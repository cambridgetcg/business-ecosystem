/**
 * Identity REST API Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { IdentityCommandHandler } from '../../../application/handlers/command-handlers.js';
import { IdentityQueryHandler } from '../../../application/handlers/query-handlers.js';
import {
  createIdentityCommandSchema,
  updateIdentityCommandSchema,
  verifyIdentityCommandSchema,
  rejectIdentityCommandSchema,
} from '../../../application/commands/index.js';
import {
  getIdentityQuerySchema,
  getIdentityByExternalIdQuerySchema,
  listIdentitiesQuerySchema,
} from '../../../application/queries/index.js';

const commandHandler = new IdentityCommandHandler();
const queryHandler = new IdentityQueryHandler();

// Request schemas
const createIdentityBodySchema = createIdentityCommandSchema.omit({ tenantId: true });
const updateIdentityBodySchema = updateIdentityCommandSchema.omit({ tenantId: true, identityId: true });

const listQuerySchema = z.object({
  type: z.enum(['INDIVIDUAL', 'CORPORATE', 'TRUST', 'PARTNERSHIP']).optional(),
  verificationStatus: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'REQUIRES_UPDATE']).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'PROHIBITED']).optional(),
  isPep: z.coerce.boolean().optional(),
  isSanctioned: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  orderBy: z.enum(['createdAt', 'updatedAt', 'verifiedAt']).default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

export async function identityRoutes(fastify: FastifyInstance) {
  // Get tenant ID from header (simplified - in production would use auth middleware)
  const getTenantId = (request: FastifyRequest): string => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new Error('Missing x-tenant-id header');
    }
    return tenantId;
  };

  // Create identity
  fastify.post('/identities', {
    schema: {


      body: { type: 'object' },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = createIdentityBodySchema.parse(request.body);

    const id = await commandHandler.createIdentity({
      ...body,
      tenantId,
    });

    reply.status(201).send({ id });
  });

  // Get identity by ID
  fastify.get('/identities/:id', {
    schema: {


      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = getTenantId(request);

    const identity = await queryHandler.getIdentity({
      identityId: request.params.id,
      tenantId,
    });

    if (!identity) {
      reply.status(404).send({ error: 'Identity not found' });
      return;
    }

    reply.send(identity);
  });

  // Get identity by external ID
  fastify.get('/identities/external/:externalId', {
    schema: {


      params: {
        type: 'object',
        properties: {
          externalId: { type: 'string' },
        },
        required: ['externalId'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { externalId: string } }>, reply: FastifyReply) => {
    const tenantId = getTenantId(request);

    const identity = await queryHandler.getIdentityByExternalId({
      externalId: request.params.externalId,
      tenantId,
    });

    if (!identity) {
      reply.status(404).send({ error: 'Identity not found' });
      return;
    }

    reply.send(identity);
  });

  // List identities
  fastify.get('/identities', {
    schema: {


    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = listQuerySchema.parse(request.query);

    const result = await queryHandler.listIdentities({
      ...query,
      tenantId,
    });

    reply.send(result);
  });

  // Update identity
  fastify.patch('/identities/:id', {
    schema: {


      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = updateIdentityBodySchema.parse(request.body);

    await commandHandler.updateIdentity({
      ...body,
      identityId: request.params.id,
      tenantId,
    });

    reply.status(204).send();
  });

  // Verify identity
  fastify.post('/identities/:id/verify', {
    schema: {


      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = z.object({
      verifiedBy: z.string(),
      expiresAt: z.coerce.date().optional(),
    }).parse(request.body);

    await commandHandler.verifyIdentity({
      identityId: request.params.id,
      tenantId,
      ...body,
    });

    reply.status(204).send();
  });

  // Reject identity
  fastify.post('/identities/:id/reject', {
    schema: {


      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = z.object({
      reason: z.string().min(1),
      rejectedBy: z.string(),
    }).parse(request.body);

    await commandHandler.rejectIdentity({
      identityId: request.params.id,
      tenantId,
      ...body,
    });

    reply.status(204).send();
  });
}
