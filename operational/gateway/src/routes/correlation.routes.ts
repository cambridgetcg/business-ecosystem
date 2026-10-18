/**
 * Correlation Routes
 * REST API for event correlation and process tracking
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import pino from 'pino';
import {
  correlationService,
  type CorrelationService,
  ProcessStatus,
} from '../correlation/index.js';

const logger = pino({ name: 'correlation-routes' });

// Query schemas
const listProcessesQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
  entityId: z.string().uuid().optional(),
  processType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const entityIdParamSchema = z.object({
  entityId: z.string().uuid(),
});

const correlationIdParamSchema = z.object({
  id: z.string().uuid(),
});

const entityProcessesQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const slaViolationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Create correlation routes
 */
export function createCorrelationRoutes(service: CorrelationService = correlationService) {
  const router = new Hono();

  /**
   * GET /processes
   * List all processes with optional filtering
   */
  router.get('/processes', zValidator('query', listProcessesQuerySchema), async (c) => {
    const query = c.req.valid('query');

    logger.info({
      status: query.status,
      entityId: query.entityId,
      processType: query.processType,
      limit: query.limit,
      offset: query.offset,
    }, 'Listing processes');

    const status = query.status ? (query.status as ProcessStatus) : undefined;
    const result = service.getProcesses({
      status,
      entityId: query.entityId,
      processType: query.processType,
      limit: query.limit,
      offset: query.offset,
    });

    return c.json({
      processes: result.processes,
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    });
  });

  /**
   * GET /processes/:id
   * Get a specific process by correlation ID
   */
  router.get('/processes/:id', zValidator('param', correlationIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');

    logger.debug({ correlationId: id }, 'Getting process details');

    const process = service.getProcess(id);
    if (!process) {
      return c.json({ error: 'Process not found' }, 404);
    }

    // Get the full event timeline
    const timeline = service.getProcessTimeline(id);

    return c.json({
      ...process,
      domains: Array.from(process.domains),
      events: timeline,
    });
  });

  /**
   * GET /processes/:id/timeline
   * Get the event timeline for a process
   */
  router.get('/processes/:id/timeline', zValidator('param', correlationIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');

    logger.debug({ correlationId: id }, 'Getting process timeline');

    const process = service.getProcess(id);
    if (!process) {
      return c.json({ error: 'Process not found' }, 404);
    }

    const timeline = service.getProcessTimeline(id);

    return c.json({
      correlationId: id,
      processType: process.processType,
      status: process.status,
      events: timeline,
      eventCount: timeline.length,
    });
  });

  /**
   * GET /processes/:id/sla
   * Check SLA status for a process
   */
  router.get('/processes/:id/sla', zValidator('param', correlationIdParamSchema), async (c) => {
    const { id } = c.req.valid('param');

    logger.debug({ correlationId: id }, 'Checking process SLA');

    const slaStatus = service.checkSLA(id);
    if (!slaStatus) {
      return c.json({ error: 'Process not found' }, 404);
    }

    const process = service.getProcess(id);

    return c.json({
      correlationId: id,
      processType: process?.processType,
      processStatus: process?.status,
      sla: slaStatus,
    });
  });

  /**
   * GET /entity/:entityId
   * Get all processes for an entity
   */
  router.get(
    '/entity/:entityId',
    zValidator('param', entityIdParamSchema),
    zValidator('query', entityProcessesQuerySchema),
    async (c) => {
      const { entityId } = c.req.valid('param');
      const query = c.req.valid('query');

      logger.info({ entityId, ...query }, 'Getting processes for entity');

      const status = query.status ? (query.status as ProcessStatus) : undefined;
      const result = service.getProcessSummariesByEntity(entityId, {
        status,
        limit: query.limit,
        offset: query.offset,
      });

      return c.json({
        entityId,
        processes: result.processes,
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      });
    }
  );

  /**
   * GET /entity/:entityId/active
   * Get active processes for an entity
   */
  router.get('/entity/:entityId/active', zValidator('param', entityIdParamSchema), async (c) => {
    const { entityId } = c.req.valid('param');

    logger.debug({ entityId }, 'Getting active processes for entity');

    const processes = service.getProcessesByEntity(entityId)
      .filter(p => p.status === ProcessStatus.Pending || p.status === ProcessStatus.InProgress);

    return c.json({
      entityId,
      processes: processes.map(p => ({
        correlationId: p.correlationId,
        processType: p.processType,
        status: p.status,
        eventCount: p.events.length,
        domains: Array.from(p.domains),
        startedAt: p.startedAt,
        lastUpdatedAt: p.lastUpdatedAt,
        currentStep: p.currentStep,
        slaStatus: p.slaStatus ? {
          withinSLA: p.slaStatus.withinSLA,
          isWarning: p.slaStatus.isWarning,
          isViolated: p.slaStatus.isViolated,
          remainingMs: p.slaStatus.remainingMs,
        } : undefined,
      })),
      count: processes.length,
    });
  });

  /**
   * GET /sla/violations
   * Get all SLA violations
   */
  router.get('/sla/violations', zValidator('query', slaViolationsQuerySchema), async (c) => {
    const { limit, offset } = c.req.valid('query');

    logger.info({ limit, offset }, 'Getting SLA violations');

    const violations = service.getSLAViolations();
    const total = violations.length;

    // Apply pagination
    const paginatedViolations = violations.slice(offset, offset + limit);

    return c.json({
      violations: paginatedViolations,
      total,
      limit,
      offset,
    });
  });

  /**
   * GET /sla/at-risk
   * Get processes that are at risk of SLA violation
   */
  router.get('/sla/at-risk', async (c) => {
    logger.info('Getting at-risk processes');

    const atRiskProcesses = service.getProcessesAtRisk();

    return c.json({
      processes: atRiskProcesses.map(p => ({
        correlationId: p.correlationId,
        entityId: p.entityId,
        processType: p.processType,
        status: p.status,
        eventCount: p.events.length,
        domains: Array.from(p.domains),
        startedAt: p.startedAt,
        lastUpdatedAt: p.lastUpdatedAt,
        currentStep: p.currentStep,
        slaStatus: p.slaStatus,
      })),
      count: atRiskProcesses.length,
    });
  });

  /**
   * GET /dashboard
   * Get correlation dashboard summary
   */
  router.get('/dashboard', async (c) => {
    logger.debug('Getting correlation dashboard');

    const dashboard = service.getDashboard();

    return c.json(dashboard);
  });

  /**
   * GET /stats
   * Get correlation statistics
   */
  router.get('/stats', async (c) => {
    logger.debug('Getting correlation stats');

    const stats = service.getStats();

    return c.json(stats);
  });

  return router;
}
