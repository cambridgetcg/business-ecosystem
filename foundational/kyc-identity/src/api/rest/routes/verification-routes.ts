/**
 * Verification Request REST API Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { VerificationRequestCommandHandler } from '../../../application/handlers/command-handlers.js';
import { VerificationRequestQueryHandler, AmlScreeningQueryHandler, AuditLogQueryHandler } from '../../../application/handlers/query-handlers.js';
import {
  createVerificationRequestCommandSchema,
} from '../../../application/commands/index.js';

const commandHandler = new VerificationRequestCommandHandler();
const queryHandler = new VerificationRequestQueryHandler();
const amlQueryHandler = new AmlScreeningQueryHandler();
const auditLogQueryHandler = new AuditLogQueryHandler();

// Request schemas
const createVerificationBodySchema = createVerificationRequestCommandSchema.omit({ tenantId: true });

const listQuerySchema = z.object({
  identityId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'REQUIRES_UPDATE']).optional(),
  type: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  orderBy: z.enum(['createdAt', 'requestedAt', 'priority']).default('requestedAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

const pendingReviewsQuerySchema = z.object({
  assignedTo: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const statisticsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const amlQuerySchema = z.object({
  screeningType: z.enum(['PEP', 'SANCTIONS', 'ADVERSE_MEDIA']).optional(),
});

const auditLogQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function verificationRoutes(fastify: FastifyInstance) {
  // Get tenant ID from header
  const getTenantId = (request: FastifyRequest): string => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new Error('Missing x-tenant-id header');
    }
    return tenantId;
  };

  // Create verification request
  fastify.post('/verification-requests', {
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
    const body = createVerificationBodySchema.parse(request.body);

    const id = await commandHandler.createVerificationRequest({
      ...body,
      tenantId,
    });

    reply.status(201).send({ id });
  });

  // Get verification request by ID
  fastify.get('/verification-requests/:id', {
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

    const verificationRequest = await queryHandler.getVerificationRequest({
      requestId: request.params.id,
      tenantId,
    });

    if (!verificationRequest) {
      reply.status(404).send({ error: 'Verification request not found' });
      return;
    }

    reply.send(verificationRequest);
  });

  // List verification requests
  fastify.get('/verification-requests', {
    schema: {


    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = listQuerySchema.parse(request.query);

    const result = await queryHandler.listVerificationRequests({
      ...query,
      tenantId,
    });

    reply.send(result);
  });

  // Get pending reviews
  fastify.get('/verification-requests/pending-reviews', {
    schema: {


    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = pendingReviewsQuerySchema.parse(request.query);

    const result = await queryHandler.getPendingReviews({
      tenantId,
      ...query,
    });

    reply.send(result);
  });

  // Get verification statistics
  fastify.get('/verification-requests/statistics', {
    schema: {


    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = statisticsQuerySchema.parse(request.query);

    const result = await queryHandler.getVerificationStatistics({
      tenantId,
      ...query,
    });

    reply.send(result);
  });

  // Start verification review
  fastify.post('/verification-requests/:id/start-review', {
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
      assignedTo: z.string(),
    }).parse(request.body);

    await commandHandler.startVerificationReview({
      requestId: request.params.id,
      tenantId,
      ...body,
    });

    reply.status(204).send();
  });

  // Complete verification request
  fastify.post('/verification-requests/:id/complete', {
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
      decision: z.enum(['APPROVED', 'REJECTED']),
      reason: z.string().optional(),
      decisionBy: z.string(),
    }).parse(request.body);

    await commandHandler.completeVerificationRequest({
      requestId: request.params.id,
      tenantId,
      ...body,
    });

    reply.status(204).send();
  });

  // Get AML screening results for an identity
  fastify.get('/identities/:identityId/aml-screening', {
    schema: {


      params: {
        type: 'object',
        properties: {
          identityId: { type: 'string', format: 'uuid' },
        },
        required: ['identityId'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { identityId: string } }>, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = amlQuerySchema.parse(request.query);

    const result = await amlQueryHandler.getAmlScreeningResults({
      identityId: request.params.identityId,
      tenantId,
      ...query,
    });

    reply.send(result);
  });

  // Get audit log for an identity
  fastify.get('/identities/:identityId/audit-log', {
    schema: {


      params: {
        type: 'object',
        properties: {
          identityId: { type: 'string', format: 'uuid' },
        },
        required: ['identityId'],
      },
    },
  }, async (request: FastifyRequest<{ Params: { identityId: string } }>, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = auditLogQuerySchema.parse(request.query);

    const result = await auditLogQueryHandler.getIdentityAuditLog({
      identityId: request.params.identityId,
      tenantId,
      ...query,
    });

    reply.send(result);
  });
}
