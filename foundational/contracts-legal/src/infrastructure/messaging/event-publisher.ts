/**
 * Contracts Legal Event Publisher
 *
 * Publishes contract events to the message bus
 * for consumption by other ecosystem services.
 */

import { randomUUID } from 'crypto';
import type { DomainEvent, EventMetadata } from '@ecosystem/messaging';

// ==========================================================================
// Event Types
// ==========================================================================

export const ContractsEventTypes = {
  // Contract events
  CONTRACT_CREATED: 'contracts-legal.contract.created',
  CONTRACT_UPDATED: 'contracts-legal.contract.updated',
  CONTRACT_SENT_FOR_SIGNATURES: 'contracts-legal.contract.sent_for_signatures',
  CONTRACT_EXECUTED: 'contracts-legal.contract.executed',
  CONTRACT_EXPIRED: 'contracts-legal.contract.expired',
  CONTRACT_TERMINATED: 'contracts-legal.contract.terminated',
  CONTRACT_RENEWED: 'contracts-legal.contract.renewed',

  // Signature events
  SIGNATURE_REQUESTED: 'contracts-legal.signature.requested',
  SIGNATURE_COMPLETED: 'contracts-legal.signature.completed',
  SIGNATURE_DECLINED: 'contracts-legal.signature.declined',
  SIGNATURE_EXPIRED: 'contracts-legal.signature.expired',

  // Template events
  TEMPLATE_PUBLISHED: 'contracts-legal.template.published',
  TEMPLATE_ARCHIVED: 'contracts-legal.template.archived',
} as const;

export type ContractsEventType = typeof ContractsEventTypes[keyof typeof ContractsEventTypes];

// ==========================================================================
// Event Payloads
// ==========================================================================

export interface ContractCreatedPayload {
  contractId: string;
  tenantId: string;
  contractNumber: string;
  title: string;
  contractType: string;
  ownerEntityId: string;
  totalValue?: { amount: number; currency: string };
  effectiveDate?: string;
  expirationDate?: string;
}

export interface ContractExecutedPayload {
  contractId: string;
  tenantId: string;
  contractNumber: string;
  ownerEntityId: string;
  executedAt: string;
  parties: Array<{ partyType: string; partyRole: string; name: string }>;
}

export interface SignatureCompletedPayload {
  signatureRequestId: string;
  contractId: string;
  tenantId: string;
  signerName: string;
  signerEmail: string;
  signedAt: string;
}

// ==========================================================================
// Publisher Interface
// ==========================================================================

export interface ContractsEventPublisher {
  publish<T>(eventType: ContractsEventType, aggregateId: string, payload: T): Promise<void>;
}

// ==========================================================================
// Implementation
// ==========================================================================

export class ContractsEventPublisherImpl implements ContractsEventPublisher {
  private readonly source = 'contracts-legal';

  constructor(
    private readonly messagingClient: {
      publish: <T>(event: DomainEvent<T>) => Promise<void>;
    } | null,
    private readonly correlationIdProvider: () => string = () => randomUUID()
  ) {}

  async publish<T>(eventType: ContractsEventType, aggregateId: string, payload: T): Promise<void> {
    if (!this.messagingClient) {
      console.log(`[ContractsLegal] Event publishing disabled - would publish: ${eventType}`);
      return;
    }

    const event = this.createEvent(eventType, aggregateId, payload);
    await this.messagingClient.publish(event);
    console.log(`[ContractsLegal] Published event: ${eventType}`, { aggregateId });
  }

  private createEvent<T>(
    eventType: ContractsEventType,
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

  private getAggregateType(eventType: ContractsEventType): string {
    if (eventType.includes('.contract.')) return 'Contract';
    if (eventType.includes('.signature.')) return 'SignatureRequest';
    if (eventType.includes('.template.')) return 'ContractTemplate';
    return 'Unknown';
  }
}

/**
 * Factory function to create event publisher
 */
export function createContractsEventPublisher(
  messagingClient: { publish: <T>(event: DomainEvent<T>) => Promise<void> } | null
): ContractsEventPublisher {
  return new ContractsEventPublisherImpl(messagingClient);
}

// Global instance
let globalPublisher: ContractsEventPublisher | null = null;

export function setGlobalEventPublisher(publisher: ContractsEventPublisher): void {
  globalPublisher = publisher;
}

export function getGlobalEventPublisher(): ContractsEventPublisher | null {
  return globalPublisher;
}
