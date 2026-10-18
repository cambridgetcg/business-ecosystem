/**
 * Share Classes REST Routes
 *
 * Endpoints for managing share classes of legal entities.
 * Handles authorized shares, par values, voting rights, and preferences.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { shareClasses, legalEntities } from '../../../infrastructure/persistence/schema.js';

interface ShareClassesRoutesDeps {
  db: any;
}

export async function shareClassesRoutes(
  fastify: FastifyInstance,
  deps: ShareClassesRoutesDeps
): Promise<void> {
  const { db } = deps;

  // ==========================================================================
  // GET /entities/:entityId/share-classes - List share classes for an entity
  // ==========================================================================
  fastify.get<{
    Params: { entityId: string };
  }>(
    '/entities/:entityId/share-classes',
    {
      schema: {
        tags: ['Share Classes'],
        summary: 'List share classes for a legal entity',
        params: {
          type: 'object',
          properties: {
            entityId: { type: 'string', format: 'uuid' },
          },
          required: ['entityId'],
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
                    className: { type: 'string' },
                    classType: { type: 'string' },
                    authorizedShares: { type: 'number' },
                    parValue: { type: 'number', nullable: true },
                    votingRightsPerShare: { type: 'number' },
                    dividendPreference: { type: 'number', nullable: true },
                    liquidationPreference: { type: 'number', nullable: true },
                    isConvertible: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
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

      const classes = await db
        .select()
        .from(shareClasses)
        .where(and(
          eq(shareClasses.entityId, request.params.entityId),
          isNull(shareClasses.deletedAt)
        ));

      return { data: classes, count: classes.length };
    }
  );

  // ==========================================================================
  // GET /share-classes/:id - Get a single share class
  // ==========================================================================
  fastify.get<{
    Params: { id: string };
  }>(
    '/share-classes/:id',
    {
      schema: {
        tags: ['Share Classes'],
        summary: 'Get a share class by ID',
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
      const [shareClass] = await db
        .select()
        .from(shareClasses)
        .where(and(
          eq(shareClasses.id, request.params.id),
          isNull(shareClasses.deletedAt)
        ));

      if (!shareClass) {
        return reply.status(404).send({ error: 'Share class not found' });
      }

      return shareClass;
    }
  );

  // ==========================================================================
  // POST /entities/:entityId/share-classes - Create a new share class
  // ==========================================================================
  fastify.post<{
    Params: { entityId: string };
    Body: {
      className: string;
      classType: string;
      authorizedShares: number;
      parValue?: number;
      votingRightsPerShare?: number;
      dividendPreference?: number;
      liquidationPreference?: number;
      isConvertible?: boolean;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/entities/:entityId/share-classes',
    {
      schema: {
        tags: ['Share Classes'],
        summary: 'Create a new share class for a legal entity',
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
            className: { type: 'string', minLength: 1, maxLength: 100 },
            classType: {
              type: 'string',
              enum: ['common', 'preferred', 'series_a', 'series_b', 'series_c', 'convertible', 'other'],
            },
            authorizedShares: { type: 'number', minimum: 1 },
            parValue: { type: 'number', minimum: 0 },
            votingRightsPerShare: { type: 'number', minimum: 0 },
            dividendPreference: { type: 'number', minimum: 0 },
            liquidationPreference: { type: 'number', minimum: 0 },
            isConvertible: { type: 'boolean' },
            metadata: { type: 'object' },
          },
          required: ['className', 'classType', 'authorizedShares'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              entityId: { type: 'string' },
              className: { type: 'string' },
              classType: { type: 'string' },
              authorizedShares: { type: 'number' },
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

      // Check for duplicate class name
      const [existing] = await db
        .select()
        .from(shareClasses)
        .where(and(
          eq(shareClasses.entityId, request.params.entityId),
          eq(shareClasses.className, request.body.className),
          isNull(shareClasses.deletedAt)
        ));

      if (existing) {
        return reply.status(409).send({ error: `Share class "${request.body.className}" already exists` });
      }

      const [shareClass] = await db
        .insert(shareClasses)
        .values({
          entityId: request.params.entityId,
          className: request.body.className,
          classType: request.body.classType as any,
          authorizedShares: request.body.authorizedShares,
          parValue: request.body.parValue,
          votingRightsPerShare: request.body.votingRightsPerShare ?? 1,
          dividendPreference: request.body.dividendPreference,
          liquidationPreference: request.body.liquidationPreference,
          isConvertible: request.body.isConvertible ?? false,
          metadata: request.body.metadata,
        })
        .returning();

      return reply.status(201).send(shareClass);
    }
  );

  // ==========================================================================
  // PATCH /share-classes/:id - Update a share class
  // ==========================================================================
  fastify.patch<{
    Params: { id: string };
    Body: {
      authorizedShares?: number;
      parValue?: number | null;
      votingRightsPerShare?: number;
      dividendPreference?: number | null;
      liquidationPreference?: number | null;
      isConvertible?: boolean;
      metadata?: Record<string, unknown>;
    };
  }>(
    '/share-classes/:id',
    {
      schema: {
        tags: ['Share Classes'],
        summary: 'Update a share class',
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
            authorizedShares: { type: 'number', minimum: 1 },
            parValue: { type: 'number', minimum: 0, nullable: true },
            votingRightsPerShare: { type: 'number', minimum: 0 },
            dividendPreference: { type: 'number', minimum: 0, nullable: true },
            liquidationPreference: { type: 'number', minimum: 0, nullable: true },
            isConvertible: { type: 'boolean' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const [existing] = await db
        .select()
        .from(shareClasses)
        .where(and(
          eq(shareClasses.id, request.params.id),
          isNull(shareClasses.deletedAt)
        ));

      if (!existing) {
        return reply.status(404).send({ error: 'Share class not found' });
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (request.body.authorizedShares !== undefined) {
        updates.authorizedShares = request.body.authorizedShares;
      }
      if (request.body.parValue !== undefined) {
        updates.parValue = request.body.parValue;
      }
      if (request.body.votingRightsPerShare !== undefined) {
        updates.votingRightsPerShare = request.body.votingRightsPerShare;
      }
      if (request.body.dividendPreference !== undefined) {
        updates.dividendPreference = request.body.dividendPreference;
      }
      if (request.body.liquidationPreference !== undefined) {
        updates.liquidationPreference = request.body.liquidationPreference;
      }
      if (request.body.isConvertible !== undefined) {
        updates.isConvertible = request.body.isConvertible;
      }
      if (request.body.metadata !== undefined) {
        updates.metadata = request.body.metadata;
      }

      const [updated] = await db
        .update(shareClasses)
        .set(updates)
        .where(eq(shareClasses.id, request.params.id))
        .returning();

      return updated;
    }
  );

  // ==========================================================================
  // DELETE /share-classes/:id - Soft delete a share class
  // ==========================================================================
  fastify.delete<{
    Params: { id: string };
  }>(
    '/share-classes/:id',
    {
      schema: {
        tags: ['Share Classes'],
        summary: 'Delete a share class',
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
        .from(shareClasses)
        .where(and(
          eq(shareClasses.id, request.params.id),
          isNull(shareClasses.deletedAt)
        ));

      if (!existing) {
        return reply.status(404).send({ error: 'Share class not found' });
      }

      await db
        .update(shareClasses)
        .set({ deletedAt: new Date() })
        .where(eq(shareClasses.id, request.params.id));

      return reply.status(204).send();
    }
  );
}
