/**
 * Trademarks API Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Trademark } from '../../../domain/entities/trademark.entity.js';
import { DrizzleTrademarkRepository } from '../../../infrastructure/persistence/trademark.repository.js';

// Validation schemas
const niceClassSchema = z.object({
  classNumber: z.number().int().min(1).max(45),
  description: z.string(),
  goodsServices: z.array(z.string()),
});

const createTrademarkSchema = z.object({
  mark: z.string().min(1).max(500),
  description: z.string().optional(),
  type: z.enum(['word', 'design', 'combined', 'sound', 'color', '3d']),
  ownerId: z.string().uuid(),
  niceClasses: z.array(niceClassSchema).default([]),
  jurisdictions: z.array(z.string()).default([]),
  logoUrl: z.string().url().optional(),
});

const registerTrademarkSchema = z.object({
  registrationNumber: z.string().min(1),
  registrationDate: z.string().datetime(),
  expirationDate: z.string().datetime(),
});

const renewTrademarkSchema = z.object({
  newExpirationDate: z.string().datetime(),
});

export const trademarksRoutes: FastifyPluginAsync = async (app) => {
  const getRepository = () => new DrizzleTrademarkRepository((app as any).db);

  // List trademarks
  app.get('/', {
    schema: {
      tags: ['trademarks'],
      summary: 'List all trademarks',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string' },
          ownerId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request) => {
    const { limit, offset, status, ownerId } = request.query as { limit?: number; offset?: number; status?: string; ownerId?: string };
    const repo = getRepository();
    
    let trademarksList;
    if (ownerId) {
      trademarksList = await repo.findByOwnerId(ownerId);
    } else {
      trademarksList = await repo.findAll({ limit, offset, status });
    }
    
    const total = await repo.count({ status, ownerId });
    return { data: trademarksList, total, limit, offset };
  });

  // Get trademark by ID
  app.get('/:id', {
    schema: {
      tags: ['trademarks'],
      summary: 'Get trademark by ID',
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
    const trademark = await repo.findById(id);
    
    if (!trademark) {
      return reply.status(404).send({ error: 'Trademark not found' });
    }
    
    return trademark;
  });

  // Create trademark
  app.post('/', {
    schema: {
      tags: ['trademarks'],
      summary: 'Create a new trademark',
      body: {
        type: 'object',
        required: ['mark', 'type', 'ownerId'],
        properties: {
          mark: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['word', 'design', 'combined', 'sound', 'color', '3d'] },
          ownerId: { type: 'string', format: 'uuid' },
          niceClasses: { type: 'array' },
          jurisdictions: { type: 'array', items: { type: 'string' } },
          logoUrl: { type: 'string', format: 'uri' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createTrademarkSchema.parse(request.body);
    const repo = getRepository();
    
    const trademark = Trademark.create({
      mark: parsed.mark,
      description: parsed.description,
      type: parsed.type,
      ownerId: parsed.ownerId,
      niceClasses: parsed.niceClasses,
      jurisdictions: parsed.jurisdictions,
      logoUrl: parsed.logoUrl,
    });
    
    await repo.save(trademark);
    return reply.status(201).send(trademark);
  });

  // Register trademark
  app.post('/:id/register', {
    schema: {
      tags: ['trademarks'],
      summary: 'Register a trademark',
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
    const data = registerTrademarkSchema.parse(request.body);
    const repo = getRepository();
    
    const trademark = await repo.findById(id);
    if (!trademark) {
      return reply.status(404).send({ error: 'Trademark not found' });
    }
    
    trademark.register(
      data.registrationNumber,
      new Date(data.registrationDate),
      new Date(data.expirationDate)
    );
    await repo.save(trademark);
    
    return trademark;
  });

  // Renew trademark
  app.post('/:id/renew', {
    schema: {
      tags: ['trademarks'],
      summary: 'Renew a trademark registration',
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
    const data = renewTrademarkSchema.parse(request.body);
    const repo = getRepository();
    
    const trademark = await repo.findById(id);
    if (!trademark) {
      return reply.status(404).send({ error: 'Trademark not found' });
    }
    
    trademark.renew(new Date(data.newExpirationDate));
    await repo.save(trademark);
    
    return trademark;
  });

  // Search trademarks
  app.get('/search', {
    schema: {
      tags: ['trademarks'],
      summary: 'Search trademarks',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
        },
        required: ['q'],
      },
    },
  }, async (request) => {
    const { q } = request.query as { q: string };
    const repo = getRepository();
    const trademarksList = await repo.search(q);
    return { data: trademarksList, query: q };
  });

  // Delete trademark
  app.delete('/:id', {
    schema: {
      tags: ['trademarks'],
      summary: 'Delete a trademark (soft delete)',
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
    
    const trademark = await repo.findById(id);
    if (!trademark) {
      return reply.status(404).send({ error: 'Trademark not found' });
    }
    
    await repo.delete(id);
    return reply.status(204).send();
  });
};
