/**
 * Reconciliation Domain
 *
 * Transaction matching and exception handling.
 *
 * @module reconciliation
 */

// Types
export type {
  TransactionSource,
  MatchStatus,
  ExceptionType,
  ExceptionPriority,
  MatchStrategy,
  MatchCriteriaType,
  ToleranceUnit,
  ResolutionType,
  ReconciliationItem,
  MatchCriteria,
  ToleranceSpec,
  MatchResult,
  MatchDiscrepancy,
  ExceptionResolution,
  ReconciliationStats,
} from './types.js';

// Value Objects
export {
  ReconciliationRule,
  DEFAULT_RECONCILIATION_RULES,
} from './value-objects/reconciliation-rule.js';
export type { ReconciliationRuleProps } from './value-objects/reconciliation-rule.js';

// Entities
export { ReconciliationException } from './entities/reconciliation-exception.js';
export type { ReconciliationExceptionProps } from './entities/reconciliation-exception.js';
