/**
 * Reconciliation Types
 *
 * Types for automated transaction matching and exception handling.
 *
 * @see docs/research/nuances/15_RECONCILIATION_EDGE_CASES.md
 * @module reconciliation/types
 */

import type { Money } from '../../types/financial.js';

/**
 * Transaction source type.
 */
export type TransactionSource = 'internal' | 'bank_statement' | 'processor' | 'manual';

/**
 * Match status.
 */
export type MatchStatus =
  | 'unmatched'
  | 'matched'
  | 'partial_match'
  | 'exception'
  | 'manually_matched'
  | 'written_off';

/**
 * Exception type.
 */
export type ExceptionType =
  | 'amount_mismatch'
  | 'date_mismatch'
  | 'duplicate_suspected'
  | 'missing_counterpart'
  | 'reference_mismatch'
  | 'currency_mismatch'
  | 'timing_difference'
  | 'partial_payment'
  | 'overpayment'
  | 'underpayment';

/**
 * Exception priority.
 */
export type ExceptionPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Match strategy.
 */
export type MatchStrategy =
  | 'one_to_one'
  | 'one_to_many'
  | 'many_to_one'
  | 'many_to_many';

/**
 * Match criteria type.
 */
export type MatchCriteriaType =
  | 'exact'
  | 'contains'
  | 'pattern'
  | 'fuzzy'
  | 'within_tolerance';

/**
 * Tolerance unit.
 */
export type ToleranceUnit = 'absolute' | 'percentage' | 'days';

/**
 * Resolution type for exceptions.
 */
export type ResolutionType =
  | 'auto_matched'
  | 'manual_match'
  | 'adjustment'
  | 'write_off'
  | 'split'
  | 'merge';

/**
 * Transaction item for reconciliation.
 */
export interface ReconciliationItem {
  readonly id: string;
  readonly accountId: string;
  readonly source: TransactionSource;
  readonly transactionDate: Date;
  readonly valueDate: Date;
  readonly amount: Money;
  readonly direction: 'debit' | 'credit';
  readonly reference: string;
  readonly description: string;
  readonly counterpartyName?: string | undefined;
  readonly counterpartyAccount?: string | undefined;
  readonly externalId?: string | undefined;
  readonly metadata: Record<string, unknown>;
}

/**
 * Match criteria for a rule.
 */
export interface MatchCriteria {
  readonly field: string;
  readonly matchType: MatchCriteriaType;
  readonly toleranceValue?: number | undefined;
  readonly toleranceUnit?: ToleranceUnit | undefined;
  readonly caseSensitive?: boolean | undefined;
  readonly weight?: number | undefined;
}

/**
 * Tolerance specification.
 */
export interface ToleranceSpec {
  readonly amountTolerance?: {
    readonly value: number;
    readonly unit: ToleranceUnit;
  } | undefined;
  readonly dateTolerance?: {
    readonly days: number;
  } | undefined;
  readonly minimumMatchScore?: number | undefined;
}

/**
 * Match result between items.
 */
export interface MatchResult {
  readonly matchId: string;
  readonly internalItems: ReconciliationItem[];
  readonly externalItems: ReconciliationItem[];
  readonly matchScore: number;
  readonly strategy: MatchStrategy;
  readonly matchedFields: string[];
  readonly discrepancies: MatchDiscrepancy[];
  readonly autoReconciled: boolean;
  readonly matchedAt: Date;
  readonly matchedBy?: string | undefined;
}

/**
 * Discrepancy in a match.
 */
export interface MatchDiscrepancy {
  readonly field: string;
  readonly internalValue: unknown;
  readonly externalValue: unknown;
  readonly difference?: number | undefined;
  readonly withinTolerance: boolean;
}

/**
 * Exception resolution.
 */
export interface ExceptionResolution {
  readonly type: ResolutionType;
  readonly resolvedAt: Date;
  readonly resolvedBy: string;
  readonly notes: string;
  readonly adjustmentAmount?: Money | undefined;
  readonly linkedMatchId?: string | undefined;
}

/**
 * Reconciliation statistics.
 */
export interface ReconciliationStats {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly totalInternalItems: number;
  readonly totalExternalItems: number;
  readonly matchedCount: number;
  readonly unmatchedInternalCount: number;
  readonly unmatchedExternalCount: number;
  readonly exceptionCount: number;
  readonly autoMatchRate: number;
  readonly totalAmount: Money;
  readonly matchedAmount: Money;
  readonly unmatchedAmount: Money;
}
