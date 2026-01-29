/**
 * Maintenance Fees API Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { MaintenanceFee } from '../../../domain/entities/maintenance-fee.entity.js';
import { DrizzleMaintenanceFeeRepository } from '../../../infrastructure/persistence/maintenance-fee.repository.js';
import { DrizzlePatentRepository } from '../../../infrastructure/persistence/patent.repository.js';

// Validation schemas
const entitySizeSchema = z.enum(['large', 'small', 'micro']);

const createMaintenanceFeeSchema = z.object({
  patentId: z.string().uuid(),
  feeNumber: z.number().int().min(1).max(3),
  jurisdiction: z.string().length(2).optional(),
  dueDate: z.string().datetime(),
  windowOpensDate: z.string().datetime(),
  gracePeriodEndsDate: z.string().datetime(),
});

const payMaintenanceFeeSchema = z.object({
  paidDate: z.string().datetime(),
  paidAmount: z.number().int().min(0),
  entitySize: entitySizeSchema,
  receiptNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const addNotesSchema = z.object({
  notes: z.string().max(1000),
});

const generateFeesSchema = z.object({
  patentId: z.string().uuid(),
  grantDate: z.string().datetime(),
});

export const maintenanceFeesRoutes: FastifyPluginAsync = async (app) => {
  const getRepository = () => new DrizzleMaintenanceFeeRepository((app as any).db);
  const getPatentRepository = () => new DrizzlePatentRepository((app as any).db);

  // List maintenance fees
  app.get('/', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'List all maintenance fees',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['upcoming', 'payable', 'grace_period', 'paid', 'missed'] },
          patentId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => {
    const { limit, offset, status, patentId } = request.query as {
      limit?: number;
      offset?: number;
      status?: string;
      patentId?: string;
    };
    const repo = getRepository();
    const fees = await repo.findAll({ limit, offset, status, patentId });
    const total = await repo.count({ status, patentId });
    return { data: fees, total, limit, offset };
  });

  // Get upcoming maintenance fees (within N days)
  app.get('/upcoming', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Get upcoming maintenance fees',
      querystring: {
        type: 'object',
        properties: {
          daysAhead: { type: 'integer', minimum: 1, maximum: 365, default: 90 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
      },
    },
  }, async (request) => {
    const { daysAhead, limit } = request.query as { daysAhead?: number; limit?: number };
    const repo = getRepository();
    const fees = await repo.findUpcoming({ daysAhead, limit });
    return { data: fees, daysAhead: daysAhead ?? 90 };
  });

  // Get overdue maintenance fees
  app.get('/overdue', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Get overdue maintenance fees',
    },
  }, async () => {
    const repo = getRepository();
    const fees = await repo.findOverdue();
    return { data: fees, count: fees.length };
  });

  // Get maintenance fee by ID
  app.get('/:id', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Get maintenance fee by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();
    const fee = await repo.findById(id);

    if (!fee) {
      return reply.status(404).send({ error: 'Maintenance fee not found' });
    }

    return fee;
  });

  // Get maintenance fees for a patent
  app.get('/by-patent/:patentId', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Get all maintenance fees for a patent',
      params: {
        type: 'object',
        properties: {
          patentId: { type: 'string', format: 'uuid' },
        },
        required: ['patentId'],
      },
    },
  }, async (request) => {
    const { patentId } = request.params as { patentId: string };
    const repo = getRepository();
    const fees = await repo.findByPatentId(patentId);
    return { data: fees };
  });

  // Generate maintenance fees for a granted patent
  app.post('/generate', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Generate maintenance fee schedule for a granted patent',
      body: {
        type: 'object',
        required: ['patentId', 'grantDate'],
        properties: {
          patentId: { type: 'string', format: 'uuid' },
          grantDate: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const data = generateFeesSchema.parse(request.body);
    const repo = getRepository();
    const patentRepo = getPatentRepository();

    // Verify patent exists and is granted
    const patent = await patentRepo.findById(data.patentId);
    if (!patent) {
      return reply.status(404).send({ error: 'Patent not found' });
    }

    if (patent.status !== 'granted') {
      return reply.status(400).send({
        error: 'Cannot generate maintenance fees for non-granted patent',
        patentStatus: patent.status,
      });
    }

    // Check if fees already exist
    const existingFees = await repo.findByPatentId(data.patentId);
    if (existingFees.length > 0) {
      return reply.status(409).send({
        error: 'Maintenance fees already exist for this patent',
        existingFees: existingFees.map(f => ({ id: f.id, feeNumber: f.feeNumber, status: f.status })),
      });
    }

    // Generate fee schedule
    const feeInputs = MaintenanceFee.calculateUSMaintenanceFees(
      data.patentId,
      new Date(data.grantDate)
    );

    const fees = feeInputs.map(input => MaintenanceFee.create(input));
    await repo.saveMany(fees);

    return reply.status(201).send({
      message: 'Generated 3 maintenance fees',
      fees,
    });
  });

  // Create individual maintenance fee (for non-US or manual entry)
  app.post('/', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Create a maintenance fee manually',
      body: {
        type: 'object',
        required: ['patentId', 'feeNumber', 'dueDate', 'windowOpensDate', 'gracePeriodEndsDate'],
        properties: {
          patentId: { type: 'string', format: 'uuid' },
          feeNumber: { type: 'integer', minimum: 1, maximum: 3 },
          jurisdiction: { type: 'string' },
          dueDate: { type: 'string', format: 'date-time' },
          windowOpensDate: { type: 'string', format: 'date-time' },
          gracePeriodEndsDate: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createMaintenanceFeeSchema.parse(request.body);
    const repo = getRepository();

    // Check if fee already exists for this patent and fee number
    const existing = await repo.findByPatentIdAndFeeNumber(
      parsed.patentId,
      parsed.feeNumber as 1 | 2 | 3
    );
    if (existing) {
      return reply.status(409).send({
        error: `Fee ${parsed.feeNumber} already exists for this patent`,
        existingFeeId: existing.id,
      });
    }

    const fee = MaintenanceFee.create({
      patentId: parsed.patentId,
      feeNumber: parsed.feeNumber as 1 | 2 | 3,
      dueDate: new Date(parsed.dueDate),
      windowOpensDate: new Date(parsed.windowOpensDate),
      gracePeriodEndsDate: new Date(parsed.gracePeriodEndsDate),
      ...(parsed.jurisdiction && { jurisdiction: parsed.jurisdiction }),
    });

    await repo.save(fee);
    return reply.status(201).send(fee);
  });

  // Pay maintenance fee
  app.post('/:id/pay', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Record payment of a maintenance fee',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = payMaintenanceFeeSchema.parse(request.body);
    const repo = getRepository();

    const fee = await repo.findById(id);
    if (!fee) {
      return reply.status(404).send({ error: 'Maintenance fee not found' });
    }

    fee.pay({
      paidDate: new Date(data.paidDate),
      paidAmount: data.paidAmount,
      entitySize: data.entitySize,
      ...(data.receiptNumber && { receiptNumber: data.receiptNumber }),
      ...(data.notes && { notes: data.notes }),
    });

    await repo.save(fee);
    return fee;
  });

  // Update fee status (for batch status updates)
  app.post('/:id/update-status', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Update maintenance fee status based on current date',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();

    const fee = await repo.findById(id);
    if (!fee) {
      return reply.status(404).send({ error: 'Maintenance fee not found' });
    }

    const previousStatus = fee.status;
    fee.updateStatus();

    if (fee.status !== previousStatus) {
      await repo.save(fee);
    }

    return {
      fee,
      statusChanged: fee.status !== previousStatus,
      previousStatus,
    };
  });

  // Add notes to maintenance fee
  app.post('/:id/notes', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Add notes to a maintenance fee',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = addNotesSchema.parse(request.body);
    const repo = getRepository();

    const fee = await repo.findById(id);
    if (!fee) {
      return reply.status(404).send({ error: 'Maintenance fee not found' });
    }

    fee.addNotes(data.notes);
    await repo.save(fee);

    return fee;
  });

  // Delete maintenance fee (soft delete)
  app.delete('/:id', {
    schema: {
      tags: ['maintenance-fees'],
      summary: 'Delete a maintenance fee (soft delete)',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repo = getRepository();

    const fee = await repo.findById(id);
    if (!fee) {
      return reply.status(404).send({ error: 'Maintenance fee not found' });
    }

    await repo.delete(id);
    return reply.status(204).send();
  });
};
