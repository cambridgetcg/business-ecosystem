/**
 * Annual Filings REST Routes
 *
 * Endpoints for managing compliance filings for legal entities.
 * Tracks Companies House and jurisdiction-specific filing requirements.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, lte, gte, isNull } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/database.js';
import { annualFilings, filingRequirements, legalEntities } from '../../../infrastructure/persistence/schema.js';

interface FilingsRoutesDeps {
  db: Database;
}

// Validation schemas
const FilingStatusSchema = z.enum(['pending', 'submitted', 'accepted', 'rejected', 'overdue']);

const CreateFilingRequirementSchema = z.object({
  entityId: z.string().uuid(),
  jurisdictionCountry: z.string().length(2),
  jurisdictionState: z.string().max(100).optional(),
  filingType: z.string().min(1).max(100),
  frequency: z.enum(['annual', 'quarterly', 'monthly', 'one-time']),
  dueDateRule: z.object({
    monthsAfterYearEnd: z.number().optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    specificDate: z.string().optional(),
  }).optional(),
  fee: z.number().int().optional(),
});

const CreateFilingSchema = z.object({
  entityId: z.string().uuid(),
  requirementId: z.string().uuid().optional(),
  filingType: z.string().min(1).max(100),
  filingYear: z.number().int().min(1900).max(2100),
  dueDate: z.string().transform(s => new Date(s)),
});

const UpdateFilingSchema = z.object({
  filedDate: z.string().transform(s => new Date(s)).optional(),
  status: FilingStatusSchema.optional(),
  confirmationNumber: z.string().max(100).optional(),
  feePaid: z.number().int().optional(),
});

export async function filingsRoutes(
  fastify: FastifyInstance,
  deps: FilingsRoutesDeps
): Promise<void> {
  const { db } = deps;

  // ==========================================================================
  // Filing Requirements
  // ==========================================================================

  // GET /entities/:entityId/filing-requirements - List filing requirements
  fastify.get<{
    Params: { entityId: string };
  }>(
    '/entities/:entityId/filing-requirements',
    {
      schema: {
        tags: ['Filings'],
        summary: 'List filing requirements for an entity',
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

      const requirements = await db.query.filingRequirements.findMany({
        where: and(
          eq(filingRequirements.entityId, request.params.entityId),
          isNull(filingRequirements.deletedAt)
        ),
      });

      return { data: requirements, count: requirements.length };
    }
  );

  // POST /entities/:entityId/filing-requirements - Create filing requirement
  fastify.post<{
    Params: { entityId: string };
    Body: z.infer<typeof CreateFilingRequirementSchema>;
  }>(
    '/entities/:entityId/filing-requirements',
    {
      schema: {
        tags: ['Filings'],
        summary: 'Create a filing requirement',
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
        const input = CreateFilingRequirementSchema.parse({
          ...request.body,
          entityId: request.params.entityId,
        });

        const [requirement] = await db.insert(filingRequirements).values({
          entityId: input.entityId,
          jurisdictionCountry: input.jurisdictionCountry,
          jurisdictionState: input.jurisdictionState,
          filingType: input.filingType,
          frequency: input.frequency,
          dueDateRule: input.dueDateRule,
          fee: input.fee,
          createdBy: (request as any).user?.id,
        }).returning();

        return reply.status(201).send(requirement);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        throw error;
      }
    }
  );

  // ==========================================================================
  // Annual Filings
  // ==========================================================================

  // GET /entities/:entityId/filings - List filings for an entity
  fastify.get<{
    Params: { entityId: string };
    Querystring: { year?: string; status?: string };
  }>(
    '/entities/:entityId/filings',
    {
      schema: {
        tags: ['Filings'],
        summary: 'List annual filings for an entity',
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
            year: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'submitted', 'accepted', 'rejected', 'overdue'] },
          },
        },
      },
    },
    async (request, reply) => {
      const conditions = [
        eq(annualFilings.entityId, request.params.entityId),
        isNull(annualFilings.deletedAt),
      ];

      if (request.query.year) {
        conditions.push(eq(annualFilings.filingYear, parseInt(request.query.year)));
      }
      if (request.query.status) {
        conditions.push(eq(annualFilings.status, request.query.status as any));
      }

      const filings = await db.query.annualFilings.findMany({
        where: and(...conditions),
        orderBy: (af, { desc }) => [desc(af.dueDate)],
      });

      return { data: filings, count: filings.length };
    }
  );

  // POST /entities/:entityId/filings - Create a filing
  fastify.post<{
    Params: { entityId: string };
    Body: Omit<z.infer<typeof CreateFilingSchema>, 'entityId'>;
  }>(
    '/entities/:entityId/filings',
    {
      schema: {
        tags: ['Filings'],
        summary: 'Create an annual filing',
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
        const input = CreateFilingSchema.parse({
          ...request.body,
          entityId: request.params.entityId,
        });

        const [filing] = await db.insert(annualFilings).values({
          entityId: input.entityId,
          requirementId: input.requirementId,
          filingType: input.filingType,
          filingYear: input.filingYear,
          dueDate: input.dueDate,
          status: 'pending',
          createdBy: (request as any).user?.id,
        }).returning();

        return reply.status(201).send(filing);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        throw error;
      }
    }
  );

  // GET /filings/:id - Get a single filing
  fastify.get<{
    Params: { id: string };
  }>(
    '/filings/:id',
    {
      schema: {
        tags: ['Filings'],
        summary: 'Get a filing by ID',
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
      const filing = await db.query.annualFilings.findFirst({
        where: and(
          eq(annualFilings.id, request.params.id),
          isNull(annualFilings.deletedAt)
        ),
      });

      if (!filing) {
        return reply.status(404).send({ error: 'Filing not found' });
      }

      return filing;
    }
  );

  // PATCH /filings/:id - Update a filing
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof UpdateFilingSchema>;
  }>(
    '/filings/:id',
    {
      schema: {
        tags: ['Filings'],
        summary: 'Update a filing',
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
        const input = UpdateFilingSchema.parse(request.body);

        const [filing] = await db.update(annualFilings)
          .set({
            ...input,
            updatedAt: new Date(),
            updatedBy: (request as any).user?.id,
          })
          .where(eq(annualFilings.id, request.params.id))
          .returning();

        if (!filing) {
          return reply.status(404).send({ error: 'Filing not found' });
        }

        return filing;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        throw error;
      }
    }
  );

  // POST /filings/:id/submit - Mark filing as submitted
  fastify.post<{
    Params: { id: string };
    Body: { confirmationNumber?: string; feePaid?: number };
  }>(
    '/filings/:id/submit',
    {
      schema: {
        tags: ['Filings'],
        summary: 'Submit a filing',
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
      const [filing] = await db.update(annualFilings)
        .set({
          status: 'submitted',
          filedDate: new Date(),
          confirmationNumber: request.body.confirmationNumber,
          feePaid: request.body.feePaid,
          updatedAt: new Date(),
          updatedBy: (request as any).user?.id,
        })
        .where(eq(annualFilings.id, request.params.id))
        .returning();

      if (!filing) {
        return reply.status(404).send({ error: 'Filing not found' });
      }

      return filing;
    }
  );

  // ==========================================================================
  // Compliance Overview
  // ==========================================================================

  // GET /filings/overdue - Get all overdue filings
  fastify.get<{
    Querystring: { entityId?: string };
  }>(
    '/filings/overdue',
    {
      schema: {
        tags: ['Filings'],
        summary: 'Get overdue filings',
        querystring: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request) => {
      const conditions = [
        eq(annualFilings.status, 'pending'),
        lte(annualFilings.dueDate, new Date()),
        isNull(annualFilings.deletedAt),
      ];

      if (request.query.entityId) {
        conditions.push(eq(annualFilings.entityId, request.query.entityId));
      }

      const filings = await db.query.annualFilings.findMany({
        where: and(...conditions),
        orderBy: (af, { asc }) => [asc(af.dueDate)],
      });

      return { data: filings, count: filings.length };
    }
  );

  // GET /filings/upcoming - Get upcoming filings (next 90 days)
  fastify.get<{
    Querystring: { entityId?: string; days?: string };
  }>(
    '/filings/upcoming',
    {
      schema: {
        tags: ['Filings'],
        summary: 'Get upcoming filings',
        querystring: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
            days: { type: 'string', default: '90' },
          },
        },
      },
    },
    async (request) => {
      const days = parseInt(request.query.days || '90');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const conditions = [
        eq(annualFilings.status, 'pending'),
        gte(annualFilings.dueDate, new Date()),
        lte(annualFilings.dueDate, futureDate),
        isNull(annualFilings.deletedAt),
      ];

      if (request.query.entityId) {
        conditions.push(eq(annualFilings.entityId, request.query.entityId));
      }

      const filings = await db.query.annualFilings.findMany({
        where: and(...conditions),
        orderBy: (af, { asc }) => [asc(af.dueDate)],
      });

      return { data: filings, count: filings.length };
    }
  );
}
