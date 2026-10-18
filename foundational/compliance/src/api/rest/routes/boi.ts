/**
 * BOI Filing API Routes
 *
 * REST endpoints for managing Beneficial Ownership Information filings
 * under the Corporate Transparency Act.
 *
 * @module api/rest/routes/boi
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, lte, isNull, or } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/index.js';
import * as schema from '../../../infrastructure/persistence/schema.js';
import {
  BOIFilingStatusSchema,
  ExemptionReasonSchema,
  BeneficialOwnerInfoSchema,
} from '../../../domain/entities/boi-filing.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const beneficialOwnerSchema = z.object({
  id: z.string().uuid().optional(),
  legalName: z.string().max(255),
  dateOfBirth: z.string().datetime(),
  residentialAddress: z.object({
    street1: z.string().max(255),
    street2: z.string().max(255).optional(),
    city: z.string().max(100),
    state: z.string().max(100),
    postalCode: z.string().max(20),
    country: z.string().length(2),
  }),
  identificationDocument: z.object({
    type: z.enum(['passport', 'drivers_license', 'state_id', 'foreign_passport']),
    number: z.string().max(100),
    issuingJurisdiction: z.string().max(100),
    expirationDate: z.string().datetime().optional(),
    documentImageKey: z.string().max(500).optional(),
  }),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  controlType: z.enum(['ownership', 'control', 'both']),
  isCompanyApplicant: z.boolean().optional(),
});

const createBOIFilingSchema = z.object({
  entityId: z.string().uuid(),
  filingType: z.enum(['initial', 'updated', 'corrected']),
  isExempt: z.boolean().optional(),
  exemptionReason: ExemptionReasonSchema.optional(),
  exemptionJustification: z.string().max(1000).optional(),
  beneficialOwners: z.array(beneficialOwnerSchema),
  companyApplicants: z.array(beneficialOwnerSchema).optional(),
  dueDate: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

const updateBOIFilingSchema = z.object({
  status: BOIFilingStatusSchema.optional(),
  isExempt: z.boolean().optional(),
  exemptionReason: ExemptionReasonSchema.optional(),
  exemptionJustification: z.string().max(1000).optional(),
  beneficialOwners: z.array(beneficialOwnerSchema).optional(),
  companyApplicants: z.array(beneficialOwnerSchema).optional(),
  fincenId: z.string().max(50).optional(),
  rejectionReason: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function boiRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const { db } = options;

  // ---------------------------------------------------------------------------
  // POST /boi/filings - Create BOI filing
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createBOIFilingSchema>;
  }>('/boi/filings', {
    schema: { body: createBOIFilingSchema },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const id = uuidv4();
    const now = new Date();

    // Add IDs to beneficial owners if not present
    const beneficialOwners = request.body.beneficialOwners.map(bo => ({
      ...bo,
      id: bo.id || uuidv4(),
    }));

    const companyApplicants = request.body.companyApplicants?.map(ca => ({
      ...ca,
      id: ca.id || uuidv4(),
    }));

    const [filing] = await db.insert(schema.boiFilings).values({
      id,
      tenantId,
      entityId: request.body.entityId,
      filingType: request.body.filingType,
      status: request.body.isExempt ? 'exempt' : 'draft',
      isExempt: request.body.isExempt ?? false,
      exemptionReason: request.body.exemptionReason ?? null,
      exemptionJustification: request.body.exemptionJustification ?? null,
      beneficialOwners,
      companyApplicants: companyApplicants ?? null,
      dueDate: new Date(request.body.dueDate),
      metadata: request.body.metadata ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? null,
      version: 1,
    }).returning();

    return reply.status(201).send(filing);
  });

  // ---------------------------------------------------------------------------
  // GET /boi/filings - List BOI filings
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: {
      entityId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>('/boi/filings', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId, status, limit = 50, offset = 0 } = request.query;

    const conditions = [eq(schema.boiFilings.tenantId, tenantId)];

    if (entityId) {
      conditions.push(eq(schema.boiFilings.entityId, entityId));
    }
    if (status) {
      conditions.push(eq(schema.boiFilings.status, status));
    }

    const filings = await db
      .select()
      .from(schema.boiFilings)
      .where(and(...conditions))
      .orderBy(desc(schema.boiFilings.createdAt))
      .limit(limit)
      .offset(offset);

    return reply.send({
      data: filings,
      total: filings.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /boi/filings/:id - Get single BOI filing
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/boi/filings/:id', async (request, reply) => {
    const [filing] = await db
      .select()
      .from(schema.boiFilings)
      .where(eq(schema.boiFilings.id, request.params.id));

    if (!filing) {
      return reply.status(404).send({ error: 'BOI filing not found' });
    }

    return reply.send(filing);
  });

  // ---------------------------------------------------------------------------
  // PATCH /boi/filings/:id - Update BOI filing
  // ---------------------------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateBOIFilingSchema>;
  }>('/boi/filings/:id', {
    schema: { body: updateBOIFilingSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: userId ?? null,
    };

    if (request.body.status !== undefined) updates.status = request.body.status;
    if (request.body.isExempt !== undefined) updates.isExempt = request.body.isExempt;
    if (request.body.exemptionReason !== undefined) updates.exemptionReason = request.body.exemptionReason;
    if (request.body.exemptionJustification !== undefined) updates.exemptionJustification = request.body.exemptionJustification;
    if (request.body.beneficialOwners !== undefined) {
      updates.beneficialOwners = request.body.beneficialOwners.map(bo => ({
        ...bo,
        id: bo.id || uuidv4(),
      }));
    }
    if (request.body.companyApplicants !== undefined) {
      updates.companyApplicants = request.body.companyApplicants.map(ca => ({
        ...ca,
        id: ca.id || uuidv4(),
      }));
    }
    if (request.body.fincenId !== undefined) updates.fincenId = request.body.fincenId;
    if (request.body.rejectionReason !== undefined) updates.rejectionReason = request.body.rejectionReason;
    if (request.body.metadata !== undefined) updates.metadata = request.body.metadata;

    const [filing] = await db
      .update(schema.boiFilings)
      .set(updates)
      .where(eq(schema.boiFilings.id, request.params.id))
      .returning();

    if (!filing) {
      return reply.status(404).send({ error: 'BOI filing not found' });
    }

    return reply.send(filing);
  });

  // ---------------------------------------------------------------------------
  // POST /boi/filings/:id/submit - Submit BOI filing
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
  }>('/boi/filings/:id/submit', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    // Validate filing is ready for submission
    const [existing] = await db
      .select()
      .from(schema.boiFilings)
      .where(eq(schema.boiFilings.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'BOI filing not found' });
    }

    if (existing.status !== 'draft' && existing.status !== 'pending_review') {
      return reply.status(400).send({
        error: `Cannot submit filing in ${existing.status} status`,
      });
    }

    // Validate beneficial owners exist
    const beneficialOwners = existing.beneficialOwners as unknown[];
    if (!existing.isExempt && (!beneficialOwners || beneficialOwners.length === 0)) {
      return reply.status(400).send({
        error: 'Non-exempt filings must have at least one beneficial owner',
      });
    }

    const [filing] = await db
      .update(schema.boiFilings)
      .set({
        status: 'submitted',
        submittedAt: now,
        submissionReference: `BOI-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.boiFilings.id, request.params.id))
      .returning();

    return reply.send(filing);
  });

  // ---------------------------------------------------------------------------
  // POST /boi/filings/:id/accept - Mark filing as accepted by FinCEN
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { fincenId?: string };
  }>('/boi/filings/:id/accept', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const [filing] = await db
      .update(schema.boiFilings)
      .set({
        status: 'accepted',
        acceptedAt: now,
        fincenId: request.body.fincenId ?? null,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.boiFilings.id, request.params.id))
      .returning();

    if (!filing) {
      return reply.status(404).send({ error: 'BOI filing not found' });
    }

    return reply.send(filing);
  });

  // ---------------------------------------------------------------------------
  // POST /boi/filings/:id/reject - Mark filing as rejected
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { rejectionReason: string };
  }>('/boi/filings/:id/reject', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const [filing] = await db
      .update(schema.boiFilings)
      .set({
        status: 'rejected',
        rejectedAt: now,
        rejectionReason: request.body.rejectionReason,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.boiFilings.id, request.params.id))
      .returning();

    if (!filing) {
      return reply.status(404).send({ error: 'BOI filing not found' });
    }

    return reply.send(filing);
  });

  // ---------------------------------------------------------------------------
  // GET /boi/filings/entity/:entityId - Get filings by entity
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { entityId: string };
    Querystring: { status?: string; limit?: number; offset?: number };
  }>('/boi/filings/entity/:entityId', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId } = request.params;
    const { status, limit = 50, offset = 0 } = request.query;

    const conditions = [
      eq(schema.boiFilings.tenantId, tenantId),
      eq(schema.boiFilings.entityId, entityId),
    ];

    if (status) {
      conditions.push(eq(schema.boiFilings.status, status));
    }

    const filings = await db
      .select()
      .from(schema.boiFilings)
      .where(and(...conditions))
      .orderBy(desc(schema.boiFilings.createdAt))
      .limit(limit)
      .offset(offset);

    return reply.send({
      data: filings,
      total: filings.length,
      entityId,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /boi/filings/upcoming - Get filings due soon
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { days?: number };
  }>('/boi/filings/upcoming', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const days = request.query.days ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const filings = await db
      .select()
      .from(schema.boiFilings)
      .where(
        and(
          eq(schema.boiFilings.tenantId, tenantId),
          lte(schema.boiFilings.dueDate, cutoffDate),
          or(
            eq(schema.boiFilings.status, 'draft'),
            eq(schema.boiFilings.status, 'pending_review')
          )
        )
      )
      .orderBy(schema.boiFilings.dueDate);

    return reply.send({
      data: filings,
      total: filings.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /boi/filings/overdue - Get overdue filings
  // ---------------------------------------------------------------------------
  fastify.get('/boi/filings/overdue', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const now = new Date();

    const filings = await db
      .select()
      .from(schema.boiFilings)
      .where(
        and(
          eq(schema.boiFilings.tenantId, tenantId),
          lte(schema.boiFilings.dueDate, now),
          or(
            eq(schema.boiFilings.status, 'draft'),
            eq(schema.boiFilings.status, 'pending_review')
          ),
          // Exclude already submitted/accepted/rejected filings
          isNull(schema.boiFilings.submittedAt)
        )
      )
      .orderBy(schema.boiFilings.dueDate);

    return reply.send({
      data: filings,
      total: filings.length,
      asOfDate: now.toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // GET /boi/exemption-reasons - Get list of exemption reasons
  // ---------------------------------------------------------------------------
  fastify.get('/boi/exemption-reasons', async (request, reply) => {
    const exemptionReasons = [
      { code: 'large_operating_company', name: 'Large Operating Company', description: '>20 employees, >$5M revenue, US physical presence' },
      { code: 'tax_exempt_entity', name: 'Tax-Exempt Entity', description: 'IRS tax-exempt status' },
      { code: 'inactive_entity', name: 'Inactive Entity', description: 'No business activity, no assets, no ownership changes' },
      { code: 'regulated_entity', name: 'Already Regulated', description: 'Already reports beneficial ownership to FinCEN' },
      { code: 'subsidiary_of_exempt', name: 'Subsidiary of Exempt Entity', description: 'Wholly-owned by exempt entity' },
      { code: 'public_utility', name: 'Public Utility', description: 'Regulated public utility company' },
      { code: 'insurance_company', name: 'Insurance Company', description: 'State-regulated insurance company' },
      { code: 'bank', name: 'Bank', description: 'Federally-regulated bank' },
      { code: 'credit_union', name: 'Credit Union', description: 'Federally-regulated credit union' },
      { code: 'money_services_business', name: 'Money Services Business', description: 'Registered with FinCEN as MSB' },
      { code: 'broker_dealer', name: 'Broker/Dealer', description: 'SEC-registered broker-dealer' },
      { code: 'pooled_investment_vehicle', name: 'Pooled Investment Vehicle', description: 'Operated by investment company/advisor' },
      { code: 'accounting_firm', name: 'Accounting Firm', description: 'PCAOB-registered accounting firm' },
      { code: 'public_company', name: 'Public Company', description: 'SEC-registered public company' },
      { code: 'other', name: 'Other Exemption', description: 'Other qualifying exemption' },
    ];

    return reply.send({ data: exemptionReasons });
  });

  // ---------------------------------------------------------------------------
  // POST /boi/filings/:id/beneficial-owners - Add beneficial owner
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof beneficialOwnerSchema>;
  }>('/boi/filings/:id/beneficial-owners', {
    schema: { body: beneficialOwnerSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const [existing] = await db
      .select()
      .from(schema.boiFilings)
      .where(eq(schema.boiFilings.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'BOI filing not found' });
    }

    const newOwner = {
      ...request.body,
      id: request.body.id || uuidv4(),
    };

    const currentOwners = (existing.beneficialOwners as unknown[]) || [];
    const updatedOwners = [...currentOwners, newOwner];

    const [filing] = await db
      .update(schema.boiFilings)
      .set({
        beneficialOwners: updatedOwners,
        lastChangeDate: new Date(),
        updatedAt: new Date(),
        updatedBy: userId ?? null,
      })
      .where(eq(schema.boiFilings.id, request.params.id))
      .returning();

    return reply.status(201).send({
      filing,
      addedOwner: newOwner,
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /boi/filings/:id/beneficial-owners/:ownerId - Remove beneficial owner
  // ---------------------------------------------------------------------------
  fastify.delete<{
    Params: { id: string; ownerId: string };
  }>('/boi/filings/:id/beneficial-owners/:ownerId', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const [existing] = await db
      .select()
      .from(schema.boiFilings)
      .where(eq(schema.boiFilings.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'BOI filing not found' });
    }

    const currentOwners = (existing.beneficialOwners as { id: string }[]) || [];
    const updatedOwners = currentOwners.filter(o => o.id !== request.params.ownerId);

    if (updatedOwners.length === currentOwners.length) {
      return reply.status(404).send({ error: 'Beneficial owner not found' });
    }

    const [filing] = await db
      .update(schema.boiFilings)
      .set({
        beneficialOwners: updatedOwners,
        lastChangeDate: new Date(),
        updatedAt: new Date(),
        updatedBy: userId ?? null,
      })
      .where(eq(schema.boiFilings.id, request.params.id))
      .returning();

    return reply.status(200).send(filing);
  });
}
