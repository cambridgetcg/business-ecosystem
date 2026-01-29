import {
  Money,
  CurrencyCode,
  EntityReference,
} from '../value-objects/index.js';

/**
 * Banking-Treasury Query Contracts
 *
 * These interfaces define what other domains can query from Banking-Treasury.
 * Banking-Treasury is the single source of truth for bank accounts, cash positions,
 * and payment operations.
 */

// ============================================================
// Bank Account Queries
// ============================================================

/**
 * Get bank account by ID
 * Used by: Accounting (for reconciliation), Compliance
 */
export interface GetBankAccountQuery {
  bankAccountId: string;
}

export interface GetBankAccountResult {
  account: BankAccountInfo | null;
}

export interface BankAccountInfo {
  bankAccountId: string;
  entityId: string;
  bankName: string;
  accountNumber: string; // Last 4 digits only for security
  accountType: 'checking' | 'savings' | 'money_market' | 'operating' | 'payroll' | 'tax_reserve';
  currency: CurrencyCode;
  status: 'active' | 'dormant' | 'frozen' | 'closed';
  isPrimary: boolean;
  openedDate: string;
  closedDate?: string;
  linkedGLAccountId?: string; // For accounting integration
}

/**
 * List bank accounts for an entity
 * Used by: Accounting, Compliance, Reporting
 */
export interface ListBankAccountsQuery {
  entityId: string;
  status?: 'active' | 'dormant' | 'frozen' | 'closed';
  accountType?: BankAccountInfo['accountType'];
}

export interface ListBankAccountsResult {
  accounts: BankAccountInfo[];
  total: number;
}

/**
 * Get bank accounts by GL account (for reconciliation)
 * Used by: Accounting
 */
export interface GetBankAccountsByGLQuery {
  glAccountId: string;
  entityId: string;
}

export interface GetBankAccountsByGLResult {
  accounts: BankAccountInfo[];
}

// ============================================================
// Cash Position Queries
// ============================================================

/**
 * Get current cash position for an entity
 * Used by: Accounting, Reporting, Compliance
 */
export interface GetCashPositionQuery {
  entityId: string;
  currency?: CurrencyCode; // If not specified, returns all currencies
}

export interface GetCashPositionResult {
  entityId: string;
  asOfTimestamp: string;
  positions: CashPositionDetail[];
  totalByCurrency: CurrencyTotal[];
}

export interface CashPositionDetail {
  bankAccountId: string;
  bankName: string;
  accountType: string;
  currency: CurrencyCode;
  availableBalance: Money;
  ledgerBalance: Money;
  pendingCredits: Money;
  pendingDebits: Money;
}

export interface CurrencyTotal {
  currency: CurrencyCode;
  totalAvailable: Money;
  totalLedger: Money;
}

/**
 * Get consolidated cash position across entities
 * Used by: Treasury, Reporting
 */
export interface GetConsolidatedCashPositionQuery {
  entityIds: string[];
  currency?: CurrencyCode;
}

export interface GetConsolidatedCashPositionResult {
  asOfTimestamp: string;
  byEntity: EntityCashSummary[];
  consolidated: CurrencyTotal[];
}

export interface EntityCashSummary {
  entityId: string;
  entityName: string;
  positions: CurrencyTotal[];
}

// ============================================================
// Payment Queries
// ============================================================

/**
 * Get payment by ID
 * Used by: Accounting (for GL entries), Compliance
 */
export interface GetPaymentQuery {
  paymentId: string;
}

export interface GetPaymentResult {
  payment: PaymentInfo | null;
}

export interface PaymentInfo {
  paymentId: string;
  entityId: string;
  paymentType: 'wire' | 'ach' | 'check' | 'internal' | 'fx';
  direction: 'inbound' | 'outbound';
  status: 'initiated' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  amount: Money;
  fromAccountId?: string;
  toAccountId?: string;
  counterparty?: PaymentCounterparty;
  reference?: string;
  memo?: string;
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
  linkedJournalEntryId?: string;
}

export interface PaymentCounterparty {
  name: string;
  accountNumber?: string; // Masked
  bankName?: string;
  routingNumber?: string; // Masked
}

/**
 * List payments for an entity
 * Used by: Accounting, Compliance, Reporting
 */
export interface ListPaymentsQuery {
  entityId: string;
  startDate?: string;
  endDate?: string;
  status?: PaymentInfo['status'];
  direction?: 'inbound' | 'outbound';
  paymentType?: PaymentInfo['paymentType'];
  limit?: number;
  offset?: number;
}

export interface ListPaymentsResult {
  payments: PaymentInfo[];
  total: number;
}

/**
 * Get pending payments summary
 * Used by: Accounting (for accruals), Treasury
 */
export interface GetPendingPaymentsQuery {
  entityId: string;
}

export interface GetPendingPaymentsResult {
  entityId: string;
  pendingInbound: PendingPaymentSummary;
  pendingOutbound: PendingPaymentSummary;
}

export interface PendingPaymentSummary {
  count: number;
  totalByCurrency: CurrencyTotal[];
  oldestPendingDate?: string;
}

// ============================================================
// Cash Pool Queries
// ============================================================

/**
 * Get cash pool configuration
 * Used by: Accounting (for intercompany), Treasury
 */
export interface GetCashPoolQuery {
  poolId: string;
}

export interface GetCashPoolResult {
  pool: CashPoolInfo | null;
}

