/**
 * DPIA (Data Protection Impact Assessment) Routes
 * GDPR Article 35 - Privacy Impact Assessment endpoints
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { DPIAService } from '../domain/privacy-impact/services/dpia.service.js';
import type { DPIAQueryFilter } from '../domain/privacy-impact/models/privacy-impact-assessment.js';
import { eventPublisher, EventTypes } from '../lib/events.js';

const dpiaRoutes = new Hono();

// ===========================================================================
// Validation Schemas
// ===========================================================================

const createDPIASchema = z.object({
  entityId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(5000),
  processingActivityId: z.string().uuid().optional(),
  necessity: z.string().min(1).max(2000),
  proportionality: z.string().min(1).max(2000),
});

const updateDPIASchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(5000).optional(),
  necessity: z.string().min(1).max(2000).optional(),
  proportionality: z.string().min(1).max(2000).optional(),
});

const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const addRiskSchema = z.object({
  description: z.string().min(1).max(2000),
  likelihood: riskLevelSchema,
  impact: riskLevelSchema,
  affectedRights: z.array(z.string()).min(1),
  category: z.string().min(1).max(100),
});

const addMitigationSchema = z.object({
  riskId: z.string(),
  description: z.string().min(1).max(2000),
  type: z.enum(['TECHNICAL', 'ORGANIZATIONAL', 'CONTRACTUAL']),
});

const updateMitigationStatusSchema = z.object({
  status: z.enum(['PLANNED', 'IMPLEMENTED', 'VERIFIED']),
});

const residualRiskSchema = z.object({
  riskId: z.string(),
  residualLevel: riskLevelSchema,
  justification: z.string().min(1).max(2000),
  acceptedBy: z.string().optional(),
});

const setResidualRisksSchema = z.object({
  residualRisks: z.array(residualRiskSchema),
});

const dpoConsultationSchema = z.object({
  opinion: z.string().min(1).max(5000),
});

const authorityConsultationSchema = z.object({
  response: z.string().min(1).max(5000),
});

const reviewSchema = z.object({
  notes: z.string().min(1).max(5000),
  approved: z.boolean(),
});

const approvalSchema = z.object({
  notes: z.string().min(1).max(5000),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// ===========================================================================
// DPIA CRUD
// ===========================================================================

// Create DPIA
dpiaRoutes.post(
  '/',
  zValidator('json', createDPIASchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const body = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.createDPIA({
      ...body,
      createdBy: userId,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const dpia = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.DPIA_CREATED,
      'DPIA',
      dpia.id,
      {
        entityId: dpia.entityId,
        title: dpia.title,
        processingActivityId: dpia.processingActivityId,
      },
      userId
    );

    return c.json(dpia, 201);
  }
);

// Get DPIA by ID
dpiaRoutes.get(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');

    const result = await service.getDPIA(id);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.data);
  }
);

// Update DPIA
dpiaRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateDPIASchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.updateDPIA(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// List DPIAs
dpiaRoutes.get(
  '/',
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;

    const filter: DPIAQueryFilter = {
      entityId: c.req.query('entityId') || undefined,
      status: c.req.query('status') as DPIAQueryFilter['status'] || undefined,
      processingActivityId: c.req.query('processingActivityId') || undefined,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
    };

    const result = await service.listDPIAs(filter);
    return c.json(result);
  }
);

// ===========================================================================
// Risk Management
// ===========================================================================

// Add risk to DPIA
dpiaRoutes.post(
  '/:id/risks',
  zValidator('param', idParamSchema),
  zValidator('json', addRiskSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.addRisk(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// Add mitigation for risk
dpiaRoutes.post(
  '/:id/mitigations',
  zValidator('param', idParamSchema),
  zValidator('json', addMitigationSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.addMitigation(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// Update mitigation status
dpiaRoutes.patch(
  '/:id/mitigations/:mitigationId',
  zValidator('param', z.object({
    id: z.string().uuid(),
    mitigationId: z.string(),
  })),
  zValidator('json', updateMitigationStatusSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id, mitigationId } = c.req.valid('param');
    const { status } = c.req.valid('json');

    const result = await service.updateMitigationStatus(id, mitigationId, status);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// Set residual risks after mitigation
dpiaRoutes.post(
  '/:id/residual-risks',
  zValidator('param', idParamSchema),
  zValidator('json', setResidualRisksSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');
    const { residualRisks } = c.req.valid('json');

    const result = await service.setResidualRisks(id, residualRisks);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Consultation & Review
// ===========================================================================

// Record DPO consultation
dpiaRoutes.post(
  '/:id/dpo-consultation',
  zValidator('param', idParamSchema),
  zValidator('json', dpoConsultationSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');
    const { opinion } = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.consultDPO(id, {
      opinion,
      consultedBy: userId,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// Record supervisory authority consultation (GDPR Art. 36)
dpiaRoutes.post(
  '/:id/authority-consultation',
  zValidator('param', idParamSchema),
  zValidator('json', authorityConsultationSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');
    const { response } = c.req.valid('json');

    const result = await service.consultAuthority(id, response);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Workflow Transitions
// ===========================================================================

// Submit DPIA for review
dpiaRoutes.post(
  '/:id/submit',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');

    const result = await service.submitForReview(id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const dpia = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.DPIA_SUBMITTED,
      'DPIA',
      dpia.id,
      {
        entityId: dpia.entityId,
        title: dpia.title,
        overallRisk: dpia.overallRisk,
      }
    );

    return c.json(dpia);
  }
);

// Review DPIA (approve for next stage or reject)
dpiaRoutes.post(
  '/:id/review',
  zValidator('param', idParamSchema),
  zValidator('json', reviewSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.reviewDPIA(id, {
      ...body,
      reviewedBy: userId,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const dpia = result.data;

    // Publish domain event based on review outcome
    if (!body.approved) {
      await eventPublisher.publish(
        EventTypes.DPIA_REJECTED,
        'DPIA',
        dpia.id,
        {
          entityId: dpia.entityId,
          title: dpia.title,
          reviewNotes: body.notes,
        },
        userId
      );
    }

    return c.json(dpia);
  }
);

// Final approval of DPIA
dpiaRoutes.post(
  '/:id/approve',
  zValidator('param', idParamSchema),
  zValidator('json', approvalSchema),
  async (c) => {
    const service = c.get('dpiaService') as DPIAService;
    const { id } = c.req.valid('param');
    const { notes } = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.approveDPIA(id, userId, notes);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const dpia = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.DPIA_APPROVED,
      'DPIA',
      dpia.id,
      {
        entityId: dpia.entityId,
        title: dpia.title,
        overallRisk: dpia.overallRisk,
        approvalNotes: notes,
      },
      userId
    );

    return c.json(dpia);
  }
);

export { dpiaRoutes };
