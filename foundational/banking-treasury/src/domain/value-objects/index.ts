/**
 * Value Objects Barrel Export
 *
 * Exports all value objects used in the banking-treasury domain.
 */

// Payment Rail
export type {
  RailType,
  Corridor,
  CostStructure,
  AvailabilitySchedule,
  PaymentRail,
} from './payment-rail.js';

export {
  railSupportsCorridor,
  calculateRailCost,
  isRailAvailable,
} from './payment-rail.js';

// Cutoff Window
export type { CutoffWindow, HolidayCalendar, CutoffCheckResult } from './cutoff-window.js';

export {
  isHoliday,
  isBusinessDay,
  getCutoffDateTime,
  checkCutoff,
  getEffectiveCutoff,
  formatCutoff,
  sortCutoffsByTime,
} from './cutoff-window.js';

// Routing Decision
export type {
  RailAvailabilityStatus,
  ComplianceStatus,
  RailOption,
  UrgencyLevel,
  ScoreWeights,
  RoutingDecision,
} from './routing-decision.js';

export {
  DEFAULT_SCORE_WEIGHTS,
  calculateTotalScore,
  calculateCostScore,
  calculateSpeedScore,
  calculateRiskScore,
  selectFallbackRail,
  generateSelectionReason,
  createRoutingDecision,
} from './routing-decision.js';
