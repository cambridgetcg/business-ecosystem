/**
 * Document REST API Routes
 */

import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DocumentCommandHandler } from '../../../application/handlers/command-handlers.js';
import { DocumentQueryHandler } from '../../../application/handlers/query-handlers.js';
import {
  uploadDocumentCommandSchema,
} from '../../../application/commands/index.js';

const commandHandler = new DocumentCommandHandler();
const queryHandler = new DocumentQueryHandler();

// Request schemas
const uploadDocumentBodySchema = uploadDocumentCommandSchema.omit({ tenantId: true });

const listQuerySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const expiringQuerySchema = z.object({
  daysUntilExpiry: z.coerce.number().min(1).max(365).default(30),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export function documentRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions,
  done: (err?: Error) => void
): void {
  // Get tenant ID from header
  const getTenantId = (request: FastifyRequest): string => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new Error('Missing x-tenant-id header');
    }
    return tenantId;
  };

  // Upload document
  fastify.post('/documents', {
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
    const body = uploadDocumentBodySchema.parse(request.body);

    const id = await commandHandler.uploadDocument({
      ...body,
      tenantId,
    });

    return reply.status(201).send({ id });
  });

  // Get document by ID
  fastify.get('/documents/:id', {
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

    const document = await queryHandler.getDocument({
      documentId: request.params.id,
      tenantId,
    });

    if (!document) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    return reply.send(document);
  });

  // List documents for an identity
  fastify.get('/identities/:identityId/documents', {
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
    const query = listQuerySchema.parse(request.query);

    const result = await queryHandler.listDocuments({
      identityId: request.params.identityId,
      tenantId,
      ...query,
    });

    return reply.send(result);
  });

  // Get expiring documents
  fastify.get('/documents/expiring', {
    schema: {


    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = expiringQuerySchema.parse(request.query);

    const result = await queryHandler.getExpiringDocuments({
      tenantId,
      ...query,
    });

    return reply.send(result);
  });

  // Verify document
  fastify.post('/documents/:id/verify', {
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
      checks: z.array(z.object({
        checkType: z.string(),
        status: z.enum(['PASSED', 'FAILED', 'PENDING']),
        score: z.number().optional(),
        details: z.record(z.unknown()).optional(),
      })),
    }).parse(request.body);

    await commandHandler.verifyDocument({
      documentId: request.params.id,
      tenantId,
      ...body,
    });

    return reply.status(204).send();
  });

  // Reject document
  fastify.post('/documents/:id/reject', {
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

    await commandHandler.rejectDocument({
      documentId: request.params.id,
      tenantId,
      ...body,
    });

    return reply.status(204).send();
  });

  done();
}
