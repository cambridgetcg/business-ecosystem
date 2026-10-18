/**
 * Event Publisher Service
 *
 * Publishes domain events to the ecosystem event bus
 */

import type { EventBus, DomainEvent } from '@ecosystem/messaging';
import { logger } from '../lib/logger.js';
import {
  CONTRACT_EVENTS,
  OBLIGATION_EVENTS,
  MATTER_EVENTS,
  createEventMetadata,
  createContractCreatedEvent,
  createContractSignedEvent,
  createContractExpiringEvent,
  createContractRenewedEvent,
  createContractTerminatedEvent,
  createContractStatusChangedEvent,
  createObligationDueEvent,
  createMatterOpenedEvent,
  type ContractCreatedPayload,
  type ContractSignedPayload,
  type ContractExpiringPayload,
  type ContractRenewedPayload,
  type ContractTerminatedPayload,
  type ContractStatusChangedPayload,
  type ObligationDuePayload,
  type MatterOpenedPayload,
} from './contract-events.js';

export class EventPublisher {
  private log = logger.child({ component: 'event-publisher' });
  private enabled: boolean;

  constructor(
    private eventBus: EventBus | null,
    enabled: boolean = true
  ) {
    this.enabled = enabled && eventBus !== null;

    if (!this.enabled) {
      this.log.warn('Event publishing is disabled - events will be logged only');
    }
  }

  async publishContractCreated(
    payload: ContractCreatedPayload,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    const metadata = createEventMetadata(userId, correlationId);
    const event = createContractCreatedEvent(payload, metadata);
    await this.publish(event);
  }

  async publishContractSigned(
    payload: ContractSignedPayload,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    const metadata = createEventMetadata(userId, correlationId);
    const event = createContractSignedEvent(payload, metadata);
    await this.publish(event);
  }

  async publishContractExpiring(
    payload: ContractExpiringPayload,
    correlationId?: string
  ): Promise<void> {
    const metadata = createEventMetadata(undefined, correlationId);
    const event = createContractExpiringEvent(payload, metadata);
    await this.publish(event);
  }

  async publishContractRenewed(
    payload: ContractRenewedPayload,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    const metadata = createEventMetadata(userId, correlationId);
    const event = createContractRenewedEvent(payload, metadata);
    await this.publish(event);
  }

  async publishContractTerminated(
    payload: ContractTerminatedPayload,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    const metadata = createEventMetadata(userId, correlationId);
    const event = createContractTerminatedEvent(payload, metadata);
    await this.publish(event);
  }

  async publishContractStatusChanged(
    payload: ContractStatusChangedPayload,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    const metadata = createEventMetadata(userId, correlationId);
    const event = createContractStatusChangedEvent(payload, metadata);
    await this.publish(event);
  }

  async publishObligationDue(
    payload: ObligationDuePayload,
    correlationId?: string
  ): Promise<void> {
    const metadata = createEventMetadata(undefined, correlationId);
    const event = createObligationDueEvent(payload, metadata);
    await this.publish(event);
  }

  async publishMatterOpened(
    payload: MatterOpenedPayload,
    userId?: string,
    correlationId?: string
  ): Promise<void> {
    const metadata = createEventMetadata(userId, correlationId);
    const event = createMatterOpenedEvent(payload, metadata);
    await this.publish(event);
  }

  async publishMany(events: DomainEvent<unknown>[]): Promise<void> {
    if (!this.enabled || !this.eventBus) {
      events.forEach((event) => this.logEvent(event));
      return;
    }

    try {
      await this.eventBus.publishMany(events);
      events.forEach((event) => {
        this.log.info(
          { eventId: event.id, eventType: event.type, aggregateId: event.aggregateId },
          'Event published'
        );
      });
    } catch (error) {
      this.log.error({ error, eventCount: events.length }, 'Failed to publish events batch');
      throw error;
    }
  }

  private async publish(event: DomainEvent<unknown>): Promise<void> {
    if (!this.enabled || !this.eventBus) {
      this.logEvent(event);
      return;
    }

    try {
      await this.eventBus.publish(event);
      this.log.info(
        { eventId: event.id, eventType: event.type, aggregateId: event.aggregateId },
        'Event published'
      );
    } catch (error) {
      this.log.error(
        { error, eventId: event.id, eventType: event.type },
        'Failed to publish event'
      );
      throw error;
    }
  }

  private logEvent(event: DomainEvent<unknown>): void {
    this.log.info(
      {
        eventId: event.id,
        eventType: event.type,
        aggregateId: event.aggregateId,
        payload: event.payload,
        mode: 'log-only',
      },
      'Event (not published - event bus disabled)'
    );
  }
}

// Singleton instance - initialized when event bus is available
let publisherInstance: EventPublisher | null = null;

export function initializeEventPublisher(
  eventBus: EventBus | null,
  enabled: boolean = true
): EventPublisher {
  publisherInstance = new EventPublisher(eventBus, enabled);
  return publisherInstance;
}

export function getEventPublisher(): EventPublisher {
  if (!publisherInstance) {
    // Return a disabled publisher if not initialized
    publisherInstance = new EventPublisher(null, false);
  }
  return publisherInstance;
}

export { CONTRACT_EVENTS, OBLIGATION_EVENTS, MATTER_EVENTS };
