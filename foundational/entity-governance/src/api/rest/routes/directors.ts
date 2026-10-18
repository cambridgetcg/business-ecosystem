/**
 * Directors & Boards REST Routes
 *
 * Endpoints for managing boards of directors and individual directors.
 * Supports corporate governance requirements.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/persistence/database.js';
import { boards, directors, legalEntities } from '../../../infrastructure/persistence/schema.js';

interface DirectorsRoutesDeps {
  db: Database;
}

// Validation schemas
const CreateBoardSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255).default('Board of Directors'),
  minimumMembers: z.number().int().min(1).default(1),
  maximumMembers: z.number().int().optional(),
  quorumPercentage: z.number().int().min(0).max(10000).default(5000), // basis points
});

const AppointDirectorSchema = z.object({
  boardId: z.string().uuid(),
  personId: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  appointmentDate: z.string().transform(s => new Date(s)),
  termEndDate: z.string().transform(s => new Date(s)).optional(),
  isIndependent: z.boolean().default(false),
  isChairperson: z.boolean().default(false),
  compensationAmount: z.number().int().optional(),
});

const UpdateDirectorSchema = z.object({
  email: z.string().email().optional().nullable(),
  termEndDate: z.string().transform(s => new Date(s)).optional().nullable(),
  isIndependent: z.boolean().optional(),
  isChairperson: z.boolean().optional(),
  compensationAmount: z.number().int().optional().nullable(),
});

export async function directorsRoutes(
  fastify: FastifyInstance,
  deps: DirectorsRoutesDeps
): Promise<void> {
  const { db } = deps;

  // ==========================================================================
  // Boards
  // ==========================================================================

  // GET /entities/:entityId/boards - List boards for an entity
  fastify.get<{
    Params: { entityId: string };
  }>(
    '/entities/:entityId/boards',
    {
      schema: {
        tags: ['Boards'],
        summary: 'List boards for an entity',
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

      const boardList = await db.query.boards.findMany({
        where: and(
          eq(boards.entityId, request.params.entityId),
          isNull(boards.deletedAt)
        ),
      });

      return { data: boardList, count: boardList.length };
    }
  );

  // POST /entities/:entityId/boards - Create a board
  fastify.post<{
    Params: { entityId: string };
    Body: Omit<z.infer<typeof CreateBoardSchema>, 'entityId'>;
  }>(
    '/entities/:entityId/boards',
    {
      schema: {
        tags: ['Boards'],
        summary: 'Create a board for an entity',
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
        const input = CreateBoardSchema.parse({
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

        const [board] = await db.insert(boards).values({
          entityId: input.entityId,
          name: input.name,
          minimumMembers: input.minimumMembers,
          maximumMembers: input.maximumMembers,
          quorumPercentage: input.quorumPercentage,
          createdBy: (request as any).user?.id,
        }).returning();

        return reply.status(201).send(board);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        throw error;
      }
    }
  );

  // GET /boards/:id - Get a single board with directors
  fastify.get<{
    Params: { id: string };
  }>(
    '/boards/:id',
    {
      schema: {
        tags: ['Boards'],
        summary: 'Get a board by ID with directors',
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
      const board = await db.query.boards.findFirst({
        where: and(
          eq(boards.id, request.params.id),
          isNull(boards.deletedAt)
        ),
      });

      if (!board) {
        return reply.status(404).send({ error: 'Board not found' });
      }

      const boardDirectors = await db.query.directors.findMany({
        where: and(
          eq(directors.boardId, request.params.id),
          isNull(directors.deletedAt)
        ),
      });

      return {
        ...board,
        directors: boardDirectors,
        directorCount: boardDirectors.length,
      };
    }
  );

  // ==========================================================================
  // Directors
  // ==========================================================================

  // GET /boards/:boardId/directors - List directors for a board
  fastify.get<{
    Params: { boardId: string };
    Querystring: { includeFormer?: boolean };
  }>(
    '/boards/:boardId/directors',
    {
      schema: {
        tags: ['Directors'],
        summary: 'List directors for a board',
        params: {
          type: 'object',
          properties: {
            boardId: { type: 'string', format: 'uuid' },
          },
          required: ['boardId'],
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
      const board = await db.query.boards.findFirst({
        where: and(
          eq(boards.id, request.params.boardId),
          isNull(boards.deletedAt)
        ),
      });

      if (!board) {
        return reply.status(404).send({ error: 'Board not found' });
      }

      const conditions = [
        eq(directors.boardId, request.params.boardId),
        isNull(directors.deletedAt),
      ];

      // Filter out former directors unless requested
      if (!request.query.includeFormer) {
        // Active directors have no term end or term end in future
        // We'll include all and filter client-side for simplicity
      }

      const directorList = await db.query.directors.findMany({
        where: and(...conditions),
        orderBy: (d, { desc }) => [desc(d.isChairperson), desc(d.appointmentDate)],
      });

      // Filter active directors (no termEndDate or termEndDate in future)
      const now = new Date();
      const filtered = request.query.includeFormer
        ? directorList
        : directorList.filter(d => !d.termEndDate || d.termEndDate > now);

      return { data: filtered, count: filtered.length };
    }
  );

  // POST /boards/:boardId/directors - Appoint a director
  fastify.post<{
    Params: { boardId: string };
    Body: Omit<z.infer<typeof AppointDirectorSchema>, 'boardId'>;
  }>(
    '/boards/:boardId/directors',
    {
      schema: {
        tags: ['Directors'],
        summary: 'Appoint a director to a board',
        params: {
          type: 'object',
          properties: {
            boardId: { type: 'string', format: 'uuid' },
          },
          required: ['boardId'],
        },
      },
    },
    async (request, reply) => {
      try {
        const input = AppointDirectorSchema.parse({
          ...request.body,
          boardId: request.params.boardId,
        });

        const board = await db.query.boards.findFirst({
          where: and(
            eq(boards.id, input.boardId),
            isNull(boards.deletedAt)
          ),
        });

        if (!board) {
          return reply.status(404).send({ error: 'Board not found' });
        }

        // Check maximum members
        if (board.maximumMembers) {
          const currentCount = await db.query.directors.findMany({
            where: and(
              eq(directors.boardId, input.boardId),
              isNull(directors.deletedAt)
            ),
          });

          const activeCount = currentCount.filter(d => !d.termEndDate || d.termEndDate > new Date()).length;
          if (activeCount >= board.maximumMembers) {
            return reply.status(400).send({
              error: 'Maximum board members reached',
              message: `Board has maximum of ${board.maximumMembers} members`,
            });
          }
        }

        // If appointing as chairperson, remove chairperson from current
        if (input.isChairperson) {
          await db.update(directors)
            .set({ isChairperson: false, updatedAt: new Date() })
            .where(and(
              eq(directors.boardId, input.boardId),
              eq(directors.isChairperson, true)
            ));
        }

        const [director] = await db.insert(directors).values({
          boardId: input.boardId,
          personId: input.personId,
          name: input.name,
          email: input.email,
          appointmentDate: input.appointmentDate,
          termEndDate: input.termEndDate,
          isIndependent: input.isIndependent,
          isChairperson: input.isChairperson,
          compensationAmount: input.compensationAmount,
          createdBy: (request as any).user?.id,
        }).returning();

        return reply.status(201).send(director);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        throw error;
      }
    }
  );

  // GET /directors/:id - Get a single director
  fastify.get<{
    Params: { id: string };
  }>(
    '/directors/:id',
    {
      schema: {
        tags: ['Directors'],
        summary: 'Get a director by ID',
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
      const director = await db.query.directors.findFirst({
        where: and(
          eq(directors.id, request.params.id),
          isNull(directors.deletedAt)
        ),
      });

      if (!director) {
        return reply.status(404).send({ error: 'Director not found' });
      }

      return director;
    }
  );

  // PATCH /directors/:id - Update a director
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof UpdateDirectorSchema>;
  }>(
    '/directors/:id',
    {
      schema: {
        tags: ['Directors'],
        summary: 'Update a director',
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
        const input = UpdateDirectorSchema.parse(request.body);

        const existing = await db.query.directors.findFirst({
          where: and(
            eq(directors.id, request.params.id),
            isNull(directors.deletedAt)
          ),
        });

        if (!existing) {
          return reply.status(404).send({ error: 'Director not found' });
        }

        // If setting as chairperson, remove from current
        if (input.isChairperson === true) {
          await db.update(directors)
            .set({ isChairperson: false, updatedAt: new Date() })
            .where(and(
              eq(directors.boardId, existing.boardId),
              eq(directors.isChairperson, true)
            ));
        }

        const [director] = await db.update(directors)
          .set({
            ...input,
            updatedAt: new Date(),
            updatedBy: (request as any).user?.id,
          })
          .where(eq(directors.id, request.params.id))
          .returning();

        return director;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation error', details: error.errors });
        }
        throw error;
      }
    }
  );

  // POST /directors/:id/resign - Record director resignation
  fastify.post<{
    Params: { id: string };
    Body: { resignationDate: string; reason?: string };
  }>(
    '/directors/:id/resign',
    {
      schema: {
        tags: ['Directors'],
        summary: 'Record director resignation',
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
            resignationDate: { type: 'string', format: 'date-time' },
            reason: { type: 'string', maxLength: 500 },
          },
          required: ['resignationDate'],
        },
      },
    },
    async (request, reply) => {
      const existing = await db.query.directors.findFirst({
        where: and(
          eq(directors.id, request.params.id),
          isNull(directors.deletedAt)
        ),
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Director not found' });
      }

      if (existing.termEndDate && existing.termEndDate <= new Date()) {
        return reply.status(400).send({ error: 'Director term has already ended' });
      }

      const [director] = await db.update(directors)
        .set({
          termEndDate: new Date(request.body.resignationDate),
          isChairperson: false,
          metadata: {
            ...(existing.metadata as object || {}),
            resignationReason: request.body.reason,
          },
          updatedAt: new Date(),
          updatedBy: (request as any).user?.id,
        })
        .where(eq(directors.id, request.params.id))
        .returning();

      return director;
    }
  );

  // DELETE /directors/:id - Soft delete a director record
  fastify.delete<{
    Params: { id: string };
  }>(
    '/directors/:id',
    {
      schema: {
        tags: ['Directors'],
        summary: 'Delete a director record',
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
      const [director] = await db.update(directors)
        .set({
          deletedAt: new Date(),
          updatedBy: (request as any).user?.id,
        })
        .where(eq(directors.id, request.params.id))
        .returning();

      if (!director) {
        return reply.status(404).send({ error: 'Director not found' });
      }

      return reply.status(204).send();
    }
  );
}
