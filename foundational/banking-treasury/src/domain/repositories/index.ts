/**
 * Repository Interfaces Barrel Export
 *
 * Domain-level repository interfaces.
 * Implementations reside in infrastructure/persistence.
 *
 * @module domain/repositories
 */

// Core entity repositories
export type {
  IBankAccountRepository,
  BankAccountQueryOptions,
  AccountCurrencySummary,
} from './bank-account.repository.js';

export type {
  IPaymentRepository,
  PaymentQueryOptions,
  PaginationOptions,
  PaginatedPayments,
  PaymentStatusSummary,
} from './payment.repository.js';

// Value object repositories
export type {
  PaymentRailRepository,
} from './payment-rail.repository.js';

export type {
  CutoffWindowRepository,
  HolidayCalendarRepository,
} from './cutoff-window.repository.js';

export type {
  RoutingDecisionRepository,
  RoutingDecisionQueryOptions,
  RoutingDecisionAnalytics,
} from './routing-decision.repository.js';
