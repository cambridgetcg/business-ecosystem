/**
 * Entity Creation Saga
 * Orchestrates the creation of a new entity across multiple services
 */

import pino from 'pino';
import type {
  SagaDefinition,
  SagaStep,
  SagaContext,
  StepResult,
} from '../saga-types.js';

const logger = pino({ name: 'entity-creation-saga' });

// ============================================================================
// Input/Output Types
// ============================================================================

export interface EntityCreationInput {
  /** Name of the entity */
  entityName: string;
  /** Type of entity (e.g., 'corporation', 'llc', 'partnership') */
  entityType: string;
  /** Jurisdiction of incorporation */
  jurisdiction: string;
  /** Formation date */
  formationDate: string;
  /** Parent entity ID (optional) */
  parentEntityId?: string;
  /** Registered address */
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  /** Regulatory frameworks applicable */
  regulatoryFrameworks?: string[];
  /** Initial officers/directors */
  officers?: Array<{
    name: string;
    role: string;
    email?: string;
  }>;
  /** Tax configuration */
  taxConfig?: {
    taxId?: string;
    vatRegistered?: boolean;
    fiscalYearEnd?: string;
  };
  /** Security policy template to apply */
  securityPolicyTemplate?: string;
}

export interface EntityCreationResult {
  entityId: string;
  entityGovernance: {
    entityId: string;
    status: string;
  };
  compliance: {
    obligationIds: string[];
  };
  tax: {
    registrationId: string;
  };
  security: {
    policyId: string;
  };
}

// ============================================================================
// Service Configuration
// ============================================================================

export interface EntityCreationSagaConfig {
  entityGovernanceUrl: string;
  complianceUrl: string;
  taxUrl: string;
  securityUrl: string;
  timeout?: number;
}

// ============================================================================
// Saga Definition Factory
// ============================================================================

