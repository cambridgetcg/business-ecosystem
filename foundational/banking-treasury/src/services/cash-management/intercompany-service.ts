/**
 * Intercompany Eliminations Service
 *
 * Calculates intercompany eliminations for consolidated cash positions.
 * This ensures accurate consolidated reporting by removing internal
 * transactions between related entities.
 *
 * @module services/cash-management/intercompany-service
 */

import type { Money } from '../../types/financial.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Represents an intercompany balance between two entities.
 */
export interface IntercompanyBalance {
  /** Entity that owes money */
  debtorEntityId: string;
  /** Entity that is owed money */
  creditorEntityId: string;
  /** Amount owed */
  amount: Money;
  /** Type of intercompany relationship */
  type: IntercompanyType;
  /** Reference to underlying transaction/agreement */
  reference?: string;
  /** Date of the balance */
  asOfDate: Date;
}

export type IntercompanyType =
  | 'loan'
  | 'trade_receivable'
  | 'trade_payable'
  | 'dividend'
  | 'management_fee'
  | 'cost_allocation'
  | 'cash_pool'
  | 'other';

/**
 * Result of intercompany elimination calculation.
 */
export interface EliminationResult {
  /** Total amount to eliminate from consolidated position */
  totalElimination: Money;
  /** Breakdown by elimination type */
  byType: Map<IntercompanyType, Money>;
  /** Individual elimination entries */
  entries: EliminationEntry[];
  /** Warnings or notes about the calculation */
  warnings: string[];
}

/**
 * Single elimination entry for audit trail.
 */
export interface EliminationEntry {
  debtorEntityId: string;
  creditorEntityId: string;
  amount: Money;
  type: IntercompanyType;
  eliminationCategory: 'receivable' | 'payable' | 'loan' | 'investment';
}

/**
 * Data source interface for intercompany balances.
 */
export interface IIntercompanyDataSource {
  getIntercompanyBalances(entityIds: string[]): Promise<IntercompanyBalance[]>;
}

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Intercompany Eliminations Service
 *
 * Provides calculation of intercompany eliminations for consolidated reporting.
 *
 * Elimination Rules:
 * 1. Intercompany loans: Eliminate loan receivable and payable
 * 2. Trade receivables/payables: Eliminate AR/AP between related entities
 * 3. Cash pooling: Eliminate notional pool balances
 * 4. Dividends: Eliminate declared but unpaid dividends
 * 5. Management fees: Eliminate fee receivables/payables
 */
export class IntercompanyService {
  private readonly dataSource: IIntercompanyDataSource;

