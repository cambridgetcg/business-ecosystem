/**
 * Attestations API Routes
 *
 * REST endpoints for managing compliance attestations and acknowledgments.
 *
 * @module api/rest/routes/attestations
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, lte, or, inArray } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/index.js';
import * as schema from '../../../infrastructure/persistence/schema.js';
import {
  AttestationTypeSchema,
  AttestationStatusSchema,
  isAttestationOverdue,
  calculateAttestationCompletionRate,
} from '../../../domain/entities/compliance-program.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const createAttestationSchema = z.object({
  entityId: z.string().uuid().optional(),
  attestationType: AttestationTypeSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  policyId: z.string().uuid().optional(),
  procedureId: z.string().uuid().optional(),
  trainingId: z.string().uuid().optional(),
  customContent: z.string().optional(),
  attestationStatement: z.string(),
  requiredFor: z.array(z.string().uuid()),
  requiredForGroups: z.array(z.string()).optional(),
  dueDate: z.string().datetime(),
  reminderDays: z.array(z.number().int()).optional(),
  expirationDate: z.string().datetime().optional(),
  frequencyDays: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const completeAttestationSchema = z.object({
  response: z.enum(['agree', 'disagree', 'not_applicable']),
  comments: z.string().max(2000).optional(),
  signature: z.string().optional(),
});

const bulkCreateAttestationSchema = z.object({
  entityId: z.string().uuid().optional(),
  attestationType: AttestationTypeSchema,
  policyId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  attestationStatement: z.string(),
  requiredFor: z.array(z.string().uuid()),
  dueDate: z.string().datetime(),
  reminderDays: z.array(z.number().int()).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function attestationRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const { db } = options;

  // ---------------------------------------------------------------------------
  // POST /attestations - Create attestation request
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createAttestationSchema>;
  }>('/attestations', {
    schema: { body: createAttestationSchema },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const id = uuidv4();
    const now = new Date();

    const [attestation] = await db.insert(schema.attestations).values({
      id,
      tenantId,
      entityId: request.body.entityId ?? null,
      attestationType: request.body.attestationType,
      title: request.body.title,
      description: request.body.description ?? null,
      policyId: request.body.policyId ?? null,
      procedureId: request.body.procedureId ?? null,
      trainingId: request.body.trainingId ?? null,
      customContent: request.body.customContent ?? null,
      attestationStatement: request.body.attestationStatement,
      requiredFor: request.body.requiredFor,
      requiredForGroups: request.body.requiredForGroups ?? null,
      dueDate: new Date(request.body.dueDate),
      reminderDays: request.body.reminderDays ?? null,
      expirationDate: request.body.expirationDate ? new Date(request.body.expirationDate) : null,
      frequencyDays: request.body.frequencyDays ?? null,
      status: 'pending',
      metadata: request.body.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? null,
      version: 1,
    }).returning();

    return reply.status(201).send(attestation);
  });

  // ---------------------------------------------------------------------------
  // POST /attestations/bulk - Create attestations for multiple users
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof bulkCreateAttestationSchema>;
  }>('/attestations/bulk', {
    schema: { body: bulkCreateAttestationSchema },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const now = new Date();
    const attestations = [];

    // Create individual attestation for each required user
    for (const requiredUserId of request.body.requiredFor) {
      const id = uuidv4();

      const [attestation] = await db.insert(schema.attestations).values({
        id,
        tenantId,
        entityId: request.body.entityId ?? null,
        attestationType: request.body.attestationType,
        title: request.body.title,
        policyId: request.body.policyId ?? null,
        attestationStatement: request.body.attestationStatement,
        requiredFor: [requiredUserId],
        dueDate: new Date(request.body.dueDate),
        reminderDays: request.body.reminderDays ?? null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        createdBy: userId ?? null,
        version: 1,
      }).returning();

      attestations.push(attestation);
    }

    return reply.status(201).send({
      data: attestations,
      total: attestations.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /attestations - List attestations
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: {
      entityId?: string;
      policyId?: string;
      attestationType?: string;
      status?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    };
  }>('/attestations', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId, policyId, attestationType, status, limit = 50, offset = 0 } = request.query;

    const conditions = [eq(schema.attestations.tenantId, tenantId)];

    if (entityId) {
      conditions.push(eq(schema.attestations.entityId, entityId));
    }
    if (policyId) {
      conditions.push(eq(schema.attestations.policyId, policyId));
    }
    if (attestationType) {
      conditions.push(eq(schema.attestations.attestationType, attestationType));
    }
    if (status) {
      conditions.push(eq(schema.attestations.status, status));
    }

    const attestations = await db
      .select()
      .from(schema.attestations)
      .where(and(...conditions))
      .orderBy(desc(schema.attestations.dueDate))
      .limit(limit)
      .offset(offset);

    return reply.send({
      data: attestations,
      total: attestations.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /attestations/pending - Get pending attestations for current user
  // ---------------------------------------------------------------------------
  fastify.get('/attestations/pending', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }
    if (!userId) {
      return reply.status(400).send({ error: 'Missing x-user-id header' });
    }

    // Get all pending attestations and filter by user
    const allPending = await db
      .select()
      .from(schema.attestations)
      .where(
        and(
          eq(schema.attestations.tenantId, tenantId),
          eq(schema.attestations.status, 'pending')
        )
      )
      .orderBy(schema.attestations.dueDate);

    // Filter to those required for this user
    const userPending = allPending.filter(a => {
      const requiredFor = a.requiredFor as string[];
      return requiredFor.includes(userId);
    });

    return reply.send({
      data: userPending,
      total: userPending.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /attestations/overdue - Get overdue attestations
  // ---------------------------------------------------------------------------
  fastify.get('/attestations/overdue', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const now = new Date();

    const attestations = await db
      .select()
      .from(schema.attestations)
      .where(
        and(
          eq(schema.attestations.tenantId, tenantId),
          eq(schema.attestations.status, 'pending'),
          lte(schema.attestations.dueDate, now)
        )
      )
      .orderBy(schema.attestations.dueDate);

    return reply.send({
      data: attestations,
      total: attestations.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /attestations/:id - Get single attestation
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/attestations/:id', async (request, reply) => {
    const [attestation] = await db
      .select()
      .from(schema.attestations)
      .where(eq(schema.attestations.id, request.params.id));

    if (!attestation) {
      return reply.status(404).send({ error: 'Attestation not found' });
    }

    return reply.send(attestation);
  });

  // ---------------------------------------------------------------------------
  // POST /attestations/:id/complete - Complete attestation
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof completeAttestationSchema>;
  }>('/attestations/:id/complete', {
    schema: { body: completeAttestationSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const userName = request.headers['x-user-name'] as string;
    const ipAddress = request.headers['x-forwarded-for'] as string || request.ip;
    const now = new Date();

    const [existing] = await db
      .select()
      .from(schema.attestations)
      .where(eq(schema.attestations.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'Attestation not found' });
    }

    // Verify user is in requiredFor list
    const requiredFor = existing.requiredFor as string[];
    if (!requiredFor.includes(userId)) {
      return reply.status(403).send({ error: 'User not authorized to complete this attestation' });
    }

    const [attestation] = await db
      .update(schema.attestations)
      .set({
        status: 'completed',
        response: request.body.response,
        comments: request.body.comments ?? null,
        signature: request.body.signature ?? null,
        completedBy: userId,
        completedByName: userName ?? null,
        completedAt: now,
        ipAddress: ipAddress ?? null,
        updatedAt: now,
        version: existing.version + 1,
      })
      .where(eq(schema.attestations.id, request.params.id))
      .returning();

    return reply.send(attestation);
  });

  // ---------------------------------------------------------------------------
  // POST /attestations/:id/decline - Decline attestation
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { reason: string };
  }>('/attestations/:id/decline', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const [attestation] = await db
      .update(schema.attestations)
      .set({
        status: 'declined',
        response: 'disagree',
        comments: request.body.reason,
        completedBy: userId,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.attestations.id, request.params.id))
      .returning();

    if (!attestation) {
      return reply.status(404).send({ error: 'Attestation not found' });
    }

    return reply.send(attestation);
  });

  // ---------------------------------------------------------------------------
  // POST /attestations/:id/remind - Send reminder
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
  }>('/attestations/:id/remind', async (request, reply) => {
    const [attestation] = await db
      .select()
      .from(schema.attestations)
      .where(eq(schema.attestations.id, request.params.id));

    if (!attestation) {
      return reply.status(404).send({ error: 'Attestation not found' });
    }

    // In a real implementation, this would send reminder emails/notifications
    // For now, just return success

    return reply.send({
      message: 'Reminder sent',
      attestationId: attestation.id,
      requiredFor: attestation.requiredFor,
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /attestations/:id - Delete attestation
  // ---------------------------------------------------------------------------
  fastify.delete<{
    Params: { id: string };
  }>('/attestations/:id', async (request, reply) => {
    const [deleted] = await db
      .delete(schema.attestations)
      .where(eq(schema.attestations.id, request.params.id))
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: 'Attestation not found' });
    }

    return reply.status(204).send();
  });

  // ---------------------------------------------------------------------------
  // GET /attestations/by-policy/:policyId/status - Get attestation status for policy
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { policyId: string };
  }>('/attestations/by-policy/:policyId/status', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const attestations = await db
      .select()
      .from(schema.attestations)
      .where(
        and(
          eq(schema.attestations.tenantId, tenantId),
          eq(schema.attestations.policyId, request.params.policyId)
        )
      );

    const total = attestations.length;
    const completed = attestations.filter(a => a.status === 'completed').length;
    const pending = attestations.filter(a => a.status === 'pending').length;
    const declined = attestations.filter(a => a.status === 'declined').length;

    const now = new Date();
    const overdue = attestations.filter(
      a => a.status === 'pending' && new Date(a.dueDate) < now
    ).length;

    const completionRate = calculateAttestationCompletionRate(completed, total);

    return reply.send({
      policyId: request.params.policyId,
      total,
      completed,
      pending,
      declined,
      overdue,
      completionRate,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /attestations/metrics - Get attestation metrics
  // ---------------------------------------------------------------------------
  fastify.get('/attestations/metrics', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const attestations = await db
      .select()
      .from(schema.attestations)
      .where(eq(schema.attestations.tenantId, tenantId));

    const total = attestations.length;
    const byStatus = {
      pending: attestations.filter(a => a.status === 'pending').length,
      completed: attestations.filter(a => a.status === 'completed').length,
      expired: attestations.filter(a => a.status === 'expired').length,
      declined: attestations.filter(a => a.status === 'declined').length,
    };

    const byType: Record<string, number> = {};
    for (const attestation of attestations) {
      byType[attestation.attestationType] = (byType[attestation.attestationType] || 0) + 1;
    }

    const now = new Date();
    const overdue = attestations.filter(
      a => a.status === 'pending' && new Date(a.dueDate) < now
    ).length;

    const completionRate = calculateAttestationCompletionRate(byStatus.completed, total);

    // Due in next 7 days
    const sevenDaysOut = new Date();
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const dueSoon = attestations.filter(
      a => a.status === 'pending' &&
        new Date(a.dueDate) > now &&
        new Date(a.dueDate) <= sevenDaysOut
    ).length;

    return reply.send({
      total,
      byStatus,
      byType,
      overdue,
      dueSoon,
      completionRate,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /attestations/types - Get attestation types
  // ---------------------------------------------------------------------------
  fastify.get('/attestations/types', async (request, reply) => {
    const types = [
      { code: 'policy_acknowledgment', name: 'Policy Acknowledgment', description: 'Acknowledge reading and understanding a policy' },
      { code: 'training_completion', name: 'Training Completion', description: 'Confirm completion of training' },
      { code: 'compliance_certification', name: 'Compliance Certification', description: 'Certify compliance with requirements' },
      { code: 'conflict_of_interest', name: 'Conflict of Interest', description: 'Disclose any conflicts of interest' },
      { code: 'code_of_conduct', name: 'Code of Conduct', description: 'Agree to abide by code of conduct' },
      { code: 'data_protection', name: 'Data Protection', description: 'Acknowledge data protection responsibilities' },
      { code: 'security_awareness', name: 'Security Awareness', description: 'Confirm security awareness training' },
      { code: 'whistleblower', name: 'Whistleblower Policy', description: 'Acknowledge whistleblower policy' },
      { code: 'anti_bribery', name: 'Anti-Bribery', description: 'Certify compliance with anti-bribery policy' },
      { code: 'custom', name: 'Custom', description: 'Custom attestation type' },
    ];

    return reply.send({ data: types });
  });
}
