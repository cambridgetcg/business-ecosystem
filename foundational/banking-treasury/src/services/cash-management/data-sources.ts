/**
 * Cash Management Data Source Adapters
 *
 * Implementations of data source interfaces for the CashPositionService.
 *
 * @module services/cash-management/data-sources
 */

import { getPool } from '../../infrastructure/database.js';
import { cacheService } from '../../infrastructure/cache/cache-service.js';
import type {
  IAccountDataSource,
  IFXRateSource,
  ICashFlowSource,
} from './cash-position-service.js';
import type {
  AccountBalance,
  FXRateSnapshot,
  ScheduledCashFlow,
  ProjectionHorizon,
  CashFlowCategory,
} from './types.js';

/**
 * Database-backed account data source with cache layer.
 */
export class DatabaseAccountDataSource implements IAccountDataSource {
  async getAccountBalance(accountId: string): Promise<AccountBalance> {
    // Try cache first
    const cached = await cacheService.get<AccountBalance>(`account-balance:${accountId}`);
    if (cached) {
      return cached;
    }

    const pool = await getPool();
    const result = await pool.query(`
      SELECT
        ba.id,
        ba.account_name,
        ba.bank_id,
        b.name as bank_name,
        ba.currency,
        ba.balance_amount,
        ba.updated_at,
        COALESCE(pending.credits, 0) as pending_credits,
        COALESCE(pending.debits, 0) as pending_debits
      FROM banking.bank_accounts ba
      LEFT JOIN banking.banks b ON ba.bank_id = b.id
      LEFT JOIN (
        SELECT
          COALESCE(destination_account_id, source_account_id) as account_id,
          SUM(CASE WHEN destination_account_id = ba.id THEN amount_value ELSE 0 END) as credits,
          SUM(CASE WHEN source_account_id = ba.id THEN amount_value ELSE 0 END) as debits
        FROM banking.transactions
        WHERE status IN ('pending', 'processing')
        GROUP BY COALESCE(destination_account_id, source_account_id)
      ) pending ON pending.account_id = ba.id
      WHERE ba.id = $1 AND ba.deleted_at IS NULL
    `, [accountId]);

    if (result.rows.length === 0) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const row = result.rows[0];
    const balance: AccountBalance = {
      accountId: row.id,
      accountName: row.account_name,
      bankId: row.bank_id,
      bankName: row.bank_name || 'Unknown Bank',
      ledgerBalance: {
        amount: parseFloat(row.balance_amount),
        currency: row.currency,
      },
      availableBalance: {
        amount: parseFloat(row.balance_amount) - parseFloat(row.pending_debits),
        currency: row.currency,
      },
      pendingCredits: {
        amount: parseFloat(row.pending_credits),
        currency: row.currency,
      },
      pendingDebits: {
        amount: parseFloat(row.pending_debits),
        currency: row.currency,
      },
      lastUpdated: new Date(row.updated_at),
    };

    // Cache for 30 seconds
    await cacheService.set(`account-balance:${accountId}`, balance, 30);

    return balance;
  }

  async getAccountsByEntity(entityId: string): Promise<string[]> {
    // Try cache first
    const cached = await cacheService.get<string[]>(`entity-accounts:${entityId}`);
    if (cached) {
      return cached;
    }

    const pool = await getPool();
    const result = await pool.query(`
      SELECT id FROM banking.bank_accounts
      WHERE entity_id = $1 AND status = 'active' AND deleted_at IS NULL
    `, [entityId]);

    const accountIds = result.rows.map(row => row.id);

    // Cache for 60 seconds
    await cacheService.set(`entity-accounts:${entityId}`, accountIds, 60);

    return accountIds;
  }
}

/**
 * FX rate source with cache layer.
 * Uses database rates or falls back to default rates.
 */
export class DatabaseFXRateSource implements IFXRateSource {
  private readonly defaultRates: Map<string, number> = new Map([
    ['EUR/USD', 1.08],
    ['GBP/USD', 1.26],
    ['USD/EUR', 0.93],
    ['USD/GBP', 0.79],
    ['EUR/GBP', 0.86],
    ['GBP/EUR', 1.16],
  ]);

