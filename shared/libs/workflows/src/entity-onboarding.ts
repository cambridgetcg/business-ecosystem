/**
 * Entity Onboarding Workflow
 *
 * Coordinates the creation of a new legal entity across multiple domains:
 * 1. Create the legal entity
 * 2. Create KYC identity for the entity
 * 3. Create a bank account
 * 4. Set up accounting accounts
 *
 * Includes compensation logic for rollback if any step fails.
 */

import { pino } from 'pino';
import type { Logger } from 'pino';

// Local type definitions matching @ecosystem/saga
export interface SagaStep<TPayload = unknown, TContext = unknown> {
  name: string;
  execute: (payload: TPayload, context: TContext) => Promise<Partial<TContext>>;
  compensate?: (payload: TPayload, context: TContext) => Promise<void>;
  timeout?: number;
}

export interface SagaDefinition<TPayload = unknown, TContext = unknown> {
  type: string;
  steps: SagaStep<TPayload, TContext>[];
  onComplete?: (payload: TPayload, context: TContext) => Promise<void>;
  onFailed?: (payload: TPayload, context: TContext, error: Error) => Promise<void>;
  defaultTimeout?: number;
}

const logger: Logger = pino({ name: 'entity-onboarding' });

export interface EntityOnboardingPayload {
  name: string;
  legalName: string;
  entityType: 'corporation' | 'llc' | 'partnership' | 'sole_proprietorship';
  jurisdictionCountry: string;
  jurisdictionState?: string;
  taxId?: string;
  bankAccountName?: string;
  bankName?: string;
  currency?: string;
  initiatedBy?: string;
}

export interface EntityOnboardingContext {
  entityId?: string;
  kycIdentityId?: string;
  bankAccountId?: string;
  accountingSetupComplete?: boolean;
}

// Service clients interface for dependency injection
export interface ServiceClients {
  entityGovernance: {
    createEntity(data: any): Promise<{ id: string }>;
    deleteEntity(id: string): Promise<void>;
  };
  kycIdentity: {
    createIdentity(data: any): Promise<{ id: string }>;
    deleteIdentity(id: string): Promise<void>;
  };
  bankingTreasury: {
    createBankAccount(data: any): Promise<{ id: string }>;
    deleteBankAccount(id: string): Promise<void>;
  };
  accounting: {
    createAccount(data: any): Promise<{ id: string }>;
    deleteAccount(id: string): Promise<void>;
  };
}

/**
 * Create the entity onboarding saga definition
 */
