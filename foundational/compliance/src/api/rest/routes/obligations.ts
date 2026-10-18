/**
 * Compliance Obligations API Routes
 *
 * REST endpoints for managing compliance obligations.
 *
 * @module api/rest/routes/obligations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ComplianceService } from '../../../application/services/compliance-service.js';
import type { Database } from '../../../infrastructure/persistence/index.js';

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

const createObligationSchema = z.object({
  requirementId: z.string().uuid(),
  entityId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  dueDate: z.string().datetime(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assignedTo: z.string().uuid().optional(),
  filingFee: z.number().positive().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateObligationSchema = z.object({
  status: z.enum([
    'pending', 'in_progress', 'under_review', 'submitted',
    'completed', 'overdue', 'waived', 'not_applicable', 'failed'
  ]).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  submissionReference: z.string().optional(),
  completionNotes: z.string().optional(),
});

const queryObligationsSchema = z.object({
  entityId: z.string().uuid().optional(),
  status: z.string().optional(),
  regulator: z.string().optional(),
  category: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function obligationRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const service = new ComplianceService(options.db);

  // ---------------------------------------------------------------------------
  // POST /obligations - Create new obligation
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createObligationSchema>;
  }>('/obligations', {
    schema: {
      body: createObligationSchema,
      response: {
        201: { type: 'object' },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    try {
      const tenantId = request.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return reply.status(400).send({ error: 'Missing x-tenant-id header' });
      }

      const obligation = await service.createObligation({
        tenantId,
        entityId: request.body.entityId,
        requirementId: request.body.requirementId,
        title: request.body.title,
        description: request.body.description,
        dueDate: new Date(request.body.dueDate),
        periodStart: request.body.periodStart ? new Date(request.body.periodStart) : undefined,
        periodEnd: request.body.periodEnd ? new Date(request.body.periodEnd) : undefined,
        priority: request.body.priority,
        assignedTo: request.body.assignedTo,
        filingFee: request.body.filingFee,
        notes: request.body.notes,
        tags: request.body.tags,
      });

      return reply.status(201).send(obligation);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /obligations - List obligations
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: z.infer<typeof queryObligationsSchema>;
  }>('/obligations', {
    schema: {
      querystring: queryObligationsSchema,
    },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId, status, regulator, category, dueBefore, dueAfter } = request.query;

    if (!entityId) {
      return reply.status(400).send({ error: 'entityId is required' });
    }

    const obligations = await service.getObligationsByEntity(tenantId, entityId, {
      status,
      regulator,
      category,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      dueAfter: dueAfter ? new Date(dueAfter) : undefined,
    });

    return reply.send({
      data: obligations,
      total: obligations.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /obligations/:id - Get single obligation
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/obligations/:id', async (request, reply) => {
    const obligation = await service.getObligation(request.params.id);

    if (!obligation) {
      return reply.status(404).send({ error: 'Obligation not found' });
    }

    return reply.send(obligation);
  });

  // ---------------------------------------------------------------------------
  // PATCH /obligations/:id - Update obligation
  // ---------------------------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateObligationSchema>;
  }>('/obligations/:id', {
    schema: {
      body: updateObligationSchema,
    },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const updated = await service.updateObligation(
      request.params.id,
      {
        status: request.body.status,
        priority: request.body.priority,
        assignedTo: request.body.assignedTo ?? undefined,
        dueDate: request.body.dueDate ? new Date(request.body.dueDate) : undefined,
        notes: request.body.notes,
        tags: request.body.tags,
      },
      userId
    );

    if (!updated) {
      return reply.status(404).send({ error: 'Obligation not found' });
    }

    return reply.send(updated);
  });

  // ---------------------------------------------------------------------------
  // GET /obligations/upcoming - Get upcoming deadlines
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { daysAhead?: number };
  }>('/obligations/upcoming', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const daysAhead = request.query.daysAhead ?? 30;
    const obligations = await service.getUpcomingDeadlines(tenantId, daysAhead);

    return reply.send({
      data: obligations,
      total: obligations.length,
      daysAhead,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /obligations/overdue - Get overdue obligations
  // ---------------------------------------------------------------------------
  fastify.get('/obligations/overdue', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const obligations = await service.getOverdueObligations(tenantId);

    return reply.send({
      data: obligations,
      total: obligations.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /dashboard - Get compliance dashboard metrics
  // ---------------------------------------------------------------------------
  fastify.get('/dashboard', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const metrics = await service.getDashboardMetrics(tenantId);

    return reply.send(metrics);
  });

  // ---------------------------------------------------------------------------
  // POST /reports - Generate compliance report
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: {
      periodStart: string;
      periodEnd: string;
      entityId?: string;
    };
  }>('/reports', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const report = await service.generateComplianceReport(
      tenantId,
      new Date(request.body.periodStart),
      new Date(request.body.periodEnd),
      request.body.entityId
    );

    return reply.status(201).send(report);
  });
}
