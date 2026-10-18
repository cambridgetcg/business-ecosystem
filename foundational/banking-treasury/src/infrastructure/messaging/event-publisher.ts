/**
 * Banking-Treasury Event Publisher
 *
 * Service-specific wrapper around the event bus for publishing banking domain events.
 */

import type { EventBus, DomainEvent } from '@ecosystem/messaging';
import { createDomainEvent } from '@ecosystem/messaging';
import {
  BankingEventTypes,
  type AccountCreatedPayload,
  type AccountBalanceChangedPayload,
  type AccountFrozenPayload,
  type AccountClosedPayload,
  type PaymentInitiatedPayload,
  type PaymentPendingApprovalPayload,
  type PaymentApprovedPayload,
  type PaymentCompletedPayload,
  type PaymentFailedPayload,
  type PaymentRecalledPayload,
  type ComplianceBlockedPayload,
  type ComplianceAlertRaisedPayload,
  type ReconciliationCompletedPayload,
  type ReconciliationExceptionCreatedPayload,
  type CashPositionUpdatedPayload,
  type CashPositionThresholdBreachedPayload,
  type FXConversionExecutedPayload,
  type ForecastGeneratedPayload,
} from './event-types.js';

const SERVICE_NAME = 'banking-treasury';

export class BankingEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  // ===========================================================================
  // Account Events
  // ===========================================================================

  async publishAccountCreated(payload: AccountCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.ACCOUNT_CREATED,
      payload.accountId,
      'BankAccount',
      payload,
      { tenantId: payload.tenantId, userId: payload.createdBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.ACCOUNT_CREATED}:`, payload.accountId);
  }

  async publishAccountBalanceChanged(payload: AccountBalanceChangedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.ACCOUNT_BALANCE_CHANGED,
      payload.accountId,
      'BankAccount',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
  }

  async publishAccountFrozen(payload: AccountFrozenPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.ACCOUNT_FROZEN,
      payload.accountId,
      'BankAccount',
      payload,
      { tenantId: payload.tenantId, userId: payload.frozenBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.ACCOUNT_FROZEN}:`, payload.accountId);
  }

  async publishAccountClosed(payload: AccountClosedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.ACCOUNT_CLOSED,
      payload.accountId,
      'BankAccount',
      payload,
      { tenantId: payload.tenantId, userId: payload.closedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.ACCOUNT_CLOSED}:`, payload.accountId);
  }

  // ===========================================================================
  // Payment Events
  // ===========================================================================

  async publishPaymentInitiated(payload: PaymentInitiatedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.PAYMENT_INITIATED,
      payload.paymentId,
      'Payment',
      payload,
      { tenantId: payload.tenantId, userId: payload.initiatedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.PAYMENT_INITIATED}:`, payload.paymentId);
  }

  async publishPaymentPendingApproval(payload: PaymentPendingApprovalPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.PAYMENT_PENDING_APPROVAL,
      payload.paymentId,
      'Payment',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.PAYMENT_PENDING_APPROVAL}: requires ${payload.requiredLevels} levels`);
  }

  async publishPaymentApproved(payload: PaymentApprovedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.PAYMENT_APPROVED,
      payload.paymentId,
      'Payment',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.PAYMENT_APPROVED}:`, payload.paymentId);
  }

  async publishPaymentCompleted(payload: PaymentCompletedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.PAYMENT_COMPLETED,
      payload.paymentId,
      'Payment',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.PAYMENT_COMPLETED}: ${payload.amount.amount} ${payload.amount.currency}`);
  }

  async publishPaymentFailed(payload: PaymentFailedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.PAYMENT_FAILED,
      payload.paymentId,
      'Payment',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.PAYMENT_FAILED}: ${payload.failureCode}`);
  }

  async publishPaymentRecalled(payload: PaymentRecalledPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.PAYMENT_RECALLED,
      payload.paymentId,
      'Payment',
      payload,
      { tenantId: payload.tenantId, userId: payload.recallRequestedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.PAYMENT_RECALLED}:`, payload.paymentId);
  }

  // ===========================================================================
  // Compliance Events
  // ===========================================================================

  async publishComplianceBlocked(payload: ComplianceBlockedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.COMPLIANCE_BLOCKED,
      payload.entityId,
      'Compliance',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.COMPLIANCE_BLOCKED}: ${payload.ruleName}`);
  }

  async publishComplianceAlertRaised(payload: ComplianceAlertRaisedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.COMPLIANCE_ALERT_RAISED,
      payload.alertId,
      'Compliance',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.COMPLIANCE_ALERT_RAISED}: ${payload.severity}`);
  }

  // ===========================================================================
  // Reconciliation Events
  // ===========================================================================

  async publishReconciliationCompleted(payload: ReconciliationCompletedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.RECONCILIATION_COMPLETED,
      payload.reconciliationId,
      'Reconciliation',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.RECONCILIATION_COMPLETED}: ${payload.status}`);
  }

  async publishReconciliationExceptionCreated(payload: ReconciliationExceptionCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.RECONCILIATION_EXCEPTION_CREATED,
      payload.exceptionId,
      'Reconciliation',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.RECONCILIATION_EXCEPTION_CREATED}: ${payload.exceptionType}`);
  }

  // ===========================================================================
  // Cash Position Events
  // ===========================================================================

  async publishCashPositionUpdated(payload: CashPositionUpdatedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.CASH_POSITION_UPDATED,
      payload.entityId,
      'CashPosition',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
  }

  async publishCashPositionThresholdBreached(payload: CashPositionThresholdBreachedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.CASH_POSITION_THRESHOLD_BREACHED,
      payload.entityId,
      'CashPosition',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.CASH_POSITION_THRESHOLD_BREACHED}: ${payload.severity}`);
  }

  // ===========================================================================
  // FX Events
  // ===========================================================================

  async publishFXConversionExecuted(payload: FXConversionExecutedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.FX_CONVERSION_EXECUTED,
      payload.conversionId,
      'FXConversion',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.FX_CONVERSION_EXECUTED}: ${payload.fromAmount.currency} -> ${payload.toAmount.currency}`);
  }

  // ===========================================================================
  // Forecast Events
  // ===========================================================================

  async publishForecastGenerated(payload: ForecastGeneratedPayload): Promise<void> {
    const event = createDomainEvent(
      BankingEventTypes.FORECAST_GENERATED,
      payload.forecastId,
      'Forecast',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Banking] Published ${BankingEventTypes.FORECAST_GENERATED}: ${payload.period}`);
  }

  // ===========================================================================
  // Generic Publish
  // ===========================================================================

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await this.eventBus.publish(event);
  }
}

// Global publisher instance
let globalPublisher: BankingEventPublisher | null = null;

export function setGlobalEventPublisher(publisher: BankingEventPublisher): void {
  globalPublisher = publisher;
}

export function getGlobalEventPublisher(): BankingEventPublisher | null {
  return globalPublisher;
}
