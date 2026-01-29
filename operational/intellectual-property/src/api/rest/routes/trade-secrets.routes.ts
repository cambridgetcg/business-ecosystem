/**
 * Trade Secrets API Routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TradeSecret } from '../../../domain/entities/trade-secret.entity.js';
import { DrizzleTradeSecretRepository } from '../../../infrastructure/persistence/trade-secret.repository.js';

// Validation schemas
const tradeSecretCategorySchema = z.enum([
  'technical', 'business', 'financial', 'customer', 'process', 'formula', 'other'
]);

const sensitivityLevelSchema = z.enum([
  'confidential', 'highly_confidential', 'restricted'
]);

const accessLevelSchema = z.enum(['read', 'write', 'admin']);

const createTradeSecretSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  category: tradeSecretCategorySchema,
  sensitivityLevel: sensitivityLevelSchema,
  ownerId: z.string().uuid(),
  custodianId: z.string().uuid().optional(),
  identifiedDate: z.string().datetime(),
  economicValueDescription: z.string().min(1).max(2000),
  estimatedValue: z.number().int().min(0).optional(),
});

const grantAccessSchema = z.object({
  userId: z.string().uuid(),
  accessLevel: accessLevelSchema,
  grantedBy: z.string().uuid(),
});

const revokeAccessSchema = z.object({
  userId: z.string().uuid(),
});

const discloseSchema = z.object({
  reason: z.string().min(1).max(2000),
});

const updateReviewDateSchema = z.object({
  reviewDate: z.string().datetime(),
});

const updateEstimatedValueSchema = z.object({
  estimatedValue: z.number().int().min(0),
});

const assignCustodianSchema = z.object({
  custodianId: z.string().uuid(),
});

const updateSensitivityLevelSchema = z.object({
  sensitivityLevel: sensitivityLevelSchema,
});

export const tradeSecretsRoutes: FastifyPluginAsync = async (app) => {
  const getRepository = () => new DrizzleTradeSecretRepository((app as any).db);

  // List trade secrets
  app.get('/', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'List all trade secrets',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          status: { type: 'string', enum: ['active', 'disclosed', 'abandoned', 'converted_to_patent'] },
          category: {
            type: 'string',
            enum: ['technical', 'business', 'financial', 'customer', 'process', 'formula', 'other']
          },
          sensitivityLevel: { type: 'string', enum: ['confidential', 'highly_confidential', 'restricted'] },
        },
      },
    },
  }, async (request) => {
    const { limit, offset, status, category, sensitivityLevel } = request.query as {
      limit?: number;
      offset?: number;
      status?: string;
      category?: string;
      sensitivityLevel?: string;
    };
    const repo = getRepository();
    const tradeSecrets = await repo.findAll({ limit, offset, status, category, sensitivityLevel });
    const total = await repo.count({ status, category });
    return { data: tradeSecrets, total, limit, offset };
  });

  // Get trade secret by ID
  app.get('/:id', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Get trade secret by ID',
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
    const tradeSecret = await repo.findById(id);

    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    return tradeSecret;
  });

  // Get trade secrets by owner
  app.get('/by-owner/:ownerId', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Get trade secrets by owner',
      params: {
        type: 'object',
        properties: {
          ownerId: { type: 'string', format: 'uuid' },
        },
        required: ['ownerId'],
      },
    },
  }, async (request) => {
    const { ownerId } = request.params as { ownerId: string };
    const repo = getRepository();
    const tradeSecrets = await repo.findByOwner(ownerId);
    return { data: tradeSecrets };
  });

  // Get trade secrets by custodian
  app.get('/by-custodian/:custodianId', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Get trade secrets by custodian',
      params: {
        type: 'object',
        properties: {
          custodianId: { type: 'string', format: 'uuid' },
        },
        required: ['custodianId'],
      },
    },
  }, async (request) => {
    const { custodianId } = request.params as { custodianId: string };
    const repo = getRepository();
    const tradeSecrets = await repo.findByCustodian(custodianId);
    return { data: tradeSecrets };
  });

  // Get trade secrets user has access to
  app.get('/by-access/:userId', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Get trade secrets user has access to',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
  }, async (request) => {
    const { userId } = request.params as { userId: string };
    const repo = getRepository();
    const tradeSecrets = await repo.findByUserAccess(userId);
    return { data: tradeSecrets };
  });

  // Search trade secrets
  app.get('/search', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Search trade secrets by title or description',
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
    const tradeSecrets = await repo.search(q);
    return { data: tradeSecrets, query: q };
  });

  // Create trade secret
  app.post('/', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Create a new trade secret',
      body: {
        type: 'object',
        required: ['title', 'description', 'category', 'sensitivityLevel', 'ownerId', 'identifiedDate', 'economicValueDescription'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', enum: ['technical', 'business', 'financial', 'customer', 'process', 'formula', 'other'] },
          sensitivityLevel: { type: 'string', enum: ['confidential', 'highly_confidential', 'restricted'] },
          ownerId: { type: 'string', format: 'uuid' },
          custodianId: { type: 'string', format: 'uuid' },
          identifiedDate: { type: 'string', format: 'date-time' },
          economicValueDescription: { type: 'string' },
          estimatedValue: { type: 'integer' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createTradeSecretSchema.parse(request.body);
    const repo = getRepository();

    const tradeSecret = TradeSecret.create({
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      sensitivityLevel: parsed.sensitivityLevel,
      ownerId: parsed.ownerId,
      identifiedDate: new Date(parsed.identifiedDate),
      economicValueDescription: parsed.economicValueDescription,
      ...(parsed.custodianId && { custodianId: parsed.custodianId }),
      ...(parsed.estimatedValue && { estimatedValue: parsed.estimatedValue }),
    });

    await repo.save(tradeSecret);
    return reply.status(201).send(tradeSecret);
  });

  // Grant access to trade secret
  app.post('/:id/access', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Grant access to a trade secret',
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
    const data = grantAccessSchema.parse(request.body);
    const repo = getRepository();

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.grantAccess(data.userId, data.accessLevel, data.grantedBy);
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Revoke access from trade secret
  app.delete('/:id/access/:userId', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Revoke access from a trade secret',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['id', 'userId'],
      },
    },
  }, async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const repo = getRepository();

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.revokeAccess(userId);
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Mark as disclosed
  app.post('/:id/disclose', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Mark trade secret as disclosed',
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
    const data = discloseSchema.parse(request.body);
    const repo = getRepository();

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.markAsDisclosed(data.reason);
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Abandon trade secret
  app.post('/:id/abandon', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Abandon a trade secret',
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

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.abandon();
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Convert to patent
  app.post('/:id/convert-to-patent', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Convert trade secret to patent application',
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

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.convertToPatent();
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Update review date
  app.post('/:id/review', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Update trade secret review date',
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
    const data = updateReviewDateSchema.parse(request.body);
    const repo = getRepository();

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.updateReviewDate(new Date(data.reviewDate));
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Update estimated value
  app.patch('/:id/value', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Update trade secret estimated value',
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
    const data = updateEstimatedValueSchema.parse(request.body);
    const repo = getRepository();

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.updateEstimatedValue(data.estimatedValue);
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Assign custodian
  app.patch('/:id/custodian', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Assign custodian to trade secret',
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
    const data = assignCustodianSchema.parse(request.body);
    const repo = getRepository();

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.assignCustodian(data.custodianId);
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Update sensitivity level
  app.patch('/:id/sensitivity', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Update trade secret sensitivity level',
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
    const data = updateSensitivityLevelSchema.parse(request.body);
    const repo = getRepository();

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    tradeSecret.updateSensitivityLevel(data.sensitivityLevel);
    await repo.save(tradeSecret);

    return tradeSecret;
  });

  // Delete trade secret (soft delete)
  app.delete('/:id', {
    schema: {
      tags: ['trade-secrets'],
      summary: 'Delete a trade secret (soft delete)',
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

    const tradeSecret = await repo.findById(id);
    if (!tradeSecret) {
      return reply.status(404).send({ error: 'Trade secret not found' });
    }

    await repo.delete(id);
    return reply.status(204).send();
  });
};
