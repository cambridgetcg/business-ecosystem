/**
 * External Event Handlers
 * Handles events from other services in the ecosystem
 */

import type { DomainEvent, EventHandler } from '@ecosystem/messaging';
import { BankAccountRepository } from '../persistence/bank-account.repository.js';
import type { Pool } from 'pg';

// ==========================================================================
// Event Payload Types (from KYC-Identity)
// ==========================================================================

interface VerificationApprovedPayload {
  identityId: string;
  tenantId: string;
  entityId?: string; // The external entity ID from entity-governance
  identityType: string;
  verifiedAt: string;
  verifiedBy: string;
  metadata?: {
    entityId?: string;
    [key: string]: unknown;
  };
}

interface EntityCreatedPayload {
  entityId: string;
  tenantId: string;
  name: string;
  legalName?: string;
  entityType: string;
}

// ==========================================================================
// Event Type Constants
// ==========================================================================

export const ExternalEventTypes = {
  // KYC-Identity events
  KYC_VERIFICATION_APPROVED: 'kyc-identity.verification.approved',
  KYC_IDENTITY_VERIFIED: 'kyc-identity.identity.verified',

  // Entity Governance events (direct)
  ENTITY_CREATED: 'entity-governance.entity.created',
} as const;

// ==========================================================================
// Handlers
// ==========================================================================

/**
 * Handles KYC verification approval
 * Creates a primary bank account for the verified entity
 */
export class KYCVerificationApprovedHandler implements EventHandler<VerificationApprovedPayload> {
  constructor(
    private readonly accountRepository: BankAccountRepository
  ) {}

  async handle(event: DomainEvent<VerificationApprovedPayload>): Promise<void> {
    const payload = event.payload;

    // Get the entity ID from payload or metadata
    const entityId = payload.entityId ?? payload.metadata?.entityId;

    if (!entityId) {
      console.log(`[Banking] KYC verification approved but no entityId found - skipping account creation`);
      return;
    }

    console.log(`[Banking] KYC verification approved for entity: ${entityId}`);

    try {
      // Check if account already exists for this entity
      const existingAccounts = await this.accountRepository.findByEntityId(entityId);
      if (existingAccounts.length > 0) {
        console.log(`[Banking] Entity ${entityId} already has ${existingAccounts.length} account(s) - skipping`);
        return;
      }

      // Generate account number (in production, this would be from bank integration)
      const accountNumber = this.generateAccountNumber();

      // Create primary operating account
      const account = await this.accountRepository.create({
        entityId,
        accountName: 'Primary Operating Account',
        accountType: 'OPERATING',
        bankName: 'Default Bank', // In production, would be configurable
        accountNumber,
        currency: 'USD',
        balance: { amount: 0, currency: 'USD' },
        status: 'ACTIVE',
        isPrimary: true,
        version: 1,
      });

      console.log(`[Banking] Created primary account ${account.id} for entity ${entityId}`);
    } catch (error) {
      console.error(`[Banking] Error creating account for entity ${entityId}:`, error);
      throw error; // Re-throw to trigger DLQ
    }
  }

  private generateAccountNumber(): string {
    // Simple account number generator (in production, use bank's system)
    const prefix = '1001';
    const random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `${prefix}${random}`;
  }
}

/**
 * Handles entity creation directly (backup path if KYC is skipped)
 * Can be used for immediate account creation in development
 */
export class EntityCreatedHandler implements EventHandler<EntityCreatedPayload> {
  constructor(
    private readonly accountRepository: BankAccountRepository,
    private readonly autoCreateAccounts: boolean = false
  ) {}

  async handle(event: DomainEvent<EntityCreatedPayload>): Promise<void> {
    const payload = event.payload;

    console.log(`[Banking] Entity created: ${payload.entityId} (${payload.name})`);

    if (!this.autoCreateAccounts) {
      console.log(`[Banking] Auto-create disabled - waiting for KYC verification`);
      return;
    }

    // In development mode, might auto-create accounts
    try {
      const existingAccounts = await this.accountRepository.findByEntityId(payload.entityId);
      if (existingAccounts.length > 0) {
        console.log(`[Banking] Entity ${payload.entityId} already has accounts`);
        return;
      }

      const accountNumber = `1001${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;

      await this.accountRepository.create({
        entityId: payload.entityId,
        accountName: 'Primary Operating Account',
        accountType: 'OPERATING',
        bankName: 'Default Bank',
        accountNumber,
        currency: 'USD',
        balance: { amount: 0, currency: 'USD' },
        status: 'PENDING_VERIFICATION', // Not active until KYC passes
        isPrimary: true,
        version: 1,
      });

      console.log(`[Banking] Created pending account for entity ${payload.entityId}`);
    } catch (error) {
      console.error(`[Banking] Error handling entity created:`, error);
      throw error;
    }
  }
}

// ==========================================================================
// Handler Factory
// ==========================================================================

export function createExternalEventHandlers(pool: Pool) {
  const accountRepository = new BankAccountRepository(pool);

  return {
    kycVerificationApprovedHandler: new KYCVerificationApprovedHandler(accountRepository),
    entityCreatedHandler: new EntityCreatedHandler(accountRepository, false), // Don't auto-create
  };
}
