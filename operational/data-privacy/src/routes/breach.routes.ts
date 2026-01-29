/**
 * Data Breach Management Routes
 * GDPR Articles 33-34 - 72-hour notification requirement
 *
 * Routes delegate to BreachService - no business logic here
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { createDomainLogger } from '../lib/logger.js';
import { eventPublisher, EventTypes } from '../lib/events.js';
import { BreachService } from '../domain/breach-management/index.js';
import { PrismaBreachRepository } from '../infrastructure/persistence/prisma-breach.repository.js';

const logger = createDomainLogger('breach-management');

// ============================================================================
// VALIDATORS
// ============================================================================

const CreateBreachSchema = z.object({
  entityId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category: z.enum(['CONFIDENTIALITY', 'INTEGRITY', 'AVAILABILITY', 'MIXED']),
  discoveredAt: z.string().datetime().transform((s) => new Date(s)),
  occurredAt: z.string().datetime().transform((s) => new Date(s)).optional(),
  affectedCount: z.number().int().positive().optional(),
  affectedCategories: z.array(z.string()).default([]),
  crossBorder: z.boolean().default(false),
  riskToSubjects: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  likelihoodOfHarm: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  authorityNotificationRequired: z.boolean().default(true),
  createdBy: z.string().min(1),
});

const UpdateBreachSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  affectedCount: z.number().int().positive().optional(),
  affectedCategories: z.array(z.string()).optional(),
  rootCause: z.string().optional(),
  attackVector: z.string().optional(),
  remediationPlan: z.string().optional(),
  lessonsLearned: z.string().optional(),
});

const NotifyAuthoritySchema = z.object({
  authorityReference: z.string().optional(),
  notifiedBy: z.string().min(1),
});

const NotifySubjectsSchema = z.object({
  notificationMethod: z.string().min(1),
  notifiedBy: z.string().min(1),
});

const BreachQuerySchema = z.object({
  entityId: z.string().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  pendingNotification: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// ============================================================================
// ROUTER FACTORY
// ============================================================================

export function createBreachRouter(prisma: PrismaClient) {
  const router = new Hono();

  // Dependency injection
  const repository = new PrismaBreachRepository(prisma);
  const service = new BreachService(repository);

  // ─────────────────────────────────────────────────────────────────────────
  // LIST BREACHES
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/', zValidator('query', BreachQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listBreaches(query as Parameters<typeof service.listBreaches>[0]);

    return c.json({
      data: result.data,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PENDING NOTIFICATION REPORT (before /:id)
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/reports/pending-notification', async (c) => {
    const entityId = c.req.query('entityId');
    const report = await service.getPendingNotificationReport(entityId);
    return c.json(report);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET BREACH BY ID
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await service.getBreach(id);

    if (!result.success) {
      return c.json({ error: result.error.message }, 404);
    }

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT NEW BREACH
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/', zValidator('json', CreateBreachSchema), async (c) => {
    const input = c.req.valid('json');
    const result = await service.reportBreach(input);

    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const breach = result.data;

    logger.error({
      breachId: breach.id,
      breachNumber: breach.breachNumber,
      severity: breach.severity,
      notificationDeadline: breach.notificationDeadline,
    }, 'Data breach reported');

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.BREACH_IDENTIFIED,
      'DataBreach',
      breach.id,
      {
        breachNumber: breach.breachNumber,
        entityId: breach.entityId,
        severity: breach.severity,
        category: breach.category,
        affectedCount: breach.affectedCount,
        notificationDeadline: breach.notificationDeadline,
      },
      input.createdBy
    );

    return c.json(breach, 201);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE BREACH
  // ─────────────────────────────────────────────────────────────────────────

  router.patch('/:id', zValidator('json', UpdateBreachSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const updatedBy = c.req.header('X-User-Id') || 'unknown';

    const result = await service.updateBreach(id, input, updatedBy);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    logger.info({ breachId: id, changes: Object.keys(input) }, 'Breach updated');

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NOTIFY AUTHORITY (GDPR Art. 33)
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/notify-authority', zValidator('json', NotifyAuthoritySchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');

    const result = await service.notifyAuthority(id, input);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    const { wasLate, ...breach } = result.data;

    if (wasLate) {
      logger.warn({
        breachId: id,
        notifiedAt: breach.authorityNotifiedAt,
        deadline: breach.notificationDeadline,
      }, 'Authority notified LATE (72-hour breach)');
    } else {
      logger.info({
        breachId: id,
        notifiedAt: breach.authorityNotifiedAt,
      }, 'Authority notified within 72 hours');
    }

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.BREACH_AUTHORITY_NOTIFIED,
      'DataBreach',
      id,
      {
        breachNumber: breach.breachNumber,
        authorityReference: breach.authorityReference,
        wasLate,
      }
    );

    return c.json(breach);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NOTIFY SUBJECTS (GDPR Art. 34)
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/notify-subjects', zValidator('json', NotifySubjectsSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');

    const result = await service.notifySubjects(id, input);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    logger.info({
      breachId: id,
      affectedCount: result.data.affectedCount,
      notificationMethod: input.notificationMethod,
    }, 'Subjects notified of breach');

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MARK CONTAINED
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/contain', async (c) => {
    const id = c.req.param('id');
    const containedBy = c.req.header('X-User-Id') || 'unknown';

    const result = await service.containBreach(id, containedBy);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    logger.info({ breachId: id }, 'Breach contained');

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.BREACH_CONTAINED,
      'DataBreach',
      id,
      {
        breachNumber: result.data.breachNumber,
        containedAt: result.data.containedAt,
      }
    );

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MARK RESOLVED
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/resolve', async (c) => {
    const id = c.req.param('id');
    const resolvedBy = c.req.header('X-User-Id') || 'unknown';

    const result = await service.resolveBreach(id, resolvedBy);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    logger.info({
      breachId: id,
      breachNumber: result.data.breachNumber,
    }, 'Breach resolved');

    return c.json(result.data);
  });

  return router;
}
