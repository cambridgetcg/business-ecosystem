/**
 * Banking-Treasury Event Types
 *
 * Standardized event type constants and payload interfaces for the @ecosystem/messaging library.
 * Maps to domain events defined in core/events/domain-events.ts but with full typing.
 */

// =============================================================================
// Event Type Constants
// =============================================================================

export const BankingEventTypes = {
  // Account Events
  ACCOUNT_CREATED: 'banking-treasury.account.created',
  ACCOUNT_UPDATED: 'banking-treasury.account.updated',
  ACCOUNT_BALANCE_CHANGED: 'banking-treasury.account.balance_changed',
  ACCOUNT_FROZEN: 'banking-treasury.account.frozen',
  ACCOUNT_UNFROZEN: 'banking-treasury.account.unfrozen',
  ACCOUNT_CLOSED: 'banking-treasury.account.closed',

  // Payment Events
  PAYMENT_INITIATED: 'banking-treasury.payment.initiated',
  PAYMENT_PENDING_APPROVAL: 'banking-treasury.payment.pending_approval',
  PAYMENT_APPROVED: 'banking-treasury.payment.approved',
  PAYMENT_REJECTED: 'banking-treasury.payment.rejected',
  PAYMENT_PROCESSING: 'banking-treasury.payment.processing',
  PAYMENT_COMPLETED: 'banking-treasury.payment.completed',
  PAYMENT_FAILED: 'banking-treasury.payment.failed',
  PAYMENT_CANCELLED: 'banking-treasury.payment.cancelled',
  PAYMENT_RECALLED: 'banking-treasury.payment.recalled',

  // Approval Events
  APPROVAL_WORKFLOW_CREATED: 'banking-treasury.approval.workflow_created',
  APPROVAL_DECISION_RECORDED: 'banking-treasury.approval.decision_recorded',
  APPROVAL_LEVEL_ADVANCED: 'banking-treasury.approval.level_advanced',
  APPROVAL_COMPLETED: 'banking-treasury.approval.completed',
  APPROVAL_EXPIRED: 'banking-treasury.approval.expired',

  // Compliance Events
  COMPLIANCE_CHECK_STARTED: 'banking-treasury.compliance.check_started',
  COMPLIANCE_CHECK_PASSED: 'banking-treasury.compliance.check_passed',
  COMPLIANCE_BLOCKED: 'banking-treasury.compliance.blocked',
  COMPLIANCE_ALERT_RAISED: 'banking-treasury.compliance.alert_raised',
  COMPLIANCE_ALERT_RESOLVED: 'banking-treasury.compliance.alert_resolved',

  // Reconciliation Events
  RECONCILIATION_STARTED: 'banking-treasury.reconciliation.started',
  RECONCILIATION_COMPLETED: 'banking-treasury.reconciliation.completed',
  RECONCILIATION_EXCEPTION_CREATED: 'banking-treasury.reconciliation.exception_created',
  RECONCILIATION_EXCEPTION_RESOLVED: 'banking-treasury.reconciliation.exception_resolved',

  // Cash Position Events
  CASH_POSITION_UPDATED: 'banking-treasury.cash_position.updated',
  CASH_POSITION_THRESHOLD_BREACHED: 'banking-treasury.cash_position.threshold_breached',
  CASH_POSITION_ALERT: 'banking-treasury.cash_position.alert',

  // FX Events
  FX_QUOTE_GENERATED: 'banking-treasury.fx.quote_generated',
  FX_CONVERSION_EXECUTED: 'banking-treasury.fx.conversion_executed',
  FX_RATE_UPDATED: 'banking-treasury.fx.rate_updated',

  // Forecast Events
  FORECAST_GENERATED: 'banking-treasury.forecast.generated',
  FORECAST_ACCURACY_TRACKED: 'banking-treasury.forecast.accuracy_tracked',
  FORECAST_THRESHOLD_ALERT: 'banking-treasury.forecast.threshold_alert',
} as const;

export type BankingEventType = typeof BankingEventTypes[keyof typeof BankingEventTypes];

// =============================================================================
// Event Payloads
// =============================================================================

// Account Payloads
export interface AccountCreatedPayload {
  accountId: string;
  tenantId?: string;
  entityId: string;
  accountName: string;
  accountType: string;
  bankName?: string;
  currency: string;
  isPrimary: boolean;
  createdBy?: string;
}

export interface AccountBalanceChangedPayload {
  accountId: string;
  tenantId?: string;
  entityId: string;
  previousBalance: { amount: number; currency: string };
  newBalance: { amount: number; currency: string };
  changeAmount: number;
  reason: string;
  transactionId?: string;
}

