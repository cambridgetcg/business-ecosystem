/**
 * Audit Findings API Routes
 *
 * REST endpoints for managing audit findings and remediation.
 *
 * @module api/rest/routes/findings
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/index.js';
import * as schema from '../../../infrastructure/persistence/schema.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'informational']);
const FindingStatusSchema = z.enum([
  'open',
  'in_remediation',
  'pending_verification',
  'closed',
  'accepted_risk',
  'false_positive',
]);
const AuditTypeSchema = z.enum([
  'internal',
  'external',
  'regulatory',
  'self_assessment',
  'third_party',
]);

const FindingTypeSchema = z.enum([
  'non_compliance',
  'process_gap',
  'control_weakness',
  'documentation_issue',
  'policy_violation',
  'other',
]);

const createFindingSchema = z.object({
  entityId: z.string().uuid(),
  auditType: AuditTypeSchema,
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  findingType: FindingTypeSchema,
  severity: SeveritySchema,
  auditDate: z.string().datetime().optional(),
  auditorName: z.string().optional(),
  auditReference: z.string().optional(),
  regulator: z.string().optional(),
  requirementId: z.string().uuid().optional(),
  obligationId: z.string().uuid().optional(),
  remediationPlan: z.string().optional(),
  remediationDueDate: z.string().datetime().optional(),
  assignedTo: z.string().uuid().optional(),
});

const updateFindingSchema = z.object({
  status: FindingStatusSchema.optional(),
  severity: SeveritySchema.optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  assignedToName: z.string().optional(),
  remediationPlan: z.string().optional(),
  remediationDueDate: z.string().datetime().optional(),
  remediationNotes: z.string().optional(),
});

const verifyFindingSchema = z.object({
  verificationNotes: z.string().optional(),
  verified: z.boolean(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function findingRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const { db } = options;

  // ---------------------------------------------------------------------------
  // POST /findings - Create audit finding
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createFindingSchema>;
  }>('/findings', {
    schema: { body: createFindingSchema },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const id = uuidv4();
    const now = new Date();

    const [finding] = await db.insert(schema.auditFindings).values({
      id,
      tenantId,
      entityId: request.body.entityId,
      auditType: request.body.auditType,
      title: request.body.title,
      description: request.body.description,
      findingType: request.body.findingType,
      severity: request.body.severity,
      status: 'open',
      auditDate: request.body.auditDate ? new Date(request.body.auditDate) : now,
      auditorName: request.body.auditorName ?? null,
      auditReference: request.body.auditReference ?? null,
      regulator: request.body.regulator ?? null,
      requirementId: request.body.requirementId ?? null,
      obligationId: request.body.obligationId ?? null,
      remediationPlan: request.body.remediationPlan ?? null,
      remediationDueDate: request.body.remediationDueDate
        ? new Date(request.body.remediationDueDate)
        : null,
      assignedTo: request.body.assignedTo ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? null,
      version: 1,
    }).returning();

    return reply.status(201).send(finding);
  });

  // ---------------------------------------------------------------------------
  // GET /findings - List findings
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: {
      entityId?: string;
      status?: string;
      severity?: string;
      findingType?: string;
      auditType?: string;
      limit?: number;
      offset?: number;
    };
  }>('/findings', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId, status, severity, findingType, auditType, limit = 50, offset = 0 } = request.query;

    const conditions = [eq(schema.auditFindings.tenantId, tenantId)];

    if (entityId) {
      conditions.push(eq(schema.auditFindings.entityId, entityId));
    }
    if (status) {
      conditions.push(eq(schema.auditFindings.status, status));
    }
    if (severity) {
      conditions.push(eq(schema.auditFindings.severity, severity));
    }
    if (findingType) {
      conditions.push(eq(schema.auditFindings.findingType, findingType));
    }
    if (auditType) {
      conditions.push(eq(schema.auditFindings.auditType, auditType));
    }

    const findings = await db
      .select()
      .from(schema.auditFindings)
      .where(and(...conditions))
      .orderBy(desc(schema.auditFindings.auditDate))
      .limit(limit)
      .offset(offset);

    return reply.send({
      data: findings,
      total: findings.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /findings/:id - Get single finding
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/findings/:id', async (request, reply) => {
    const [finding] = await db
      .select()
      .from(schema.auditFindings)
      .where(eq(schema.auditFindings.id, request.params.id));

    if (!finding) {
      return reply.status(404).send({ error: 'Finding not found' });
    }

    return reply.send(finding);
  });

  // ---------------------------------------------------------------------------
  // PATCH /findings/:id - Update finding
  // ---------------------------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateFindingSchema>;
  }>('/findings/:id', {
    schema: { body: updateFindingSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: userId ?? null,
    };

    if (request.body.status !== undefined) updates.status = request.body.status;
    if (request.body.severity !== undefined) updates.severity = request.body.severity;
    if (request.body.assignedTo !== undefined) updates.assignedTo = request.body.assignedTo;
    if (request.body.assignedToName !== undefined) updates.assignedToName = request.body.assignedToName;
    if (request.body.remediationPlan !== undefined) updates.remediationPlan = request.body.remediationPlan;
    if (request.body.remediationDueDate !== undefined) {
      updates.remediationDueDate = new Date(request.body.remediationDueDate);
    }
    if (request.body.remediationNotes !== undefined) {
      updates.remediationNotes = request.body.remediationNotes;
    }

    const [finding] = await db
      .update(schema.auditFindings)
      .set(updates)
      .where(eq(schema.auditFindings.id, request.params.id))
      .returning();

    if (!finding) {
      return reply.status(404).send({ error: 'Finding not found' });
    }

    return reply.send(finding);
  });

  // ---------------------------------------------------------------------------
  // POST /findings/:id/start-remediation - Start remediation
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { remediationPlan?: string };
  }>('/findings/:id/start-remediation', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const [finding] = await db
      .update(schema.auditFindings)
      .set({
        status: 'in_remediation',
        remediationPlan: request.body.remediationPlan ?? null,
        updatedAt: new Date(),
        updatedBy: userId ?? null,
      })
      .where(eq(schema.auditFindings.id, request.params.id))
      .returning();

    if (!finding) {
      return reply.status(404).send({ error: 'Finding not found' });
    }

    return reply.send(finding);
  });

  // ---------------------------------------------------------------------------
  // POST /findings/:id/complete-remediation - Complete remediation
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { completionNotes?: string };
  }>('/findings/:id/complete-remediation', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const [finding] = await db
      .update(schema.auditFindings)
      .set({
        status: 'pending_verification',
        remediationCompletedDate: new Date(),
        updatedAt: new Date(),
        updatedBy: userId ?? null,
      })
      .where(eq(schema.auditFindings.id, request.params.id))
      .returning();

    if (!finding) {
      return reply.status(404).send({ error: 'Finding not found' });
    }

    return reply.send(finding);
  });

  // ---------------------------------------------------------------------------
  // POST /findings/:id/verify - Verify remediation
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof verifyFindingSchema>;
  }>('/findings/:id/verify', {
    schema: { body: verifyFindingSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const updates: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: userId ?? null,
    };

    if (request.body.verified) {
      updates.status = 'closed';
      updates.remediationCompletedDate = now;
      if (request.body.verificationNotes) {
        updates.remediationNotes = request.body.verificationNotes;
      }
    } else {
      updates.status = 'in_remediation'; // Send back for more work
      if (request.body.verificationNotes) {
        updates.remediationNotes = request.body.verificationNotes;
      }
    }

    const [finding] = await db
      .update(schema.auditFindings)
      .set(updates)
      .where(eq(schema.auditFindings.id, request.params.id))
      .returning();

    if (!finding) {
      return reply.status(404).send({ error: 'Finding not found' });
    }

    return reply.send(finding);
  });

  // ---------------------------------------------------------------------------
  // POST /findings/:id/accept-risk - Accept risk
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { justification: string; approvedBy: string };
  }>('/findings/:id/accept-risk', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const [finding] = await db
      .update(schema.auditFindings)
      .set({
        status: 'accepted_risk',
        remediationNotes: `Risk accepted by ${request.body.approvedBy}: ${request.body.justification}`,
        updatedAt: new Date(),
        updatedBy: userId ?? null,
      })
      .where(eq(schema.auditFindings.id, request.params.id))
      .returning();

    if (!finding) {
      return reply.status(404).send({ error: 'Finding not found' });
    }

    return reply.send(finding);
  });

  // ---------------------------------------------------------------------------
  // GET /findings/metrics - Get findings metrics
  // ---------------------------------------------------------------------------
  fastify.get('/findings/metrics', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const findings = await db
      .select()
      .from(schema.auditFindings)
      .where(eq(schema.auditFindings.tenantId, tenantId));

    const total = findings.length;
    const open = findings.filter(f => f.status === 'open').length;
    const inRemediation = findings.filter(f => f.status === 'in_remediation').length;
    const pendingVerification = findings.filter(f => f.status === 'pending_verification').length;
    const closed = findings.filter(f => f.status === 'closed').length;
    const acceptedRisk = findings.filter(f => f.status === 'accepted_risk').length;

    const critical = findings.filter(f => f.severity === 'critical' && f.status !== 'closed').length;
    const high = findings.filter(f => f.severity === 'high' && f.status !== 'closed').length;

    // Overdue findings
    const now = new Date();
    const overdue = findings.filter(
      f =>
        f.remediationDueDate &&
        f.remediationDueDate < now &&
        !['closed', 'accepted_risk'].includes(f.status)
    ).length;

    return reply.send({
      total,
      byStatus: { open, inRemediation, pendingVerification, closed, acceptedRisk },
      openCritical: critical,
      openHigh: high,
      overdue,
      closureRate: total > 0 ? ((closed / total) * 100).toFixed(1) : '0',
    });
  });
}
