/**
 * Meeting Minutes REST Routes
 *
 * Endpoints for managing corporate meeting minutes.
 * Handles board meetings, shareholder meetings, and committee meetings.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { meetingMinutes, legalEntities, boards } from '../../../infrastructure/persistence/schema.js';

interface MeetingMinutesRoutesDeps {
  db: any;
}

export async function meetingMinutesRoutes(
  fastify: FastifyInstance,
  deps: MeetingMinutesRoutesDeps
): Promise<void> {
  const { db } = deps;

  // ==========================================================================
  // GET /entities/:entityId/meeting-minutes - List meeting minutes for an entity
  // ==========================================================================
  fastify.get<{
    Params: { entityId: string };
    Querystring: {
      meetingType?: string;
      boardId?: string;
      limit?: number;
      offset?: number;
    };
  }>(
    '/entities/:entityId/meeting-minutes',
    {
      schema: {
        tags: ['Meeting Minutes'],
        summary: 'List meeting minutes for a legal entity',
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
            meetingType: { type: 'string', enum: ['board', 'shareholders', 'committee', 'annual_general', 'extraordinary'] },
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
                    meetingType: { type: 'string' },
                    meetingDate: { type: 'string', format: 'date-time' },
                    location: { type: 'string', nullable: true },
                    attendees: { type: 'array', nullable: true },
                    agendaItems: { type: 'array', nullable: true },
                    approvedAt: { type: 'string', format: 'date-time', nullable: true },
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

      let query = db
        .select()
        .from(meetingMinutes)
        .where(and(
          eq(meetingMinutes.entityId, request.params.entityId),
          isNull(meetingMinutes.deletedAt)
        ))
        .orderBy(desc(meetingMinutes.meetingDate));

      // Apply filters
      // Note: Drizzle ORM filtering would need to be done differently in production

      const limit = request.query.limit ?? 50;
      const offset = request.query.offset ?? 0;

      const allMinutes = await query;

      // Filter in memory for now (would be done in SQL in production)
      let filtered = allMinutes;
      if (request.query.meetingType) {
        filtered = filtered.filter((m: any) => m.meetingType === request.query.meetingType);
      }
      if (request.query.boardId) {
        filtered = filtered.filter((m: any) => m.boardId === request.query.boardId);
      }

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      return { data: paginated, count: paginated.length, total };
    }
  );

  // ==========================================================================
  // GET /meeting-minutes/:id - Get a single meeting minutes record
  // ==========================================================================
  fastify.get<{
    Params: { id: string };
  }>(
    '/meeting-minutes/:id',
    {
      schema: {
        tags: ['Meeting Minutes'],
        summary: 'Get meeting minutes by ID',
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
      const [minutes] = await db
        .select()
        .from(meetingMinutes)
        .where(and(
          eq(meetingMinutes.id, request.params.id),
          isNull(meetingMinutes.deletedAt)
        ));

      if (!minutes) {
        return reply.status(404).send({ error: 'Meeting minutes not found' });
      }

      return minutes;
    }
  );

  // ==========================================================================
  // POST /entities/:entityId/meeting-minutes - Create new meeting minutes
  // ==========================================================================
  fastify.post<{
    Params: { entityId: string };
    Body: {
      boardId?: string;
      meetingType: string;
      meetingDate: string;
      location?: string;
      attendees?: { name: string; role: string; present: boolean }[];
      agendaItems?: { title: string; description?: string; decision?: string }[];
      content?: string;
      fileStorageKey?: string;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/entities/:entityId/meeting-minutes',
    {
      schema: {
        tags: ['Meeting Minutes'],
        summary: 'Create new meeting minutes',
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
            meetingType: {
              type: 'string',
              enum: ['board', 'shareholders', 'committee', 'annual_general', 'extraordinary'],
            },
            meetingDate: { type: 'string', format: 'date-time' },
            location: { type: 'string', maxLength: 255 },
            attendees: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string' },
                  present: { type: 'boolean' },
                },
              },
            },
            agendaItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  decision: { type: 'string' },
                },
              },
            },
            content: { type: 'string' },
            fileStorageKey: { type: 'string', maxLength: 500 },
            metadata: { type: 'object' },
          },
          required: ['meetingType', 'meetingDate'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              entityId: { type: 'string' },
              meetingType: { type: 'string' },
              meetingDate: { type: 'string', format: 'date-time' },
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

      const [minutes] = await db
        .insert(meetingMinutes)
        .values({
          entityId: request.params.entityId,
          boardId: request.body.boardId,
          meetingType: request.body.meetingType,
          meetingDate: new Date(request.body.meetingDate),
          location: request.body.location,
          attendees: request.body.attendees,
          agendaItems: request.body.agendaItems,
          content: request.body.content,
          fileStorageKey: request.body.fileStorageKey,
          metadata: request.body.metadata,
        })
        .returning();

      return reply.status(201).send(minutes);
    }
  );

  // ==========================================================================
  // PATCH /meeting-minutes/:id - Update meeting minutes
  // ==========================================================================
  fastify.patch<{
    Params: { id: string };
    Body: {
      location?: string;
      attendees?: { name: string; role: string; present: boolean }[];
      agendaItems?: { title: string; description?: string; decision?: string }[];
      content?: string;
      fileStorageKey?: string;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/meeting-minutes/:id',
    {
      schema: {
        tags: ['Meeting Minutes'],
        summary: 'Update meeting minutes',
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
            location: { type: 'string', maxLength: 255 },
            attendees: { type: 'array' },
            agendaItems: { type: 'array' },
            content: { type: 'string' },
            fileStorageKey: { type: 'string', maxLength: 500 },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const [existing] = await db
        .select()
        .from(meetingMinutes)
        .where(and(
          eq(meetingMinutes.id, request.params.id),
          isNull(meetingMinutes.deletedAt)
        ));

      if (!existing) {
        return reply.status(404).send({ error: 'Meeting minutes not found' });
      }

      // Cannot update approved minutes
      if (existing.approvedAt) {
        return reply.status(400).send({ error: 'Cannot update approved meeting minutes' });
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (request.body.location !== undefined) updates.location = request.body.location;
      if (request.body.attendees !== undefined) updates.attendees = request.body.attendees;
      if (request.body.agendaItems !== undefined) updates.agendaItems = request.body.agendaItems;
      if (request.body.content !== undefined) updates.content = request.body.content;
      if (request.body.fileStorageKey !== undefined) updates.fileStorageKey = request.body.fileStorageKey;
      if (request.body.metadata !== undefined) updates.metadata = request.body.metadata;

      const [updated] = await db
        .update(meetingMinutes)
        .set(updates)
        .where(eq(meetingMinutes.id, request.params.id))
        .returning();

      return updated;
    }
  );

  // ==========================================================================
  // POST /meeting-minutes/:id/approve - Approve meeting minutes
  // ==========================================================================
  fastify.post<{
    Params: { id: string };
    Body: {
      approvedBy?: string;
    };
  }>(
    '/meeting-minutes/:id/approve',
    {
      schema: {
        tags: ['Meeting Minutes'],
        summary: 'Approve meeting minutes',
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
            approvedBy: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const [existing] = await db
        .select()
        .from(meetingMinutes)
        .where(and(
          eq(meetingMinutes.id, request.params.id),
          isNull(meetingMinutes.deletedAt)
        ));

      if (!existing) {
        return reply.status(404).send({ error: 'Meeting minutes not found' });
      }

      if (existing.approvedAt) {
        return reply.status(400).send({ error: 'Meeting minutes already approved' });
      }

      const [updated] = await db
        .update(meetingMinutes)
        .set({
          approvedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: request.body.approvedBy || (request as any).user?.id,
        })
        .where(eq(meetingMinutes.id, request.params.id))
        .returning();

      return updated;
    }
  );

  // ==========================================================================
  // DELETE /meeting-minutes/:id - Soft delete meeting minutes
  // ==========================================================================
  fastify.delete<{
    Params: { id: string };
  }>(
    '/meeting-minutes/:id',
    {
      schema: {
        tags: ['Meeting Minutes'],
        summary: 'Delete meeting minutes',
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
        .from(meetingMinutes)
        .where(and(
          eq(meetingMinutes.id, request.params.id),
          isNull(meetingMinutes.deletedAt)
        ));

      if (!existing) {
        return reply.status(404).send({ error: 'Meeting minutes not found' });
      }

      // Cannot delete approved minutes
      if (existing.approvedAt) {
        return reply.status(400).send({ error: 'Cannot delete approved meeting minutes' });
      }

      await db
        .update(meetingMinutes)
        .set({ deletedAt: new Date() })
        .where(eq(meetingMinutes.id, request.params.id));

      return reply.status(204).send();
    }
  );
}
