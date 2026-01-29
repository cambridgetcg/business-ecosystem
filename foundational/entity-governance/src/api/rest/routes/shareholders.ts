/**
 * Shareholder REST Routes
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ShareholderRepository } from '../../../domain/shareholder/repositories/shareholder-repository.js';
import type { LegalEntityRepository } from '../../../domain/entity/repositories/legal-entity-repository.js';
import { ShareholderCommandHandler } from '../../../application/handlers/shareholder-command-handler.js';
import {
  AddShareholderCommandSchema,
  UpdateShareholderCommandSchema,
} from '../../../application/commands/shareholder-commands.js';
import type { EventPublisher } from '../../../infrastructure/integration/event-publisher.js';

interface ShareholderRoutesDeps {
  shareholderRepository: ShareholderRepository;
  entityRepository: LegalEntityRepository;
  eventPublisher?: EventPublisher | undefined;
}

export async function shareholderRoutes(
  fastify: FastifyInstance,
  deps: ShareholderRoutesDeps
): Promise<void> {
  const commandHandler = new ShareholderCommandHandler(
    deps.shareholderRepository,
    deps.entityRepository,
    deps.eventPublisher
  );

  // GET /entities/:entityId/shareholders - List shareholders
  fastify.get<{
    Params: { entityId: string };
  }>(
    '/entities/:entityId/shareholders',
    {
      schema: {
        tags: ['Shareholders'],
        summary: 'List shareholders for a legal entity',
        params: {
          type: 'object',
          properties: { entityId: { type: 'string', format: 'uuid' } },
          required: ['entityId'],
        },
      },
    },
    async (request, reply) => {
      const entity = await deps.entityRepository.findById(request.params.entityId);
      if (!entity) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      const shareholders = await deps.shareholderRepository.findByEntityId(request.params.entityId);
      return { data: shareholders, count: shareholders.length };
    }
  );

  // GET /shareholders/:id - Get single shareholder
  fastify.get<{
    Params: { id: string };
  }>(
    '/shareholders/:id',
    {
      schema: {
        tags: ['Shareholders'],
        summary: 'Get a shareholder by ID',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const shareholder = await deps.shareholderRepository.findById(request.params.id);
      if (!shareholder) {
        return reply.status(404).send({ error: 'Shareholder not found' });
      }
      return shareholder;
    }
  );

  // POST /entities/:entityId/shareholders - Add shareholder
  fastify.post<{
    Params: { entityId: string };
    Body: {
      shareholderType: string;
      name: string;
      taxId?: string;
      contactEmail?: string;
      address?: {
        line1: string;
        line2?: string;
        city: string;
        state?: string;
        postalCode: string;
        country: string;
      };
      metadata?: Record<string, unknown>;
    };
  }>(
    '/entities/:entityId/shareholders',
    {
      schema: {
        tags: ['Shareholders'],
        summary: 'Add a shareholder to a legal entity',
        params: {
          type: 'object',
          properties: { entityId: { type: 'string', format: 'uuid' } },
          required: ['entityId'],
        },
        body: {
          type: 'object',
          properties: {
            shareholderType: { type: 'string', enum: ['individual', 'corporation', 'trust', 'partnership', 'other'] },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            taxId: { type: 'string', maxLength: 50 },
            contactEmail: { type: 'string', format: 'email' },
            address: {
              type: 'object',
              properties: {
                line1: { type: 'string' },
                line2: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                postalCode: { type: 'string' },
                country: { type: 'string' },
              },
              required: ['line1', 'city', 'postalCode', 'country'],
            },
            metadata: { type: 'object' },
          },
          required: ['shareholderType', 'name'],
        },
      },
    },
    async (request, reply) => {
      try {
        const command = AddShareholderCommandSchema.parse({
          entityId: request.params.entityId,
          ...request.body,
          actorId: (request as any).user?.id,
        });

        const shareholder = await commandHandler.addShareholder(command);
        return reply.status(201).send(shareholder);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // PATCH /shareholders/:id - Update shareholder
  fastify.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      taxId?: string | null;
      contactEmail?: string | null;
      address?: {
        line1: string;
        line2?: string;
        city: string;
        state?: string;
        postalCode: string;
        country: string;
      } | null;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/shareholders/:id',
    {
      schema: {
        tags: ['Shareholders'],
        summary: 'Update a shareholder',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      try {
        const command = UpdateShareholderCommandSchema.parse({
          shareholderId: request.params.id,
          ...request.body,
          actorId: (request as any).user?.id,
        });

        const shareholder = await commandHandler.updateShareholder(command);
        return shareholder;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );

  // DELETE /shareholders/:id - Remove shareholder
  fastify.delete<{
    Params: { id: string };
  }>(
    '/shareholders/:id',
    {
      schema: {
        tags: ['Shareholders'],
        summary: 'Remove a shareholder',
        params: {
          type: 'object',
          properties: { id: { type: 'string', format: 'uuid' } },
          required: ['id'],
        },
        response: { 204: { type: 'null' } },
      },
    },
    async (request, reply) => {
      try {
        await commandHandler.removeShareholder({
          shareholderId: request.params.id,
          actorId: (request as any).user?.id,
        });
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    }
  );
}
