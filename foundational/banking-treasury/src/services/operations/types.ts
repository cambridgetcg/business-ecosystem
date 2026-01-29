/**
 * Operations Service Types
 *
 * Types for operational queries, status tracking, and administrative functions.
 *
 * @module services/operations
 */

import type { Money, TransactionStatus, PaymentMethod } from '../../types/financial.js';

/**
 * Transaction inquiry request.
 */
export interface TransactionInquiry {
  readonly inquiryId: string;
  readonly entityId: string;
  readonly transactionId?: string | undefined;
  readonly externalReference?: string | undefined;
  readonly dateRange?: DateRange | undefined;
  readonly amountRange?: AmountRange | undefined;
  readonly status?: TransactionStatus[] | undefined;
  readonly paymentMethod?: PaymentMethod[] | undefined;
  readonly counterpartyName?: string | undefined;
  readonly currency?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

/**
 * Date range filter.
 */
export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

/**
 * Amount range filter.
 */
export interface AmountRange {
  readonly min?: Money | undefined;
  readonly max?: Money | undefined;
}

/**
 * Transaction inquiry result.
 */
export interface TransactionInquiryResult {
  readonly inquiryId: string;
  readonly transactions: TransactionSummary[];
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly executedAt: Date;
}

/**
 * Transaction summary.
 */
export interface TransactionSummary {
  readonly transactionId: string;
  readonly externalReference?: string | undefined;
  readonly type: 'inbound' | 'outbound' | 'internal';
  readonly amount: Money;
  readonly status: TransactionStatus;
  readonly paymentMethod: PaymentMethod;
  readonly counterpartyName?: string | undefined;
  readonly counterpartyAccount?: string | undefined;
  readonly initiatedAt: Date;
  readonly completedAt?: Date | undefined;
  readonly valueDate?: Date | undefined;
  readonly description?: string | undefined;
}

/**
 * Balance inquiry request.
 */
export interface BalanceInquiry {
  readonly inquiryId: string;
  readonly entityId: string;
  readonly accountIds?: string[] | undefined;
  readonly currencies?: string[] | undefined;
  readonly asOfDate?: Date | undefined;
  readonly includeProjected?: boolean | undefined;
}

/**
 * Balance inquiry result.
 */
export interface BalanceInquiryResult {
  readonly inquiryId: string;
  readonly balances: AccountBalanceSummary[];
  readonly totalByurrency: Map<string, Money>;
  readonly asOfDate: Date;
  readonly executedAt: Date;
}

/**
 * Account balance summary.
 */
export interface AccountBalanceSummary {
  readonly accountId: string;
  readonly accountName: string;
  readonly bankName: string;
  readonly currency: string;
  readonly ledgerBalance: Money;
  readonly availableBalance: Money;
  readonly pendingIn: Money;
  readonly pendingOut: Money;
  readonly projectedBalance?: Money | undefined;
  readonly lastUpdated: Date;
}

/**
 * Statement request.
 */
export interface StatementRequest {
  readonly requestId: string;
  readonly entityId: string;
  readonly accountId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly format: StatementFormat;
}

/**
 * Statement formats.
 */
export type StatementFormat =
  | 'pdf'
  | 'csv'
  | 'mt940'
  | 'camt053'
  | 'bai2';

/**
 * Statement result.
 */
export interface StatementResult {
  readonly requestId: string;
  readonly accountId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly format: StatementFormat;
  readonly status: 'ready' | 'generating' | 'failed';
  readonly downloadUrl?: string | undefined;
  readonly generatedAt?: Date | undefined;
  readonly expiresAt?: Date | undefined;
  readonly errorMessage?: string | undefined;
}

/**
 * Operational status dashboard.
 */
export interface OperationalDashboard {
  readonly entityId: string;
  readonly asOfDate: Date;
  readonly paymentStats: PaymentStatistics;
  readonly systemStatus: SystemStatus;
  readonly pendingActions: PendingAction[];
  readonly recentAlerts: OperationalAlert[];
}

/**
 * Payment statistics.
 */
export interface PaymentStatistics {
  readonly today: PaymentMetrics;
  readonly thisWeek: PaymentMetrics;
  readonly thisMonth: PaymentMetrics;
}

/**
 * Payment metrics.
 */
export interface PaymentMetrics {
  readonly totalInbound: Money;
  readonly totalOutbound: Money;
  readonly countInbound: number;
  readonly countOutbound: number;
  readonly successRate: number;
  readonly averageProcessingTimeMs: number;
}

/**
 * System status.
 */
export interface SystemStatus {
  readonly overall: HealthStatus;
  readonly components: ComponentStatus[];
  readonly lastChecked: Date;
}

/**
 * Health status.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component status.
 */
export interface ComponentStatus {
  readonly name: string;
  readonly status: HealthStatus;
  readonly latencyMs?: number | undefined;
  readonly lastError?: string | undefined;
  readonly lastErrorAt?: Date | undefined;
}

/**
 * Pending action.
 */
export interface PendingAction {
  readonly actionId: string;
  readonly actionType: ActionType;
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly requiredBy?: Date | undefined;
  readonly assignedTo?: string | undefined;
  readonly relatedEntityId?: string | undefined;
  readonly relatedTransactionId?: string | undefined;
}

/**
 * Action types.
 */
export type ActionType =
  | 'approval_required'
  | 'review_required'
  | 'exception_handling'
  | 'reconciliation_needed'
  | 'compliance_review'
  | 'document_upload'
  | 'information_request';

/**
 * Operational alert.
 */
export interface OperationalAlert {
  readonly alertId: string;
  readonly alertType: OperationalAlertType;
  readonly severity: 'info' | 'warning' | 'error' | 'critical';
  readonly title: string;
  readonly message: string;
  readonly occurredAt: Date;
  readonly acknowledged: boolean;
  readonly acknowledgedBy?: string | undefined;
  readonly acknowledgedAt?: Date | undefined;
}

/**
 * Operational alert types.
 */
export type OperationalAlertType =
  | 'payment_failure'
  | 'cutoff_approaching'
  | 'balance_threshold'
  | 'system_degradation'
  | 'bank_connection_issue'
  | 'reconciliation_exception'
  | 'compliance_alert'
  | 'rate_limit_warning';

/**
 * Audit log entry.
 */
export interface AuditLogEntry {
  readonly entryId: string;
  readonly timestamp: Date;
  readonly userId: string;
  readonly userName?: string | undefined;
  readonly action: AuditAction;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly details: Record<string, unknown>;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly outcome: 'success' | 'failure';
  readonly failureReason?: string | undefined;
}

/**
 * Audit actions.
 */
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'submit'
  | 'cancel'
  | 'export'
  | 'login'
  | 'logout';

/**
 * Audit log query.
 */
export interface AuditLogQuery {
  readonly entityId?: string | undefined;
  readonly userId?: string | undefined;
  readonly resourceType?: string | undefined;
  readonly resourceId?: string | undefined;
  readonly action?: AuditAction[] | undefined;
  readonly dateRange?: DateRange | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

/**
 * Audit log result.
 */
export interface AuditLogResult {
  readonly entries: AuditLogEntry[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

/**
 * Report generation request.
 */
export interface ReportRequest {
  readonly requestId: string;
  readonly entityId: string;
  readonly reportType: ReportType;
  readonly dateRange: DateRange;
  readonly format: 'pdf' | 'xlsx' | 'csv';
  readonly filters?: Record<string, unknown> | undefined;
}

/**
 * Report types.
 */
export type ReportType =
  | 'cash_position'
  | 'transaction_summary'
  | 'reconciliation_status'
  | 'fx_exposure'
  | 'payment_activity'
  | 'bank_fees'
  | 'compliance_summary';

/**
 * Report result.
 */
export interface ReportResult {
  readonly requestId: string;
  readonly reportType: ReportType;
  readonly status: 'ready' | 'generating' | 'failed';
  readonly downloadUrl?: string | undefined;
  readonly generatedAt?: Date | undefined;
  readonly expiresAt?: Date | undefined;
  readonly errorMessage?: string | undefined;
}
