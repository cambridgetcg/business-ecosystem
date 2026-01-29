/**
 * Legal Entities REST API Routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  CreateLegalEntityCommandSchema,
  UpdateLegalEntityCommandSchema,
  DissolveLegalEntityCommandSchema,
} from '../../../application/commands/index.js';
import { ListLegalEntitiesQuerySchema } from '../../../application/queries/index.js';
import type { LegalEntityCommandHandler } from '../../../application/handlers/legal-entity-command-handler.js';
import type { LegalEntityQueryHandler } from '../../../application/handlers/legal-entity-query-handler.js';

interface RouteContext {
  commandHandler: LegalEntityCommandHandler;
  queryHandler: LegalEntityQueryHandler;
}

export async function legalEntitiesRoutes(
  fastify: FastifyInstance,
  context: RouteContext
): Promise<void> {
  const { commandHandler, queryHandler } = context;

  // GET /entities - List legal entities
  fastify.get(
    '/',
    {
      schema: {
        description: 'List legal entities with optional filtering',
        tags: ['Legal Entities'],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            entityType: { type: 'string' },
            jurisdictionCountry: { type: 'string' },
            jurisdictionState: { type: 'string' },
            searchTerm: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array' },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = ListLegalEntitiesQuerySchema.parse(request.query);
      const result = await queryHandler.listLegalEntities(query);
      return reply.send(result);
    }
  );

  // GET /entities/:id - Get a single legal entity
  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get a legal entity by ID',
        tags: ['Legal Entities'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const entity = await queryHandler.getLegalEntity({ entityId: request.params.id });
      if (!entity) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Legal entity not found',
        });
      }
      return reply.send(entity);
    }
  );

  // POST /entities - Create a new legal entity
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new legal entity',
        tags: ['Legal Entities'],
        body: {
          type: 'object',
          required: ['name', 'legalName', 'entityType', 'jurisdictionCountry'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            legalName: { type: 'string', minLength: 1, maxLength: 500 },
            entityType: { type: 'string', enum: ['corporation', 'llc', 'lp', 'llp', 'partnership', 'sole_proprietorship', 'nonprofit', 'trust', 'other'] },
            jurisdictionCountry: { type: 'string', minLength: 2, maxLength: 2 },
            jurisdictionState: { type: 'string', maxLength: 100 },
            incorporationDate: { type: 'string', format: 'date-time' },
            taxId: { type: 'string', maxLength: 50 },
            registrationNumber: { type: 'string', maxLength: 100 },
            metadata: { type: 'object' },
          },
        },
        response: {
          201: { type: 'object' },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;
      const command = CreateLegalEntityCommandSchema.parse({
        ...body,
        incorporationDate: body.incorporationDate ? new Date(body.incorporationDate as string) : undefined,
      });
      const entity = await commandHandler.createLegalEntity(command);
      return reply.status(201).send(entity);
    }
  );

  // PATCH /entities/:id - Update a legal entity
  fastify.patch(
    '/:id',
    {
      schema: {
        description: 'Update a legal entity',
        tags: ['Legal Entities'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            legalName: { type: 'string', minLength: 1, maxLength: 500 },
            status: { type: 'string', enum: ['active', 'inactive', 'dissolved', 'merged', 'converted', 'suspended'] },
            taxId: { type: 'string', maxLength: 50 },
            registrationNumber: { type: 'string', maxLength: 100 },
            metadata: { type: 'object' },
          },
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const command = UpdateLegalEntityCommandSchema.parse({
          entityId: request.params.id,
          ...(request.body as Record<string, unknown>),
        });
        const entity = await commandHandler.updateLegalEntity(command);
        return reply.send(entity);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Legal entity not found',
          });
        }
        throw error;
      }
    }
  );

  // POST /entities/:id/dissolve - Dissolve a legal entity
  fastify.post(
    '/:id/dissolve',
    {
      schema: {
        description: 'Dissolve a legal entity',
        tags: ['Legal Entities'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['dissolutionDate'],
          properties: {
            dissolutionDate: { type: 'string', format: 'date-time' },
            reason: { type: 'string', maxLength: 500 },
          },
        },
        response: {
          200: { type: 'object' },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const command = DissolveLegalEntityCommandSchema.parse({
          entityId: request.params.id,
          dissolutionDate: new Date(body.dissolutionDate as string),
          reason: body.reason,
        });
        const entity = await commandHandler.dissolveLegalEntity(command);
        return reply.send(entity);
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Legal entity not found',
          });
        }
        if (error.message?.includes('cannot be dissolved')) {
          return reply.status(400).send({
            error: 'INVALID_STATE',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  // DELETE /entities/:id - Soft delete a legal entity
  fastify.delete(
    '/:id',
    {
      schema: {
        description: 'Delete a legal entity (soft delete)',
        tags: ['Legal Entities'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          204: { type: 'null' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        await commandHandler.deleteLegalEntity(request.params.id);
        return reply.status(204).send();
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Legal entity not found',
          });
        }
        throw error;
      }
    }
  );

  // GET /entities/:id/subsidiaries - Get subsidiaries of an entity
  fastify.get(
    '/:id/subsidiaries',
    {
      schema: {
        description: 'Get subsidiaries of a legal entity',
        tags: ['Legal Entities', 'Corporate Structure'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'array' },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const subsidiaries = await queryHandler.getSubsidiaries(request.params.id);
      return reply.send(subsidiaries);
    }
  );

  // GET /entities/:id/parent - Get parent of an entity
  fastify.get(
    '/:id/parent',
    {
      schema: {
        description: 'Get parent entity of a subsidiary',
        tags: ['Legal Entities', 'Corporate Structure'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: { type: 'object' },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parent = await queryHandler.getParent(request.params.id);
      if (!parent) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Parent entity not found or entity has no parent',
        });
      }
      return reply.send(parent);
    }
  );
}
