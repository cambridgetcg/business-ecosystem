/**
 * Compliance Event Publisher
 *
 * Service-specific wrapper around the event bus for publishing compliance domain events.
 */

import type { EventBus, DomainEvent } from '@ecosystem/messaging';
import { createDomainEvent } from '@ecosystem/messaging';
import {
  ComplianceEventTypes,
  type ObligationCreatedPayload,
  type ObligationUpdatedPayload,
  type ObligationCompletedPayload,
  type ObligationOverduePayload,
  type ObligationEscalatedPayload,
  type DeadlineApproachingPayload,
  type FindingCreatedPayload,
  type FindingClosedPayload,
  type ReportGeneratedPayload,
  type BOIFilingSubmittedPayload,
  type ComplianceStatusChangedPayload,
  type ComplianceBreachDetectedPayload,
} from './event-types.js';

const SERVICE_NAME = 'compliance';

export class ComplianceEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  // ===========================================================================
  // Obligation Events
  // ===========================================================================

  async publishObligationCreated(payload: ObligationCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.OBLIGATION_CREATED,
      payload.obligationId,
      'ComplianceObligation',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.OBLIGATION_CREATED}:`, payload.obligationId);
  }

  async publishObligationUpdated(payload: ObligationUpdatedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.OBLIGATION_UPDATED,
      payload.obligationId,
      'ComplianceObligation',
      payload,
      { tenantId: payload.tenantId, userId: payload.updatedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
  }

  async publishObligationCompleted(payload: ObligationCompletedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.OBLIGATION_COMPLETED,
      payload.obligationId,
      'ComplianceObligation',
      payload,
      { tenantId: payload.tenantId, userId: payload.completedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.OBLIGATION_COMPLETED}:`, payload.obligationId);
  }

  async publishObligationOverdue(payload: ObligationOverduePayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.OBLIGATION_OVERDUE,
      payload.obligationId,
      'ComplianceObligation',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.OBLIGATION_OVERDUE}:`, payload.obligationId);
  }

  async publishObligationEscalated(payload: ObligationEscalatedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.OBLIGATION_ESCALATED,
      payload.obligationId,
      'ComplianceObligation',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.OBLIGATION_ESCALATED}:`, payload.obligationId);
  }

  // ===========================================================================
  // Calendar Events
  // ===========================================================================

  async publishDeadlineApproaching(payload: DeadlineApproachingPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.DEADLINE_APPROACHING,
      payload.obligationId,
      'ComplianceObligation',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.DEADLINE_APPROACHING}: ${payload.daysUntilDue} days`);
  }

  // ===========================================================================
  // Finding Events
  // ===========================================================================

  async publishFindingCreated(payload: FindingCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.FINDING_CREATED,
      payload.findingId,
      'AuditFinding',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.FINDING_CREATED}:`, payload.findingId);
  }

  async publishFindingClosed(payload: FindingClosedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.FINDING_CLOSED,
      payload.findingId,
      'AuditFinding',
      payload,
      { tenantId: payload.tenantId, userId: payload.closedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.FINDING_CLOSED}:`, payload.findingId);
  }

  // ===========================================================================
  // Report Events
  // ===========================================================================

  async publishReportGenerated(payload: ReportGeneratedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.REPORT_GENERATED,
      payload.reportId,
      'ComplianceReport',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.REPORT_GENERATED}:`, payload.reportId);
  }

  // ===========================================================================
  // BOI Filing Events
  // ===========================================================================

  async publishBOIFilingSubmitted(payload: BOIFilingSubmittedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.BOI_FILING_SUBMITTED,
      payload.filingId,
      'BOIFiling',
      payload,
      { tenantId: payload.tenantId, userId: payload.submittedBy, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.BOI_FILING_SUBMITTED}:`, payload.filingId);
  }

  // ===========================================================================
  // Status Events
  // ===========================================================================

  async publishComplianceStatusChanged(payload: ComplianceStatusChangedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.COMPLIANCE_STATUS_CHANGED,
      payload.entityId,
      'ComplianceStatus',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.COMPLIANCE_STATUS_CHANGED}:`, payload.entityId);
  }

  async publishComplianceBreachDetected(payload: ComplianceBreachDetectedPayload): Promise<void> {
    const event = createDomainEvent(
      ComplianceEventTypes.COMPLIANCE_BREACH_DETECTED,
      payload.entityId,
      'ComplianceBreach',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Compliance] Published ${ComplianceEventTypes.COMPLIANCE_BREACH_DETECTED}:`, payload.entityId);
  }

  // ===========================================================================
  // Generic Publish
  // ===========================================================================

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await this.eventBus.publish(event);
  }
}

// Global publisher instance
let globalPublisher: ComplianceEventPublisher | null = null;

export function setGlobalEventPublisher(publisher: ComplianceEventPublisher): void {
  globalPublisher = publisher;
}

export function getGlobalEventPublisher(): ComplianceEventPublisher | null {
  return globalPublisher;
}
