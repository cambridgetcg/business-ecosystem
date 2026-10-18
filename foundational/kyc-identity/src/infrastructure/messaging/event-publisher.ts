/**
 * KYC Event Publisher
 *
 * Publishes KYC identity events to the message bus
 * for consumption by other ecosystem services.
 */

import { randomUUID } from 'crypto';
import type { DomainEvent, EventMetadata } from '@ecosystem/messaging';

// ==========================================================================
// Event Types
// ==========================================================================

export const KYCEventTypes = {
  // Identity events
  IDENTITY_CREATED: 'kyc-identity.identity.created',
  IDENTITY_UPDATED: 'kyc-identity.identity.updated',
  IDENTITY_VERIFIED: 'kyc-identity.identity.verified',
  IDENTITY_REJECTED: 'kyc-identity.identity.rejected',

  // Verification events
  VERIFICATION_REQUESTED: 'kyc-identity.verification.requested',
  VERIFICATION_STARTED: 'kyc-identity.verification.started',
  VERIFICATION_APPROVED: 'kyc-identity.verification.approved',
  VERIFICATION_REJECTED: 'kyc-identity.verification.rejected',

  // Document events
  DOCUMENT_UPLOADED: 'kyc-identity.document.uploaded',
  DOCUMENT_VERIFIED: 'kyc-identity.document.verified',
  DOCUMENT_REJECTED: 'kyc-identity.document.rejected',

  // Risk events
  RISK_ASSESSED: 'kyc-identity.risk.assessed',
  PEP_FLAGGED: 'kyc-identity.risk.pep_flagged',
  SANCTIONS_MATCH: 'kyc-identity.risk.sanctions_match',
} as const;

export type KYCEventType = typeof KYCEventTypes[keyof typeof KYCEventTypes];

// ==========================================================================
// Event Payloads
// ==========================================================================

export interface IdentityVerifiedPayload {
  identityId: string;
  tenantId: string;
  externalId?: string; // Entity ID from entity-governance
  identityType: string;
  verifiedAt: string;
  verifiedBy: string;
  metadata?: Record<string, unknown>;
}

export interface VerificationApprovedPayload {
  requestId: string;
  identityId: string;
  tenantId: string;
  externalId?: string | null | undefined;
  verificationType: string;
  decision: string;
  decisionBy: string;
  decisionAt: string;
  metadata?: Record<string, unknown>;
}

// ==========================================================================
// Publisher Interface
// ==========================================================================

export interface KYCEventPublisher {
  publish<T>(eventType: KYCEventType, aggregateId: string, payload: T): Promise<void>;
}

// ==========================================================================
// Implementation
// ==========================================================================

export class KYCEventPublisherImpl implements KYCEventPublisher {
  private readonly source = 'kyc-identity';

  constructor(
    private readonly messagingClient: {
      publish: <T>(event: DomainEvent<T>) => Promise<void>;
    } | null,
    private readonly correlationIdProvider: () => string = () => randomUUID()
  ) {}

  async publish<T>(eventType: KYCEventType, aggregateId: string, payload: T): Promise<void> {
    if (!this.messagingClient) {
      console.log(`[KYC] Event publishing disabled - would publish: ${eventType}`);
      return;
    }

    const event = this.createEvent(eventType, aggregateId, payload);
    await this.messagingClient.publish(event);
    console.log(`[KYC] Published event: ${eventType}`, { aggregateId });
  }

  private createEvent<T>(
    eventType: KYCEventType,
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

  private getAggregateType(eventType: KYCEventType): string {
    if (eventType.includes('.identity.')) return 'Identity';
    if (eventType.includes('.verification.')) return 'VerificationRequest';
    if (eventType.includes('.document.')) return 'Document';
    if (eventType.includes('.risk.')) return 'RiskAssessment';
    return 'Unknown';
  }
}

/**
 * Factory function to create event publisher
 */
export function createKYCEventPublisher(
  messagingClient: { publish: <T>(event: DomainEvent<T>) => Promise<void> } | null
): KYCEventPublisher {
  return new KYCEventPublisherImpl(messagingClient);
}

// Global instance (set during app initialization)
let globalPublisher: KYCEventPublisher | null = null;

export function setGlobalEventPublisher(publisher: KYCEventPublisher): void {
  globalPublisher = publisher;
}

export function getGlobalEventPublisher(): KYCEventPublisher | null {
  return globalPublisher;
}
