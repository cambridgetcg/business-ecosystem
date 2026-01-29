/**
 * Patents API Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Patent } from '../../../domain/entities/patent.entity.js';
import { DrizzlePatentRepository } from '../../../infrastructure/persistence/patent.repository.js';

// Validation schemas
const createPatentSchema = z.object({
  title: z.string().min(1).max(500),
  abstract: z.string().optional(),
  type: z.enum(['utility', 'design', 'plant', 'reissue']),
  inventors: z.array(z.string()).min(1),
  assigneeId: z.string().uuid().optional(),
  jurisdictions: z.array(z.string()).default([]),
});

const filePatentSchema = z.object({
  applicationNumber: z.string().min(1),
  filingDate: z.string().datetime(),
});

const grantPatentSchema = z.object({
  patentNumber: z.string().min(1),
  grantDate: z.string().datetime(),
  expirationDate: z.string().datetime(),
});

export const patentsRoutes: FastifyPluginAsync = async (app) => {
  const getRepository = () => new DrizzlePatentRepository((app as any).db);

  // List patents
  app.get('/', {
    schema: {
      tags: ['patents'],
      summary: 'List all patents',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { limit, offset, status } = request.query as { limit?: number; offset?: number; status?: string };
    const repo = getRepository();
    const patents = await repo.findAll({ limit, offset, status });
    const total = await repo.count({ status });
    return { data: patents, total, limit, offset };
  });

  // Get patent by ID
  app.get('/:id', {
    schema: {
      tags: ['patents'],
      summary: 'Get patent by ID',
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
    const patent = await repo.findById(id);
    
    if (!patent) {
      return reply.status(404).send({ error: 'Patent not found' });
    }
    
    return patent;
  });

  // Create patent
  app.post('/', {
    schema: {
      tags: ['patents'],
      summary: 'Create a new patent',
      body: {
        type: 'object',
        required: ['title', 'type', 'inventors'],
        properties: {
          title: { type: 'string' },
          abstract: { type: 'string' },
          type: { type: 'string', enum: ['utility', 'design', 'plant', 'reissue'] },
          inventors: { type: 'array', items: { type: 'string' } },
          assigneeId: { type: 'string', format: 'uuid' },
          jurisdictions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createPatentSchema.parse(request.body);
    const repo = getRepository();
    
    const patent = Patent.create({
      title: parsed.title,
      abstract: parsed.abstract,
      type: parsed.type,
      inventors: parsed.inventors,
      assigneeId: parsed.assigneeId,
      jurisdictions: parsed.jurisdictions,
      claims: [],
    });
    
    await repo.save(patent);
    return reply.status(201).send(patent);
  });

  // File patent
  app.post('/:id/file', {
    schema: {
      tags: ['patents'],
      summary: 'File a patent application',
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
    const data = filePatentSchema.parse(request.body);
    const repo = getRepository();
    
    const patent = await repo.findById(id);
    if (!patent) {
      return reply.status(404).send({ error: 'Patent not found' });
    }
    
    patent.file(data.applicationNumber, new Date(data.filingDate));
    await repo.save(patent);
    
    return patent;
  });

  // Grant patent
  app.post('/:id/grant', {
    schema: {
      tags: ['patents'],
      summary: 'Grant a patent',
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
    const data = grantPatentSchema.parse(request.body);
    const repo = getRepository();
    
    const patent = await repo.findById(id);
    if (!patent) {
      return reply.status(404).send({ error: 'Patent not found' });
    }
    
    patent.grant(data.patentNumber, new Date(data.grantDate), new Date(data.expirationDate));
    await repo.save(patent);
    
    return patent;
  });

  // Search patents
  app.get('/search', {
    schema: {
      tags: ['patents'],
      summary: 'Search patents',
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
    const patents = await repo.search(q);
    return { data: patents, query: q };
  });

  // Delete patent
  app.delete('/:id', {
    schema: {
      tags: ['patents'],
      summary: 'Delete a patent (soft delete)',
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
    
    const patent = await repo.findById(id);
    if (!patent) {
      return reply.status(404).send({ error: 'Patent not found' });
    }
    
    await repo.delete(id);
    return reply.status(204).send();
  });
};