export function createEntityCreationSaga(
  config: EntityCreationSagaConfig
): SagaDefinition {
  const timeout = config.timeout ?? 30000;

  // ==========================================================================
  // Step 1: Create Entity in Entity Governance
  // ==========================================================================

  const createEntityStep: SagaStep<EntityCreationInput, { entityId: string }> = {
    name: 'create-entity',
    description: 'Create entity record in Entity Governance service',
    service: 'entity-governance',
    action: 'createEntity',
    timeoutMs: timeout,
    retries: 2,

    inputMapper: (context: SagaContext) => context.input as EntityCreationInput,

    outputMapper: (result) => ({
      entityId: result.entityId,
    }),

    execute: async (input: EntityCreationInput, context: SagaContext): Promise<StepResult> => {
      logger.info({ input, executionId: context.executionId }, 'Creating entity');

      try {
        const response = await fetch(`${config.entityGovernanceUrl}/entities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': context.executionId,
          },
          body: JSON.stringify({
            name: input.entityName,
            type: input.entityType,
            jurisdiction: input.jurisdiction,
            formationDate: input.formationDate,
            parentEntityId: input.parentEntityId,
            address: input.address,
            officers: input.officers,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          return {
            success: false,
            error: {
              code: 'ENTITY_CREATION_FAILED',
              message: `Failed to create entity: ${response.status}`,
              details: errorBody,
            },
          };
        }

        const data = await response.json();
        return {
          success: true,
          data: { entityId: data.id || data.entityId },
        };
      } catch (error) {
        logger.error({ error, executionId: context.executionId }, 'Entity creation failed');
        return {
          success: false,
          error: {
            code: 'ENTITY_CREATION_ERROR',
            message: error instanceof Error ? error.message : 'Entity creation failed',
          },
        };
      }
    },

    compensate: async (context: SagaContext): Promise<StepResult> => {
      const entityId = (context.stepResults['create-entity'] as { entityId: string })?.entityId;

      if (!entityId) {
        return { success: true }; // Nothing to compensate
      }

      logger.info({ entityId, executionId: context.executionId }, 'Compensating: deleting entity');

      try {
        const response = await fetch(`${config.entityGovernanceUrl}/entities/${entityId}`, {
          method: 'DELETE',
          headers: {
            'X-Correlation-ID': context.executionId,
          },
        });

        if (!response.ok && response.status !== 404) {
          return {
            success: false,
            error: {
              code: 'ENTITY_DELETE_FAILED',
              message: `Failed to delete entity: ${response.status}`,
            },
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ENTITY_DELETE_ERROR',
            message: error instanceof Error ? error.message : 'Entity deletion failed',
          },
        };
      }
    },
  };

  // ==========================================================================
  // Step 2: Create Compliance Obligations
  // ==========================================================================

  const createComplianceStep: SagaStep<
    { entityId: string; frameworks: string[] },
    { obligationIds: string[] }
  > = {
    name: 'create-compliance',
    description: 'Create compliance obligations based on jurisdiction and entity type',
    service: 'compliance',
    action: 'createObligations',
    timeoutMs: timeout,
    retries: 2,

    inputMapper: (context: SagaContext) => {
      const input = context.input as EntityCreationInput;
      const entityResult = context.stepResults['create-entity'] as { entityId: string };
      return {
        entityId: entityResult.entityId,
        frameworks: input.regulatoryFrameworks || ['general'],
      };
    },

    outputMapper: (result) => ({
      obligationIds: result.obligationIds,
    }),

    execute: async (input, context: SagaContext): Promise<StepResult> => {
      logger.info({ input, executionId: context.executionId }, 'Creating compliance obligations');

      try {
        const creationInput = context.input as EntityCreationInput;

        const response = await fetch(`${config.complianceUrl}/obligations/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': context.executionId,
          },
          body: JSON.stringify({
            entityId: input.entityId,
            entityType: creationInput.entityType,
            jurisdiction: creationInput.jurisdiction,
            frameworks: input.frameworks,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          return {
            success: false,
            error: {
              code: 'COMPLIANCE_CREATION_FAILED',
              message: `Failed to create compliance obligations: ${response.status}`,
              details: errorBody,
            },
          };
        }

        const data = await response.json();
        return {
          success: true,
          data: { obligationIds: data.obligationIds || [] },
        };
      } catch (error) {
        logger.error({ error, executionId: context.executionId }, 'Compliance creation failed');
        return {
          success: false,
          error: {
            code: 'COMPLIANCE_CREATION_ERROR',
            message: error instanceof Error ? error.message : 'Compliance creation failed',
          },
        };
      }
    },

    compensate: async (context: SagaContext): Promise<StepResult> => {
      const result = context.stepResults['create-compliance'] as { obligationIds: string[] };
      const obligationIds = result?.obligationIds || [];

      if (obligationIds.length === 0) {
        return { success: true };
      }

      logger.info(
        { obligationIds, executionId: context.executionId },
        'Compensating: deleting compliance obligations'
      );

      try {
        const response = await fetch(`${config.complianceUrl}/obligations/batch`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': context.executionId,
          },
          body: JSON.stringify({ obligationIds }),
        });

        if (!response.ok && response.status !== 404) {
          return {
            success: false,
            error: {
              code: 'COMPLIANCE_DELETE_FAILED',
              message: `Failed to delete obligations: ${response.status}`,
            },
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'COMPLIANCE_DELETE_ERROR',
            message: error instanceof Error ? error.message : 'Obligation deletion failed',
          },
        };
      }
    },
  };

  // ==========================================================================
  // Step 3: Create Tax Registration
  // ==========================================================================

  const createTaxRegistrationStep: SagaStep<
    { entityId: string; taxConfig?: EntityCreationInput['taxConfig'] },
    { registrationId: string }
  > = {
    name: 'create-tax-registration',
    description: 'Register entity with tax service',
    service: 'tax',
    action: 'createRegistration',
    timeoutMs: timeout,
    retries: 2,

    shouldExecute: (context: SagaContext) => {
      // Skip if no tax configuration needed
      const input = context.input as EntityCreationInput;
      return input.taxConfig !== undefined || input.jurisdiction !== undefined;
    },

    inputMapper: (context: SagaContext) => {
      const input = context.input as EntityCreationInput;
      const entityResult = context.stepResults['create-entity'] as { entityId: string };
      return {
        entityId: entityResult.entityId,
        taxConfig: input.taxConfig,
      };
    },

    outputMapper: (result) => ({
      registrationId: result.registrationId,
    }),

    execute: async (input, context: SagaContext): Promise<StepResult> => {
      logger.info({ input, executionId: context.executionId }, 'Creating tax registration');

      try {
        const creationInput = context.input as EntityCreationInput;

        const response = await fetch(`${config.taxUrl}/registrations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': context.executionId,
          },
          body: JSON.stringify({
            entityId: input.entityId,
            entityName: creationInput.entityName,
            entityType: creationInput.entityType,
            jurisdiction: creationInput.jurisdiction,
            address: creationInput.address,
            taxId: input.taxConfig?.taxId,
            vatRegistered: input.taxConfig?.vatRegistered,
            fiscalYearEnd: input.taxConfig?.fiscalYearEnd,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          return {
            success: false,
            error: {
              code: 'TAX_REGISTRATION_FAILED',
              message: `Failed to create tax registration: ${response.status}`,
              details: errorBody,
            },
          };
        }

        const data = await response.json();
        return {
          success: true,
          data: { registrationId: data.id || data.registrationId },
        };
      } catch (error) {
        logger.error({ error, executionId: context.executionId }, 'Tax registration failed');
        return {
          success: false,
          error: {
            code: 'TAX_REGISTRATION_ERROR',
            message: error instanceof Error ? error.message : 'Tax registration failed',
          },
        };
      }
    },

    compensate: async (context: SagaContext): Promise<StepResult> => {
      const result = context.stepResults['create-tax-registration'] as { registrationId: string };
      const registrationId = result?.registrationId;

      if (!registrationId) {
        return { success: true };
      }

      logger.info(
        { registrationId, executionId: context.executionId },
        'Compensating: deleting tax registration'
      );

      try {
        const response = await fetch(`${config.taxUrl}/registrations/${registrationId}`, {
          method: 'DELETE',
          headers: {
            'X-Correlation-ID': context.executionId,
          },
        });

        if (!response.ok && response.status !== 404) {
          return {
            success: false,
            error: {
              code: 'TAX_REGISTRATION_DELETE_FAILED',
              message: `Failed to delete tax registration: ${response.status}`,
            },
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TAX_REGISTRATION_DELETE_ERROR',
            message: error instanceof Error ? error.message : 'Tax registration deletion failed',
          },
        };
      }
    },
  };

  // ==========================================================================
  // Step 4: Set Up Security Policies
  // ==========================================================================

  const setupSecurityStep: SagaStep<
    { entityId: string; template?: string },
    { policyId: string }
  > = {
    name: 'setup-security',
    description: 'Configure security policies for the entity',
    service: 'corporate-security',
    action: 'createPolicy',
    timeoutMs: timeout,
    retries: 2,

    inputMapper: (context: SagaContext) => {
      const input = context.input as EntityCreationInput;
      const entityResult = context.stepResults['create-entity'] as { entityId: string };
      return {
        entityId: entityResult.entityId,
        template: input.securityPolicyTemplate,
      };
    },

    outputMapper: (result) => ({
      policyId: result.policyId,
    }),

    execute: async (input, context: SagaContext): Promise<StepResult> => {
      logger.info({ input, executionId: context.executionId }, 'Setting up security policies');

      try {
        const creationInput = context.input as EntityCreationInput;

        const response = await fetch(`${config.securityUrl}/policies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': context.executionId,
          },
          body: JSON.stringify({
            entityId: input.entityId,
            entityName: creationInput.entityName,
            template: input.template || 'default',
            jurisdiction: creationInput.jurisdiction,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          return {
            success: false,
            error: {
              code: 'SECURITY_SETUP_FAILED',
              message: `Failed to set up security policies: ${response.status}`,
              details: errorBody,
            },
          };
        }

        const data = await response.json();
        return {
          success: true,
          data: { policyId: data.id || data.policyId },
        };
      } catch (error) {
        logger.error({ error, executionId: context.executionId }, 'Security setup failed');
        return {
          success: false,
          error: {
            code: 'SECURITY_SETUP_ERROR',
            message: error instanceof Error ? error.message : 'Security setup failed',
          },
        };
      }
    },

    compensate: async (context: SagaContext): Promise<StepResult> => {
      const result = context.stepResults['setup-security'] as { policyId: string };
      const policyId = result?.policyId;

      if (!policyId) {
        return { success: true };
      }

      logger.info(
        { policyId, executionId: context.executionId },
        'Compensating: deleting security policy'
      );

      try {
        const response = await fetch(`${config.securityUrl}/policies/${policyId}`, {
          method: 'DELETE',
          headers: {
            'X-Correlation-ID': context.executionId,
          },
        });

        if (!response.ok && response.status !== 404) {
          return {
            success: false,
            error: {
              code: 'SECURITY_POLICY_DELETE_FAILED',
              message: `Failed to delete security policy: ${response.status}`,
            },
          };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SECURITY_POLICY_DELETE_ERROR',
            message: error instanceof Error ? error.message : 'Security policy deletion failed',
          },
        };
      }
    },
  };

  // ==========================================================================
  // Complete Saga Definition
  // ==========================================================================

  return {
    metadata: {
      sagaId: 'entity-creation',
      name: 'Entity Creation Saga',
      description:
        'Creates a new entity across entity-governance, compliance, tax, and security services',
      version: '1.0.0',
      tags: ['entity', 'onboarding', 'multi-service'],
    },
    steps: [
      createEntityStep,
      createComplianceStep,
      createTaxRegistrationStep,
      setupSecurityStep,
    ],
    timeoutMs: timeout * 5, // Global timeout
    compensationStrategy: 'backward',

    onComplete: async (context: SagaContext) => {
      logger.info(
        { executionId: context.executionId, results: context.stepResults },
        'Entity creation saga completed successfully'
      );
    },

    onFailure: async (context: SagaContext, failedStep: string, error: unknown) => {
      logger.error(
        { executionId: context.executionId, failedStep, error },
        'Entity creation saga failed'
      );
    },
  };
}
