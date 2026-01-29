/**
 * Domain Event Publisher
 *
 * Publishes entity governance events to the message bus
 * for consumption by other ecosystem services.
 */

import { randomUUID } from 'crypto';
import type { DomainEvent, EventMetadata } from '@ecosystem/messaging';
import { EntityEventTypes, type EntityEventType } from '../../domain/events/entity-events.js';

export interface EventPublisher {
  publish<T>(eventType: EntityEventType, aggregateId: string, payload: T): Promise<void>;
  publishMany<T>(events: Array<{ type: EntityEventType; aggregateId: string; payload: T }>): Promise<void>;
}

export class EntityEventPublisher implements EventPublisher {
  private readonly source = 'entity-governance';

  constructor(
    private readonly messagingClient: {
      publish: <T>(event: DomainEvent<T>) => Promise<void>;
    },
    private readonly correlationIdProvider: () => string = () => randomUUID()
  ) {}

  async publish<T>(eventType: EntityEventType, aggregateId: string, payload: T): Promise<void> {
    const event = this.createEvent(eventType, aggregateId, payload);
    await this.messagingClient.publish(event);
  }

  async publishMany<T>(
    events: Array<{ type: EntityEventType; aggregateId: string; payload: T }>
  ): Promise<void> {
    const correlationId = this.correlationIdProvider();
    const domainEvents = events.map((e, index) =>
      this.createEvent(e.type, e.aggregateId, e.payload, correlationId, index === 0 ? undefined : correlationId)
    );
    await Promise.all(domainEvents.map(event => this.messagingClient.publish(event)));
  }

  private createEvent<T>(
    eventType: EntityEventType,
    aggregateId: string,
    payload: T,
    correlationId?: string,
    causationId?: string
  ): DomainEvent<T> {
    const now = new Date();
    const metadata: EventMetadata = {
      correlationId: correlationId ?? this.correlationIdProvider(),
      ...(causationId !== undefined && { causationId }),
      source: this.source,
      timestamp: now,
    };

    return {
      id: randomUUID(),
      type: eventType,
      aggregateId,
      aggregateType: this.getAggregateType(eventType),
      payload,
      metadata,
      occurredAt: now,
      version: 1,
    };
  }

  private getAggregateType(eventType: EntityEventType): string {
    if (eventType.includes('.entity.')) return 'LegalEntity';
    if (eventType.includes('.structure.')) return 'CorporateStructure';
    if (eventType.includes('.governance.')) return 'Governance';
    if (eventType.includes('.shareholders.')) return 'Shareholder';
    if (eventType.includes('.compliance.')) return 'Compliance';
    return 'Unknown';
  }
}

/**
 * Factory function to create event publisher with dependencies
 */
export function createEventPublisher(
  messagingClient: { publish: <T>(event: DomainEvent<T>) => Promise<void> }
): EventPublisher {
  return new EntityEventPublisher(messagingClient);
}
