/**
 * Policies API Routes
 *
 * REST endpoints for managing compliance policies with versioning and approval workflows.
 *
 * @module api/rest/routes/policies
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, isNull, or } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/index.js';
import * as schema from '../../../infrastructure/persistence/schema.js';
import { PolicyStatusSchema, policyNeedsReview } from '../../../domain/entities/compliance-program.js';
import { RequirementCategorySchema, RegulatorTypeSchema } from '../../../domain/entities/regulatory-requirement.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const createPolicySchema = z.object({
  entityId: z.string().uuid().optional(),
  policyNumber: z.string().max(50),
  title: z.string().min(1).max(255),
  description: z.string().max(4000),
  category: RequirementCategorySchema,
  regulators: z.array(RegulatorTypeSchema).optional(),
  relatedRequirementIds: z.array(z.string().uuid()).optional(),
  purpose: z.string().max(2000),
  scope: z.string().max(2000),
  content: z.string(),
  exceptions: z.string().max(2000).optional(),
  definitions: z.record(z.string()).optional(),
  policyOwner: z.string().uuid().optional(),
  policyOwnerName: z.string().optional(),
  effectiveDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  requiresTraining: z.boolean().optional(),
  requiresAcknowledgment: z.boolean().optional(),
  acknowledgmentFrequency: z.enum(['once', 'annual', 'biannual', 'quarterly']).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const updatePolicySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(4000).optional(),
  purpose: z.string().max(2000).optional(),
  scope: z.string().max(2000).optional(),
  content: z.string().optional(),
  exceptions: z.string().max(2000).optional(),
  definitions: z.record(z.string()).optional(),
  policyOwner: z.string().uuid().nullable().optional(),
  policyOwnerName: z.string().nullable().optional(),
  effectiveDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  requiresTraining: z.boolean().optional(),
  requiresAcknowledgment: z.boolean().optional(),
  acknowledgmentFrequency: z.enum(['once', 'annual', 'biannual', 'quarterly']).optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

const submitForApprovalSchema = z.object({
  approver: z.string().uuid(),
  approverName: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const approveRejectSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(1000).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function policyRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const { db } = options;

  // ---------------------------------------------------------------------------
  // POST /policies - Create policy
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createPolicySchema>;
  }>('/policies', {
    schema: { body: createPolicySchema },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const id = uuidv4();
    const now = new Date();

    const [policy] = await db.insert(schema.policies).values({
      id,
      tenantId,
      entityId: request.body.entityId ?? null,
      policyNumber: request.body.policyNumber,
      title: request.body.title,
      description: request.body.description,
      category: request.body.category,
      regulators: request.body.regulators ?? null,
      relatedRequirementIds: request.body.relatedRequirementIds ?? null,
      purpose: request.body.purpose,
      scope: request.body.scope,
      content: request.body.content,
      exceptions: request.body.exceptions ?? null,
      definitions: request.body.definitions ?? null,
      policyOwner: request.body.policyOwner ?? null,
      policyOwnerName: request.body.policyOwnerName ?? null,
      status: 'draft',
      effectiveDate: request.body.effectiveDate ? new Date(request.body.effectiveDate) : null,
      reviewDate: request.body.reviewDate ? new Date(request.body.reviewDate) : null,
      expirationDate: request.body.expirationDate ? new Date(request.body.expirationDate) : null,
      versionNumber: '1.0',
      requiresTraining: request.body.requiresTraining ?? false,
      requiresAcknowledgment: request.body.requiresAcknowledgment ?? false,
      acknowledgmentFrequency: request.body.acknowledgmentFrequency ?? null,
      metadata: request.body.metadata ?? null,
      tags: request.body.tags ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? null,
      version: 1,
    }).returning();

    return reply.status(201).send(policy);
  });

  // ---------------------------------------------------------------------------
  // GET /policies - List policies
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: {
      entityId?: string;
      category?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>('/policies', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId, category, status, limit = 50, offset = 0 } = request.query;

    const conditions = [eq(schema.policies.tenantId, tenantId)];

    if (entityId) {
      conditions.push(eq(schema.policies.entityId, entityId));
    }
    if (category) {
      conditions.push(eq(schema.policies.category, category));
    }
    if (status) {
      conditions.push(eq(schema.policies.status, status));
    }

    const policies = await db
      .select()
      .from(schema.policies)
      .where(and(...conditions))
      .orderBy(schema.policies.policyNumber)
      .limit(limit)
      .offset(offset);

    return reply.send({
      data: policies,
      total: policies.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /policies/published - Get published policies only
  // ---------------------------------------------------------------------------
  fastify.get('/policies/published', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const policies = await db
      .select()
      .from(schema.policies)
      .where(
        and(
          eq(schema.policies.tenantId, tenantId),
          eq(schema.policies.status, 'published')
        )
      )
      .orderBy(schema.policies.policyNumber);

    return reply.send({
      data: policies,
      total: policies.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /policies/needs-review - Get policies needing review
  // ---------------------------------------------------------------------------
  fastify.get('/policies/needs-review', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const now = new Date();

    const policies = await db
      .select()
      .from(schema.policies)
      .where(
        and(
          eq(schema.policies.tenantId, tenantId),
          eq(schema.policies.status, 'published')
        )
      );

    // Filter to those needing review
    const needsReview = policies.filter(p => {
      if (!p.reviewDate) return false;
      return new Date(p.reviewDate) <= now;
    });

    return reply.send({
      data: needsReview,
      total: needsReview.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /policies/:id - Get single policy
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/policies/:id', async (request, reply) => {
    const [policy] = await db
      .select()
      .from(schema.policies)
      .where(eq(schema.policies.id, request.params.id));

    if (!policy) {
      return reply.status(404).send({ error: 'Policy not found' });
    }

    return reply.send(policy);
  });

  // ---------------------------------------------------------------------------
  // PATCH /policies/:id - Update policy
  // ---------------------------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updatePolicySchema>;
  }>('/policies/:id', {
    schema: { body: updatePolicySchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: userId ?? null,
    };

    const fields = [
      'title', 'description', 'purpose', 'scope', 'content', 'exceptions',
      'definitions', 'policyOwner', 'policyOwnerName', 'effectiveDate',
      'reviewDate', 'expirationDate', 'requiresTraining', 'requiresAcknowledgment',
      'acknowledgmentFrequency', 'metadata', 'tags'
    ];

    for (const field of fields) {
      if ((request.body as Record<string, unknown>)[field] !== undefined) {
        let value = (request.body as Record<string, unknown>)[field];
        // Convert date strings to Date objects
        if (['effectiveDate', 'reviewDate', 'expirationDate'].includes(field) && value) {
          value = new Date(value as string);
        }
        updates[field] = value;
      }
    }

    const [policy] = await db
      .update(schema.policies)
      .set(updates)
      .where(eq(schema.policies.id, request.params.id))
      .returning();

    if (!policy) {
      return reply.status(404).send({ error: 'Policy not found' });
    }

    return reply.send(policy);
  });

  // ---------------------------------------------------------------------------
  // POST /policies/:id/submit-for-approval - Submit policy for approval
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof submitForApprovalSchema>;
  }>('/policies/:id/submit-for-approval', {
    schema: { body: submitForApprovalSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const [policy] = await db
      .update(schema.policies)
      .set({
        status: 'pending_approval',
        approver: request.body.approver,
        approverName: request.body.approverName ?? null,
        notes: request.body.notes ?? null,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.policies.id, request.params.id))
      .returning();

    if (!policy) {
      return reply.status(404).send({ error: 'Policy not found' });
    }

    return reply.send(policy);
  });

  // ---------------------------------------------------------------------------
  // POST /policies/:id/approve - Approve or reject policy
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof approveRejectSchema>;
  }>('/policies/:id/approve', {
    schema: { body: approveRejectSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const updates: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: userId ?? null,
    };

    if (request.body.approved) {
      updates.status = 'approved';
      updates.approvedDate = now;
    } else {
      updates.status = 'draft'; // Send back for revision
    }

    if (request.body.notes) {
      updates.notes = request.body.notes;
    }

    const [policy] = await db
      .update(schema.policies)
      .set(updates)
      .where(eq(schema.policies.id, request.params.id))
      .returning();

    if (!policy) {
      return reply.status(404).send({ error: 'Policy not found' });
    }

    return reply.send(policy);
  });

  // ---------------------------------------------------------------------------
  // POST /policies/:id/publish - Publish approved policy
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
  }>('/policies/:id/publish', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    // Verify policy is approved
    const [existing] = await db
      .select()
      .from(schema.policies)
      .where(eq(schema.policies.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'Policy not found' });
    }

    if (existing.status !== 'approved') {
      return reply.status(400).send({ error: 'Policy must be approved before publishing' });
    }

    const [policy] = await db
      .update(schema.policies)
      .set({
        status: 'published',
        publishedDate: now,
        effectiveDate: existing.effectiveDate ?? now,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.policies.id, request.params.id))
      .returning();

    return reply.send(policy);
  });

  // ---------------------------------------------------------------------------
  // POST /policies/:id/new-version - Create new version of policy
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { changeLog: string };
  }>('/policies/:id/new-version', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    // Get existing policy
    const [existing] = await db
      .select()
      .from(schema.policies)
      .where(eq(schema.policies.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'Policy not found' });
    }

    // Parse version and increment
    const versionParts = existing.versionNumber.split('.');
    const majorVersion = parseInt(versionParts[0], 10) || 1;
    const minorVersion = (parseInt(versionParts[1], 10) || 0) + 1;
    const newVersionNumber = `${majorVersion}.${minorVersion}`;

    // Create new version
    const newId = uuidv4();
    const [newPolicy] = await db.insert(schema.policies).values({
      id: newId,
      tenantId: existing.tenantId,
      entityId: existing.entityId,
      policyNumber: existing.policyNumber,
      title: existing.title,
      description: existing.description,
      category: existing.category,
      regulators: existing.regulators,
      relatedRequirementIds: existing.relatedRequirementIds,
      purpose: existing.purpose,
      scope: existing.scope,
      content: existing.content,
      exceptions: existing.exceptions,
      definitions: existing.definitions,
      policyOwner: existing.policyOwner,
      policyOwnerName: existing.policyOwnerName,
      status: 'draft',
      versionNumber: newVersionNumber,
      previousVersionId: existing.id,
      changeLog: request.body.changeLog,
      requiresTraining: existing.requiresTraining,
      requiresAcknowledgment: existing.requiresAcknowledgment,
      acknowledgmentFrequency: existing.acknowledgmentFrequency,
      metadata: existing.metadata,
      tags: existing.tags,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? null,
      version: 1,
    }).returning();

    return reply.status(201).send(newPolicy);
  });

  // ---------------------------------------------------------------------------
  // POST /policies/:id/deprecate - Deprecate policy
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { reason?: string };
  }>('/policies/:id/deprecate', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const [policy] = await db
      .update(schema.policies)
      .set({
        status: 'deprecated',
        notes: request.body.reason ?? null,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.policies.id, request.params.id))
      .returning();

    if (!policy) {
      return reply.status(404).send({ error: 'Policy not found' });
    }

    return reply.send(policy);
  });

  // ---------------------------------------------------------------------------
  // GET /policies/metrics - Get policy metrics
  // ---------------------------------------------------------------------------
  fastify.get('/policies/metrics', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const policies = await db
      .select()
      .from(schema.policies)
      .where(eq(schema.policies.tenantId, tenantId));

    const total = policies.length;
    const byStatus = {
      draft: policies.filter(p => p.status === 'draft').length,
      pending_approval: policies.filter(p => p.status === 'pending_approval').length,
      approved: policies.filter(p => p.status === 'approved').length,
      published: policies.filter(p => p.status === 'published').length,
      under_review: policies.filter(p => p.status === 'under_review').length,
      deprecated: policies.filter(p => p.status === 'deprecated').length,
    };

    const byCategory: Record<string, number> = {};
    for (const policy of policies) {
      byCategory[policy.category] = (byCategory[policy.category] || 0) + 1;
    }

    const now = new Date();
    const needsReview = policies.filter(p =>
      p.status === 'published' && p.reviewDate && new Date(p.reviewDate) <= now
    ).length;

    const requiresTraining = policies.filter(p => p.requiresTraining).length;
    const requiresAcknowledgment = policies.filter(p => p.requiresAcknowledgment).length;

    return reply.send({
      total,
      byStatus,
      byCategory,
      needsReview,
      requiresTraining,
      requiresAcknowledgment,
    });
  });
}
