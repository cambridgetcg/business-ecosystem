/**
 * Registered Agent REST Routes
 *
 * Endpoints for managing registered agents / registered offices.
 * Required for UK Companies House and other jurisdictions.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/database.js';
import { registeredAgents, legalEntities } from '../../../infrastructure/persistence/schema.js';

interface RegisteredAgentRoutesDeps {
  db: Database;
}

// Validation schemas
const AddressSchema = z.object({
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2),
});

const CreateRegisteredAgentSchema = z.object({
  entityId: z.string().uuid(),
  agentName: z.string().min(1).max(255),
  agentType: z.enum(['individual', 'professional', 'company', 'self']),
  address: AddressSchema,
  effectiveDate: z.string().transform(s => new Date(s)),
});

const UpdateRegisteredAgentSchema = z.object({
  agentName: z.string().min(1).max(255).optional(),
  address: AddressSchema.optional(),
  endDate: z.string().transform(s => new Date(s)).optional().nullable(),
});

export async function registeredAgentRoutes(
  fastify: FastifyInstance,
  deps: RegisteredAgentRoutesDeps
): Promise<void> {
  const { db } = deps;

  // GET /entities/:entityId/registered-agents - List registered agents (history)
  fastify.get<{
    Params: { entityId: string };
    Querystring: { includeFormer?: boolean };
  }>(
    '/entities/:entityId/registered-agents',
    {
      schema: {
        tags: ['Registered Agents'],
        summary: 'List registered agents for an entity',
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
            includeFormer: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (request, reply) => {
      const entity = await db.query.legalEntities.findFirst({
        where: and(
          eq(legalEntities.id, request.params.entityId),
          isNull(legalEntities.deletedAt)
        ),
      });

      if (!entity) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      const conditions = [
        eq(registeredAgents.entityId, request.params.entityId),
        isNull(registeredAgents.deletedAt),
      ];

      const agents = await db.query.registeredAgents.findMany({
        where: and(...conditions),
        orderBy: (ra, { desc }) => [desc(ra.effectiveDate)],
      });

      // Filter to current agent unless includeFormer
      const now = new Date();
      const filtered = request.query.includeFormer
        ? agents
        : agents.filter(a => !a.endDate || a.endDate > now);

      return { data: filtered, count: filtered.length };
    }
  );

  // GET /entities/:entityId/registered-agent - Get current registered agent
  fastify.get<{
    Params: { entityId: string };
  }>(
    '/entities/:entityId/registered-agent',
    {
      schema: {
        tags: ['Registered Agents'],
        summary: 'Get current registered agent for an entity',
        params: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityId'],
        },
      },
    },
    async (request, reply) => {
      const entity = await db.query.legalEntities.findFirst({
        where: and(
          eq(legalEntities.id, request.params.entityId),
          isNull(legalEntities.deletedAt)
        ),
      });

      if (!entity) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      const agents = await db.query.registeredAgents.findMany({
        where: and(
          eq(registeredAgents.entityId, request.params.entityId),
          isNull(registeredAgents.deletedAt)
        ),
        orderBy: (ra, { desc }) => [desc(ra.effectiveDate)],
      });

      // Find current agent (no end date or end date in future)
      const now = new Date();
      const current = agents.find(a => !a.endDate || a.endDate > now);

      if (!current) {
        return reply.status(404).send({ error: 'No current registered agent found' });
      }

      return current;
    }
  );

  // POST /entities/:entityId/registered-agents - Add registered agent (ends previous)
  fastify.post<{
    Params: { entityId: string };
    Body: Omit<z.infer<typeof CreateRegisteredAgentSchema>, 'entityId'>;
  }>(
    '/entities/:entityId/registered-agents',
    {
      schema: {
        tags: ['Registered Agents'],
        summary: 'Add a new registered agent (ends previous if exists)',
        params: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityId'],
        },
      },
    },
    async (request, reply) => {
      try {
        const input = CreateRegisteredAgentSchema.parse({
          ...request.body,
          entityId: request.params.entityId,
        });

        const entity = await db.query.legalEntities.findFirst({
          where: and(
            eq(legalEntities.id, input.entityId),
            isNull(legalEntities.deletedAt)
          ),
        });

        if (!entity) {
          return reply.status(404).send({ error: 'Entity not found' });
        }

        // End any current registered agents
        const currentAgents = await db.query.registeredAgents.findMany({
          where: and(
            eq(registeredAgents.entityId, input.entityId),
            isNull(registeredAgents.endDate),
            isNull(registeredAgents.deletedAt)
          ),
        });

        for (const agent of currentAgents) {
          await db.update(registeredAgents)
            .set({
              endDate: input.effectiveDate,
              updatedAt: new Date(),
              updatedBy: (request as any).user?.id,
            })
            .where(eq(registeredAgents.id, agent.id));
        }

        // Create new registered agent
        const [newAgent] = await db.insert(registeredAgents).values({
          entityId: input.entityId,
          agentName: input.agentName,
          agentType: input.agentType,
          address: input.address,
          effectiveDate: input.effectiveDate,
          createdBy: (request as any).user?.id,
        }).returning();

        return reply.status(201).send(newAgent);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        throw error;
      }
    }
  );

  // GET /registered-agents/:id - Get a specific registered agent record
  fastify.get<{
    Params: { id: string };
  }>(
    '/registered-agents/:id',
    {
      schema: {
        tags: ['Registered Agents'],
        summary: 'Get a registered agent by ID',
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
      const agent = await db.query.registeredAgents.findFirst({
        where: and(
          eq(registeredAgents.id, request.params.id),
          isNull(registeredAgents.deletedAt)
        ),
      });

      if (!agent) {
        return reply.status(404).send({ error: 'Registered agent not found' });
      }

      return agent;
    }
  );

  // PATCH /registered-agents/:id - Update registered agent details
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof UpdateRegisteredAgentSchema>;
  }>(
    '/registered-agents/:id',
    {
      schema: {
        tags: ['Registered Agents'],
        summary: 'Update a registered agent',
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
      try {
        const input = UpdateRegisteredAgentSchema.parse(request.body);

        const [agent] = await db.update(registeredAgents)
          .set({
            ...input,
            updatedAt: new Date(),
            updatedBy: (request as any).user?.id,
          })
          .where(and(
            eq(registeredAgents.id, request.params.id),
            isNull(registeredAgents.deletedAt)
          ))
          .returning();

        if (!agent) {
          return reply.status(404).send({ error: 'Registered agent not found' });
        }

        return agent;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        throw error;
      }
    }
  );

  // POST /registered-agents/:id/change-address - Update registered office address
  fastify.post<{
    Params: { id: string };
    Body: { address: z.infer<typeof AddressSchema>; effectiveDate: string };
  }>(
    '/registered-agents/:id/change-address',
    {
      schema: {
        tags: ['Registered Agents'],
        summary: 'Change registered office address',
        description: 'Updates the address for Companies House / statutory requirements',
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
            effectiveDate: { type: 'string', format: 'date-time' },
          },
          required: ['address', 'effectiveDate'],
        },
      },
    },
    async (request, reply) => {
      const existing = await db.query.registeredAgents.findFirst({
        where: and(
          eq(registeredAgents.id, request.params.id),
          isNull(registeredAgents.deletedAt)
        ),
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Registered agent not found' });
      }

      const validatedAddress = AddressSchema.parse(request.body.address);

      const [agent] = await db.update(registeredAgents)
        .set({
          address: validatedAddress,
          metadata: {
            ...(existing.metadata as object || {}),
            addressHistory: [
              ...((existing.metadata as any)?.addressHistory || []),
              {
                address: existing.address,
                endDate: request.body.effectiveDate,
              },
            ],
          },
          updatedAt: new Date(),
          updatedBy: (request as any).user?.id,
        })
        .where(eq(registeredAgents.id, request.params.id))
        .returning();

      return agent;
    }
  );
}
