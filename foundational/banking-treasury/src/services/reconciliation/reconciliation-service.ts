/**
 * Reconciliation Service
 *
 * Automated bank reconciliation with intelligent matching, exception handling,
 * and audit trail support. Target: 95%+ auto-match rate.
 *
 * @module services/reconciliation
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../../infrastructure/database.js';

const logger = pino({ name: 'reconciliation-service' });

/**
 * Bank statement transaction.
 */
export interface StatementTransaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  type: 'credit' | 'debit';
  balance?: number;
  metadata?: Record<string, unknown>;
}

/**
 * System transaction for matching.
 */
export interface SystemTransaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description?: string;
  reference?: string;
  type: string;
  status: string;
}

/**
 * Match result.
 */
export interface MatchResult {
  statementTxn: StatementTransaction;
  systemTxn: SystemTransaction | null;
  matchType: 'exact' | 'fuzzy' | 'rule' | 'manual' | 'unmatched';
  confidence: number; // 0-100
  matchReason?: string;
}

/**
 * Reconciliation summary.
 */
export interface ReconciliationSummary {
  reconciliationId: string;
  bankAccountId: string;
  statementDate: string;
  statementBalance: number;
  systemBalance: number;
  difference: number;
  status: 'matched' | 'unmatched' | 'pending_review';
  stats: {
    totalTransactions: number;
    exactMatches: number;
    fuzzyMatches: number;
    ruleMatches: number;
    unmatched: number;
    matchRate: number;
  };
  exceptions: ReconciliationException[];
  createdAt: Date;
}

/**
 * Reconciliation exception.
 */
export interface ReconciliationException {
  id: string;
  reconciliationId: string;
  type: 'missing_in_system' | 'missing_in_statement' | 'amount_mismatch' | 'duplicate' | 'timing';
  amount: number;
  currency: string;
  description: string;
  statementTxnId?: string;
  systemTxnId?: string;
  status: 'open' | 'investigating' | 'resolved';
  resolutionNotes?: string;
  createdAt: Date;
}

/**
 * Matching rule.
 */
interface MatchingRule {
  name: string;
  priority: number;
  match: (stmt: StatementTransaction, sys: SystemTransaction) => boolean;
  confidence: number;
}

/**
 * Reconciliation Service
 */
export class ReconciliationService {
  private readonly matchingRules: MatchingRule[] = [];

  constructor() {
    this.initializeMatchingRules();
  }

