/**
 * Plaid Bank Integration Service
 *
 * Provides integration with Plaid for:
 * - Account linking and verification
 * - Balance synchronization
 * - Transaction ingestion
 * - Identity verification
 *
 * @module services/bank-integration/plaid-service
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../infrastructure/database.js';

const logger = pino({ name: 'plaid-service' });

/**
 * Plaid configuration from environment.
 */
interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: 'sandbox' | 'development' | 'production';
  webhookUrl?: string;
}

/**
 * Plaid link token request.
 */
interface LinkTokenRequest {
  entityId: string;
  userId: string;
  clientName: string;
  products: PlaidProduct[];
  countryCodes: string[];
  language?: string;
  redirectUri?: string;
}

/**
 * Plaid products.
 */
type PlaidProduct = 'auth' | 'transactions' | 'identity' | 'assets' | 'liabilities' | 'investments';

/**
 * Plaid account.
 */
interface PlaidAccount {
  accountId: string;
  mask: string;
  name: string;
  officialName?: string;
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype?: string;
  balances: {
    available: number | null;
    current: number;
    limit?: number | null;
    isoCurrencyCode: string;
  };
}

/**
 * Plaid transaction.
 */
interface PlaidTransaction {
  transactionId: string;
  accountId: string;
  amount: number;
  isoCurrencyCode: string;
  date: string;
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
  paymentChannel: string;
}

/**
 * Link session result.
 */
interface LinkSession {
  linkToken: string;
  expiration: string;
  requestId: string;
}

/**
 * Access token exchange result.
 */
interface AccessTokenResult {
  accessToken: string;
  itemId: string;
  requestId: string;
}

/**
 * Plaid Service
 *
 * Note: This implementation uses mock responses for development.
 * In production, replace with actual Plaid API calls.
 */
export class PlaidService {
  private readonly config: PlaidConfig;

  constructor(config?: Partial<PlaidConfig>) {
    this.config = {
      clientId: process.env.PLAID_CLIENT_ID || 'sandbox_client_id',
      secret: process.env.PLAID_SECRET || 'sandbox_secret',
      environment: (process.env.PLAID_ENV as PlaidConfig['environment']) || 'sandbox',
      webhookUrl: process.env.PLAID_WEBHOOK_URL,
      ...config,
    };
  }

  /**
   * Create a link token for Plaid Link initialization.
   */
  async createLinkToken(request: LinkTokenRequest): Promise<LinkSession> {
    logger.info({ entityId: request.entityId, products: request.products }, 'Creating Plaid link token');

    // In production, this would call Plaid's /link/token/create endpoint
    // For now, return a mock token for development
    const linkToken = `link-sandbox-${uuidv4()}`;
    const expiration = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours

    // Store the link session
    const pool = await getPool();
    await pool.query(`
      INSERT INTO banking.bank_connections (
        id, entity_id, provider, status, link_token, link_expiration, created_at, updated_at
      ) VALUES ($1, $2, 'plaid', 'pending_link', $3, $4, NOW(), NOW())
    `, [uuidv4(), request.entityId, linkToken, expiration]);

    return {
      linkToken,
      expiration,
      requestId: uuidv4(),
    };
  }

  /**
   * Exchange a public token for an access token after successful Link flow.
   */
  async exchangePublicToken(publicToken: string, entityId: string): Promise<AccessTokenResult> {
    logger.info({ entityId }, 'Exchanging Plaid public token');

    // In production, this would call Plaid's /item/public_token/exchange endpoint
    const accessToken = `access-sandbox-${uuidv4()}`;
    const itemId = `item-sandbox-${uuidv4()}`;

    // Update the bank connection with the access token
    const pool = await getPool();
    await pool.query(`
      UPDATE banking.bank_connections
      SET access_token = $1, item_id = $2, status = 'connected', updated_at = NOW()
      WHERE entity_id = $3 AND provider = 'plaid' AND status = 'pending_link'
    `, [accessToken, itemId, entityId]);

    logger.info({ entityId, itemId }, 'Plaid access token exchanged successfully');

    return {
      accessToken,
      itemId,
      requestId: uuidv4(),
    };
  }

