/**
 * Patent Families API Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PatentFamily } from '../../../domain/entities/patent-family.entity.js';
import { DrizzlePatentFamilyRepository } from '../../../infrastructure/persistence/patent-family.repository.js';

// Validation schemas
const continuationTypeSchema = z.enum(['original', 'continuation', 'divisional', 'continuation_in_part']);

const createPatentFamilySchema = z.object({
  familyName: z.string().min(1).max(255),
  priorityPatentId: z.string().uuid(),
  priorityDate: z.string().datetime(),
  description: z.string().max(2000).optional(),
  technologyArea: z.string().max(100).optional(),
});

const addFamilyMemberSchema = z.object({
  patentId: z.string().uuid(),
  parentPatentId: z.string().uuid().optional(),
  continuationType: continuationTypeSchema,
  isTrueDivisional: z.boolean().optional(),
  restrictionDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

const updateDescriptionSchema = z.object({
  description: z.string().max(2000),
});

const updateTechnologyAreaSchema = z.object({
  technologyArea: z.string().max(100),
});

const updateMemberNotesSchema = z.object({
  notes: z.string().max(1000),
});

export const patentFamiliesRoutes: FastifyPluginAsync = async (app) => {
  const getRepository = () => new DrizzlePatentFamilyRepository((app as any).db);

  // List patent families
  app.get('/', {
    schema: {
      tags: ['patent-families'],
      summary: 'List all patent families',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { limit, offset } = request.query as { limit?: number; offset?: number };
    const repo = getRepository();
    const families = await repo.findAll({ limit, offset });
    const total = await repo.count();
    return { data: families, total, limit, offset };
  });

  // Get patent family by ID
  app.get('/:id', {
    schema: {
      tags: ['patent-families'],
      summary: 'Get patent family by ID',
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
    const family = await repo.findById(id);

    if (!family) {
      return reply.status(404).send({ error: 'Patent family not found' });
    }

    return family;
  });

  // Get patent family by patent ID (find family containing this patent)
  app.get('/by-patent/:patentId', {
    schema: {
      tags: ['patent-families'],
      summary: 'Get patent family containing a specific patent',
      params: {
        type: 'object',
        properties: {
          patentId: { type: 'string', format: 'uuid' },
        },
        required: ['patentId'],
      },
    },
  }, async (request, reply) => {
    const { patentId } = request.params as { patentId: string };
    const repo = getRepository();
    const family = await repo.findByPatentId(patentId);

    if (!family) {
      return reply.status(404).send({ error: 'No patent family found containing this patent' });
    }

    return family;
  });

  // Create patent family
  app.post('/', {
    schema: {
      tags: ['patent-families'],
      summary: 'Create a new patent family',
      body: {
        type: 'object',
        required: ['familyName', 'priorityPatentId', 'priorityDate'],
        properties: {
          familyName: { type: 'string' },
          priorityPatentId: { type: 'string', format: 'uuid' },
          priorityDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          technologyArea: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createPatentFamilySchema.parse(request.body);
    const repo = getRepository();

    // Check if family already exists for this priority patent
    const existing = await repo.findByPriorityPatentId(parsed.priorityPatentId);
    if (existing) {
      return reply.status(409).send({
        error: 'A patent family already exists with this priority patent',
        existingFamilyId: existing.id,
      });
    }

    const family = PatentFamily.create({
      familyName: parsed.familyName,
      priorityPatentId: parsed.priorityPatentId,
      priorityDate: new Date(parsed.priorityDate),
      ...(parsed.description && { description: parsed.description }),
      ...(parsed.technologyArea && { technologyArea: parsed.technologyArea }),
    });

    await repo.save(family);
    return reply.status(201).send(family);
  });

  // Add member to patent family
  app.post('/:id/members', {
    schema: {
      tags: ['patent-families'],
      summary: 'Add a patent to the family',
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
    const data = addFamilyMemberSchema.parse(request.body);
    const repo = getRepository();

    const family = await repo.findById(id);
    if (!family) {
      return reply.status(404).send({ error: 'Patent family not found' });
    }

    const member = family.addMember({
      patentId: data.patentId,
      continuationType: data.continuationType,
      ...(data.parentPatentId && { parentPatentId: data.parentPatentId }),
      ...(data.isTrueDivisional !== undefined && { isTrueDivisional: data.isTrueDivisional }),
      ...(data.restrictionDate && { restrictionDate: new Date(data.restrictionDate) }),
      ...(data.notes && { notes: data.notes }),
    });

    await repo.save(family);

    return reply.status(201).send({ family, addedMember: member });
  });

  // Remove member from patent family
  app.delete('/:id/members/:patentId', {
    schema: {
      tags: ['patent-families'],
      summary: 'Remove a patent from the family',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          patentId: { type: 'string', format: 'uuid' },
        },
        required: ['id', 'patentId'],
      },
    },
  }, async (request, reply) => {
    const { id, patentId } = request.params as { id: string; patentId: string };
    const repo = getRepository();

    const family = await repo.findById(id);
    if (!family) {
      return reply.status(404).send({ error: 'Patent family not found' });
    }

    family.removeMember(patentId);
    await repo.save(family);

    return family;
  });

  // Update member notes
  app.patch('/:id/members/:patentId/notes', {
    schema: {
      tags: ['patent-families'],
      summary: 'Update notes for a family member',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          patentId: { type: 'string', format: 'uuid' },
        },
        required: ['id', 'patentId'],
      },
    },
  }, async (request, reply) => {
    const { id, patentId } = request.params as { id: string; patentId: string };
    const data = updateMemberNotesSchema.parse(request.body);
    const repo = getRepository();

    const family = await repo.findById(id);
    if (!family) {
      return reply.status(404).send({ error: 'Patent family not found' });
    }

    family.updateMemberNotes(patentId, data.notes);
    await repo.save(family);

    return family;
  });

  // Update family description
  app.patch('/:id/description', {
    schema: {
      tags: ['patent-families'],
      summary: 'Update patent family description',
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
    const data = updateDescriptionSchema.parse(request.body);
    const repo = getRepository();

    const family = await repo.findById(id);
    if (!family) {
      return reply.status(404).send({ error: 'Patent family not found' });
    }

    family.updateDescription(data.description);
    await repo.save(family);

    return family;
  });

  // Update technology area
  app.patch('/:id/technology-area', {
    schema: {
      tags: ['patent-families'],
      summary: 'Update patent family technology area',
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
    const data = updateTechnologyAreaSchema.parse(request.body);
    const repo = getRepository();

    const family = await repo.findById(id);
    if (!family) {
      return reply.status(404).send({ error: 'Patent family not found' });
    }

    family.updateTechnologyArea(data.technologyArea);
    await repo.save(family);

    return family;
  });

  // Get family tree (ancestor chain for a patent)
  app.get('/:id/tree/:patentId', {
    schema: {
      tags: ['patent-families'],
      summary: 'Get the ancestor chain for a patent in the family',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          patentId: { type: 'string', format: 'uuid' },
        },
        required: ['id', 'patentId'],
      },
    },
  }, async (request, reply) => {
    const { id, patentId } = request.params as { id: string; patentId: string };
    const repo = getRepository();

    const family = await repo.findById(id);
    if (!family) {
      return reply.status(404).send({ error: 'Patent family not found' });
    }

    const member = family.getMemberByPatentId(patentId);
    if (!member) {
      return reply.status(404).send({ error: 'Patent is not a member of this family' });
    }

    const ancestors = family.getAncestorChain(patentId);
    const children = family.getChildMembers(patentId);

    return {
      member,
      ancestors,
      children,
    };
  });

  // Delete patent family (soft delete)
  app.delete('/:id', {
    schema: {
      tags: ['patent-families'],
      summary: 'Delete a patent family (soft delete)',
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

    const family = await repo.findById(id);
    if (!family) {
      return reply.status(404).send({ error: 'Patent family not found' });
    }

    await repo.delete(id);
    return reply.status(204).send();
  });
};
