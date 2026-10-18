/**
 * Entity Governance Event Publisher
 *
 * Publishes entity governance events to the message bus
 * for consumption by other ecosystem services.
 */

import { randomUUID } from 'crypto';
import type { DomainEvent, EventMetadata } from '@ecosystem/messaging';

// ==========================================================================
// Event Types
// ==========================================================================

export const EntityGovernanceEventTypes = {
  // Entity events
  ENTITY_CREATED: 'entity-governance.entity.created',
  ENTITY_UPDATED: 'entity-governance.entity.updated',
  ENTITY_DISSOLVED: 'entity-governance.entity.dissolved',
  ENTITY_MERGED: 'entity-governance.entity.merged',
  ENTITY_KYC_UPDATED: 'entity-governance.entity.kyc_updated',

  // Officer events
  OFFICER_APPOINTED: 'entity-governance.officer.appointed',
  OFFICER_TERMINATED: 'entity-governance.officer.terminated',
  OFFICER_UPDATED: 'entity-governance.officer.updated',

  // Shareholder events
  SHAREHOLDER_ADDED: 'entity-governance.shareholder.added',
  SHAREHOLDER_REMOVED: 'entity-governance.shareholder.removed',
  SHAREHOLDING_CHANGED: 'entity-governance.shareholding.changed',

  // Director events
  DIRECTOR_APPOINTED: 'entity-governance.director.appointed',
  DIRECTOR_REMOVED: 'entity-governance.director.removed',
} as const;

export type EntityGovernanceEventType = typeof EntityGovernanceEventTypes[keyof typeof EntityGovernanceEventTypes];

// ==========================================================================
// Event Payloads
// ==========================================================================

export interface EntityCreatedPayload {
  entityId: string;
  tenantId: string;
  name: string;
  legalName: string;
  entityType: string;
  jurisdiction: string;
  taxId?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface EntityUpdatedPayload {
  entityId: string;
  tenantId: string;
  changes: Record<string, unknown>;
}

export interface OfficerAppointedPayload {
  entityId: string;
  tenantId: string;
  officerId: string;
  personId: string;
  name: string;
  title: string;
  email?: string;
}

export interface ShareholderAddedPayload {
  entityId: string;
  tenantId: string;
  shareholderId: string;
  shareholderType: string;
  name: string;
  ownershipPercentage?: number;
}

// ==========================================================================
// Publisher Interface
// ==========================================================================

export interface EntityGovernanceEventPublisher {
  publish<T>(eventType: EntityGovernanceEventType, aggregateId: string, payload: T): Promise<void>;
}

// ==========================================================================
// Implementation
// ==========================================================================

export class EntityGovernanceEventPublisherImpl implements EntityGovernanceEventPublisher {
  private readonly source = 'entity-governance';

  constructor(
    private readonly messagingClient: {
      publish: <T>(event: DomainEvent<T>) => Promise<void>;
    } | null,
    private readonly correlationIdProvider: () => string = () => randomUUID()
  ) {}

  async publish<T>(eventType: EntityGovernanceEventType, aggregateId: string, payload: T): Promise<void> {
    if (!this.messagingClient) {
      console.log(`[EntityGovernance] Event publishing disabled - would publish: ${eventType}`);
      return;
    }

    const event = this.createEvent(eventType, aggregateId, payload);
    await this.messagingClient.publish(event);
    console.log(`[EntityGovernance] Published event: ${eventType}`, { aggregateId });
  }

  private createEvent<T>(
    eventType: EntityGovernanceEventType,
    aggregateId: string,
    payload: T
  ): DomainEvent<T> {
    const now = new Date();
    const metadata: EventMetadata = {
      correlationId: this.correlationIdProvider(),
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

  private getAggregateType(eventType: EntityGovernanceEventType): string {
    if (eventType.includes('.entity.')) return 'LegalEntity';
    if (eventType.includes('.officer.')) return 'Officer';
    if (eventType.includes('.shareholder.')) return 'Shareholder';
    if (eventType.includes('.director.')) return 'Director';
    return 'Unknown';
  }
}

/**
 * Factory function to create event publisher
 */
export function createEntityGovernanceEventPublisher(
  messagingClient: { publish: <T>(event: DomainEvent<T>) => Promise<void> } | null
): EntityGovernanceEventPublisher {
  return new EntityGovernanceEventPublisherImpl(messagingClient);
}

// Global instance (set during app initialization)
let globalPublisher: EntityGovernanceEventPublisher | null = null;

export function setGlobalEventPublisher(publisher: EntityGovernanceEventPublisher): void {
  globalPublisher = publisher;
}

export function getGlobalEventPublisher(): EntityGovernanceEventPublisher | null {
  return globalPublisher;
}