  /**
   * Get accounts from a linked institution.
   */
  async getAccounts(accessToken: string): Promise<PlaidAccount[]> {
    logger.info('Fetching Plaid accounts');

    // In production, this would call Plaid's /accounts/get endpoint
    // Return mock accounts for development
    return [
      {
        accountId: `account-sandbox-${uuidv4()}`,
        mask: '1234',
        name: 'Checking Account',
        officialName: 'PLAID CHECKING',
        type: 'depository',
        subtype: 'checking',
        balances: {
          available: 100000.00,
          current: 100500.00,
          isoCurrencyCode: 'USD',
        },
      },
      {
        accountId: `account-sandbox-${uuidv4()}`,
        mask: '5678',
        name: 'Savings Account',
        officialName: 'PLAID SAVINGS',
        type: 'depository',
        subtype: 'savings',
        balances: {
          available: 250000.00,
          current: 250000.00,
          isoCurrencyCode: 'USD',
        },
      },
    ];
  }

  /**
   * Sync account balances from Plaid.
   */
  async syncBalances(accessToken: string, entityId: string): Promise<{ synced: number; updated: Date }> {
    logger.info({ entityId }, 'Syncing balances from Plaid');

    const accounts = await this.getAccounts(accessToken);
    const pool = await getPool();

    let syncedCount = 0;

    for (const account of accounts) {
      // Update or insert the bank account
      await pool.query(`
        INSERT INTO banking.bank_accounts (
          id, entity_id, account_name, account_type, currency,
          balance_amount, balance_currency, external_account_id, bank_name, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $5, $7, 'Plaid Connected Bank', 'active', NOW(), NOW())
        ON CONFLICT (entity_id, external_account_id) DO UPDATE SET
          balance_amount = $6,
          updated_at = NOW()
      `, [
        uuidv4(),
        entityId,
        account.name,
        account.type,
        account.balances.isoCurrencyCode,
        account.balances.current,
        account.accountId,
      ]);

      syncedCount++;
    }

    logger.info({ entityId, syncedCount }, 'Balance sync completed');

    return {
      synced: syncedCount,
      updated: new Date(),
    };
  }

  /**
   * Get transactions for a date range.
   */
  async getTransactions(
    accessToken: string,
    startDate: string,
    endDate: string
  ): Promise<PlaidTransaction[]> {
    logger.info({ startDate, endDate }, 'Fetching Plaid transactions');

    // In production, this would call Plaid's /transactions/get endpoint
    // Return mock transactions for development
    return [
      {
        transactionId: `txn-sandbox-${uuidv4()}`,
        accountId: `account-sandbox-${uuidv4()}`,
        amount: -500.00,
        isoCurrencyCode: 'USD',
        date: new Date().toISOString().split('T')[0],
        name: 'AMAZON.COM',
        merchantName: 'Amazon',
        category: ['Shops', 'Computers and Electronics'],
        pending: false,
        paymentChannel: 'online',
      },
      {
        transactionId: `txn-sandbox-${uuidv4()}`,
        accountId: `account-sandbox-${uuidv4()}`,
        amount: 2500.00,
        isoCurrencyCode: 'USD',
        date: new Date().toISOString().split('T')[0],
        name: 'PAYROLL DEPOSIT',
        category: ['Transfer', 'Payroll'],
        pending: false,
        paymentChannel: 'other',
      },
    ];
  }

