// Entity Governance Contracts
export {
  // Entity queries
  type GetEntityReferenceQuery,
  type GetEntityReferenceResult,
  type GetEntityJurisdictionContextQuery,
  type GetEntityJurisdictionContextResult,
  type GetEntityWithTaxIdsQuery,
  type GetEntityWithTaxIdsResult,
  type ListEntitiesByStatusQuery,
  type ListEntitiesByStatusResult,
  type ListEntitiesByTypeQuery,
  type ListEntitiesByTypeResult,

  // Ownership queries
  type GetOwnershipRelationshipsQuery,
  type GetOwnershipRelationshipsResult,
  type GetEntityHierarchyQuery,
  type GetEntityHierarchyResult,
  type CheckEntityControlQuery,
  type CheckEntityControlResult,

  // Cap table queries
  type GetCapTableSummaryQuery,
  type GetCapTableSummaryResult,
  type ShareClassSummary,

  // Governance queries
  type GetOfficersAndDirectorsQuery,
  type GetOfficersAndDirectorsResult,
  type OfficerRecord,
  type DirectorRecord,
  type GetBeneficialOwnersQuery,
  type GetBeneficialOwnersResult,
  type BeneficialOwnerRecord,

  // Veil protection
  type GetVeilProtectionStatusQuery,
  type GetVeilProtectionStatusResult,

  // Service interface
  type IEntityGovernanceService,
} from './entity-governance-contracts.js';

// Accounting Contracts
export {
  // Account queries
  type GetAccountQuery,
  type GetAccountResult,
  type AccountInfo,
  type GetChartOfAccountsQuery,
  type GetChartOfAccountsResult,

  // Balance queries
  type GetAccountBalanceQuery,
  type GetAccountBalanceResult,
  type GetTrialBalanceQuery,
  type GetTrialBalanceResult,
  type TrialBalanceEntry,

  // Journal entry queries
  type GetJournalEntriesQuery,
  type GetJournalEntriesResult,
  type JournalEntryInfo,
  type JournalLineInfo,

  // Period queries
  type GetPeriodStatusQuery,
  type GetPeriodStatusResult,
  type PeriodInfo,
  type ListPeriodsQuery,
  type ListPeriodsResult,

  // Intercompany queries
  type GetIntercompanyBalanceQuery,
  type GetIntercompanyBalanceResult,
  type GetAllIntercompanyBalancesQuery,
  type GetAllIntercompanyBalancesResult,
  type IntercompanyPositionSummary,

  // Reconciliation queries
  type GetReconciliationStatusQuery,
  type GetReconciliationStatusResult,

  // Financial statement queries
  type GetIncomeStatementQuery,
  type GetIncomeStatementResult,
  type GetBalanceSheetQuery,
  type GetBalanceSheetResult,
  type FinancialStatementSection,
  type FinancialStatementLineItem,

  // Service interface
  type IAccountingService,
} from './accounting-contracts.js';

// Banking-Treasury Contracts
export {
  // Bank account queries
  type GetBankAccountQuery,
  type GetBankAccountResult,
  type BankAccountInfo,
  type ListBankAccountsQuery,
  type ListBankAccountsResult,
  type GetBankAccountsByGLQuery,
  type GetBankAccountsByGLResult,

  // Cash position queries
  type GetCashPositionQuery,
  type GetCashPositionResult,
  type CashPositionDetail,
  type CurrencyTotal,
  type GetConsolidatedCashPositionQuery,
  type GetConsolidatedCashPositionResult,
  type EntityCashSummary,

  // Payment queries
  type GetPaymentQuery,
  type GetPaymentResult,
  type PaymentInfo,
  type PaymentCounterparty,
  type ListPaymentsQuery,
  type ListPaymentsResult,
  type GetPendingPaymentsQuery,
  type GetPendingPaymentsResult,
  type PendingPaymentSummary,

  // Cash pool queries
  type GetCashPoolQuery,
  type GetCashPoolResult,
  type CashPoolInfo,
  type GetCashPoolPositionsQuery,
  type GetCashPoolPositionsResult,
  type ParticipantPoolPosition,

  // Bank statement queries
  type GetBankStatementQuery,
  type GetBankStatementResult,
  type BankStatementInfo,
  type GetUnreconciledTransactionsQuery,
  type GetUnreconciledTransactionsResult,
  type BankTransactionInfo,

  // De-risking queries
  type GetDeRiskingStatusQuery,
  type GetDeRiskingStatusResult,
  type DeRiskingAlertSummary,

  // BaaS queries
  type GetBaaSProviderStatusQuery,
  type GetBaaSProviderStatusResult,
  type BaaSProviderInfo,

  // Service interface
  type IBankingTreasuryService,
} from './banking-treasury-contracts.js';
