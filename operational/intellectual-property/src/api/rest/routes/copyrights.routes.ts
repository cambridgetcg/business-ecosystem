/**
 * Copyrights API Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Copyright } from '../../../domain/entities/copyright.entity.js';
import { DrizzleCopyrightRepository } from '../../../infrastructure/persistence/copyright.repository.js';

// Validation schemas
const authorSchema = z.object({
  name: z.string().min(1),
  contribution: z.string().min(1),
  isWorkForHire: z.boolean(),
  nationality: z.string().length(2).optional(),
});

const createCopyrightSchema = z.object({
  title: z.string().min(1).max(500),
  alternativeTitles: z.array(z.string()).optional(),
  workType: z.enum([
    'literary', 'musical', 'dramatic', 'choreographic', 'pictorial',
    'audiovisual', 'sound_recording', 'architectural', 'software', 'compilation', 'derivative'
  ]),
  creationDate: z.string().datetime(),
  publicationDate: z.string().datetime().optional(),
  authors: z.array(authorSchema).min(1),
  claimantId: z.string().uuid(),
  description: z.string().optional(),
  nation: z.string().length(2),
  isPublished: z.boolean().default(false),
});

const registerCopyrightSchema = z.object({
  registrationNumber: z.string().min(1).max(50),
  registrationDate: z.string().datetime(),
});

const publishCopyrightSchema = z.object({
  publicationDate: z.string().datetime(),
});

const addAuthorSchema = z.object({
  author: authorSchema,
});

export const copyrightsRoutes: FastifyPluginAsync = async (app) => {
  const getRepository = () => new DrizzleCopyrightRepository((app as any).db);

  // List copyrights
  app.get('/', {
    schema: {
      tags: ['copyrights'],
      summary: 'List all copyrights',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['unregistered', 'pending', 'registered', 'disputed'] },
          workType: {
            type: 'string',
            enum: ['literary', 'musical', 'dramatic', 'choreographic', 'pictorial',
                   'audiovisual', 'sound_recording', 'architectural', 'software', 'compilation', 'derivative']
          },
        },
      },
    },
  }, async (request) => {
    const { limit, offset, status, workType } = request.query as {
      limit?: number;
      offset?: number;
      status?: string;
      workType?: string;
    };
    const repo = getRepository();
    const copyrights = await repo.findAll({ limit, offset, status, workType });
    const total = await repo.count({ status, workType });
    return { data: copyrights, total, limit, offset };
  });

  // Get copyright by ID
  app.get('/:id', {
    schema: {
      tags: ['copyrights'],
      summary: 'Get copyright by ID',
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
    const copyright = await repo.findById(id);

    if (!copyright) {
      return reply.status(404).send({ error: 'Copyright not found' });
    }

    return copyright;
  });

  // Get copyrights by claimant
  app.get('/by-claimant/:claimantId', {
    schema: {
      tags: ['copyrights'],
      summary: 'Get copyrights by claimant',
      params: {
        type: 'object',
        properties: {
          claimantId: { type: 'string', format: 'uuid' },
        },
        required: ['claimantId'],
      },
    },
  }, async (request) => {
    const { claimantId } = request.params as { claimantId: string };
    const repo = getRepository();
    const copyrights = await repo.findByClaimant(claimantId);
    return { data: copyrights };
  });

  // Search copyrights
  app.get('/search', {
    schema: {
      tags: ['copyrights'],
      summary: 'Search copyrights by title',
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
    const copyrights = await repo.search(q);
    return { data: copyrights, query: q };
  });

  // Create copyright
  app.post('/', {
    schema: {
      tags: ['copyrights'],
      summary: 'Create a new copyright',
      body: {
        type: 'object',
        required: ['title', 'workType', 'creationDate', 'authors', 'claimantId', 'nation'],
        properties: {
          title: { type: 'string' },
          alternativeTitles: { type: 'array', items: { type: 'string' } },
          workType: {
            type: 'string',
            enum: ['literary', 'musical', 'dramatic', 'choreographic', 'pictorial',
                   'audiovisual', 'sound_recording', 'architectural', 'software', 'compilation', 'derivative']
          },
          creationDate: { type: 'string', format: 'date-time' },
          publicationDate: { type: 'string', format: 'date-time' },
          authors: { type: 'array', items: { type: 'object' } },
          claimantId: { type: 'string', format: 'uuid' },
          description: { type: 'string' },
          nation: { type: 'string' },
          isPublished: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createCopyrightSchema.parse(request.body);
    const repo = getRepository();

    const copyright = Copyright.create({
      title: parsed.title,
      workType: parsed.workType,
      creationDate: new Date(parsed.creationDate),
      authors: parsed.authors.map(a => ({
        name: a.name,
        contribution: a.contribution,
        isWorkForHire: a.isWorkForHire,
        ...(a.nationality && { nationality: a.nationality }),
      })),
      claimantId: parsed.claimantId,
      nation: parsed.nation,
      isPublished: parsed.isPublished,
      ...(parsed.alternativeTitles && { alternativeTitles: parsed.alternativeTitles }),
      ...(parsed.publicationDate && { publicationDate: new Date(parsed.publicationDate) }),
      ...(parsed.description && { description: parsed.description }),
    });

    await repo.save(copyright);
    return reply.status(201).send(copyright);
  });

  // Submit for registration
  app.post('/:id/submit', {
    schema: {
      tags: ['copyrights'],
      summary: 'Submit copyright for registration',
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

    const copyright = await repo.findById(id);
    if (!copyright) {
      return reply.status(404).send({ error: 'Copyright not found' });
    }

    copyright.submitForRegistration();
    await repo.save(copyright);

    return copyright;
  });

  // Register copyright
  app.post('/:id/register', {
    schema: {
      tags: ['copyrights'],
      summary: 'Register a copyright',
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
    const data = registerCopyrightSchema.parse(request.body);
    const repo = getRepository();

    const copyright = await repo.findById(id);
    if (!copyright) {
      return reply.status(404).send({ error: 'Copyright not found' });
    }

    copyright.register(data.registrationNumber, new Date(data.registrationDate));
    await repo.save(copyright);

    return copyright;
  });

  // Publish work
  app.post('/:id/publish', {
    schema: {
      tags: ['copyrights'],
      summary: 'Mark work as published',
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
    const data = publishCopyrightSchema.parse(request.body);
    const repo = getRepository();

    const copyright = await repo.findById(id);
    if (!copyright) {
      return reply.status(404).send({ error: 'Copyright not found' });
    }

    copyright.publish(new Date(data.publicationDate));
    await repo.save(copyright);

    return copyright;
  });

  // Add author
  app.post('/:id/authors', {
    schema: {
      tags: ['copyrights'],
      summary: 'Add an author to the copyright',
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
    const data = addAuthorSchema.parse(request.body);
    const repo = getRepository();

    const copyright = await repo.findById(id);
    if (!copyright) {
      return reply.status(404).send({ error: 'Copyright not found' });
    }

    const author = {
      name: data.author.name,
      contribution: data.author.contribution,
      isWorkForHire: data.author.isWorkForHire,
      ...(data.author.nationality && { nationality: data.author.nationality }),
    };
    copyright.addAuthor(author);
    await repo.save(copyright);

    return copyright;
  });

  // Mark as disputed
  app.post('/:id/dispute', {
    schema: {
      tags: ['copyrights'],
      summary: 'Mark copyright as disputed',
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

    const copyright = await repo.findById(id);
    if (!copyright) {
      return reply.status(404).send({ error: 'Copyright not found' });
    }

    copyright.dispute();
    await repo.save(copyright);

    return copyright;
  });

  // Delete copyright (soft delete)
  app.delete('/:id', {
    schema: {
      tags: ['copyrights'],
      summary: 'Delete a copyright (soft delete)',
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

    const copyright = await repo.findById(id);
    if (!copyright) {
      return reply.status(404).send({ error: 'Copyright not found' });
    }

    await repo.delete(id);
    return reply.status(204).send();
  });
};
