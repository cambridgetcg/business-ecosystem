/**
 * Data Processor (Vendor Privacy) Routes
 * GDPR Article 28 - Processor relationships and DPA management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { ProcessorService } from '../domain/vendor-privacy/services/processor.service.js';
import type { ProcessorQueryFilter } from '../domain/vendor-privacy/models/data-processor.js';
import { eventPublisher, EventTypes } from '../lib/events.js';

const processorRoutes = new Hono();

// ===========================================================================
// Validation Schemas
// ===========================================================================

const dataCategorySchema = z.enum([
  'BASIC_IDENTITY', 'CONTACT_DETAILS', 'FINANCIAL', 'EMPLOYMENT', 'EDUCATION',
  'ONLINE_IDENTIFIERS', 'LOCATION', 'BEHAVIORAL', 'PREFERENCES', 'DEVICE_DATA',
  'COMMUNICATION', 'IMAGES', 'AUDIO_VIDEO', 'OTHER',
]);

const createProcessorSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  country: z.string().length(2).toUpperCase(),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email().optional(),
  dataCategories: z.array(dataCategorySchema).min(1),
  purposes: z.array(z.string()).min(1),
});

const updateProcessorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  contactName: z.string().max(255).optional(),
  contactEmail: z.string().email().optional(),
  country: z.string().length(2).toUpperCase().optional(),
  dataCategories: z.array(dataCategorySchema).optional(),
  purposes: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
});

const recordDPASchema = z.object({
  dpaReference: z.string().min(1).max(100),
  signedAt: z.string().transform(s => new Date(s)),
  expiresAt: z.string().transform(s => new Date(s)),
});

const transferMechanismSchema = z.object({
  mechanism: z.enum([
    'ADEQUACY_DECISION', 'STANDARD_CONTRACTUAL_CLAUSES', 'BINDING_CORPORATE_RULES',
    'DEROGATION', 'CERTIFICATION', 'CODE_OF_CONDUCT',
  ]),
  sccReference: z.string().optional(),
});

const addSubProcessorSchema = z.object({
  name: z.string().min(1).max(255),
  country: z.string().length(2).toUpperCase(),
  purposes: z.array(z.string()).min(1),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// ===========================================================================
// Processor CRUD
// ===========================================================================

// Create processor
processorRoutes.post(
  '/',
  zValidator('json', createProcessorSchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const body = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.createProcessor({
      ...body,
      createdBy: userId,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const processor = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.PROCESSOR_CREATED,
      'DataProcessor',
      processor.id,
      {
        entityId: processor.entityId,
        name: processor.name,
        country: processor.country,
        dataCategories: processor.dataCategories,
      },
      userId
    );

    return c.json(processor, 201);
  }
);

// Get processor by ID
processorRoutes.get(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');

    const result = await service.getProcessor(id);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.data);
  }
);

// Update processor
processorRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateProcessorSchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.updateProcessor(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// List processors
processorRoutes.get(
  '/',
  async (c) => {
    const service = c.get('processorService') as ProcessorService;

    const filter: ProcessorQueryFilter = {
      entityId: c.req.query('entityId') || undefined,
      status: c.req.query('status') as ProcessorQueryFilter['status'] || undefined,
      complianceStatus: c.req.query('complianceStatus') as ProcessorQueryFilter['complianceStatus'] || undefined,
      isEU: c.req.query('isEU') === 'true' ? true : c.req.query('isEU') === 'false' ? false : undefined,
      dpaExpiringSoon: c.req.query('dpaExpiringSoon') === 'true' || undefined,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
    };

    const result = await service.listProcessors(filter);
    return c.json(result);
  }
);

// ===========================================================================
// DPA Management
// ===========================================================================

// Record DPA
processorRoutes.post(
  '/:id/dpa',
  zValidator('param', idParamSchema),
  zValidator('json', recordDPASchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.recordDPA(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const processor = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.PROCESSOR_DPA_RECORDED,
      'DataProcessor',
      processor.id,
      {
        entityId: processor.entityId,
        name: processor.name,
        dpaReference: body.dpaReference,
        expiresAt: body.expiresAt,
      }
    );

    return c.json(processor);
  }
);

// Set transfer mechanism
processorRoutes.post(
  '/:id/transfer-mechanism',
  zValidator('param', idParamSchema),
  zValidator('json', transferMechanismSchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.setTransferMechanism(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Sub-Processor Management
// ===========================================================================

// Add sub-processor
processorRoutes.post(
  '/:id/sub-processors',
  zValidator('param', idParamSchema),
  zValidator('json', addSubProcessorSchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.addSubProcessor(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Status Management
// ===========================================================================

// Activate processor
processorRoutes.post(
  '/:id/activate',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');

    const result = await service.activateProcessor(id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const processor = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.PROCESSOR_ACTIVATED,
      'DataProcessor',
      processor.id,
      {
        entityId: processor.entityId,
        name: processor.name,
        activatedAt: new Date(),
      }
    );

    return c.json(processor);
  }
);

// Suspend processor
processorRoutes.post(
  '/:id/suspend',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({ reason: z.string() })),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');

    const result = await service.suspendProcessor(id, reason);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const processor = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.PROCESSOR_SUSPENDED,
      'DataProcessor',
      processor.id,
      {
        entityId: processor.entityId,
        name: processor.name,
        reason,
        suspendedAt: new Date(),
      }
    );

    return c.json(processor);
  }
);

// Terminate processor
processorRoutes.post(
  '/:id/terminate',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');

    const result = await service.terminateProcessor(id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const processor = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.PROCESSOR_TERMINATED,
      'DataProcessor',
      processor.id,
      {
        entityId: processor.entityId,
        name: processor.name,
        terminatedAt: new Date(),
      }
    );

    return c.json(processor);
  }
);

// ===========================================================================
// Compliance
// ===========================================================================

// Record audit
processorRoutes.post(
  '/:id/audit',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    complianceStatus: z.enum(['UNKNOWN', 'COMPLIANT', 'NON_COMPLIANT', 'UNDER_REVIEW']),
    notes: z.string().optional(),
  })),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');
    const { complianceStatus, notes } = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.recordAudit(id, complianceStatus, notes, userId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// Get compliance risk assessment
processorRoutes.get(
  '/:id/risk',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('processorService') as ProcessorService;
    const { id } = c.req.valid('param');

    const result = await service.getComplianceRisk(id);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.data);
  }
);

export { processorRoutes };
