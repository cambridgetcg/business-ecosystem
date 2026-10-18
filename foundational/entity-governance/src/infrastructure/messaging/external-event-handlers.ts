/**
 * External Event Handlers
 * Handles events from other services in the ecosystem
 */

import { eq } from 'drizzle-orm';
import type { DomainEvent, EventHandler } from '@ecosystem/messaging';
import { getDb, legalEntities } from '../persistence/index.js';
import {
  getGlobalEventPublisher,
  EntityGovernanceEventTypes,
} from './event-publisher.js';

// ==========================================================================
// Event Payload Types (from kyc-identity)
// ==========================================================================

interface VerificationApprovedPayload {
  requestId: string;
  identityId: string;
  tenantId: string;
  externalId?: string | null; // Entity ID in entity-governance
  verificationType: string;
  decision: string;
  decisionBy: string;
  decisionAt: string;
  metadata?: Record<string, unknown>;
}

interface VerificationRejectedPayload {
  requestId: string;
  identityId: string;
  tenantId: string;
  externalId?: string | null;
  verificationType: string;
  reason: string;
  rejectedBy: string;
  rejectedAt: string;
}

// ==========================================================================
// Event Type Constants
// ==========================================================================

export const ExternalEventTypes = {
  // KYC Identity events
  KYC_VERIFICATION_APPROVED: 'kyc-identity.verification.approved',
  KYC_VERIFICATION_REJECTED: 'kyc-identity.verification.rejected',
  KYC_IDENTITY_VERIFIED: 'kyc-identity.identity.verified',
  KYC_IDENTITY_REJECTED: 'kyc-identity.identity.rejected',

  // Tax service events (future)
  TAX_ID_ASSIGNED: 'tax-service.tax_id.assigned',
  TAX_ID_VERIFIED: 'tax-service.tax_id.verified',
} as const;

// ==========================================================================
// Handlers
// ==========================================================================

/**
 * Handles KYC verification approval from kyc-identity
 * Updates entity metadata with KYC verification status
 */