  constructor(dataSource: IIntercompanyDataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Calculate intercompany eliminations for a set of entities.
   *
   * @param entityIds - Array of entity IDs in the consolidation group
   * @param baseCurrency - Currency for elimination totals
   * @returns Elimination result with total and breakdown
   */
  async calculateEliminations(
    entityIds: string[],
    baseCurrency: string = 'USD'
  ): Promise<EliminationResult> {
    if (entityIds.length < 2) {
      return {
        totalElimination: { amount: 0, currency: baseCurrency },
        byType: new Map(),
        entries: [],
        warnings: [],
      };
    }

    const balances = await this.dataSource.getIntercompanyBalances(entityIds);
    const warnings: string[] = [];
    const entries: EliminationEntry[] = [];
    const byType = new Map<IntercompanyType, Money>();

    let totalElimination = 0;

    // Process each intercompany balance
    for (const balance of balances) {
      // Only eliminate if both entities are in the consolidation group
      if (
        entityIds.includes(balance.debtorEntityId) &&
        entityIds.includes(balance.creditorEntityId)
      ) {
        const eliminationCategory = this.categorizeElimination(balance.type);

        // For cash position, we eliminate receivables (they inflate the consolidated position)
        // Payables don't affect cash position directly
        if (eliminationCategory === 'receivable' || eliminationCategory === 'loan') {
          totalElimination += balance.amount.amount;

          // Track by type
          const existing = byType.get(balance.type);
          byType.set(balance.type, {
            amount: (existing?.amount ?? 0) + balance.amount.amount,
            currency: baseCurrency,
          });

          entries.push({
            debtorEntityId: balance.debtorEntityId,
            creditorEntityId: balance.creditorEntityId,
            amount: balance.amount,
            type: balance.type,
            eliminationCategory,
          });
        }
      }
    }

    // Validate balanced eliminations
    const validation = this.validateEliminations(balances, entityIds);
    if (!validation.balanced) {
      warnings.push(
        `Intercompany balances are not balanced: difference of ${validation.difference.toFixed(2)}`
      );
    }

    return {
      totalElimination: { amount: totalElimination, currency: baseCurrency },
      byType,
      entries,
      warnings,
    };
  }

  /**
   * Get detailed intercompany position for reporting.
   */
  async getIntercompanyMatrix(
    entityIds: string[]
  ): Promise<Map<string, Map<string, Money>>> {
    const matrix = new Map<string, Map<string, Money>>();
    const balances = await this.dataSource.getIntercompanyBalances(entityIds);

    for (const balance of balances) {
      if (!matrix.has(balance.creditorEntityId)) {
        matrix.set(balance.creditorEntityId, new Map());
      }

      const entityBalances = matrix.get(balance.creditorEntityId)!;
      const existing = entityBalances.get(balance.debtorEntityId);

      entityBalances.set(balance.debtorEntityId, {
        amount: (existing?.amount ?? 0) + balance.amount.amount,
        currency: balance.amount.currency,
      });
    }

    return matrix;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private categorizeElimination(
    type: IntercompanyType
  ): 'receivable' | 'payable' | 'loan' | 'investment' {
    switch (type) {
      case 'trade_receivable':
      case 'management_fee':
      case 'dividend':
        return 'receivable';
      case 'trade_payable':
      case 'cost_allocation':
        return 'payable';
      case 'loan':
      case 'cash_pool':
        return 'loan';
      default:
        return 'receivable';
    }
  }

  private validateEliminations(
    balances: IntercompanyBalance[],
    entityIds: string[]
  ): { balanced: boolean; difference: number } {
    // For each pair of entities, receivables should equal payables
    const pairBalances = new Map<string, number>();

    for (const balance of balances) {
      if (
        entityIds.includes(balance.debtorEntityId) &&
        entityIds.includes(balance.creditorEntityId)
      ) {
        const key = [balance.debtorEntityId, balance.creditorEntityId].sort().join(':');
        const existing = pairBalances.get(key) ?? 0;

        // Receivables add, payables subtract
        if (
          balance.type === 'trade_receivable' ||
          balance.type === 'loan'
        ) {
          pairBalances.set(key, existing + balance.amount.amount);
        } else if (balance.type === 'trade_payable') {
          pairBalances.set(key, existing - balance.amount.amount);
        }
      }
    }

    // Sum all differences (should be zero if balanced)
    let totalDifference = 0;
    for (const diff of pairBalances.values()) {
      totalDifference += Math.abs(diff);
    }

    return {
      balanced: totalDifference < 0.01, // Allow small rounding difference
      difference: totalDifference,
    };
  }
}

// =============================================================================
// IN-MEMORY DATA SOURCE (for testing/development)
// =============================================================================

/**
 * In-memory implementation of intercompany data source.
 */
export class InMemoryIntercompanyDataSource implements IIntercompanyDataSource {
  private balances: IntercompanyBalance[] = [];

  async getIntercompanyBalances(entityIds: string[]): Promise<IntercompanyBalance[]> {
    return this.balances.filter(
      b =>
        entityIds.includes(b.debtorEntityId) ||
        entityIds.includes(b.creditorEntityId)
    );
  }

  addBalance(balance: IntercompanyBalance): void {
    this.balances.push(balance);
  }

  clear(): void {
    this.balances = [];
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create an intercompany service with default configuration.
 */
export function createIntercompanyService(
  dataSource?: IIntercompanyDataSource
): IntercompanyService {
  return new IntercompanyService(
    dataSource ?? new InMemoryIntercompanyDataSource()
  );
}
