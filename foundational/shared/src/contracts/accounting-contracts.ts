import {
  Money,
  CurrencyCode,
  EntityReference,
} from '../value-objects/index.js';

/**
 * Accounting Query Contracts
 *
 * These interfaces define what other domains can query from Accounting.
 * Accounting is the single source of truth for financial records and GL data.
 */

// ============================================================
// Account Queries
// ============================================================

/**
 * Get account by ID
 * Used by: Banking (for reconciliation), Tax (for basis calculation)
 */
export interface GetAccountQuery {
  accountId: string;
  entityId: string;
}

export interface GetAccountResult {
  account: AccountInfo | null;
}

export interface AccountInfo {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  normalBalance: 'debit' | 'credit';
  currency: CurrencyCode;
  isActive: boolean;
  parentAccountId?: string;
}

/**
 * Get chart of accounts for an entity
 * Used by: Reporting, Tax
 */
export interface GetChartOfAccountsQuery {
  entityId: string;
  accountTypes?: ('asset' | 'liability' | 'equity' | 'revenue' | 'expense')[];
  activeOnly?: boolean;
}

export interface GetChartOfAccountsResult {
  accounts: AccountInfo[];
  total: number;
}

// ============================================================
// Balance Queries
// ============================================================

/**
 * Get account balance at a point in time
 * Used by: Banking (for reconciliation), Tax (for basis)
 */
export interface GetAccountBalanceQuery {
  accountId: string;
  entityId: string;
  asOfDate: string; // ISO date
}

export interface GetAccountBalanceResult {
  accountId: string;
  balance: Money;
  asOfDate: string;
  lastActivityDate?: string;
}

/**
 * Get trial balance for an entity
 * Used by: Reporting, Tax, Compliance
 */
export interface GetTrialBalanceQuery {
  entityId: string;
  asOfDate: string; // ISO date
  periodId?: string;
}

export interface GetTrialBalanceResult {
  entityId: string;
  asOfDate: string;
  periodId?: string;
  balances: TrialBalanceEntry[];
  totalDebits: Money;
  totalCredits: Money;
  isBalanced: boolean;
}

export interface TrialBalanceEntry {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  debitBalance: Money;
  creditBalance: Money;
}

// ============================================================
// Journal Entry Queries
// ============================================================

/**
 * Get journal entries by date range
 * Used by: Tax (for audit), Compliance
 */
export interface GetJournalEntriesQuery {
  entityId: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  accountId?: string;
  limit?: number;
  offset?: number;
}

export interface GetJournalEntriesResult {
  entries: JournalEntryInfo[];
  total: number;
}

export interface JournalEntryInfo {
  entryId: string;
  entryDate: string;
  description: string;
  reference?: string;
  lines: JournalLineInfo[];
  totalDebits: Money;
  totalCredits: Money;
  isReversed: boolean;
  reversalOfEntryId?: string;
}

export interface JournalLineInfo {
  lineId: string;
  accountId: string;
  accountNumber: string;
  debitAmount?: Money;
  creditAmount?: Money;
  memo?: string;
}

// ============================================================
// Period Queries
// ============================================================

/**
 * Get accounting period status
 * Used by: All domains (to check if entries can be posted)
 */
export interface GetPeriodStatusQuery {
  entityId: string;
  periodId?: string; // If not provided, returns current period
  asOfDate?: string; // Alternative: find period containing this date
}

export interface GetPeriodStatusResult {
  period: PeriodInfo | null;
}

export interface PeriodInfo {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed' | 'locked';
  fiscalYear: number;
  fiscalQuarter: number;
  closedAt?: string;
  closedBy?: string;
}

/**
 * List accounting periods for an entity
 * Used by: Reporting, Tax
 */
export interface ListPeriodsQuery {
  entityId: string;
  fiscalYear?: number;
  status?: 'open' | 'closed' | 'locked';
}

export interface ListPeriodsResult {
  periods: PeriodInfo[];
}

// ============================================================
// Intercompany Queries
// ============================================================

/**
 * Get intercompany balance between two entities
 * Used by: Tax (for transfer pricing), Consolidation
 */
export interface GetIntercompanyBalanceQuery {
  fromEntityId: string;
  toEntityId: string;
  asOfDate: string;
}