export class KYCVerificationApprovedHandler implements EventHandler<VerificationApprovedPayload> {
  async handle(event: DomainEvent<VerificationApprovedPayload>): Promise<void> {
    const payload = event.payload;
    const entityId = payload.externalId ?? payload.metadata?.entityId as string | undefined;

    if (!entityId) {
      console.log(`[EntityGovernance] KYC verification approved but no entityId found in event`);
      return;
    }

    console.log(`[EntityGovernance] Received KYC verification approved for entity: ${entityId}`);

    try {
      const db = getDb();

      // Get current entity to preserve metadata
      const entityResults = await db.select({
        id: legalEntities.id,
        metadata: legalEntities.metadata,
      })
        .from(legalEntities)
        .where(eq(legalEntities.id, entityId));

      const entity = entityResults[0];
      if (!entity) {
        console.log(`[EntityGovernance] Entity not found: ${entityId}`);
        return;
      }

      // Update entity metadata with KYC verification status
      const updatedMetadata = {
        ...(entity.metadata as Record<string, unknown> || {}),
        kycVerification: {
          status: 'approved',
          requestId: payload.requestId,
          identityId: payload.identityId,
          verificationType: payload.verificationType,
          verifiedAt: payload.decisionAt,
          verifiedBy: payload.decisionBy,
        },
      };

      await db.update(legalEntities)
        .set({
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(legalEntities.id, entityId));

      console.log(`[EntityGovernance] Updated entity ${entityId} with KYC verification status`);

      // Publish entity KYC updated event
      const eventPublisher = getGlobalEventPublisher();
      if (eventPublisher) {
        await eventPublisher.publish(
          EntityGovernanceEventTypes.ENTITY_KYC_UPDATED,
          entityId,
          {
            entityId,
            tenantId: payload.tenantId,
            kycStatus: 'approved',
            verificationType: payload.verificationType,
            verifiedAt: payload.decisionAt,
          }
        );
      }
    } catch (error) {
      console.error(`[EntityGovernance] Error handling KYC verification approved event:`, error);
      throw error; // Re-throw to trigger DLQ
    }
  }
}

/**
 * Handles KYC verification rejection from kyc-identity
 * Updates entity metadata with rejection status
 */
export class KYCVerificationRejectedHandler implements EventHandler<VerificationRejectedPayload> {
  async handle(event: DomainEvent<VerificationRejectedPayload>): Promise<void> {
    const payload = event.payload;
    const entityId = payload.externalId;

    if (!entityId) {
      console.log(`[EntityGovernance] KYC verification rejected but no entityId found`);
      return;
    }

    console.log(`[EntityGovernance] Received KYC verification rejected for entity: ${entityId}`);

    try {
      const db = getDb();

      // Get current entity metadata
      const entityResults = await db.select({
        id: legalEntities.id,
        metadata: legalEntities.metadata,
      })
        .from(legalEntities)
        .where(eq(legalEntities.id, entityId));

      const entity = entityResults[0];
      if (!entity) {
        console.log(`[EntityGovernance] Entity not found: ${entityId}`);
        return;
      }

      // Update metadata with rejection status
      const updatedMetadata = {
        ...(entity.metadata as Record<string, unknown> || {}),
        kycVerification: {
          status: 'rejected',
          requestId: payload.requestId,
          identityId: payload.identityId,
          verificationType: payload.verificationType,
          rejectedAt: payload.rejectedAt,
          rejectedBy: payload.rejectedBy,
          reason: payload.reason,
        },
      };

      await db.update(legalEntities)
        .set({
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(legalEntities.id, entityId));

      console.log(`[EntityGovernance] Updated entity ${entityId} with KYC rejection status`);

      // Publish entity KYC updated event
      const eventPublisher = getGlobalEventPublisher();
      if (eventPublisher) {
        await eventPublisher.publish(
          EntityGovernanceEventTypes.ENTITY_KYC_UPDATED,
          entityId,
          {
            entityId,
            tenantId: payload.tenantId,
            kycStatus: 'rejected',
            verificationType: payload.verificationType,
            rejectedAt: payload.rejectedAt,
            reason: payload.reason,
          }
        );
      }
    } catch (error) {
      console.error(`[EntityGovernance] Error handling KYC verification rejected event:`, error);
      throw error;
    }
  }
}

/**
 * Handles tax ID assignment from tax service
 * Updates entity with verified tax ID
 */
export class TaxIdAssignedHandler implements EventHandler<{
  entityId: string;
  tenantId: string;
  taxId: string;
  taxIdType: string;
  jurisdiction: string;
  assignedAt: string;
}> {
  async handle(event: DomainEvent<{
    entityId: string;
    tenantId: string;
    taxId: string;
    taxIdType: string;
    jurisdiction: string;
    assignedAt: string;
  }>): Promise<void> {
    const payload = event.payload;

    console.log(`[EntityGovernance] Received tax ID assigned for entity: ${payload.entityId}`);

    try {
      const db = getDb();

      // Get current entity metadata
      const entityResults = await db.select({
        id: legalEntities.id,
        metadata: legalEntities.metadata,
      })
        .from(legalEntities)
        .where(eq(legalEntities.id, payload.entityId));

      const entity = entityResults[0];
      if (!entity) {
        console.log(`[EntityGovernance] Entity not found: ${payload.entityId}`);
        return;
      }

      // Update entity with tax ID
      const updatedMetadata = {
        ...(entity.metadata as Record<string, unknown> || {}),
        taxIdVerification: {
          status: 'assigned',
          taxIdType: payload.taxIdType,
          jurisdiction: payload.jurisdiction,
          assignedAt: payload.assignedAt,
        },
      };

      await db.update(legalEntities)
        .set({
          taxId: payload.taxId,
          metadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(legalEntities.id, payload.entityId));

      console.log(`[EntityGovernance] Updated entity ${payload.entityId} with tax ID: ${payload.taxId}`);
    } catch (error) {
      console.error(`[EntityGovernance] Error handling tax ID assigned event:`, error);
      throw error;
    }
  }
}

// ==========================================================================
// Handler Factory
// ==========================================================================

export function createExternalEventHandlers() {
  return {
    kycVerificationApprovedHandler: new KYCVerificationApprovedHandler(),
    kycVerificationRejectedHandler: new KYCVerificationRejectedHandler(),
    taxIdAssignedHandler: new TaxIdAssignedHandler(),
  };
}
