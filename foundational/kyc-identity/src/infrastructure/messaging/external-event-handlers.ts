/**
 * External Event Handlers
 * Handles events from other services in the ecosystem
 */

import type { DomainEvent, EventHandler } from '@ecosystem/messaging';
import { IdentityCommandHandler, VerificationRequestCommandHandler } from '../../application/handlers/command-handlers.js';

// ==========================================================================
// Event Payload Types (from entity-governance)
// ==========================================================================

interface EntityCreatedPayload {
  entityId: string;
  tenantId: string;
  name: string;
  legalName?: string;
  entityType: string;
  jurisdiction?: string;
  taxId?: string;
  email?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

interface EntityUpdatedPayload {
  entityId: string;
  tenantId: string;
  changes: Record<string, unknown>;
}

// ==========================================================================
// Event Type Constants
// ==========================================================================

export const ExternalEventTypes = {
  // Entity Governance events
  ENTITY_CREATED: 'entity-governance.entity.created',
  ENTITY_UPDATED: 'entity-governance.entity.updated',
  ENTITY_DISSOLVED: 'entity-governance.entity.dissolved',
  OFFICER_APPOINTED: 'entity-governance.officer.appointed',
  SHAREHOLDER_ADDED: 'entity-governance.shareholder.added',
} as const;

// ==========================================================================
// Handlers
// ==========================================================================

/**
 * Handles entity creation from entity-governance
 * Creates a KYC identity record and initiates verification
 */
export class EntityCreatedHandler implements EventHandler<EntityCreatedPayload> {
  constructor(
    private readonly identityHandler: IdentityCommandHandler,
    private readonly verificationHandler: VerificationRequestCommandHandler
  ) {}

  async handle(event: DomainEvent<EntityCreatedPayload>): Promise<void> {
    const payload = event.payload;

    console.log(`[KYC] Received entity created event: ${payload.entityId}`);

    try {
      // Create identity record for the entity
      const identityId = await this.identityHandler.createIdentity({
        tenantId: payload.tenantId,
        externalId: payload.entityId, // Link to entity-governance entity
        type: 'CORPORATE',
        corporateDetails: payload.jurisdiction ? {
          legalName: payload.legalName ?? payload.name,
          registrationNumber: payload.taxId ?? 'PENDING', // Will be updated after verification
          registrationCountry: payload.jurisdiction,
        } : undefined,
        taxId: payload.taxId,
        email: payload.email,
        address: (payload.address?.line1 && payload.address?.city && payload.address?.country) ? {
          line1: payload.address.line1,
          line2: payload.address.line2,
          city: payload.address.city,
          state: payload.address.state,
          postalCode: payload.address.postalCode,
          country: payload.address.country,
        } : undefined,
        metadata: {
          sourceService: 'entity-governance',
          sourceEventId: event.id,
          correlationId: event.metadata.correlationId,
        },
      });

      console.log(`[KYC] Created identity ${identityId} for entity ${payload.entityId}`);

      // Auto-create verification request (KYB = Know Your Business)
      const requestId = await this.verificationHandler.createVerificationRequest({
        identityId,
        tenantId: payload.tenantId,
        type: 'KYB', // Know Your Business
        priority: 'NORMAL',
        requiredDocuments: [
          { documentType: 'ARTICLES_OF_INCORPORATION', required: true },
          { documentType: 'CERTIFICATE_OF_GOOD_STANDING', required: false },
          { documentType: 'EIN_LETTER', required: true },
        ],
        requestedBy: 'system',
        requestSource: 'AUTOMATED',
        metadata: {
          entityId: payload.entityId,
          autoCreated: true,
        },
      });

      console.log(`[KYC] Created verification request ${requestId} for identity ${identityId}`);
    } catch (error) {
      console.error(`[KYC] Error handling entity created event:`, error);
      throw error; // Re-throw to trigger DLQ
    }
  }
}

/**
 * Handles officer appointment from entity-governance
 * Creates individual identity for KYC if needed
 */
export class OfficerAppointedHandler implements EventHandler<{
  entityId: string;
  tenantId: string;
  officerId: string;
  personId: string;
  name: string;
  title: string;
  email?: string;
}> {
  constructor(
    private readonly identityHandler: IdentityCommandHandler
  ) {}

  async handle(event: DomainEvent<{
    entityId: string;
    tenantId: string;
    officerId: string;
    personId: string;
    name: string;
    title: string;
    email?: string;
  }>): Promise<void> {
    const payload = event.payload;

    console.log(`[KYC] Officer appointed: ${payload.name} as ${payload.title}`);

    try {
      // Parse name (assumes "First Last" format)
      const nameParts = payload.name.split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || 'Unknown';

      // Create identity for the officer
      const identityId = await this.identityHandler.createIdentity({
        tenantId: payload.tenantId,
        externalId: payload.personId,
        type: 'INDIVIDUAL',
        name: {
          firstName,
          lastName,
        },
        email: payload.email,
        metadata: {
          sourceService: 'entity-governance',
          associatedEntityId: payload.entityId,
          officerId: payload.officerId,
          title: payload.title,
          correlationId: event.metadata.correlationId,
        },
      });

      console.log(`[KYC] Created individual identity ${identityId} for officer ${payload.name}`);
    } catch (error) {
      console.error(`[KYC] Error handling officer appointed event:`, error);
      throw error;
    }
  }
}

// ==========================================================================
// Handler Factory
// ==========================================================================

export function createExternalEventHandlers(
  identityHandler: IdentityCommandHandler,
  verificationHandler: VerificationRequestCommandHandler
) {
  return {
    entityCreatedHandler: new EntityCreatedHandler(identityHandler, verificationHandler),
    officerAppointedHandler: new OfficerAppointedHandler(identityHandler),
  };
}
