/**
 * Operations Service
 *
 * Operational queries, status tracking, and administrative functions.
 *
 * @module services/operations
 */

export { OperationsService } from './operations-service.js';
export type {
  ITransactionRepository,
  IBalanceRepository,
  IStatementGenerator,
  IAuditLogRepository,
} from './operations-service.js';

export type {
  TransactionInquiry,
  DateRange,
  AmountRange,
  TransactionInquiryResult,
  TransactionSummary,
  BalanceInquiry,
  BalanceInquiryResult,
  AccountBalanceSummary,
  StatementRequest,
  StatementFormat,
  StatementResult,
  OperationalDashboard,
  PaymentStatistics,
  PaymentMetrics,
  SystemStatus,
  HealthStatus,
  ComponentStatus,
  PendingAction,
  ActionType,
  OperationalAlert,
  OperationalAlertType,
  AuditLogEntry,
  AuditAction,
  AuditLogQuery,
  AuditLogResult,
  ReportRequest,
  ReportType,
  ReportResult,
} from './types.js';