export interface GetIntercompanyBalanceResult {
  fromEntityId: string;
  toEntityId: string;
  receivableBalance: Money; // Amount fromEntity is owed by toEntity
  payableBalance: Money; // Amount fromEntity owes to toEntity
  netPosition: Money;
  asOfDate: string;
  lastTransactionDate?: string;
}

/**
 * Get all intercompany balances for an entity
 * Used by: Consolidation, Compliance
 */
export interface GetAllIntercompanyBalancesQuery {
  entityId: string;
  asOfDate: string;
}

export interface GetAllIntercompanyBalancesResult {
  entityId: string;
  balances: IntercompanyPositionSummary[];
  totalReceivables: Money;
  totalPayables: Money;
  netPosition: Money;
}

export interface IntercompanyPositionSummary {
  counterpartyEntityId: string;
  counterpartyName: string;
  receivableBalance: Money;
  payableBalance: Money;
  netPosition: Money;
}

// ============================================================
// Reconciliation Queries
// ============================================================

/**
 * Get reconciliation status for an account
 * Used by: Banking, Compliance, Audit
 */
export interface GetReconciliationStatusQuery {
  accountId: string;
  entityId: string;
  asOfDate?: string;
}

export interface GetReconciliationStatusResult {
  accountId: string;
  lastReconciledDate?: string;
  reconciledBalance?: Money;
  currentBalance: Money;
  unreconciledItems: number;
  unreconciledAmount: Money;
  daysSinceLastReconciliation: number;
}

// ============================================================
// Financial Statement Queries
// ============================================================

/**
 * Get income statement for a period
 * Used by: Tax, Reporting, Compliance
 */
export interface GetIncomeStatementQuery {
  entityId: string;
  periodId?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetIncomeStatementResult {
  entityId: string;
  periodStart: string;
  periodEnd: string;
  revenue: FinancialStatementSection;
  expenses: FinancialStatementSection;
  netIncome: Money;
}

export interface FinancialStatementSection {
  total: Money;
  lineItems: FinancialStatementLineItem[];
}

export interface FinancialStatementLineItem {
  accountId: string;
  accountName: string;
  amount: Money;
  percentage?: string; // Decimal as string (e.g., percentage of revenue)
}

/**
 * Get balance sheet at a point in time
 * Used by: Tax, Reporting, Compliance, Banking
 */
export interface GetBalanceSheetQuery {
  entityId: string;
  asOfDate: string;
}

export interface GetBalanceSheetResult {
  entityId: string;
  asOfDate: string;
  assets: FinancialStatementSection;
  liabilities: FinancialStatementSection;
  equity: FinancialStatementSection;
  totalAssets: Money;
  totalLiabilitiesAndEquity: Money;
  isBalanced: boolean;
}

// ============================================================
// Service Interface
// ============================================================

/**
 * Accounting Service Interface
 * Implemented by Accounting, consumed by other domains
 */
export interface IAccountingService {
  // Account queries
  getAccount(query: GetAccountQuery): Promise<GetAccountResult>;
  getChartOfAccounts(query: GetChartOfAccountsQuery): Promise<GetChartOfAccountsResult>;

  // Balance queries
  getAccountBalance(query: GetAccountBalanceQuery): Promise<GetAccountBalanceResult>;
  getTrialBalance(query: GetTrialBalanceQuery): Promise<GetTrialBalanceResult>;

  // Journal entry queries
  getJournalEntries(query: GetJournalEntriesQuery): Promise<GetJournalEntriesResult>;

  // Period queries
  getPeriodStatus(query: GetPeriodStatusQuery): Promise<GetPeriodStatusResult>;
  listPeriods(query: ListPeriodsQuery): Promise<ListPeriodsResult>;

  // Intercompany queries
  getIntercompanyBalance(query: GetIntercompanyBalanceQuery): Promise<GetIntercompanyBalanceResult>;
  getAllIntercompanyBalances(query: GetAllIntercompanyBalancesQuery): Promise<GetAllIntercompanyBalancesResult>;

  // Reconciliation queries
  getReconciliationStatus(query: GetReconciliationStatusQuery): Promise<GetReconciliationStatusResult>;

  // Financial statement queries
  getIncomeStatement(query: GetIncomeStatementQuery): Promise<GetIncomeStatementResult>;
  getBalanceSheet(query: GetBalanceSheetQuery): Promise<GetBalanceSheetResult>;
}
