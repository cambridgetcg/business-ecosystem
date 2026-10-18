/**
 * Resolutions REST Routes
 *
 * Endpoints for managing corporate resolutions.
 * Handles board resolutions, shareholder resolutions, and written consents.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { resolutions, legalEntities, boards } from '../../../infrastructure/persistence/schema.js';

interface ResolutionsRoutesDeps {
  db: any;
}

export async function resolutionsRoutes(
  fastify: FastifyInstance,
  deps: ResolutionsRoutesDeps
): Promise<void> {
  const { db } = deps;

  // ==========================================================================
  // GET /entities/:entityId/resolutions - List resolutions for an entity
  // ==========================================================================
  fastify.get<{
    Params: { entityId: string };
    Querystring: {
      resolutionType?: string;
      isPassed?: boolean;
      boardId?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    '/entities/:entityId/resolutions',
    {
      schema: {
        tags: ['Resolutions'],
        summary: 'List resolutions for a legal entity',
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
            resolutionType: { type: 'string', enum: ['ordinary', 'special', 'written_consent', 'unanimous'] },
            isPassed: { type: 'boolean' },
            boardId: { type: 'string', format: 'uuid' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 },
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
                    boardId: { type: 'string', nullable: true },
                    resolutionType: { type: 'string' },
                    resolutionNumber: { type: 'string', nullable: true },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    effectiveDate: { type: 'string', format: 'date-time' },
                    votesFor: { type: 'number', nullable: true },
                    votesAgainst: { type: 'number', nullable: true },
                    votesAbstained: { type: 'number', nullable: true },
                    isPassed: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              count: { type: 'number' },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Verify entity exists
      const [entity] = await db
        .select()
        .from(legalEntities)
        .where(and(
          eq(legalEntities.id, request.params.entityId),
          isNull(legalEntities.deletedAt)
        ));

      if (!entity) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      const allResolutions = await db
        .select()
        .from(resolutions)
        .where(and(
          eq(resolutions.entityId, request.params.entityId),
          isNull(resolutions.deletedAt)
        ))
        .orderBy(desc(resolutions.effectiveDate));

      // Filter in memory (would be done in SQL in production)
      let filtered = allResolutions;
      if (request.query.resolutionType) {
        filtered = filtered.filter((r: any) => r.resolutionType === request.query.resolutionType);
      }
      if (request.query.isPassed !== undefined) {
        filtered = filtered.filter((r: any) => r.isPassed === request.query.isPassed);
      }
      if (request.query.boardId) {
        filtered = filtered.filter((r: any) => r.boardId === request.query.boardId);
      }

      const limit = request.query.limit ?? 50;
      const offset = request.query.offset ?? 0;
      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      return { data: paginated, count: paginated.length, total };
    }
  );

  // ==========================================================================
  // GET /resolutions/:id - Get a single resolution
  // ==========================================================================
  fastify.get<{
    Params: { id: string };
  }>(
    '/resolutions/:id',
    {
      schema: {
        tags: ['Resolutions'],
        summary: 'Get a resolution by ID',
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
      const [resolution] = await db
        .select()
        .from(resolutions)
        .where(and(
          eq(resolutions.id, request.params.id),
          isNull(resolutions.deletedAt)
        ));

      if (!resolution) {
        return reply.status(404).send({ error: 'Resolution not found' });
      }

      return resolution;
    }
  );

  // ==========================================================================
  // POST /entities/:entityId/resolutions - Create a new resolution
  // ==========================================================================
  fastify.post<{
    Params: { entityId: string };
    Body: {
      boardId?: string;
      resolutionType: string;
      resolutionNumber?: string;
      title: string;
      content: string;
      effectiveDate: string;
      votesFor?: number;
      votesAgainst?: number;
      votesAbstained?: number;
      isPassed: boolean;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/entities/:entityId/resolutions',
    {
      schema: {
        tags: ['Resolutions'],
        summary: 'Create a new resolution',
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
            boardId: { type: 'string', format: 'uuid' },
            resolutionType: {
              type: 'string',
              enum: ['ordinary', 'special', 'written_consent', 'unanimous'],
            },
            resolutionNumber: { type: 'string', maxLength: 50 },
            title: { type: 'string', minLength: 1, maxLength: 255 },
            content: { type: 'string', minLength: 1 },
            effectiveDate: { type: 'string', format: 'date-time' },
            votesFor: { type: 'number', minimum: 0 },
            votesAgainst: { type: 'number', minimum: 0 },
            votesAbstained: { type: 'number', minimum: 0 },
            isPassed: { type: 'boolean' },
            metadata: { type: 'object' },
          },
          required: ['resolutionType', 'title', 'content', 'effectiveDate', 'isPassed'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              entityId: { type: 'string' },
              resolutionType: { type: 'string' },
              resolutionNumber: { type: 'string', nullable: true },
              title: { type: 'string' },
              isPassed: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Verify entity exists
      const [entity] = await db
        .select()
        .from(legalEntities)
        .where(and(
          eq(legalEntities.id, request.params.entityId),
          isNull(legalEntities.deletedAt)
        ));

      if (!entity) {
        return reply.status(404).send({ error: 'Entity not found' });
      }

      // Verify board exists if boardId provided
      if (request.body.boardId) {
        const [board] = await db
          .select()
          .from(boards)
          .where(and(
            eq(boards.id, request.body.boardId),
            eq(boards.entityId, request.params.entityId),
            isNull(boards.deletedAt)
          ));

        if (!board) {
          return reply.status(404).send({ error: 'Board not found' });
        }
      }

      // Generate resolution number if not provided
      let resolutionNumber = request.body.resolutionNumber;
      if (!resolutionNumber) {
        const year = new Date().getFullYear();
        const count = await db
          .select()
          .from(resolutions)
          .where(eq(resolutions.entityId, request.params.entityId));
        resolutionNumber = `RES-${year}-${String(count.length + 1).padStart(4, '0')}`;
      }

      const [resolution] = await db
        .insert(resolutions)
        .values({
          entityId: request.params.entityId,
          boardId: request.body.boardId,
          resolutionType: request.body.resolutionType,
          resolutionNumber,
          title: request.body.title,
          content: request.body.content,
          effectiveDate: new Date(request.body.effectiveDate),
          votesFor: request.body.votesFor,
          votesAgainst: request.body.votesAgainst,
          votesAbstained: request.body.votesAbstained,
          isPassed: request.body.isPassed,
          metadata: request.body.metadata,
        })
        .returning();

      return reply.status(201).send(resolution);
    }
  );

  // ==========================================================================
  // PATCH /resolutions/:id - Update a resolution
  // ==========================================================================
  fastify.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      content?: string;
      votesFor?: number;
      votesAgainst?: number;
      votesAbstained?: number;
      isPassed?: boolean;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/resolutions/:id',
    {
      schema: {
        tags: ['Resolutions'],
        summary: 'Update a resolution',
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
            title: { type: 'string', minLength: 1, maxLength: 255 },
            content: { type: 'string', minLength: 1 },
            votesFor: { type: 'number', minimum: 0 },
            votesAgainst: { type: 'number', minimum: 0 },
            votesAbstained: { type: 'number', minimum: 0 },
            isPassed: { type: 'boolean' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const [existing] = await db
        .select()
        .from(resolutions)
        .where(and(
          eq(resolutions.id, request.params.id),
          isNull(resolutions.deletedAt)
        ));

      if (!existing) {
        return reply.status(404).send({ error: 'Resolution not found' });
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (request.body.title !== undefined) updates.title = request.body.title;
      if (request.body.content !== undefined) updates.content = request.body.content;
      if (request.body.votesFor !== undefined) updates.votesFor = request.body.votesFor;
      if (request.body.votesAgainst !== undefined) updates.votesAgainst = request.body.votesAgainst;
      if (request.body.votesAbstained !== undefined) updates.votesAbstained = request.body.votesAbstained;
      if (request.body.isPassed !== undefined) updates.isPassed = request.body.isPassed;
      if (request.body.metadata !== undefined) updates.metadata = request.body.metadata;

      const [updated] = await db
        .update(resolutions)
        .set(updates)
        .where(eq(resolutions.id, request.params.id))
        .returning();

      return updated;
    }
  );

  // ==========================================================================
  // DELETE /resolutions/:id - Soft delete a resolution
  // ==========================================================================
  fastify.delete<{
    Params: { id: string };
  }>(
    '/resolutions/:id',
    {
      schema: {
        tags: ['Resolutions'],
        summary: 'Delete a resolution',
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
      const [existing] = await db
        .select()
        .from(resolutions)
        .where(and(
          eq(resolutions.id, request.params.id),
          isNull(resolutions.deletedAt)
        ));

      if (!existing) {
        return reply.status(404).send({ error: 'Resolution not found' });
      }

      await db
        .update(resolutions)
        .set({ deletedAt: new Date() })
        .where(eq(resolutions.id, request.params.id));

      return reply.status(204).send();
    }
  );
}
