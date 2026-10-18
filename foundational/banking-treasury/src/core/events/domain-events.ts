/**
 * Domain Event Definitions
 *
 * Comprehensive catalog of all domain events in the banking-treasury system.
 * Events are organized by aggregate type and include payload schemas.
 *
 * @module core/events/domain-events
 */

import { v4 as uuidv4 } from 'uuid';
import type { DomainEvent } from './event-bus.js';

// =============================================================================
// EVENT TYPE CONSTANTS
// =============================================================================

export const ACCOUNT_EVENTS = {
  CREATED: 'account.created',
  UPDATED: 'account.updated',
  BALANCE_CHANGED: 'account.balance_changed',
  FROZEN: 'account.frozen',
  UNFROZEN: 'account.unfrozen',
  CLOSED: 'account.closed',
} as const;

export const PAYMENT_EVENTS = {
  INITIATED: 'payment.initiated',
  PENDING_APPROVAL: 'payment.pending_approval',
  APPROVED: 'payment.approved',
  REJECTED: 'payment.rejected',
  PROCESSING_STARTED: 'payment.processing_started',
  COMPLETED: 'payment.completed',
  FAILED: 'payment.failed',
  CANCELLED: 'payment.cancelled',
  RECALLED: 'payment.recalled',
} as const;

export const APPROVAL_EVENTS = {
  WORKFLOW_CREATED: 'approval.workflow_created',
  DECISION_RECORDED: 'approval.decision_recorded',
  LEVEL_ADVANCED: 'approval.level_advanced',
  COMPLETED: 'approval.completed',
  EXPIRED: 'approval.expired',
} as const;

export const COMPLIANCE_EVENTS = {
  CHECK_STARTED: 'compliance.check_started',
  CHECK_PASSED: 'compliance.check_passed',
  BLOCKED: 'compliance.blocked',
  ALERT_RAISED: 'compliance.alert_raised',
  ALERT_RESOLVED: 'compliance.alert_resolved',
} as const;

export const RECONCILIATION_EVENTS = {
  STARTED: 'reconciliation.started',
  COMPLETED: 'reconciliation.completed',
  EXCEPTION_CREATED: 'reconciliation.exception_created',
  EXCEPTION_RESOLVED: 'reconciliation.exception_resolved',
} as const;

export const CASH_POSITION_EVENTS = {
  UPDATED: 'cash_position.updated',
  THRESHOLD_BREACHED: 'cash_position.threshold_breached',
  ALERT_TRIGGERED: 'cash_position.alert_triggered',
} as const;

export const FX_EVENTS = {
  QUOTE_GENERATED: 'fx.quote_generated',
  CONVERSION_EXECUTED: 'fx.conversion_executed',
  RATE_UPDATED: 'fx.rate_updated',
} as const;

export const FORECAST_EVENTS = {
  GENERATED: 'forecast.generated',
  ACCURACY_TRACKED: 'forecast.accuracy_tracked',
  THRESHOLD_ALERT: 'forecast.threshold_alert',
} as const;

// =============================================================================
// EVENT FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a domain event with standard fields.
 */
function createEvent(
  type: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  metadata?: Record<string, unknown>
): DomainEvent {
  return {
    id: uuidv4(),
    type,
    aggregateType,
    aggregateId,
    payload,
    metadata: {
      ...metadata,
      source: 'banking-treasury',
      version: '1.0',
    },
    occurredAt: new Date(),
  };
}

// =============================================================================
// ACCOUNT EVENTS
// =============================================================================

export function accountCreated(
  accountId: string,
  payload: {
    entityId: string;
    accountName: string;
    accountType: string;
    currency: string;
    bankId?: string;
  }
): DomainEvent {
  return createEvent(ACCOUNT_EVENTS.CREATED, 'BankAccount', accountId, payload);
}

export function accountBalanceChanged(
  accountId: string,
  payload: {
    entityId: string;
    previousBalance: number;
    newBalance: number;
    currency: string;
    changeAmount: number;
    reason: string;
    transactionId?: string;
  }
): DomainEvent {
  return createEvent(ACCOUNT_EVENTS.BALANCE_CHANGED, 'BankAccount', accountId, payload);
}

export function accountFrozen(
  accountId: string,
  payload: {
    entityId: string;
    reason: string;
    frozenBy?: string;
  }
): DomainEvent {
  return createEvent(ACCOUNT_EVENTS.FROZEN, 'BankAccount', accountId, payload);
}

export function accountClosed(
  accountId: string,
  payload: {
    entityId: string;
    reason: string;
    finalBalance: number;
    closedBy?: string;
  }
): DomainEvent {
  return createEvent(ACCOUNT_EVENTS.CLOSED, 'BankAccount', accountId, payload);
}

// =============================================================================
// PAYMENT EVENTS
// =============================================================================

export function paymentInitiated(
  paymentId: string,
  payload: {
    transactionId: string;
    amount: number;
    currency: string;
    method: string;
    sourceAccountId?: string;
    destinationAccountId?: string;
  }
): DomainEvent {
  return createEvent(PAYMENT_EVENTS.INITIATED, 'Payment', paymentId, payload);
}

export function paymentPendingApproval(
  paymentId: string,
  payload: {
    approvalId: string;
    policyId: string;
    policyName: string;
    requiredLevels: number;
  }
): DomainEvent {
  return createEvent(PAYMENT_EVENTS.PENDING_APPROVAL, 'Payment', paymentId, payload);
}

export function paymentApproved(
  paymentId: string,
  payload: {
    approvalId: string;
    approvedBy: string[];
    approvalDuration: number; // milliseconds
  }
): DomainEvent {
  return createEvent(PAYMENT_EVENTS.APPROVED, 'Payment', paymentId, payload);
}

