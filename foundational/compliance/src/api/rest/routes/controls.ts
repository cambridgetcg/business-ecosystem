/**
 * Control Requirements API Routes
 *
 * REST endpoints for managing internal controls and compliance testing.
 *
 * @module api/rest/routes/controls
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, lte, gte } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/index.js';
import * as schema from '../../../infrastructure/persistence/schema.js';
import {
  ControlTypeSchema,
  ControlFrequencySchema,
  ControlStatusSchema,
  ControlFrameworkSchema,
  ControlRiskLevelSchema,
  calculateNextTestDate,
} from '../../../domain/entities/control-requirement.js';
import { RequirementCategorySchema, RegulatorTypeSchema } from '../../../domain/entities/regulatory-requirement.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const createControlSchema = z.object({
  entityId: z.string().uuid().optional(),
  controlId: z.string().max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(4000),
  controlType: ControlTypeSchema,
  framework: ControlFrameworkSchema,
  category: RequirementCategorySchema,
  riskLevel: ControlRiskLevelSchema,
  objective: z.string().max(2000),
  procedure: z.string().max(4000).optional(),
  frequency: ControlFrequencySchema,
  automationLevel: z.enum(['manual', 'semi_automated', 'fully_automated']),
  controlOwner: z.string().uuid().optional(),
  processOwner: z.string().uuid().optional(),
  relatedRequirementIds: z.array(z.string().uuid()).optional(),
  regulators: z.array(RegulatorTypeSchema).optional(),
  testingFrequency: ControlFrequencySchema.optional(),
  testingProcedure: z.string().max(4000).optional(),
  evidenceRequirements: z.array(z.string()).optional(),
  inherentRisk: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const updateControlSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4000).optional(),
  status: ControlStatusSchema.optional(),
  controlOwner: z.string().uuid().nullable().optional(),
  controlOwnerName: z.string().nullable().optional(),
  processOwner: z.string().uuid().nullable().optional(),
  processOwnerName: z.string().nullable().optional(),
  procedure: z.string().max(4000).optional(),
  testingProcedure: z.string().max(4000).optional(),
  testingFrequency: ControlFrequencySchema.optional(),
  evidenceRequirements: z.array(z.string()).optional(),
  evidenceLocations: z.array(z.string()).optional(),
  inherentRisk: z.number().int().min(1).max(5).optional(),
  residualRisk: z.number().int().min(1).max(5).optional(),
  controlEffectiveness: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(4000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

const recordTestResultSchema = z.object({
  testResult: z.enum(['pass', 'fail', 'partial', 'not_tested']),
  sampleSize: z.number().int().optional(),
  findings: z.string().optional(),
  evidenceLocations: z.array(z.string()).optional(),
  deficiencyCount: z.number().int().optional(),
  materialWeakness: z.boolean().optional(),
  significantDeficiency: z.boolean().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function controlRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const { db } = options;

  // ---------------------------------------------------------------------------
  // POST /controls - Create control requirement
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createControlSchema>;
  }>('/controls', {
    schema: { body: createControlSchema },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const id = uuidv4();
    const now = new Date();

    const [control] = await db.insert(schema.controlRequirements).values({
      id,
      tenantId,
      entityId: request.body.entityId ?? null,
      controlId: request.body.controlId,
      name: request.body.name,
      description: request.body.description,
      controlType: request.body.controlType,
      framework: request.body.framework,
      category: request.body.category,
      riskLevel: request.body.riskLevel,
      objective: request.body.objective,
      procedure: request.body.procedure ?? null,
      frequency: request.body.frequency,
      automationLevel: request.body.automationLevel,
      controlOwner: request.body.controlOwner ?? null,
      processOwner: request.body.processOwner ?? null,
      relatedRequirementIds: request.body.relatedRequirementIds ?? null,
      regulators: request.body.regulators ?? null,
      status: 'not_implemented',
      testingFrequency: request.body.testingFrequency ?? null,
      testingProcedure: request.body.testingProcedure ?? null,
      evidenceRequirements: request.body.evidenceRequirements ?? null,
      inherentRisk: request.body.inherentRisk ?? null,
      notes: request.body.notes ?? null,
      metadata: request.body.metadata ?? null,
      tags: request.body.tags ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? null,
      version: 1,
    }).returning();

    return reply.status(201).send(control);
  });

  // ---------------------------------------------------------------------------
  // GET /controls - List controls
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: {
      entityId?: string;
      framework?: string;
      category?: string;
      status?: string;
      riskLevel?: string;
      limit?: number;
      offset?: number;
    };
  }>('/controls', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const { entityId, framework, category, status, riskLevel, limit = 50, offset = 0 } = request.query;

    const conditions = [eq(schema.controlRequirements.tenantId, tenantId)];

    if (entityId) {
      conditions.push(eq(schema.controlRequirements.entityId, entityId));
    }
    if (framework) {
      conditions.push(eq(schema.controlRequirements.framework, framework));
    }
    if (category) {
      conditions.push(eq(schema.controlRequirements.category, category));
    }
    if (status) {
      conditions.push(eq(schema.controlRequirements.status, status));
    }
    if (riskLevel) {
      conditions.push(eq(schema.controlRequirements.riskLevel, riskLevel));
    }

    const controls = await db
      .select()
      .from(schema.controlRequirements)
      .where(and(...conditions))
      .orderBy(schema.controlRequirements.controlId)
      .limit(limit)
      .offset(offset);

    return reply.send({
      data: controls,
      total: controls.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /controls/:id - Get single control
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/controls/:id', async (request, reply) => {
    const [control] = await db
      .select()
      .from(schema.controlRequirements)
      .where(eq(schema.controlRequirements.id, request.params.id));

    if (!control) {
      return reply.status(404).send({ error: 'Control not found' });
    }

    return reply.send(control);
  });

  // ---------------------------------------------------------------------------
  // PATCH /controls/:id - Update control
  // ---------------------------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateControlSchema>;
  }>('/controls/:id', {
    schema: { body: updateControlSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: userId ?? null,
    };

    // Map all optional fields
    const fields = [
      'name', 'description', 'status', 'controlOwner', 'controlOwnerName',
      'processOwner', 'processOwnerName', 'procedure', 'testingProcedure',
      'testingFrequency', 'evidenceRequirements', 'evidenceLocations',
      'inherentRisk', 'residualRisk', 'controlEffectiveness', 'notes',
      'metadata', 'tags'
    ];

    for (const field of fields) {
      if ((request.body as Record<string, unknown>)[field] !== undefined) {
        updates[field] = (request.body as Record<string, unknown>)[field];
      }
    }

    const [control] = await db
      .update(schema.controlRequirements)
      .set(updates)
      .where(eq(schema.controlRequirements.id, request.params.id))
      .returning();

    if (!control) {
      return reply.status(404).send({ error: 'Control not found' });
    }

    return reply.send(control);
  });

  // ---------------------------------------------------------------------------
  // POST /controls/:id/implement - Mark control as implemented
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { implementationNotes?: string };
  }>('/controls/:id/implement', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    const [control] = await db
      .update(schema.controlRequirements)
      .set({
        status: 'implemented',
        implementedDate: now,
        notes: request.body.implementationNotes ?? null,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.controlRequirements.id, request.params.id))
      .returning();

    if (!control) {
      return reply.status(404).send({ error: 'Control not found' });
    }

    return reply.send(control);
  });

  // ---------------------------------------------------------------------------
  // POST /controls/:id/test - Record test result
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof recordTestResultSchema>;
  }>('/controls/:id/test', {
    schema: { body: recordTestResultSchema },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    const now = new Date();

    // Get current control to calculate next test date
    const [existing] = await db
      .select()
      .from(schema.controlRequirements)
      .where(eq(schema.controlRequirements.id, request.params.id));

    if (!existing) {
      return reply.status(404).send({ error: 'Control not found' });
    }

    const testingFrequency = existing.testingFrequency || 'quarterly';
    const nextTestDate = calculateNextTestDate(now, testingFrequency as any);

    // Determine new status based on test result
    let newStatus = existing.status;
    if (request.body.testResult === 'pass') {
      newStatus = 'operating_effectively';
    } else if (request.body.testResult === 'fail') {
      newStatus = 'deficient';
    }

    const [control] = await db
      .update(schema.controlRequirements)
      .set({
        lastTestedDate: now,
        nextTestDueDate: nextTestDate,
        lastTestResult: request.body.testResult,
        sampleSize: request.body.sampleSize ?? null,
        evidenceLocations: request.body.evidenceLocations ?? existing.evidenceLocations,
        deficiencyCount: request.body.deficiencyCount ?? existing.deficiencyCount,
        materialWeakness: request.body.materialWeakness ?? existing.materialWeakness,
        significantDeficiency: request.body.significantDeficiency ?? existing.significantDeficiency,
        status: newStatus,
        updatedAt: now,
        updatedBy: userId ?? null,
      })
      .where(eq(schema.controlRequirements.id, request.params.id))
      .returning();

    return reply.send(control);
  });

  // ---------------------------------------------------------------------------
  // GET /controls/due-for-testing - Get controls due for testing
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: { days?: number };
  }>('/controls/due-for-testing', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const days = request.query.days ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const controls = await db
      .select()
      .from(schema.controlRequirements)
      .where(
        and(
          eq(schema.controlRequirements.tenantId, tenantId),
          lte(schema.controlRequirements.nextTestDueDate, cutoffDate)
        )
      )
      .orderBy(schema.controlRequirements.nextTestDueDate);

    return reply.send({
      data: controls,
      total: controls.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /controls/deficient - Get deficient controls
  // ---------------------------------------------------------------------------
  fastify.get('/controls/deficient', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const controls = await db
      .select()
      .from(schema.controlRequirements)
      .where(
        and(
          eq(schema.controlRequirements.tenantId, tenantId),
          eq(schema.controlRequirements.status, 'deficient')
        )
      )
      .orderBy(desc(schema.controlRequirements.riskLevel));

    return reply.send({
      data: controls,
      total: controls.length,
      criticalCount: controls.filter(c => c.materialWeakness).length,
      significantCount: controls.filter(c => c.significantDeficiency).length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /controls/metrics - Get control metrics
  // ---------------------------------------------------------------------------
  fastify.get('/controls/metrics', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const controls = await db
      .select()
      .from(schema.controlRequirements)
      .where(eq(schema.controlRequirements.tenantId, tenantId));

    const total = controls.length;
    const byStatus = {
      not_implemented: controls.filter(c => c.status === 'not_implemented').length,
      in_design: controls.filter(c => c.status === 'in_design').length,
      in_implementation: controls.filter(c => c.status === 'in_implementation').length,
      implemented: controls.filter(c => c.status === 'implemented').length,
      operating_effectively: controls.filter(c => c.status === 'operating_effectively').length,
      deficient: controls.filter(c => c.status === 'deficient').length,
    };

    const byFramework: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};

    for (const control of controls) {
      byFramework[control.framework] = (byFramework[control.framework] || 0) + 1;
      byRiskLevel[control.riskLevel] = (byRiskLevel[control.riskLevel] || 0) + 1;
    }

    const materialWeaknesses = controls.filter(c => c.materialWeakness).length;
    const significantDeficiencies = controls.filter(c => c.significantDeficiency).length;

    const effectiveControls = controls.filter(c => c.status === 'operating_effectively').length;
    const effectivenessRate = total > 0 ? ((effectiveControls / total) * 100).toFixed(1) : '0';

    return reply.send({
      total,
      byStatus,
      byFramework,
      byRiskLevel,
      materialWeaknesses,
      significantDeficiencies,
      effectivenessRate,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /controls/frameworks - Get available frameworks
  // ---------------------------------------------------------------------------
  fastify.get('/controls/frameworks', async (request, reply) => {
    const frameworks = [
      { code: 'coso', name: 'COSO', description: 'Committee of Sponsoring Organizations Internal Control Framework' },
      { code: 'cobit', name: 'COBIT', description: 'Control Objectives for Information and Related Technologies' },
      { code: 'iso27001', name: 'ISO 27001', description: 'Information Security Management System' },
      { code: 'iso31000', name: 'ISO 31000', description: 'Risk Management Framework' },
      { code: 'sox', name: 'SOX', description: 'Sarbanes-Oxley Act Compliance' },
      { code: 'gdpr', name: 'GDPR', description: 'General Data Protection Regulation Controls' },
      { code: 'pci_dss', name: 'PCI DSS', description: 'Payment Card Industry Data Security Standard' },
      { code: 'nist', name: 'NIST CSF', description: 'NIST Cybersecurity Framework' },
      { code: 'custom', name: 'Custom', description: 'Custom Control Framework' },
    ];

    return reply.send({ data: frameworks });
  });
}
