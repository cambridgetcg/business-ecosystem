/**
 * Licenses API Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { License } from '../../../domain/entities/license.entity.js';
import { DrizzleLicenseRepository } from '../../../infrastructure/persistence/license.repository.js';

// Validation schemas
const territorySchema = z.object({
  includedCountries: z.array(z.string().length(2)).optional(),
  excludedCountries: z.array(z.string().length(2)).optional(),
  worldwide: z.boolean(),
});

const royaltyTermsSchema = z.object({
  type: z.enum(['percentage', 'fixed', 'hybrid', 'lump_sum']),
  rate: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).optional(),
  minimumAnnual: z.number().min(0).optional(),
  paymentFrequency: z.enum(['monthly', 'quarterly', 'annually', 'one_time']),
  currency: z.string().length(3),
});

const createLicenseSchema = z.object({
  licenseNumber: z.string().min(1).max(50),
  ipType: z.enum(['patent', 'trademark', 'copyright', 'trade_secret']),
  ipAssetId: z.string().uuid(),
  licenseType: z.enum(['exclusive', 'non_exclusive', 'sole', 'sublicense']),
  licensorId: z.string().uuid(),
  licenseeId: z.string().uuid(),
  effectiveDate: z.string().datetime(),
  expirationDate: z.string().datetime().optional(),
  territory: territorySchema,
  royaltyTerms: royaltyTermsSchema,
  fieldOfUse: z.string().optional(),
  canSublicense: z.boolean().default(false),
  sublicenseOf: z.string().uuid().optional(),
});

const activateLicenseSchema = z.object({});

const suspendLicenseSchema = z.object({
  reason: z.string().min(1).max(1000),
});

const terminateLicenseSchema = z.object({
  reason: z.string().min(1).max(1000),
  terminationDate: z.string().datetime(),
});

export const licensesRoutes: FastifyPluginAsync = async (app) => {
  const getRepository = () => new DrizzleLicenseRepository((app as any).db);

  // List licenses
  app.get('/', {
    schema: {
      tags: ['licenses'],
      summary: 'List all licenses',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['draft', 'active', 'suspended', 'terminated', 'expired'] },
          licenseType: { type: 'string', enum: ['exclusive', 'non_exclusive', 'sole', 'sublicense'] },
          ipType: { type: 'string', enum: ['patent', 'trademark', 'copyright', 'trade_secret'] },
        },
      },
    },
  }, async (request) => {
    const { limit, offset, status, licenseType, ipType } = request.query as {
      limit?: number;
      offset?: number;
      status?: string;
      licenseType?: string;
      ipType?: string;
    };
    const repo = getRepository();
    const licenses = await repo.findAll({ limit, offset, status, licenseType, ipType });
    const total = await repo.count({ status, licenseType, ipType });
    return { data: licenses, total, limit, offset };
  });

  // Get license by ID
  app.get('/:id', {
    schema: {
      tags: ['licenses'],
      summary: 'Get license by ID',
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
    const license = await repo.findById(id);

    if (!license) {
      return reply.status(404).send({ error: 'License not found' });
    }

    return license;
  });

  // Get licenses by asset
  app.get('/by-asset/:ipType/:ipAssetId', {
    schema: {
      tags: ['licenses'],
      summary: 'Get licenses for a specific IP asset',
      params: {
        type: 'object',
        properties: {
          ipType: { type: 'string', enum: ['patent', 'trademark', 'copyright', 'trade_secret'] },
          ipAssetId: { type: 'string', format: 'uuid' },
        },
        required: ['ipType', 'ipAssetId'],
      },
    },
  }, async (request) => {
    const { ipType, ipAssetId } = request.params as { ipType: string; ipAssetId: string };
    const repo = getRepository();
    const licenses = await repo.findByAsset(ipType, ipAssetId);
    return { data: licenses };
  });

  // Get licenses by party (licensor or licensee)
  app.get('/by-party/:partyId', {
    schema: {
      tags: ['licenses'],
      summary: 'Get licenses where entity is licensor or licensee',
      params: {
        type: 'object',
        properties: {
          partyId: { type: 'string', format: 'uuid' },
        },
        required: ['partyId'],
      },
    },
  }, async (request) => {
    const { partyId } = request.params as { partyId: string };
    const repo = getRepository();
    const licenses = await repo.findByParty(partyId);
    return { data: licenses };
  });

  // Create license
  app.post('/', {
    schema: {
      tags: ['licenses'],
      summary: 'Create a new license',
      body: {
        type: 'object',
        required: ['licenseNumber', 'ipType', 'ipAssetId', 'licenseType', 'licensorId', 'licenseeId', 'effectiveDate', 'territory', 'royaltyTerms'],
        properties: {
          licenseNumber: { type: 'string' },
          ipType: { type: 'string', enum: ['patent', 'trademark', 'copyright', 'trade_secret'] },
          ipAssetId: { type: 'string', format: 'uuid' },
          licenseType: { type: 'string', enum: ['exclusive', 'non_exclusive', 'sole', 'sublicense'] },
          licensorId: { type: 'string', format: 'uuid' },
          licenseeId: { type: 'string', format: 'uuid' },
          effectiveDate: { type: 'string', format: 'date-time' },
          expirationDate: { type: 'string', format: 'date-time' },
          territory: { type: 'object' },
          royaltyTerms: { type: 'object' },
          fieldOfUse: { type: 'string' },
          canSublicense: { type: 'boolean' },
          sublicenseOf: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createLicenseSchema.parse(request.body);
    const repo = getRepository();

    const license = License.create({
      licenseNumber: parsed.licenseNumber,
      ipType: parsed.ipType,
      ipAssetId: parsed.ipAssetId,
      licenseType: parsed.licenseType,
      licensorId: parsed.licensorId,
      licenseeId: parsed.licenseeId,
      effectiveDate: new Date(parsed.effectiveDate),
      expirationDate: parsed.expirationDate ? new Date(parsed.expirationDate) : undefined,
      territory: parsed.territory,
      royaltyTerms: parsed.royaltyTerms,
      fieldOfUse: parsed.fieldOfUse,
      canSublicense: parsed.canSublicense,
      sublicenseOf: parsed.sublicenseOf,
    });

    await repo.save(license);
    return reply.status(201).send(license);
  });

  // Activate license
  app.post('/:id/activate', {
    schema: {
      tags: ['licenses'],
      summary: 'Activate a draft license',
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

    const license = await repo.findById(id);
    if (!license) {
      return reply.status(404).send({ error: 'License not found' });
    }

    license.activate();
    await repo.save(license);

    return license;
  });

  // Suspend license
  app.post('/:id/suspend', {
    schema: {
      tags: ['licenses'],
      summary: 'Suspend an active license',
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
    const data = suspendLicenseSchema.parse(request.body);
    const repo = getRepository();

    const license = await repo.findById(id);
    if (!license) {
      return reply.status(404).send({ error: 'License not found' });
    }

    license.suspend(data.reason);
    await repo.save(license);

    return license;
  });

  // Reinstate license
  app.post('/:id/reinstate', {
    schema: {
      tags: ['licenses'],
      summary: 'Reinstate a suspended license',
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

    const license = await repo.findById(id);
    if (!license) {
      return reply.status(404).send({ error: 'License not found' });
    }

    license.reinstate();
    await repo.save(license);

    return license;
  });

  // Terminate license
  app.post('/:id/terminate', {
    schema: {
      tags: ['licenses'],
      summary: 'Terminate a license',
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
    const data = terminateLicenseSchema.parse(request.body);
    const repo = getRepository();

    const license = await repo.findById(id);
    if (!license) {
      return reply.status(404).send({ error: 'License not found' });
    }

    license.terminate(data.reason, new Date(data.terminationDate));
    await repo.save(license);

    return license;
  });

  // Delete license (soft delete)
  app.delete('/:id', {
    schema: {
      tags: ['licenses'],
      summary: 'Delete a license (soft delete)',
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

    const license = await repo.findById(id);
    if (!license) {
      return reply.status(404).send({ error: 'License not found' });
    }

    await repo.delete(id);
    return reply.status(204).send();
  });
};