export function paymentCompleted(
  paymentId: string,
  payload: {
    transactionId: string;
    amount: number;
    currency: string;
    sourceAccountId?: string;
    processingDuration: number; // milliseconds
    externalReference?: string;
  }
): DomainEvent {
  return createEvent(PAYMENT_EVENTS.COMPLETED, 'Payment', paymentId, payload);
}

export function paymentFailed(
  paymentId: string,
  payload: {
    transactionId: string;
    failureCode: string;
    failureReason: string;
    retryable: boolean;
    retryCount?: number;
  }
): DomainEvent {
  return createEvent(PAYMENT_EVENTS.FAILED, 'Payment', paymentId, payload);
}

export function paymentRecalled(
  paymentId: string,
  payload: {
    recallReason: string;
    recallRequestedBy: string;
    originalAmount: number;
    originalCurrency: string;
  }
): DomainEvent {
  return createEvent(PAYMENT_EVENTS.RECALLED, 'Payment', paymentId, payload);
}

// =============================================================================
// APPROVAL EVENTS
// =============================================================================

export function approvalWorkflowCreated(
  approvalId: string,
  payload: {
    paymentId: string;
    policyId: string;
    totalLevels: number;
    expiresAt: string;
  }
): DomainEvent {
  return createEvent(APPROVAL_EVENTS.WORKFLOW_CREATED, 'Approval', approvalId, payload);
}

export function approvalDecisionRecorded(
  approvalId: string,
  payload: {
    approverId: string;
    decision: 'approve' | 'reject';
    level: number;
    reason?: string;
  }
): DomainEvent {
  return createEvent(APPROVAL_EVENTS.DECISION_RECORDED, 'Approval', approvalId, payload);
}

export function approvalCompleted(
  approvalId: string,
  payload: {
    paymentId: string;
    outcome: 'approved' | 'rejected' | 'expired';
    totalDecisions: number;
    duration: number; // milliseconds
  }
): DomainEvent {
  return createEvent(APPROVAL_EVENTS.COMPLETED, 'Approval', approvalId, payload);
}

// =============================================================================
// COMPLIANCE EVENTS
// =============================================================================

export function complianceBlocked(
  entityId: string,
  payload: {
    paymentId?: string;
    ruleId: string;
    ruleName: string;
    reason: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, unknown>;
  }
): DomainEvent {
  return createEvent(COMPLIANCE_EVENTS.BLOCKED, 'Compliance', entityId, payload);
}

export function complianceAlertRaised(
  alertId: string,
  payload: {
    entityId: string;
    alertType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    paymentId?: string;
    metadata?: Record<string, unknown>;
  }
): DomainEvent {
  return createEvent(COMPLIANCE_EVENTS.ALERT_RAISED, 'Compliance', alertId, payload);
}

// =============================================================================
// RECONCILIATION EVENTS
// =============================================================================

export function reconciliationCompleted(
  reconciliationId: string,
  payload: {
    bankAccountId: string;
    statementDate: string;
    matchedCount: number;
    exceptionCount: number;
    statementBalance: number;
    systemBalance: number;
    difference: number;
  }
): DomainEvent {
  return createEvent(RECONCILIATION_EVENTS.COMPLETED, 'Reconciliation', reconciliationId, payload);
}

export function reconciliationExceptionCreated(
  exceptionId: string,
  payload: {
    reconciliationId: string;
    bankAccountId: string;
    exceptionType: string;
    amount: number;
    currency: string;
    description: string;
  }
): DomainEvent {
  return createEvent(RECONCILIATION_EVENTS.EXCEPTION_CREATED, 'Reconciliation', exceptionId, payload);
}

// =============================================================================
// CASH POSITION EVENTS
// =============================================================================

export function cashPositionUpdated(
  entityId: string,
  payload: {
    accountId: string;
    currency: string;
    previousBalance: number;
    currentBalance: number;
    changeAmount: number;
  }
): DomainEvent {
  return createEvent(CASH_POSITION_EVENTS.UPDATED, 'CashPosition', entityId, payload);
}

export function cashPositionThresholdBreached(
  entityId: string,
  payload: {
    currency: string;
    currentBalance: number;
    threshold: number;
    thresholdType: 'minimum' | 'maximum' | 'target';
    severity: 'warning' | 'critical';
  }
): DomainEvent {
  return createEvent(CASH_POSITION_EVENTS.THRESHOLD_BREACHED, 'CashPosition', entityId, payload);
}

// =============================================================================
// FX EVENTS
// =============================================================================

export function fxConversionExecuted(
  conversionId: string,
  payload: {
    entityId?: string;
    fromAmount: number;
    fromCurrency: string;
    toAmount: number;
    toCurrency: string;
    rate: number;
    fee: number;
    reference?: string;
  }
): DomainEvent {
  return createEvent(FX_EVENTS.CONVERSION_EXECUTED, 'FXConversion', conversionId, payload);
}

// =============================================================================
// FORECAST EVENTS
// =============================================================================

export function forecastGenerated(
  forecastId: string,
  payload: {
    entityId: string;
    period: string;
    startDate: string;
    endDate: string;
    projectedInflows: number;
    projectedOutflows: number;
    projectedBalance: number;
    confidence: number;
  }
): DomainEvent {
  return createEvent(FORECAST_EVENTS.GENERATED, 'Forecast', forecastId, payload);
}

export function forecastAccuracyTracked(
  forecastId: string,
  payload: {
    entityId: string;
    forecastedBalance: number;
    actualBalance: number;
    variance: number;
    variancePercentage: number;
    mape: number;
  }
): DomainEvent {
  return createEvent(FORECAST_EVENTS.ACCURACY_TRACKED, 'Forecast', forecastId, payload);
}
