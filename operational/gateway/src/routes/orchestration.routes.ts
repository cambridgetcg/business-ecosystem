/**
 * Orchestration Routes
 * API endpoints for saga orchestration
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import pino from 'pino';
import {
  SagaExecutor,
  createEntityCreationSaga,
  sagaExecutionQuerySchema,
} from '../orchestration/index.js';

const logger = pino({ name: 'orchestration-routes' });

// ============================================================================
// Validation Schemas
// ============================================================================

const entityCreationInputSchema = z.object({
  entityName: z.string().min(1).max(255),
  entityType: z.enum(['corporation', 'llc', 'partnership', 'sole-proprietorship', 'nonprofit', 'trust']),
  jurisdiction: z.string().min(2).max(100),
  formationDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  parentEntityId: z.string().uuid().optional(),
  address: z.object({
    line1: z.string().min(1).max(255),
    line2: z.string().max(255).optional(),
    city: z.string().min(1).max(100),
    state: z.string().max(100).optional(),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(2).max(100),
  }),
  regulatoryFrameworks: z.array(z.string()).optional(),
  officers: z.array(z.object({
    name: z.string().min(1).max(255),
    role: z.string().min(1).max(100),
    email: z.string().email().optional(),
  })).optional(),
  taxConfig: z.object({
    taxId: z.string().optional(),
    vatRegistered: z.boolean().optional(),
    fiscalYearEnd: z.string().optional(),
  }).optional(),
  securityPolicyTemplate: z.string().optional(),
});

const executionIdParamSchema = z.object({
  executionId: z.string().uuid(),
});

// ============================================================================
// Route Configuration
// ============================================================================

export interface OrchestrationRoutesConfig {
  entityGovernanceUrl: string;
  complianceUrl: string;
  taxUrl: string;
  securityUrl: string;
  stepTimeout?: number;
}

// ============================================================================
// Route Factory
// ============================================================================

export function createOrchestrationRoutes(config: OrchestrationRoutesConfig) {
  const router = new Hono();

  // Create saga executor instance
  const executor = new SagaExecutor({
    defaultStepTimeoutMs: config.stepTimeout ?? 30000,
    defaultRetries: 3,
    onEvent: async (event) => {
      logger.info({ event }, 'Saga event');
    },
  });

  // Create entity creation saga definition
  const entityCreationSaga = createEntityCreationSaga({
    entityGovernanceUrl: config.entityGovernanceUrl,
    complianceUrl: config.complianceUrl,
    taxUrl: config.taxUrl,
    securityUrl: config.securityUrl,
    timeout: config.stepTimeout,
  });

  // ==========================================================================
  // POST /entity-creation - Trigger entity creation saga
  // ==========================================================================

  router.post(
    '/entity-creation',
    zValidator('json', entityCreationInputSchema),
    async (c) => {
      const input = c.req.valid('json');
      const correlationId = c.req.header('X-Correlation-ID');
      const initiatedBy = c.req.header('X-Initiated-By') || 'api';

      logger.info({ input, correlationId }, 'Starting entity creation saga');

      try {
        const execution = await executor.execute(entityCreationSaga, input, {
          correlationId,
          initiatedBy,
        });

        // Return appropriate status based on execution result
        if (execution.status === 'completed') {
          return c.json({
            executionId: execution.executionId,
            status: execution.status,
            sagaId: execution.sagaId,
            result: execution.result,
            completedAt: execution.completedAt?.toISOString(),
          }, 201);
        }

        // Failed or compensated
        return c.json({
          executionId: execution.executionId,
          status: execution.status,
          sagaId: execution.sagaId,
          error: execution.error,
          steps: execution.steps.map((step) => ({
            name: step.stepName,
            status: step.status,
            completedAt: step.completedAt?.toISOString(),
            error: step.result?.error,
          })),
          completedAt: execution.completedAt?.toISOString(),
        }, 500);
      } catch (error) {
        logger.error({ error, input }, 'Failed to execute entity creation saga');
        return c.json({
          error: {
            code: 'SAGA_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Failed to execute saga',
          },
        }, 500);
      }
    }
  );

  // ==========================================================================
  // GET /executions - List saga executions
  // ==========================================================================

  router.get(
    '/executions',
    zValidator('query', sagaExecutionQuerySchema),
    async (c) => {
      const query = c.req.valid('query');

      const executions = executor.getExecutions({
        status: query.status,
        sagaId: query.sagaId,
        limit: query.limit,
        offset: query.offset,
      });

      return c.json({
        executions: executions.map((e) => ({
          executionId: e.executionId,
          sagaId: e.sagaId,
          status: e.status,
          startedAt: e.startedAt.toISOString(),
          completedAt: e.completedAt?.toISOString(),
          correlationId: e.correlationId,
          initiatedBy: e.initiatedBy,
        })),
        total: executions.length,
        limit: query.limit,
        offset: query.offset,
      });
    }
  );

  // ==========================================================================
  // GET /executions/:executionId - Get saga execution status
  // ==========================================================================

  router.get(
    '/executions/:executionId',
    zValidator('param', executionIdParamSchema),
    async (c) => {
      const { executionId } = c.req.valid('param');

      const execution = executor.getExecution(executionId);

      if (!execution) {
        return c.json({
          error: {
            code: 'EXECUTION_NOT_FOUND',
            message: `Saga execution with ID '${executionId}' not found`,
          },
        }, 404);
      }

      return c.json({
        executionId: execution.executionId,
        sagaId: execution.sagaId,
        status: execution.status,
        input: execution.input,
        currentStepIndex: execution.currentStepIndex,
        steps: execution.steps.map((step) => ({
          name: step.stepName,
          status: step.status,
          startedAt: step.startedAt?.toISOString(),
          completedAt: step.completedAt?.toISOString(),
          retryCount: step.retryCount,
          result: step.result,
          compensationResult: step.compensationResult,
        })),
        result: execution.result,
        error: execution.error,
        startedAt: execution.startedAt.toISOString(),
        completedAt: execution.completedAt?.toISOString(),
        correlationId: execution.correlationId,
        initiatedBy: execution.initiatedBy,
      });
    }
  );

  // ==========================================================================
  // GET /sagas - List available sagas
  // ==========================================================================

  router.get('/sagas', async (c) => {
    // Currently we only have entity-creation, but this can be extended
    const sagas = [
      {
        sagaId: entityCreationSaga.metadata.sagaId,
        name: entityCreationSaga.metadata.name,
        description: entityCreationSaga.metadata.description,
        version: entityCreationSaga.metadata.version,
        tags: entityCreationSaga.metadata.tags,
        steps: entityCreationSaga.steps.map((step) => ({
          name: step.name,
          description: step.description,
          service: step.service,
          action: step.action,
          hasCompensation: !!step.compensate,
        })),
      },
    ];

    return c.json({ sagas });
  });

  // ==========================================================================
  // GET /sagas/:sagaId - Get saga definition details
  // ==========================================================================

  router.get('/sagas/:sagaId', async (c) => {
    const sagaId = c.req.param('sagaId');

    // Currently we only have entity-creation
    if (sagaId !== entityCreationSaga.metadata.sagaId) {
      return c.json({
        error: {
          code: 'SAGA_NOT_FOUND',
          message: `Saga with ID '${sagaId}' not found`,
        },
      }, 404);
    }

    return c.json({
      sagaId: entityCreationSaga.metadata.sagaId,
      name: entityCreationSaga.metadata.name,
      description: entityCreationSaga.metadata.description,
      version: entityCreationSaga.metadata.version,
      tags: entityCreationSaga.metadata.tags,
      timeoutMs: entityCreationSaga.timeoutMs,
      compensationStrategy: entityCreationSaga.compensationStrategy,
      steps: entityCreationSaga.steps.map((step) => ({
        name: step.name,
        description: step.description,
        service: step.service,
        action: step.action,
        timeoutMs: step.timeoutMs,
        retries: step.retries,
        hasCompensation: !!step.compensate,
        hasConditionalExecution: !!step.shouldExecute,
      })),
    });
  });

  return router;
}