export interface AccountFrozenPayload {
  accountId: string;
  tenantId?: string;
  entityId: string;
  reason: string;
  frozenBy?: string;
  frozenAt: string;
}

export interface AccountClosedPayload {
  accountId: string;
  tenantId?: string;
  entityId: string;
  reason: string;
  finalBalance: { amount: number; currency: string };
  closedBy?: string;
  closedAt: string;
}

// Payment Payloads
export interface PaymentInitiatedPayload {
  paymentId: string;
  tenantId?: string;
  entityId: string;
  transactionId: string;
  amount: { amount: number; currency: string };
  paymentMethod: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  destinationBank?: string;
  destinationAccountNumber?: string;
  reference?: string;
  initiatedBy?: string;
}

export interface PaymentPendingApprovalPayload {
  paymentId: string;
  tenantId?: string;
  entityId: string;
  approvalId: string;
  policyId: string;
  policyName: string;
  requiredLevels: number;
  currentLevel: number;
  amount: { amount: number; currency: string };
  expiresAt: string;
}

export interface PaymentApprovedPayload {
  paymentId: string;
  tenantId?: string;
  entityId: string;
  approvalId: string;
  approvedBy: string[];
  approvalDuration: number;
  amount: { amount: number; currency: string };
}

export interface PaymentCompletedPayload {
  paymentId: string;
  tenantId?: string;
  entityId: string;
  transactionId: string;
  amount: { amount: number; currency: string };
  sourceAccountId?: string;
  processingDuration: number;
  externalReference?: string;
  completedAt: string;
}

export interface PaymentFailedPayload {
  paymentId: string;
  tenantId?: string;
  entityId: string;
  transactionId: string;
  amount: { amount: number; currency: string };
  failureCode: string;
  failureReason: string;
  retryable: boolean;
  retryCount?: number;
  failedAt: string;
}

export interface PaymentRecalledPayload {
  paymentId: string;
  tenantId?: string;
  entityId: string;
  recallReason: string;
  recallRequestedBy: string;
  originalAmount: { amount: number; currency: string };
  recallStatus: 'pending' | 'accepted' | 'rejected';
}

// Compliance Payloads
export interface ComplianceBlockedPayload {
  entityId: string;
  tenantId?: string;
  paymentId?: string;
  ruleId: string;
  ruleName: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ComplianceAlertRaisedPayload {
  alertId: string;
  tenantId?: string;
  entityId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  paymentId?: string;
  raisedAt: string;
  metadata?: Record<string, unknown>;
}

// Reconciliation Payloads
export interface ReconciliationCompletedPayload {
  reconciliationId: string;
  tenantId?: string;
  entityId: string;
  bankAccountId: string;
  statementDate: string;
  matchedCount: number;
  exceptionCount: number;
  statementBalance: { amount: number; currency: string };
  systemBalance: { amount: number; currency: string };
  difference: { amount: number; currency: string };
  status: 'balanced' | 'unbalanced';
  completedAt: string;
}

export interface ReconciliationExceptionCreatedPayload {
  exceptionId: string;
  tenantId?: string;
  reconciliationId: string;
  bankAccountId: string;
  entityId: string;
  exceptionType: 'missing_statement' | 'missing_system' | 'amount_mismatch' | 'duplicate';
  amount: { amount: number; currency: string };
  description: string;
  createdAt: string;
}

// Cash Position Payloads
export interface CashPositionUpdatedPayload {
  entityId: string;
  tenantId?: string;
  accountId: string;
  currency: string;
  previousBalance: number;
  currentBalance: number;
  changeAmount: number;
  timestamp: string;
}

export interface CashPositionThresholdBreachedPayload {
  entityId: string;
  tenantId?: string;
  accountId?: string;
  currency: string;
  currentBalance: number;
  threshold: number;
  thresholdType: 'minimum' | 'maximum' | 'target';
  severity: 'warning' | 'critical';
  breachedAt: string;
}

// FX Payloads
export interface FXConversionExecutedPayload {
  conversionId: string;
  tenantId?: string;
  entityId?: string;
  fromAmount: { amount: number; currency: string };
  toAmount: { amount: number; currency: string };
  rate: number;
  fee: { amount: number; currency: string };
  reference?: string;
  executedAt: string;
}

// Forecast Payloads
export interface ForecastGeneratedPayload {
  forecastId: string;
  tenantId?: string;
  entityId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  projectedInflows: { amount: number; currency: string };
  projectedOutflows: { amount: number; currency: string };
  projectedBalance: { amount: number; currency: string };
  confidence: number;
  generatedAt: string;
}

// =============================================================================
// External Event Types (from event-bus-setup.ts)
// =============================================================================

export { ExternalEventTypes } from './external-event-handlers.js';
