/**
 * External Event Handlers
 * Handles events from other services in the ecosystem
 */

import type { DomainEvent, EventHandler } from '@ecosystem/messaging';

// ==========================================================================
// Event Payload Types
// ==========================================================================

interface EntityCreatedPayload {
  entityId: string;
  tenantId: string;
  name: string;
  legalName?: string;
  entityType: string;
}

interface KYCVerificationApprovedPayload {
  requestId: string;
  identityId: string;
  tenantId: string;
  externalId?: string | null;
  verificationType: string;
  decision: string;
  decisionBy: string;
  decisionAt: string;
}

// ==========================================================================
// Event Type Constants
// ==========================================================================

export const ExternalEventTypes = {
  // Entity Governance events
  ENTITY_CREATED: 'entity-governance.entity.created',
  ENTITY_KYC_UPDATED: 'entity-governance.entity.kyc_updated',

  // KYC Identity events
  KYC_VERIFICATION_APPROVED: 'kyc-identity.verification.approved',
} as const;

// ==========================================================================
// Handlers
// ==========================================================================

/**
 * Handles entity creation from entity-governance
 * Could auto-create standard contract templates for the entity
 */
export class EntityCreatedHandler implements EventHandler<EntityCreatedPayload> {
  async handle(event: DomainEvent<EntityCreatedPayload>): Promise<void> {
    const payload = event.payload;

    console.log(`[ContractsLegal] Received entity created event: ${payload.entityId}`);

    // Could auto-create standard NDA template, employment agreement template, etc.
    // For now, just log the event
    console.log(`[ContractsLegal] Entity ${payload.name} ready for contract management`);
  }
}

/**
 * Handles KYC verification approval
 * Enables contract execution for verified entities
 */
export class KYCVerificationApprovedHandler implements EventHandler<KYCVerificationApprovedPayload> {
  async handle(event: DomainEvent<KYCVerificationApprovedPayload>): Promise<void> {
    const payload = event.payload;
    const entityId = payload.externalId;

    if (!entityId) {
      console.log(`[ContractsLegal] KYC verification approved but no entityId found`);
      return;
    }

    console.log(`[ContractsLegal] Entity ${entityId} KYC verified - contract execution enabled`);

    // Could update any pending contracts waiting for KYC verification
    // or enable certain contract types that require verified parties
  }
}

// ==========================================================================
// Handler Factory
// ==========================================================================

export function createExternalEventHandlers() {
  return {
    entityCreatedHandler: new EntityCreatedHandler(),
    kycVerificationApprovedHandler: new KYCVerificationApprovedHandler(),
  };
}
