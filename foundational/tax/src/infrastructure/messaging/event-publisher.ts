/**
 * Tax Domain Event Publisher
 *
 * Service-specific wrapper around the event bus for publishing tax domain events.
 */

import type { EventBus, DomainEvent } from '@ecosystem/messaging';
import { createDomainEvent } from '@ecosystem/messaging';
import {
  TaxEventTypes,
  type TaxEventType,
  type RegistrationCreatedPayload,
  type VATRegisteredPayload,
  type PAYERegisteredPayload,
  type CTPeriodCreatedPayload,
  type CTPeriodCalculatedPayload,
  type CTPeriodFiledPayload,
  type CTPeriodPaidPayload,
  type VATReturnCreatedPayload,
  type VATReturnCalculatedPayload,
  type VATReturnSubmittedPayload,
  type PAYESubmissionCreatedPayload,
  type PAYESubmissionSubmittedPayload,
  type EmployeeTaxCodeChangedPayload,
} from './events.js';

const SERVICE_NAME = 'tax';

export class TaxEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  // ===========================================================================
  // Registration Events
  // ===========================================================================

  async publishRegistrationCreated(payload: RegistrationCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.REGISTRATION_CREATED,
      payload.registrationId,
      'UKTaxRegistration',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.REGISTRATION_CREATED}:`, payload.registrationId);
  }

  async publishVATRegistered(payload: VATRegisteredPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.VAT_REGISTERED,
      payload.registrationId,
      'UKTaxRegistration',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.VAT_REGISTERED}: VAT ${payload.vatNumber}`);
  }

  async publishPAYERegistered(payload: PAYERegisteredPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.PAYE_REGISTERED,
      payload.registrationId,
      'UKTaxRegistration',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.PAYE_REGISTERED}: PAYE ${payload.payeReference}`);
  }

  // ===========================================================================
  // Corporation Tax Events
  // ===========================================================================

  async publishCTPeriodCreated(payload: CTPeriodCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.CT_PERIOD_CREATED,
      payload.periodId,
      'CorporationTaxPeriod',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.CT_PERIOD_CREATED}:`, payload.periodId);
  }

  async publishCTPeriodCalculated(payload: CTPeriodCalculatedPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.CT_PERIOD_CALCULATED,
      payload.periodId,
      'CorporationTaxPeriod',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.CT_PERIOD_CALCULATED}: ${payload.effectiveRate}% rate`);
  }

  async publishCTPeriodFiled(payload: CTPeriodFiledPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.CT_PERIOD_FILED,
      payload.periodId,
      'CorporationTaxPeriod',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.CT_PERIOD_FILED}: HMRC ref ${payload.hmrcReceiptNumber}`);
  }

  async publishCTPeriodPaid(payload: CTPeriodPaidPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.CT_PERIOD_PAID,
      payload.periodId,
      'CorporationTaxPeriod',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.CT_PERIOD_PAID}:`, payload.taxPaid);
  }

  // ===========================================================================
  // VAT Return Events
  // ===========================================================================

  async publishVATReturnCreated(payload: VATReturnCreatedPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.VAT_RETURN_CREATED,
      payload.returnId,
      'UKVATReturn',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.VAT_RETURN_CREATED}:`, payload.periodKey);
  }

  async publishVATReturnCalculated(payload: VATReturnCalculatedPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.VAT_RETURN_CALCULATED,
      payload.returnId,
      'UKVATReturn',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.VAT_RETURN_CALCULATED}: Box5=${payload.box5}`);
  }

  async publishVATReturnSubmitted(payload: VATReturnSubmittedPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.VAT_RETURN_SUBMITTED,
      payload.returnId,
      'UKVATReturn',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.VAT_RETURN_SUBMITTED}: MTD receipt ${payload.mtdReceiptId}`);
  }

  // ===========================================================================
  // PAYE Events
  // ===========================================================================

  async publishPAYESubmissionCreated(payload: PAYESubmissionCreatedPayload): Promise<void> {
    const eventType = payload.submissionType === 'fps'
      ? TaxEventTypes.PAYE_FPS_CREATED
      : TaxEventTypes.PAYE_EPS_CREATED;

    const event = createDomainEvent(
      eventType,
      payload.submissionId,
      'PAYESubmission',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${eventType}:`, payload.submissionId);
  }

  async publishPAYESubmissionSubmitted(payload: PAYESubmissionSubmittedPayload): Promise<void> {
    const eventType = payload.submissionType === 'fps'
      ? TaxEventTypes.PAYE_FPS_SUBMITTED
      : TaxEventTypes.PAYE_EPS_SUBMITTED;

    const event = createDomainEvent(
      eventType,
      payload.submissionId,
      'PAYESubmission',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${eventType}: HMRC correlation ${payload.hmrcCorrelationId}`);
  }

  // ===========================================================================
  // Employee Tax Events
  // ===========================================================================

  async publishEmployeeTaxCodeChanged(payload: EmployeeTaxCodeChangedPayload): Promise<void> {
    const event = createDomainEvent(
      TaxEventTypes.EMPLOYEE_TAX_CODE_CHANGED,
      payload.employeeId,
      'EmployeeTaxRecord',
      payload,
      { tenantId: payload.tenantId, source: SERVICE_NAME }
    );
    await this.eventBus.publish(event);
    console.log(`[Tax] Published ${TaxEventTypes.EMPLOYEE_TAX_CODE_CHANGED}: ${payload.previousTaxCode} -> ${payload.newTaxCode}`);
  }

  // ===========================================================================
  // Generic Publish
  // ===========================================================================

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await this.eventBus.publish(event);
  }
}

// Global publisher instance
let globalPublisher: TaxEventPublisher | null = null;

export function setGlobalEventPublisher(publisher: TaxEventPublisher): void {
  globalPublisher = publisher;
}

export function getGlobalEventPublisher(): TaxEventPublisher | null {
  return globalPublisher;
}

// Legacy interface for backward compatibility
export interface EventPublisher {
  publish<T>(eventType: TaxEventType, aggregateId: string, payload: T): Promise<void>;
  publishMany<T>(events: Array<{ type: TaxEventType; aggregateId: string; payload: T }>): Promise<void>;
}

/**
 * Factory function to create event publisher (legacy support)
 * @deprecated Use getGlobalEventPublisher() instead
 */
export function createEventPublisher(
  messagingClient: { publish: <T>(event: DomainEvent<T>) => Promise<void> }
): EventPublisher {
  return {
    async publish<T>(eventType: TaxEventType, aggregateId: string, payload: T): Promise<void> {
      const event = createDomainEvent(
        eventType,
        aggregateId,
        'Unknown',
        payload,
        { source: SERVICE_NAME }
      );
      await messagingClient.publish(event);
    },
    async publishMany<T>(events: Array<{ type: TaxEventType; aggregateId: string; payload: T }>): Promise<void> {
      await Promise.all(
        events.map(e => {
          const event = createDomainEvent(e.type, e.aggregateId, 'Unknown', e.payload, { source: SERVICE_NAME });
          return messagingClient.publish(event);
        })
      );
    },
  };
}
