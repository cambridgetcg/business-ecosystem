/**
 * Officer REST Routes
 *
 * Endpoints for managing officers of legal entities.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { OfficerRepository } from '../../../domain/officer/repositories/officer-repository.js';
import type { LegalEntityRepository } from '../../../domain/entity/repositories/legal-entity-repository.js';
import { OfficerCommandHandler } from '../../../application/handlers/officer-command-handler.js';
import {
  AppointOfficerCommandSchema,
  UpdateOfficerCommandSchema,
  TerminateOfficerCommandSchema,
} from '../../../application/commands/officer-commands.js';
import { OfficerTitleSchema } from '../../../domain/value-objects/index.js';
import type { EventPublisher } from '../../../infrastructure/integration/event-publisher.js';

interface OfficerRoutesDeps {
  officerRepository: OfficerRepository;
  entityRepository: LegalEntityRepository;
  eventPublisher?: EventPublisher | undefined;
}

export async function officerRoutes(
  fastify: FastifyInstance,
  deps: OfficerRoutesDeps
): Promise<void> {
  const commandHandler = new OfficerCommandHandler(
    deps.officerRepository,
    deps.entityRepository,
    deps.eventPublisher
  );

  // ==========================================================================
  // GET /entities/:entityId/officers - List officers for an entity
  // ==========================================================================
  fastify.get<{
    Params: { entityId: string };
    Querystring: { includeTerminated?: boolean };
  }>(
    '/entities/:entityId/officers',
    {
      schema: {
        tags: ['Officers'],
        summary: 'List officers for a legal entity',
        params: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityId'],
        },
        querystring: {
          type: 'object',
          properties: {
            includeTerminated: { type: 'boolean', default: false },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    entityId: { type: 'string' },
                    personId: { type: 'string' },
                    name: { type: 'string' },
                    title: { type: 'string' },
                    customTitle: { type: 'string', nullable: true },
                    email: { type: 'string', nullable: true },
                    appointmentDate: { type: 'string', format: 'date-time' },
                    terminationDate: { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
              count: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Verify entity exists
      const entity = await deps.entityRepository.findById(request.params.entityId);
      if (!entity) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      const officers = await deps.officerRepository.findByEntityId(
        request.params.entityId,
        request.query.includeTerminated ?? false
      );

      return { data: officers, count: officers.length };
    }
  );

  // ==========================================================================
  // GET /officers/:id - Get a single officer
  // ==========================================================================
  fastify.get<{
    Params: { id: string };
  }>(
    '/officers/:id',
    {
      schema: {
        tags: ['Officers'],
        summary: 'Get an officer by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const officer = await deps.officerRepository.findById(request.params.id);
      if (!officer) {
        return reply.status(404).send({ error: 'Officer not found' });
      }
      return officer;
    }
  );

  // ==========================================================================
  // POST /entities/:entityId/officers - Appoint a new officer
  // ==========================================================================
  fastify.post<{
    Params: { entityId: string };
    Body: {
      personId: string;
      name: string;
      title: string;
      customTitle?: string;
      email?: string;
      appointmentDate: string;
      compensationAmount?: number;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/entities/:entityId/officers',
    {
      schema: {
        tags: ['Officers'],
        summary: 'Appoint a new officer to a legal entity',
        params: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityId'],
        },
        body: {
          type: 'object',
          properties: {
            personId: { type: 'string', format: 'uuid' },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            title: { type: 'string', enum: ['ceo', 'cfo', 'coo', 'cto', 'president', 'vice_president', 'secretary', 'treasurer', 'general_counsel', 'other'] },
            customTitle: { type: 'string', maxLength: 100 },
            email: { type: 'string', format: 'email' },
            appointmentDate: { type: 'string', format: 'date-time' },
            compensationAmount: { type: 'number' },
            metadata: { type: 'object' },
          },
          required: ['personId', 'name', 'title', 'appointmentDate'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              entityId: { type: 'string' },
              name: { type: 'string' },
              title: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const command = AppointOfficerCommandSchema.parse({
          entityId: request.params.entityId,
          personId: request.body.personId,
          name: request.body.name,
          title: request.body.title,
          customTitle: request.body.customTitle,
          email: request.body.email,
          appointmentDate: new Date(request.body.appointmentDate),
          compensationAmount: request.body.compensationAmount,
          metadata: request.body.metadata,
          actorId: (request as any).user?.id,
        });

        const officer = await commandHandler.appointOfficer(command);
        return reply.status(201).send(officer);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes('already has')) {
            return reply.status(409).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // ==========================================================================
  // PATCH /officers/:id - Update an officer
  // ==========================================================================
  fastify.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      customTitle?: string | null;
      email?: string | null;
      compensationAmount?: number | null;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/officers/:id',
    {
      schema: {
        tags: ['Officers'],
        summary: 'Update an officer',
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
            title: { type: 'string', enum: ['ceo', 'cfo', 'coo', 'cto', 'president', 'vice_president', 'secretary', 'treasurer', 'general_counsel', 'other'] },
            customTitle: { type: 'string', maxLength: 100, nullable: true },
            email: { type: 'string', format: 'email', nullable: true },
            compensationAmount: { type: 'number', nullable: true },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const command = UpdateOfficerCommandSchema.parse({
          officerId: request.params.id,
          ...request.body,
          actorId: (request as any).user?.id,
        });

        const officer = await commandHandler.updateOfficer(command);
        return officer;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes('terminated')) {
            return reply.status(400).send({ error: error.message });
          }
          if (error.message.includes('already has')) {
            return reply.status(409).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // ==========================================================================
  // POST /officers/:id/terminate - Terminate an officer
  // ==========================================================================
  fastify.post<{
    Params: { id: string };
    Body: {
      terminationDate: string;
      reason?: string;
    };
  }>(
    '/officers/:id/terminate',
    {
      schema: {
        tags: ['Officers'],
        summary: 'Terminate an officer',
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
            terminationDate: { type: 'string', format: 'date-time' },
            reason: { type: 'string', maxLength: 500 },
          },
          required: ['terminationDate'],
        },
      },
    },
    async (request, reply) => {
      try {
        const command = TerminateOfficerCommandSchema.parse({
          officerId: request.params.id,
          terminationDate: new Date(request.body.terminationDate),
          reason: request.body.reason,
          actorId: (request as any).user?.id,
        });

        const officer = await commandHandler.terminateOfficer(command);
        return officer;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
          if (error.message.includes('already terminated')) {
            return reply.status(400).send({ error: error.message });
          }
        }
        throw error;
      }
    }
  );

  // ==========================================================================
  // DELETE /officers/:id - Soft delete an officer record
  // ==========================================================================
  fastify.delete<{
    Params: { id: string };
  }>(
    '/officers/:id',
    {
      schema: {
        tags: ['Officers'],
        summary: 'Delete an officer record',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request, reply) => {
      try {
        await commandHandler.deleteOfficer(request.params.id, (request as any).user?.id);
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
