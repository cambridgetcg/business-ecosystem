/**
 * Procedures API Routes
 *
 * REST endpoints for managing compliance procedures.
 *
 * @module api/rest/routes/procedures
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/index.js';
import * as schema from '../../../infrastructure/persistence/schema.js';
import { ProcedureStatusSchema, ProcedureStepSchema } from '../../../domain/entities/compliance-program.js';
import { RequirementCategorySchema } from '../../../domain/entities/regulatory-requirement.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const procedureStepInputSchema = z.object({
  stepNumber: z.number().int().positive(),
  title: z.string().max(255),
  description: z.string(),
  responsible: z.string().max(255).optional(),
  expectedDuration: z.string().max(50).optional(),
  requiredEvidence: z.array(z.string()).optional(),
  controlIds: z.array(z.string()).optional(),
});

const createProcedureSchema = z.object({
  entityId: z.string().uuid().optional(),
  procedureNumber: z.string().max(50),
  title: z.string().min(1).max(255),
  description: z.string().max(4000),
  policyId: z.string().uuid().optional(),
  category: RequirementCategorySchema,
  controlIds: z.array(z.string().uuid()).optional(),
  purpose: z.string().max(2000),
  scope: z.string().max(2000),
  prerequisites: z.array(z.string()).optional(),
  steps: z.array(procedureStepInputSchema),
  frequencyOfUse: z.enum(['as_needed', 'daily', 'weekly', 'monthly', 'quarterly', 'annually']),
  procedureOwner: z.string().uuid().optional(),
  procedureOwnerName: z.string().optional(),
  effectiveDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const updateProcedureSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(4000).optional(),
  purpose: z.string().max(2000).optional(),
  scope: z.string().max(2000).optional(),
  prerequisites: z.array(z.string()).optional(),
  steps: z.array(procedureStepInputSchema).optional(),
  frequencyOfUse: z.enum(['as_needed', 'daily', 'weekly', 'monthly', 'quarterly', 'annually']).optional(),
  procedureOwner: z.string().uuid().nullable().optional(),
  procedureOwnerName: z.string().nullable().optional(),
  effectiveDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  status: ProcedureStatusSchema.optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function procedureRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const { db } = options;

  // ---------------------------------------------------------------------------
  // POST /procedures - Create procedure
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createProcedureSchema>;
  }>('/procedures', {
    schema: { body: createProcedureSchema },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const id = uuidv4();
    const now = new Date();

    const [procedure] = await db.insert(schema.procedures).values({
      id,
      tenantId,
      entityId: request.body.entityId ?? null,
      procedureNumber: request.body.procedureNumber,
      title: request.body.title,
      description: request.body.description,
      policyId: request.body.policyId ?? null,
      category: request.body.category,
      controlIds: request.body.controlIds ?? null,
      purpose: request.body.purpose,
      scope: request.body.scope,
      prerequisites: request.body.prerequisites ?? null,
      steps: request.body.steps,
      frequencyOfUse: request.body.frequencyOfUse,
      procedureOwner: request.body.procedureOwner ?? null,
      procedureOwnerName: request.body.procedureOwnerName ?? null,
      status: 'draft',
      effectiveDate: request.body.effectiveDate ? new Date(request.body.effectiveDate) : null,
      reviewDate: request.body.reviewDate ? new Date(request.body.reviewDate) : null,
      versionNumber: '1.0',
      metadata: request.body.metadata ?? null,
      tags: request.body.tags ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? null,
      version: 1,
    }).returning();

    return reply.status(201).send(procedure);
  });

  // ---------------------------------------------------------------------------
  // GET /procedures - List procedures
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: {
      entityId?: string;
      policyId?: string;
      category?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>('/procedures', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId, policyId, category, status, limit = 50, offset = 0 } = request.query;

    const conditions = [eq(schema.procedures.tenantId, tenantId)];

    if (entityId) {
      conditions.push(eq(schema.procedures.entityId, entityId));
    }
    if (policyId) {
      conditions.push(eq(schema.procedures.policyId, policyId));
    }
    if (category) {
      conditions.push(eq(schema.procedures.category, category));
    }
    if (status) {
      conditions.push(eq(schema.procedures.status, status));
    }

    const procedures = await db
      .select()
      .from(schema.procedures)
      .where(and(...conditions))
      .orderBy(schema.procedures.procedureNumber)
      .limit(limit)
      .offset(offset);

    return reply.send({
      data: procedures,
      total: procedures.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /procedures/by-policy/:policyId - Get procedures for a policy
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { policyId: string };
  }>('/procedures/by-policy/:policyId', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const procedures = await db
      .select()
      .from(schema.procedures)
      .where(
        and(
          eq(schema.procedures.tenantId, tenantId),
          eq(schema.procedures.policyId, request.params.policyId)
        )
      )
      .orderBy(schema.procedures.procedureNumber);

    return reply.send({
      data: procedures,
      total: procedures.length,
      policyId: request.params.policyId,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /procedures/:id - Get single procedure
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/procedures/:id', async (request, reply) => {
    const [procedure] = await db
      .select()
      .from(schema.procedures)
      .where(eq(schema.procedures.id, request.params.id));

    if (!procedure) {
      return reply.status(404).send({ error: 'Procedure not found' });
    }

    return reply.send(procedure);
  });

  // ---------------------------------------------------------------------------
  // PATCH /procedures/:id - Update procedure
  // ---------------------------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateProcedureSchema>;
  }>('/procedures/:id', {
    schema: { body: updateProcedureSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: userId ?? null,
    };

    const fields = [
      'title', 'description', 'purpose', 'scope', 'prerequisites', 'steps',
      'frequencyOfUse', 'procedureOwner', 'procedureOwnerName', 'effectiveDate',
      'reviewDate', 'status', 'metadata', 'tags'
    ];

    for (const field of fields) {
      if ((request.body as Record<string, unknown>)[field] !== undefined) {
        let value = (request.body as Record<string, unknown>)[field];
        if (['effectiveDate', 'reviewDate'].includes(field) && value) {
          value = new Date(value as string);
        }
        updates[field] = value;
      }
    }

    const [procedure] = await db
      .update(schema.procedures)
      .set(updates)
      .where(eq(schema.procedures.id, request.params.id))
      .returning();

    if (!procedure) {
      return reply.status(404).send({ error: 'Procedure not found' });
    }

    return reply.send(procedure);
  });

  // ---------------------------------------------------------------------------
  // DELETE /procedures/:id - Delete procedure
  // ---------------------------------------------------------------------------
  fastify.delete<{
    Params: { id: string };
  }>('/procedures/:id', async (request, reply) => {
    const [deleted] = await db
      .delete(schema.procedures)
      .where(eq(schema.procedures.id, request.params.id))
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: 'Procedure not found' });
    }

    return reply.status(204).send();
  });

  // ---------------------------------------------------------------------------
  // POST /procedures/:id/activate - Activate procedure
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
  }>('/procedures/:id/activate', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const [procedure] = await db
      .update(schema.procedures)
      .set({
        status: 'active',
        effectiveDate: now,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.procedures.id, request.params.id))
      .returning();

    if (!procedure) {
      return reply.status(404).send({ error: 'Procedure not found' });
    }

    return reply.send(procedure);
  });

  // ---------------------------------------------------------------------------
  // POST /procedures/:id/new-version - Create new version
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
  }>('/procedures/:id/new-version', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const [existing] = await db
      .select()
      .from(schema.procedures)
      .where(eq(schema.procedures.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'Procedure not found' });
    }

    // Increment version
    const versionParts = existing.versionNumber.split('.');
    const majorVersion = parseInt(versionParts[0], 10) || 1;
    const minorVersion = (parseInt(versionParts[1], 10) || 0) + 1;
    const newVersionNumber = `${majorVersion}.${minorVersion}`;

    const newId = uuidv4();
    const [newProcedure] = await db.insert(schema.procedures).values({
      id: newId,
      tenantId: existing.tenantId,
      entityId: existing.entityId,
      procedureNumber: existing.procedureNumber,
      title: existing.title,
      description: existing.description,
      policyId: existing.policyId,
      category: existing.category,
      controlIds: existing.controlIds,
      purpose: existing.purpose,
      scope: existing.scope,
      prerequisites: existing.prerequisites,
      steps: existing.steps,
      frequencyOfUse: existing.frequencyOfUse,
      procedureOwner: existing.procedureOwner,
      procedureOwnerName: existing.procedureOwnerName,
      status: 'draft',
      versionNumber: newVersionNumber,
      previousVersionId: existing.id,
      metadata: existing.metadata,
      tags: existing.tags,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? null,
      version: 1,
    }).returning();

    return reply.status(201).send(newProcedure);
  });

  // ---------------------------------------------------------------------------
  // POST /procedures/:id/steps - Add step to procedure
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof procedureStepInputSchema>;
  }>('/procedures/:id/steps', {
    schema: { body: procedureStepInputSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const [existing] = await db
      .select()
      .from(schema.procedures)
      .where(eq(schema.procedures.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'Procedure not found' });
    }

    const currentSteps = (existing.steps as unknown[]) || [];
    const newStep = { ...request.body };

    // Insert at correct position or append
    const steps = [...currentSteps];
    const insertIndex = newStep.stepNumber - 1;

    if (insertIndex >= steps.length) {
      steps.push(newStep);
    } else {
      steps.splice(insertIndex, 0, newStep);
      // Renumber subsequent steps
      for (let i = insertIndex + 1; i < steps.length; i++) {
        (steps[i] as { stepNumber: number }).stepNumber = i + 1;
      }
    }

    const [procedure] = await db
      .update(schema.procedures)
      .set({
        steps,
        updatedAt: new Date(),
        updatedBy: userId ?? null,
      })
      .where(eq(schema.procedures.id, request.params.id))
      .returning();

    return reply.send(procedure);
  });

  // ---------------------------------------------------------------------------
  // DELETE /procedures/:id/steps/:stepNumber - Remove step from procedure
  // ---------------------------------------------------------------------------
  fastify.delete<{
    Params: { id: string; stepNumber: string };
  }>('/procedures/:id/steps/:stepNumber', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const stepNumber = parseInt(request.params.stepNumber, 10);

    const [existing] = await db
      .select()
      .from(schema.procedures)
      .where(eq(schema.procedures.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'Procedure not found' });
    }

    const currentSteps = (existing.steps as { stepNumber: number }[]) || [];
    const steps = currentSteps.filter(s => s.stepNumber !== stepNumber);

    // Renumber remaining steps
    for (let i = 0; i < steps.length; i++) {
      steps[i].stepNumber = i + 1;
    }

    const [procedure] = await db
      .update(schema.procedures)
      .set({
        steps,
        updatedAt: new Date(),
        updatedBy: userId ?? null,
      })
      .where(eq(schema.procedures.id, request.params.id))
      .returning();

    return reply.send(procedure);
  });
}