  async getRate(baseCurrency: string, quoteCurrency: string): Promise<FXRateSnapshot> {
    if (baseCurrency === quoteCurrency) {
      return {
        currencyPair: `${baseCurrency}/${quoteCurrency}`,
        rate: 1.0,
        source: 'identity',
        timestamp: new Date(),
      };
    }

    const pair = `${baseCurrency}/${quoteCurrency}`;

    // Try cache first
    const cached = await cacheService.get<FXRateSnapshot>(`fx-rate:${pair}`);
    if (cached) {
      return cached;
    }

    // Try database
    const pool = await getPool();
    const result = await pool.query(`
      SELECT rate, source, updated_at
      FROM banking.fx_rates
      WHERE base_currency = $1 AND quote_currency = $2
        AND updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC
      LIMIT 1
    `, [baseCurrency, quoteCurrency]);

    let rate: FXRateSnapshot;

    if (result.rows.length > 0) {
      const row = result.rows[0];
      rate = {
        currencyPair: pair,
        rate: parseFloat(row.rate),
        source: row.source,
        timestamp: new Date(row.updated_at),
      };
    } else {
      // Fallback to default rates
      const defaultRate = this.defaultRates.get(pair);
      if (defaultRate) {
        rate = {
          currencyPair: pair,
          rate: defaultRate,
          source: 'default',
          timestamp: new Date(),
        };
      } else {
        // Try inverse
        const inversePair = `${quoteCurrency}/${baseCurrency}`;
        const inverseRate = this.defaultRates.get(inversePair);
        if (inverseRate) {
          rate = {
            currencyPair: pair,
            rate: 1 / inverseRate,
            source: 'default_inverse',
            timestamp: new Date(),
          };
        } else {
          throw new Error(`No FX rate available for ${pair}`);
        }
      }
    }

    // Cache for 5 minutes
    await cacheService.set(`fx-rate:${pair}`, rate, 300);

    return rate;
  }
}

/**
 * Cash flow source for projections.
 */
export class DatabaseCashFlowSource implements ICashFlowSource {
  async getScheduledFlows(entityId: string, horizon: ProjectionHorizon): Promise<ScheduledCashFlow[]> {
    const pool = await getPool();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + horizon.days);

    // Get scheduled payments (outflows)
    const paymentsResult = await pool.query(`
      SELECT
        p.id,
        p.amount_value,
        p.amount_currency,
        COALESCE(p.metadata->>'scheduled_date', p.created_at::text) as expected_date,
        p.status,
        'vendor_payments' as category
      FROM banking.payments p
      WHERE p.status IN ('pending', 'pending_approval', 'approved')
        AND p.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM banking.bank_accounts ba
          WHERE ba.id::text = p.metadata->>'source_account_id'
            AND ba.entity_id = $1
        )
        AND p.created_at <= $2
    `, [entityId, endDate]);

    // Get expected receivables (inflows) from invoices
    const receivablesResult = await pool.query(`
      SELECT
        id,
        amount_value,
        amount_currency,
        due_date as expected_date,
        status,
        'customer_receipts' as category
      FROM banking.receivables
      WHERE entity_id = $1
        AND status IN ('open', 'partial')
        AND due_date <= $2
        AND deleted_at IS NULL
    `, [entityId, endDate]);

    const flows: ScheduledCashFlow[] = [];

    // Process payments (outflows)
    for (const row of paymentsResult.rows) {
      flows.push({
        id: row.id,
        type: 'outflow',
        category: row.category as CashFlowCategory,
        amount: {
          amount: parseFloat(row.amount_value),
          currency: row.amount_currency,
        },
        expectedDate: new Date(row.expected_date),
        certainty: row.status === 'approved' ? 'committed' : 'expected',
        sourceSystem: 'payments',
        reference: row.id,
      });
    }

    // Process receivables (inflows)
    for (const row of receivablesResult.rows) {
      flows.push({
        id: row.id,
        type: 'inflow',
        category: row.category as CashFlowCategory,
        amount: {
          amount: parseFloat(row.amount_value),
          currency: row.amount_currency,
        },
        expectedDate: new Date(row.expected_date),
        certainty: 'expected',
        sourceSystem: 'receivables',
        reference: row.id,
      });
    }

    return flows;
  }
}

/**
 * Create a fully-configured CashPositionService instance.
 */
export function createCashPositionService() {
  const { CashPositionService } = require('./cash-position-service.js');
  return new CashPositionService(
    new DatabaseAccountDataSource(),
    new DatabaseFXRateSource(),
    new DatabaseCashFlowSource()
  );
}
