/**
 * Cross-Border Data Transfer Routes
 * GDPR Chapter V - Transfers of personal data to third countries
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { TransferService } from '../domain/cross-border-transfer/services/transfer.service.js';
import type { TransferQueryFilter } from '../domain/cross-border-transfer/models/data-transfer.js';
import { eventPublisher, EventTypes } from '../lib/events.js';

const transferRoutes = new Hono();

// ===========================================================================
// Validation Schemas
// ===========================================================================

const transferBasisSchema = z.enum([
  'ADEQUACY_DECISION', 'STANDARD_CONTRACTUAL_CLAUSES', 'BINDING_CORPORATE_RULES',
  'APPROVED_CODE_OF_CONDUCT', 'APPROVED_CERTIFICATION', 'EXPLICIT_CONSENT',
  'CONTRACT_PERFORMANCE', 'PUBLIC_INTEREST', 'LEGAL_CLAIMS', 'VITAL_INTERESTS', 'PUBLIC_REGISTER',
]);

const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const createTransferSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(2000),
  destinationCountry: z.string().length(2).toUpperCase(),
  recipientName: z.string().min(1).max(255),
  recipientType: z.enum(['CONTROLLER', 'PROCESSOR']),
  dataCategories: z.array(z.string()).min(1),
  dataSubjects: z.array(z.string()).min(1),
  transferPurposes: z.array(z.string()).min(1),
  transferBasis: transferBasisSchema,
  basisReference: z.string().max(100).optional(),
  processorId: z.string().uuid().optional(),
  processingActivityId: z.string().uuid().optional(),
});

const updateTransferSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(2000).optional(),
  dataCategories: z.array(z.string()).optional(),
  dataSubjects: z.array(z.string()).optional(),
  transferPurposes: z.array(z.string()).optional(),
  transferBasis: transferBasisSchema.optional(),
  basisReference: z.string().max(100).optional(),
  technicalMeasures: z.array(z.string()).optional(),
  organizationalMeasures: z.array(z.string()).optional(),
  contractualMeasures: z.array(z.string()).optional(),
});

const impactAssessmentSchema = z.object({
  recipientCountryLaws: z.string().min(1).max(5000),
  supplementaryMeasures: z.string().max(5000).optional(),
  riskLevel: riskLevelSchema,
  conclusion: z.string().min(1).max(2000),
});

const approvalSchema = z.object({
  notes: z.string().max(2000).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

// ===========================================================================
// Transfer CRUD
// ===========================================================================

// Create transfer
transferRoutes.post(
  '/',
  zValidator('json', createTransferSchema),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const body = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.createTransfer({
      ...body,
      createdBy: userId,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const transfer = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.TRANSFER_CREATED,
      'DataTransfer',
      transfer.id,
      {
        entityId: transfer.entityId,
        name: transfer.name,
        destinationCountry: transfer.destinationCountry,
        recipientName: transfer.recipientName,
        transferBasis: transfer.transferBasis,
      },
      userId
    );

    return c.json(transfer, 201);
  }
);

// Get transfer by ID
transferRoutes.get(
  '/:id',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');

    const result = await service.getTransfer(id);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.data);
  }
);

// Update transfer
transferRoutes.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateTransferSchema),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const result = await service.updateTransfer(id, body);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// List transfers
transferRoutes.get(
  '/',
  async (c) => {
    const service = c.get('transferService') as TransferService;

    const filter: TransferQueryFilter = {
      entityId: c.req.query('entityId') || undefined,
      status: c.req.query('status') as TransferQueryFilter['status'] || undefined,
      destinationCountry: c.req.query('destinationCountry') || undefined,
      transferBasis: c.req.query('transferBasis') as TransferQueryFilter['transferBasis'] || undefined,
      hasImpactAssessment: c.req.query('hasImpactAssessment') === 'true' ? true :
                          c.req.query('hasImpactAssessment') === 'false' ? false : undefined,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50,
      offset: c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0,
    };

    const result = await service.listTransfers(filter);
    return c.json(result);
  }
);

// ===========================================================================
// Transfer Impact Assessment (Schrems II)
// ===========================================================================

// Record Transfer Impact Assessment
transferRoutes.post(
  '/:id/impact-assessment',
  zValidator('param', idParamSchema),
  zValidator('json', impactAssessmentSchema),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.recordImpactAssessment(id, {
      ...body,
      assessedBy: userId,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Supplementary Measures
// ===========================================================================

// Add supplementary measures
transferRoutes.post(
  '/:id/measures',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({
    technicalMeasures: z.array(z.string()).optional(),
    organizationalMeasures: z.array(z.string()).optional(),
    contractualMeasures: z.array(z.string()).optional(),
  })),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');
    const measures = c.req.valid('json');

    const result = await service.addSupplementaryMeasures(id, measures);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data);
  }
);

// ===========================================================================
// Workflow
// ===========================================================================

// Submit for review
transferRoutes.post(
  '/:id/submit',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');

    const result = await service.submitForReview(id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const transfer = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.TRANSFER_SUBMITTED,
      'DataTransfer',
      transfer.id,
      {
        entityId: transfer.entityId,
        name: transfer.name,
        destinationCountry: transfer.destinationCountry,
      }
    );

    return c.json(transfer);
  }
);

// Approve transfer
transferRoutes.post(
  '/:id/approve',
  zValidator('param', idParamSchema),
  zValidator('json', approvalSchema),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');
    const { notes } = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.approveTransfer(id, userId, notes);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const transfer = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.TRANSFER_APPROVED,
      'DataTransfer',
      transfer.id,
      {
        entityId: transfer.entityId,
        name: transfer.name,
        destinationCountry: transfer.destinationCountry,
        approvalNotes: notes,
      },
      userId
    );

    return c.json(transfer);
  }
);

// Reject transfer
transferRoutes.post(
  '/:id/reject',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({ reason: z.string() })),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');
    const userId = c.get('userId') || 'system';

    const result = await service.rejectTransfer(id, userId, reason);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const transfer = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.TRANSFER_REJECTED,
      'DataTransfer',
      transfer.id,
      {
        entityId: transfer.entityId,
        name: transfer.name,
        destinationCountry: transfer.destinationCountry,
        reason,
      },
      userId
    );

    return c.json(transfer);
  }
);

// Suspend transfer
transferRoutes.post(
  '/:id/suspend',
  zValidator('param', idParamSchema),
  zValidator('json', z.object({ reason: z.string() })),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');
    const { reason } = c.req.valid('json');

    const result = await service.suspendTransfer(id, reason);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const transfer = result.data;

    // Publish domain event
    await eventPublisher.publish(
      EventTypes.TRANSFER_SUSPENDED,
      'DataTransfer',
      transfer.id,
      {
        entityId: transfer.entityId,
        name: transfer.name,
        destinationCountry: transfer.destinationCountry,
        reason,
      }
    );

    return c.json(transfer);
  }
);

// ===========================================================================
// Utilities
// ===========================================================================

// Get recommended transfer basis for a country
transferRoutes.get(
  '/recommend/:countryCode',
  zValidator('param', z.object({ countryCode: z.string().length(2).toUpperCase() })),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { countryCode } = c.req.valid('param');

    const recommendation = service.getRecommendedBasis(countryCode);
    return c.json(recommendation);
  }
);

// Check adequacy status for a country
transferRoutes.get(
  '/adequacy/:countryCode',
  zValidator('param', z.object({ countryCode: z.string().length(2).toUpperCase() })),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { countryCode } = c.req.valid('param');

    const adequacy = service.getAdequacyStatus(countryCode);
    return c.json(adequacy);
  }
);

// Get compliance status for a transfer
transferRoutes.get(
  '/:id/compliance',
  zValidator('param', idParamSchema),
  async (c) => {
    const service = c.get('transferService') as TransferService;
    const { id } = c.req.valid('param');

    const result = await service.getComplianceStatus(id);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.data);
  }
);

export { transferRoutes };