export interface CashPoolInfo {
  poolId: string;
  poolName: string;
  masterEntityId: string;
  participantEntityIds: string[];
  poolType: 'zero_balance' | 'target_balance' | 'notional';
  currency: CurrencyCode;
  isActive: boolean;
  sweepFrequency: 'daily' | 'weekly' | 'monthly';
  lastSweepDate?: string;
  interestRate?: string; // Decimal as string
}

/**
 * Get cash pool positions
 * Used by: Accounting, Reporting
 */
export interface GetCashPoolPositionsQuery {
  poolId: string;
  asOfDate?: string;
}

export interface GetCashPoolPositionsResult {
  poolId: string;
  asOfDate: string;
  masterPosition: Money;
  participantPositions: ParticipantPoolPosition[];
  totalPoolBalance: Money;
}

export interface ParticipantPoolPosition {
  entityId: string;
  entityName: string;
  contribution: Money;
  interestAccrued: Money;
}

// ============================================================
// Bank Statement Queries
// ============================================================

/**
 * Get bank statement summary
 * Used by: Accounting (for reconciliation)
 */
export interface GetBankStatementQuery {
  bankAccountId: string;
  statementDate: string; // ISO date
}

export interface GetBankStatementResult {
  statement: BankStatementInfo | null;
}

export interface BankStatementInfo {
  statementId: string;
  bankAccountId: string;
  statementDate: string;
  openingBalance: Money;
  closingBalance: Money;
  totalCredits: Money;
  totalDebits: Money;
  transactionCount: number;
  isReconciled: boolean;
  reconciledAt?: string;
  varianceAmount?: Money;
}

/**
 * Get unreconciled bank transactions
 * Used by: Accounting
 */
export interface GetUnreconciledTransactionsQuery {
  bankAccountId: string;
  limit?: number;
}

export interface GetUnreconciledTransactionsResult {
  transactions: BankTransactionInfo[];
  total: number;
  totalAmount: Money;
}

export interface BankTransactionInfo {
  transactionId: string;
  transactionDate: string;
  postDate: string;
  description: string;
  amount: Money;
  transactionType: 'credit' | 'debit';
  reference?: string;
  matchedJournalEntryId?: string;
}

// ============================================================
// De-Risking Queries
// ============================================================

/**
 * Get de-risking status for an entity
 * Used by: Compliance, Entity Governance
 */
export interface GetDeRiskingStatusQuery {
  entityId: string;
}

export interface GetDeRiskingStatusResult {
  entityId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  activeAlerts: DeRiskingAlertSummary[];
  recentIncidents: number; // Last 12 months
  bankRelationshipHealth: 'healthy' | 'strained' | 'at_risk';
}

export interface DeRiskingAlertSummary {
  alertId: string;
  signalType: string;
  severity: 'warning' | 'critical';
  bankName: string;
  detectedAt: string;
  description: string;
}

// ============================================================
// BaaS Provider Queries
// ============================================================

/**
 * Get BaaS provider status
 * Used by: Compliance, Operations
 */
export interface GetBaaSProviderStatusQuery {
  providerId?: string;
  entityId?: string; // Get provider(s) serving this entity
}

export interface GetBaaSProviderStatusResult {
  providers: BaaSProviderInfo[];
}

export interface BaaSProviderInfo {
  providerId: string;
  providerName: string;
  status: 'active' | 'degraded' | 'maintenance' | 'terminated';
  servingEntityIds: string[];
  apiHealthStatus: 'healthy' | 'degraded' | 'down';
  lastHealthCheck: string;
  supportedServices: string[];
}

// ============================================================
// Service Interface
// ============================================================

/**
 * Banking-Treasury Service Interface
 * Implemented by Banking-Treasury, consumed by other domains
 */
export interface IBankingTreasuryService {
  // Bank account queries
  getBankAccount(query: GetBankAccountQuery): Promise<GetBankAccountResult>;
  listBankAccounts(query: ListBankAccountsQuery): Promise<ListBankAccountsResult>;
  getBankAccountsByGL(query: GetBankAccountsByGLQuery): Promise<GetBankAccountsByGLResult>;

  // Cash position queries
  getCashPosition(query: GetCashPositionQuery): Promise<GetCashPositionResult>;
  getConsolidatedCashPosition(query: GetConsolidatedCashPositionQuery): Promise<GetConsolidatedCashPositionResult>;

  // Payment queries
  getPayment(query: GetPaymentQuery): Promise<GetPaymentResult>;
  listPayments(query: ListPaymentsQuery): Promise<ListPaymentsResult>;
  getPendingPayments(query: GetPendingPaymentsQuery): Promise<GetPendingPaymentsResult>;

  // Cash pool queries
  getCashPool(query: GetCashPoolQuery): Promise<GetCashPoolResult>;
  getCashPoolPositions(query: GetCashPoolPositionsQuery): Promise<GetCashPoolPositionsResult>;

  // Bank statement queries
  getBankStatement(query: GetBankStatementQuery): Promise<GetBankStatementResult>;
  getUnreconciledTransactions(query: GetUnreconciledTransactionsQuery): Promise<GetUnreconciledTransactionsResult>;

  // De-risking queries
  getDeRiskingStatus(query: GetDeRiskingStatusQuery): Promise<GetDeRiskingStatusResult>;

  // BaaS queries
  getBaaSProviderStatus(query: GetBaaSProviderStatusQuery): Promise<GetBaaSProviderStatusResult>;
}
