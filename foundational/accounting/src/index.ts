/**
 * @foundational/accounting
 *
 * Accounting domain for the business ecosystem.
 * Implements double-entry bookkeeping, chart of accounts,
 * journal entries, period management, and intercompany tracking.
 */

// Domain entities
export * from './domain/entities/index.js';

// Application services
export { AccountingService } from './application/services/index.js';

// Re-export shared contracts for convenience
export type {
  IAccountingService,
  GetAccountQuery,
  GetAccountResult,
  AccountInfo,
  GetChartOfAccountsQuery,
  GetChartOfAccountsResult,
  GetAccountBalanceQuery,
  GetAccountBalanceResult,
  GetTrialBalanceQuery,
  GetTrialBalanceResult,
  TrialBalanceEntry,
  GetJournalEntriesQuery,
  GetJournalEntriesResult,
  JournalEntryInfo,
  JournalLineInfo,
  GetPeriodStatusQuery,
  GetPeriodStatusResult,
  PeriodInfo,
  ListPeriodsQuery,
  ListPeriodsResult,
  GetIntercompanyBalanceQuery,
  GetIntercompanyBalanceResult,
  GetAllIntercompanyBalancesQuery,
  GetAllIntercompanyBalancesResult,
  IntercompanyPositionSummary,
  GetReconciliationStatusQuery,
  GetReconciliationStatusResult,
  GetIncomeStatementQuery,
  GetIncomeStatementResult,
  GetBalanceSheetQuery,
  GetBalanceSheetResult,
  FinancialStatementSection,
  FinancialStatementLineItem,
} from '@foundational/shared';