export function createEntityOnboardingSaga(
  clients: ServiceClients
): SagaDefinition<EntityOnboardingPayload, EntityOnboardingContext> {
  const steps: SagaStep<EntityOnboardingPayload, EntityOnboardingContext>[] = [
    // Step 1: Create Legal Entity
    {
      name: 'createEntity',
      async execute(payload) {
        logger.info({ name: payload.name }, 'Creating legal entity');

        const entity = await clients.entityGovernance.createEntity({
          name: payload.name,
          legalName: payload.legalName,
          entityType: payload.entityType,
          jurisdictionCountry: payload.jurisdictionCountry,
          jurisdictionState: payload.jurisdictionState,
          taxId: payload.taxId,
        });

        logger.info({ entityId: entity.id }, 'Legal entity created');
        return { entityId: entity.id };
      },
      async compensate(payload, context) {
        if (context.entityId) {
          logger.info({ entityId: context.entityId }, 'Compensating: deleting entity');
          await clients.entityGovernance.deleteEntity(context.entityId);
        }
      },
      timeout: 30000,
    },

    // Step 2: Create KYC Identity
    {
      name: 'createKycIdentity',
      async execute(payload, context) {
        if (!context.entityId) {
          throw new Error('Entity ID not available');
        }

        logger.info({ entityId: context.entityId }, 'Creating KYC identity');

        const identity = await clients.kycIdentity.createIdentity({
          entityId: context.entityId,
          type: 'business',
          name: payload.legalName,
          country: payload.jurisdictionCountry,
          state: payload.jurisdictionState,
          taxId: payload.taxId,
        });

        logger.info({ identityId: identity.id }, 'KYC identity created');
        return { kycIdentityId: identity.id };
      },
      async compensate(payload, context) {
        if (context.kycIdentityId) {
          logger.info({ identityId: context.kycIdentityId }, 'Compensating: deleting KYC identity');
          await clients.kycIdentity.deleteIdentity(context.kycIdentityId);
        }
      },
      timeout: 30000,
    },

    // Step 3: Create Bank Account
    {
      name: 'createBankAccount',
      async execute(payload, context) {
        if (!context.entityId) {
          throw new Error('Entity ID not available');
        }

        // Skip if bank details not provided
        if (!payload.bankAccountName && !payload.bankName) {
          logger.info('Skipping bank account creation - no bank details provided');
          return {};
        }

        logger.info({ entityId: context.entityId }, 'Creating bank account');

        const bankAccount = await clients.bankingTreasury.createBankAccount({
          entityId: context.entityId,
          accountName: payload.bankAccountName || `${payload.name} Operating`,
          accountType: 'checking',
          bankName: payload.bankName || 'Default Bank',
          currency: payload.currency || 'USD',
          status: 'active',
          isPrimary: true,
        });

        logger.info({ bankAccountId: bankAccount.id }, 'Bank account created');
        return { bankAccountId: bankAccount.id };
      },
      async compensate(payload, context) {
        if (context.bankAccountId) {
          logger.info({ bankAccountId: context.bankAccountId }, 'Compensating: deleting bank account');
          await clients.bankingTreasury.deleteBankAccount(context.bankAccountId);
        }
      },
      timeout: 30000,
    },

    // Step 4: Set Up Accounting
    {
      name: 'setupAccounting',
      async execute(payload, context) {
        if (!context.entityId) {
          throw new Error('Entity ID not available');
        }

        logger.info({ entityId: context.entityId }, 'Setting up accounting');

        // Create default chart of accounts entries
        await clients.accounting.createAccount({
          entityId: context.entityId,
          name: 'Cash',
          type: 'asset',
          code: '1000',
        });

        await clients.accounting.createAccount({
          entityId: context.entityId,
          name: 'Accounts Receivable',
          type: 'asset',
          code: '1100',
        });

        await clients.accounting.createAccount({
          entityId: context.entityId,
          name: 'Accounts Payable',
          type: 'liability',
          code: '2000',
        });

        await clients.accounting.createAccount({
          entityId: context.entityId,
          name: 'Retained Earnings',
          type: 'equity',
          code: '3000',
        });

        logger.info({ entityId: context.entityId }, 'Accounting setup complete');
        return { accountingSetupComplete: true };
      },
      // No compensation for accounting - accounts should persist
      timeout: 60000,
    },
  ];

  return {
    type: 'entity-onboarding',
    steps,
    defaultTimeout: 5 * 60 * 1000, // 5 minutes total

    async onComplete(payload, context) {
      logger.info({
        entityId: context.entityId,
        kycIdentityId: context.kycIdentityId,
        bankAccountId: context.bankAccountId,
      }, 'Entity onboarding completed successfully');
    },

    async onFailed(payload, context, error) {
      logger.error({
        entityName: payload.name,
        error: error.message,
        partialContext: context,
      }, 'Entity onboarding failed');
    },
  };
}

/**
 * Mock service clients for testing
 */
export function createMockServiceClients(): ServiceClients {
  let entityCounter = 0;
  let identityCounter = 0;
  let bankAccountCounter = 0;
  let accountCounter = 0;

  return {
    entityGovernance: {
      async createEntity(data) {
        entityCounter++;
        return { id: `entity-${entityCounter}` };
      },
      async deleteEntity(id) {
        logger.info({ id }, 'Mock: deleting entity');
      },
    },
    kycIdentity: {
      async createIdentity(data) {
        identityCounter++;
        return { id: `identity-${identityCounter}` };
      },
      async deleteIdentity(id) {
        logger.info({ id }, 'Mock: deleting identity');
      },
    },
    bankingTreasury: {
      async createBankAccount(data) {
        bankAccountCounter++;
        return { id: `bank-account-${bankAccountCounter}` };
      },
      async deleteBankAccount(id) {
        logger.info({ id }, 'Mock: deleting bank account');
      },
    },
    accounting: {
      async createAccount(data) {
        accountCounter++;
        return { id: `account-${accountCounter}` };
      },
      async deleteAccount(id) {
        logger.info({ id }, 'Mock: deleting account');
      },
    },
  };
}
