/**
 * Domain Services
 *
 * Exports all domain services.
 *
 * @module domain/services
 */

export {
  DeadlineCalculator,
  deadlineCalculator,
  US_MAINTENANCE_WINDOWS,
  US_MAINTENANCE_FEES,
  TRADEMARK_RENEWAL_PERIODS,
  US_TRADEMARK_MAINTENANCE,
  type CalculatedDeadline,
} from './deadline-calculator.service.js';

export {
  TrademarkComplianceService,
  trademarkComplianceService,
  US_TRADEMARK_FEES,
  type Section8Filing,
  type Section9Filing,
  type Section15Filing,
  type MadridDesignation,
  type MadridCountryDesignation,
  type ComplianceDeadline,
} from './trademark-compliance.service.js';

export {
  CopyrightDurationService,
  copyrightDurationService,
  type WorkType,
  type AuthorshipType,
  type CopyrightAuthor,
  type CopyrightWorkDetails,
  type DurationResult,
} from './copyright-duration.service.js';
