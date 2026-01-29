/**
 * DSAR (Data Subject Access Request) Routes
 * GDPR Articles 15-22
 *
 * Routes delegate to DSARService - no business logic here
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { createDomainLogger } from '../lib/logger.js';
import { eventPublisher, EventTypes } from '../lib/events.js';
import { DSARService } from '../domain/data-subject-rights/index.js';
import { PrismaDSARRepository } from '../infrastructure/persistence/prisma-dsar.repository.js';

const logger = createDomainLogger('dsar-handling');

// ============================================================================
// VALIDATORS
// ============================================================================

const CreateDSARSchema = z.object({
  entityId: z.string().min(1),
  subjectEmail: z.string().email(),
  subjectName: z.string().optional(),
  subjectId: z.string().optional(),
  requestType: z.enum([
    'ACCESS',
    'RECTIFICATION',
    'ERASURE',
    'RESTRICTION',
    'PORTABILITY',
    'OBJECTION',
    'AUTOMATED_DECISION',
  ]),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const VerifyDSARSchema = z.object({
  verificationMethod: z.enum([
    'ID_DOCUMENT',
    'EMAIL_VERIFICATION',
    'PHONE_VERIFICATION',
    'ACCOUNT_LOGIN',
    'KNOWLEDGE_BASED',
    'IN_PERSON',
    'OTHER',
  ]),
  verifiedBy: z.string().min(1),
});

const CompleteDSARSchema = z.object({
  responseRef: z.string().optional(),
  responseMethod: z.enum(['EMAIL', 'PORTAL_DOWNLOAD', 'PHYSICAL_MAIL', 'SECURE_TRANSFER']),
});

const ExtendDSARSchema = z.object({
  reason: z.string().min(1),
});

const RejectDSARSchema = z.object({
  reason: z.string().min(1),
});

const DSARQuerySchema = z.object({
  entityId: z.string().optional(),
  status: z.string().optional(),
  requestType: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// ============================================================================
// ROUTER FACTORY
// ============================================================================

export function createDSARRouter(prisma: PrismaClient) {
  const router = new Hono();

  // Dependency injection
  const repository = new PrismaDSARRepository(prisma);
  const service = new DSARService(repository);

  // ─────────────────────────────────────────────────────────────────────────
  // LIST DSARs
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/', zValidator('query', DSARQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const result = await service.listDSARs(query as Parameters<typeof service.listDSARs>[0]);

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
  // OVERDUE REPORT (before /:id)
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/reports/overdue', async (c) => {
    const entityId = c.req.query('entityId');
    const overdue = await service.getOverdueDSARs(entityId);

    return c.json({
      data: overdue,
      count: overdue.length,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET DSAR BY ID
  // ─────────────────────────────────────────────────────────────────────────

  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await service.getDSAR(id);

    if (!result.success) {
      return c.json({ error: result.error.message }, 404);
    }

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT NEW DSAR
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/', zValidator('json', CreateDSARSchema), async (c) => {
    const input = c.req.valid('json');
    const result = await service.submitDSAR(input);

    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const dsar = result.data;

    logger.info({
      dsarId: dsar.id,
      requestNumber: dsar.requestNumber,
      requestType: dsar.requestType,
      deadline: dsar.deadline,
    }, 'DSAR submitted');

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.DSAR_SUBMITTED,
      'DSAR',
      dsar.id,
      {
        requestNumber: dsar.requestNumber,
        entityId: dsar.entityId,
        requestType: dsar.requestType,
        subjectEmail: dsar.subjectEmail,
        deadline: dsar.deadline,
      }
    );

    return c.json(dsar, 201);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VERIFY IDENTITY
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/verify', zValidator('json', VerifyDSARSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const result = await service.verifyIdentity(id, input);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    logger.info({
      dsarId: id,
      verificationMethod: input.verificationMethod,
    }, 'DSAR identity verified');

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.DSAR_VERIFIED,
      'DSAR',
      id,
      {
        verificationMethod: input.verificationMethod,
        verifiedBy: input.verifiedBy,
      }
    );

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // START PROCESSING
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/start', async (c) => {
    const id = c.req.param('id');
    const assignedTo = c.req.header('X-User-Id') || 'unknown';

    const result = await service.startProcessing(id, assignedTo);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    logger.info({ dsarId: id, assignedTo }, 'DSAR processing started');

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLETE DSAR
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/complete', zValidator('json', CompleteDSARSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const completedBy = c.req.header('X-User-Id') || 'unknown';

    const result = await service.completeDSAR(id, input, completedBy);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    const { onTime, ...dsar } = result.data;

    logger.info({
      dsarId: id,
      requestNumber: dsar.requestNumber,
      completedAt: dsar.completedAt,
      onTime,
    }, 'DSAR completed');

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.DSAR_COMPLETED,
      'DSAR',
      id,
      {
        requestNumber: dsar.requestNumber,
        responseMethod: dsar.responseMethod,
        onTime,
      }
    );

    return c.json(dsar);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EXTEND DEADLINE
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/extend', zValidator('json', ExtendDSARSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const extendedBy = c.req.header('X-User-Id') || 'unknown';

    const result = await service.extendDeadline(id, input, extendedBy);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    logger.info({
      dsarId: id,
      newDeadline: result.data.extendedDeadline,
      reason: input.reason,
    }, 'DSAR deadline extended');

    return c.json(result.data);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REJECT DSAR
  // ─────────────────────────────────────────────────────────────────────────

  router.post('/:id/reject', zValidator('json', RejectDSARSchema), async (c) => {
    const id = c.req.param('id');
    const input = c.req.valid('json');
    const rejectedBy = c.req.header('X-User-Id') || 'unknown';

    const result = await service.rejectDSAR(id, input, rejectedBy);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return c.json({ error: result.error.message }, status);
    }

    logger.warn({ dsarId: id, reason: input.reason }, 'DSAR rejected');

    return c.json(result.data);
  });

  return router;
}