  /**
   * Initialize default matching rules.
   */
  private initializeMatchingRules(): void {
    // Rule 1: Exact amount and date match
    this.matchingRules.push({
      name: 'exact_amount_date',
      priority: 100,
      confidence: 100,
      match: (stmt, sys) =>
        Math.abs(stmt.amount) === Math.abs(parseFloat(sys.amount.toString())) &&
        stmt.date === sys.date &&
        stmt.currency === sys.currency,
    });

    // Rule 2: Exact amount, date within 2 days
    this.matchingRules.push({
      name: 'exact_amount_fuzzy_date',
      priority: 90,
      confidence: 95,
      match: (stmt, sys) => {
        const stmtDate = new Date(stmt.date);
        const sysDate = new Date(sys.date);
        const dayDiff = Math.abs(stmtDate.getTime() - sysDate.getTime()) / (1000 * 60 * 60 * 24);
        return (
          Math.abs(stmt.amount) === Math.abs(parseFloat(sys.amount.toString())) &&
          stmt.currency === sys.currency &&
          dayDiff <= 2
        );
      },
    });

    // Rule 3: Reference number match
    this.matchingRules.push({
      name: 'reference_match',
      priority: 85,
      confidence: 98,
      match: (stmt, sys) =>
        stmt.reference !== undefined &&
        sys.reference !== undefined &&
        stmt.reference === sys.reference,
    });

    // Rule 4: Amount within tolerance (0.01)
    this.matchingRules.push({
      name: 'amount_tolerance',
      priority: 70,
      confidence: 85,
      match: (stmt, sys) => {
        const diff = Math.abs(Math.abs(stmt.amount) - Math.abs(parseFloat(sys.amount.toString())));
        return diff <= 0.01 && stmt.date === sys.date && stmt.currency === sys.currency;
      },
    });

    // Rule 5: Description contains reference
    this.matchingRules.push({
      name: 'description_reference',
      priority: 60,
      confidence: 80,
      match: (stmt, sys) =>
        sys.reference !== undefined &&
        stmt.description.toUpperCase().includes(sys.reference.toUpperCase()) &&
        Math.abs(stmt.amount) === Math.abs(parseFloat(sys.amount.toString())),
    });

    // Sort by priority descending
    this.matchingRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Perform automated reconciliation.
   */
  async reconcile(
    bankAccountId: string,
    statementTransactions: StatementTransaction[],
    statementDate: string,
    statementBalance: number
  ): Promise<ReconciliationSummary> {
    const pool = await getPool();
    const reconciliationId = uuidv4();

    logger.info({
      bankAccountId,
      statementDate,
      transactionCount: statementTransactions.length,
    }, 'Starting reconciliation');

    // Get system transactions for matching
    const systemTxns = await this.getSystemTransactions(bankAccountId, statementDate);

    // Get current system balance
    const systemBalance = await this.getSystemBalance(bankAccountId);

    // Perform matching
    const matches = this.performMatching(statementTransactions, systemTxns);

    // Analyze results
    const stats = this.calculateStats(matches);

    // Identify exceptions
    const exceptions = this.identifyExceptions(matches, systemTxns);

    // Calculate difference
    const difference = statementBalance - systemBalance;
    const status = Math.abs(difference) < 0.01 ? 'matched' : 'unmatched';

    // Store reconciliation results
    await pool.query(`
      INSERT INTO banking.reconciliations (
        id, bank_account_id, statement_date, statement_balance,
        system_balance, difference, status, match_rate,
        total_transactions, exact_matches, fuzzy_matches, unmatched,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
    `, [
      reconciliationId,
      bankAccountId,
      statementDate,
      statementBalance,
      systemBalance,
      difference,
      status,
      stats.matchRate,
      stats.totalTransactions,
      stats.exactMatches,
      stats.fuzzyMatches,
      stats.unmatched,
    ]);

    // Store exceptions
    for (const exception of exceptions) {
      exception.reconciliationId = reconciliationId;
      await pool.query(`
        INSERT INTO banking.reconciliation_exceptions (
          id, reconciliation_id, type, amount, currency, description,
          statement_txn_id, system_txn_id, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', NOW())
      `, [
        exception.id,
        reconciliationId,
        exception.type,
        exception.amount,
        exception.currency,
        exception.description,
        exception.statementTxnId,
        exception.systemTxnId,
      ]);
    }

    logger.info({
      reconciliationId,
      matchRate: stats.matchRate,
      exceptionCount: exceptions.length,
      difference,
    }, 'Reconciliation completed');

    return {
      reconciliationId,
      bankAccountId,
      statementDate,
      statementBalance,
      systemBalance,
      difference,
      status: Math.abs(difference) < 0.01 && stats.unmatched === 0 ? 'matched' : 'pending_review',
      stats,
      exceptions,
      createdAt: new Date(),
    };
  }

  /**
   * Get system transactions for a period.
   */
  private async getSystemTransactions(
    bankAccountId: string,
    statementDate: string
  ): Promise<SystemTransaction[]> {
    const pool = await getPool();

    // Get transactions from 5 days before to statement date
    const startDate = new Date(statementDate);
    startDate.setDate(startDate.getDate() - 5);

    const result = await pool.query(`
      SELECT
        t.id,
        t.created_at::date as date,
        t.amount_value as amount,
        t.amount_currency as currency,
        t.description,
        t.external_id as reference,
        t.type,
        t.status
      FROM banking.transactions t
      WHERE (t.source_account_id = $1 OR t.destination_account_id = $1)
        AND t.created_at::date >= $2
        AND t.created_at::date <= $3
        AND t.status IN ('completed', 'posted')
      ORDER BY t.created_at
    `, [bankAccountId, startDate.toISOString().split('T')[0], statementDate]);

    return result.rows.map(row => ({
      id: row.id,
      date: row.date.toISOString().split('T')[0],
      amount: parseFloat(row.amount),
      currency: row.currency,
      description: row.description,
      reference: row.reference,
      type: row.type,
      status: row.status,
    }));
  }

  /**
   * Get current system balance for an account.
   */
  private async getSystemBalance(bankAccountId: string): Promise<number> {
    const pool = await getPool();

    const result = await pool.query(`
      SELECT balance_amount FROM banking.bank_accounts
      WHERE id = $1 AND deleted_at IS NULL
    `, [bankAccountId]);

    return result.rows.length > 0 ? parseFloat(result.rows[0].balance_amount) : 0;
  }

  /**
   * Perform matching using rules.
   */
  private performMatching(
    statementTxns: StatementTransaction[],
    systemTxns: SystemTransaction[]
  ): MatchResult[] {
    const results: MatchResult[] = [];
    const matchedSystemTxnIds = new Set<string>();

    for (const stmtTxn of statementTxns) {
      let bestMatch: MatchResult | null = null;

      // Try each rule in priority order
      for (const rule of this.matchingRules) {
        for (const sysTxn of systemTxns) {
          // Skip already matched transactions
          if (matchedSystemTxnIds.has(sysTxn.id)) continue;

          if (rule.match(stmtTxn, sysTxn)) {
            const matchType = rule.confidence === 100 ? 'exact' : 'fuzzy';
            if (!bestMatch || rule.confidence > bestMatch.confidence) {
              bestMatch = {
                statementTxn: stmtTxn,
                systemTxn: sysTxn,
                matchType,
                confidence: rule.confidence,
                matchReason: rule.name,
              };
            }
            break; // Found a match with this rule, try next rule for better match
          }
        }

        // If we found an exact match, don't try lower priority rules
        if (bestMatch && bestMatch.confidence === 100) break;
      }

      if (bestMatch && bestMatch.systemTxn) {
        matchedSystemTxnIds.add(bestMatch.systemTxn.id);
        results.push(bestMatch);
      } else {
        results.push({
          statementTxn: stmtTxn,
          systemTxn: null,
          matchType: 'unmatched',
          confidence: 0,
        });
      }
    }

    return results;
  }

  /**
   * Calculate matching statistics.
   */
  private calculateStats(matches: MatchResult[]): ReconciliationSummary['stats'] {
    const total = matches.length;
    const exact = matches.filter(m => m.matchType === 'exact').length;
    const fuzzy = matches.filter(m => m.matchType === 'fuzzy').length;
    const rule = matches.filter(m => m.matchType === 'rule').length;
    const unmatched = matches.filter(m => m.matchType === 'unmatched').length;

    return {
      totalTransactions: total,
      exactMatches: exact,
      fuzzyMatches: fuzzy,
      ruleMatches: rule,
      unmatched,
      matchRate: total > 0 ? ((total - unmatched) / total) * 100 : 100,
    };
  }

  /**
   * Identify exceptions from matching results.
   */
  private identifyExceptions(
    matches: MatchResult[],
    systemTxns: SystemTransaction[]
  ): ReconciliationException[] {
    const exceptions: ReconciliationException[] = [];
    const matchedSystemIds = new Set(
      matches
        .filter(m => m.systemTxn)
        .map(m => m.systemTxn!.id)
    );

    // Unmatched statement transactions
    for (const match of matches) {
      if (match.matchType === 'unmatched') {
        exceptions.push({
          id: uuidv4(),
          reconciliationId: '',
          type: 'missing_in_system',
          amount: match.statementTxn.amount,
          currency: match.statementTxn.currency,
          description: `Statement transaction not found in system: ${match.statementTxn.description}`,
          statementTxnId: match.statementTxn.id,
          status: 'open',
          createdAt: new Date(),
        });
      }
    }

    // System transactions not in statement
    for (const sysTxn of systemTxns) {
      if (!matchedSystemIds.has(sysTxn.id)) {
        exceptions.push({
          id: uuidv4(),
          reconciliationId: '',
          type: 'missing_in_statement',
          amount: sysTxn.amount,
          currency: sysTxn.currency,
          description: `System transaction not in statement: ${sysTxn.description || sysTxn.reference || sysTxn.id}`,
          systemTxnId: sysTxn.id,
          status: 'open',
          createdAt: new Date(),
        });
      }
    }

    return exceptions;
  }

  /**
   * Resolve an exception.
   */
  async resolveException(
    exceptionId: string,
    resolution: {
      action: 'match' | 'ignore' | 'adjust' | 'investigate';
      notes: string;
      resolvedBy?: string;
      matchedSystemTxnId?: string;
    }
  ): Promise<void> {
    const pool = await getPool();

    await pool.query(`
      UPDATE banking.reconciliation_exceptions
      SET status = 'resolved',
          resolution_notes = $1,
          resolved_by = $2,
          resolved_at = NOW(),
          matched_system_txn_id = $3
      WHERE id = $4
    `, [resolution.notes, resolution.resolvedBy, resolution.matchedSystemTxnId, exceptionId]);

    logger.info({ exceptionId, action: resolution.action }, 'Exception resolved');
  }

  /**
   * Get reconciliation history for an account.
   */
  async getHistory(
    bankAccountId: string,
    limit = 30
  ): Promise<ReconciliationSummary[]> {
    const pool = await getPool();

    const result = await pool.query(`
      SELECT
        r.*,
        (SELECT json_agg(e.*)
         FROM banking.reconciliation_exceptions e
         WHERE e.reconciliation_id = r.id) as exceptions
      FROM banking.reconciliations r
      WHERE r.bank_account_id = $1
      ORDER BY r.statement_date DESC
      LIMIT $2
    `, [bankAccountId, limit]);

    return result.rows.map(row => ({
      reconciliationId: row.id,
      bankAccountId: row.bank_account_id,
      statementDate: row.statement_date.toISOString().split('T')[0],
      statementBalance: parseFloat(row.statement_balance),
      systemBalance: parseFloat(row.system_balance),
      difference: parseFloat(row.difference),
      status: row.status,
      stats: {
        totalTransactions: row.total_transactions || 0,
        exactMatches: row.exact_matches || 0,
        fuzzyMatches: row.fuzzy_matches || 0,
        ruleMatches: 0,
        unmatched: row.unmatched || 0,
        matchRate: row.match_rate || 0,
      },
      exceptions: (row.exceptions || []).map((e: Record<string, unknown>) => ({
        id: e.id,
        reconciliationId: e.reconciliation_id,
        type: e.type,
        amount: parseFloat(e.amount as string),
        currency: e.currency,
        description: e.description,
        status: e.status,
        createdAt: new Date(e.created_at as string),
      })),
      createdAt: new Date(row.created_at),
    }));
  }
}

// Singleton instance
export const reconciliationService = new ReconciliationService();