  /**
   * Ingest transactions into the system.
   */
  async ingestTransactions(
    accessToken: string,
    entityId: string,
    startDate: string,
    endDate: string
  ): Promise<{ ingested: number; duplicates: number }> {
    logger.info({ entityId, startDate, endDate }, 'Ingesting transactions from Plaid');

    const transactions = await this.getTransactions(accessToken, startDate, endDate);
    const pool = await getPool();

    let ingested = 0;
    let duplicates = 0;

    for (const txn of transactions) {
      try {
        await pool.query(`
          INSERT INTO banking.transactions (
            id, entity_id, type, status, amount_value, amount_currency,
            description, external_id, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [
          uuidv4(),
          entityId,
          txn.amount > 0 ? 'credit' : 'debit',
          txn.pending ? 'pending' : 'completed',
          Math.abs(txn.amount),
          txn.isoCurrencyCode,
          txn.name,
          txn.transactionId,
          JSON.stringify({
            merchantName: txn.merchantName,
            category: txn.category,
            paymentChannel: txn.paymentChannel,
            plaidDate: txn.date,
          }),
        ]);
        ingested++;
      } catch (error) {
        // Check for duplicate key violation
        if ((error as { code?: string }).code === '23505') {
          duplicates++;
        } else {
          throw error;
        }
      }
    }

    logger.info({ entityId, ingested, duplicates }, 'Transaction ingestion completed');

    return { ingested, duplicates };
  }

  /**
   * Handle Plaid webhook events.
   */
  async handleWebhook(webhookType: string, webhookCode: string, itemId: string, payload: unknown): Promise<void> {
    logger.info({ webhookType, webhookCode, itemId }, 'Processing Plaid webhook');

    const pool = await getPool();

    // Find the connection for this item
    const result = await pool.query(`
      SELECT id, entity_id, access_token FROM banking.bank_connections
      WHERE item_id = $1 AND provider = 'plaid'
    `, [itemId]);

    if (result.rows.length === 0) {
      logger.warn({ itemId }, 'No connection found for Plaid item');
      return;
    }

    const { entity_id: entityId, access_token: accessToken } = result.rows[0];

    switch (webhookType) {
      case 'TRANSACTIONS':
        if (webhookCode === 'SYNC_UPDATES_AVAILABLE') {
          // New transactions available, trigger sync
          const today = new Date().toISOString().split('T')[0];
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          await this.ingestTransactions(accessToken, entityId, thirtyDaysAgo, today);
        }
        break;

      case 'ITEM':
        if (webhookCode === 'ERROR') {
          // Item needs attention (e.g., re-authentication)
          await pool.query(`
            UPDATE banking.bank_connections
            SET status = 'error', error_message = $1, updated_at = NOW()
            WHERE item_id = $2
          `, [JSON.stringify(payload), itemId]);
          logger.warn({ itemId, payload }, 'Plaid item error');
        }
        break;

      case 'HOLDINGS':
      case 'INVESTMENTS_TRANSACTIONS':
        // Handle investment updates if needed
        break;

      default:
        logger.debug({ webhookType, webhookCode }, 'Unhandled Plaid webhook type');
    }
  }

  /**
   * Remove a linked item (disconnect bank).
   */
  async removeItem(accessToken: string, itemId: string): Promise<void> {
    logger.info({ itemId }, 'Removing Plaid item');

    // In production, this would call Plaid's /item/remove endpoint

    const pool = await getPool();
    await pool.query(`
      UPDATE banking.bank_connections
      SET status = 'disconnected', access_token = NULL, updated_at = NOW()
      WHERE item_id = $1
    `, [itemId]);

    logger.info({ itemId }, 'Plaid item removed');
  }

  /**
   * Get institution details.
   */
  async getInstitution(institutionId: string): Promise<{
    institutionId: string;
    name: string;
    logo?: string;
    primaryColor?: string;
    url?: string;
  }> {
    // In production, this would call Plaid's /institutions/get_by_id endpoint
    return {
      institutionId,
      name: 'Sample Bank',
      primaryColor: '#0052cc',
      url: 'https://example.com',
    };
  }
}

// Singleton instance
export const plaidService = new PlaidService();
