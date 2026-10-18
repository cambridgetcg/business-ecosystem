/**
 * Compliance Calendar API Routes
 *
 * REST endpoints for managing compliance calendar events.
 *
 * @module api/rest/routes/calendar
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ComplianceService } from '../../../application/services/compliance-service.js';
import type { Database } from '../../../infrastructure/persistence/index.js';
import { RegulatorTypeSchema, RequirementCategorySchema } from '../../../domain/entities/regulatory-requirement.js';

// =============================================================================
// REQUEST SCHEMAS
// =============================================================================

const createCalendarEventSchema = z.object({
  entityId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  eventType: z.enum([
    'deadline', 'reminder', 'review', 'submission_window_open',
    'submission_window_close', 'payment_due', 'meeting', 'audit', 'other'
  ]),
  regulator: RegulatorTypeSchema.optional(),
  category: RequirementCategorySchema.optional(),
  obligationId: z.string().uuid().optional(),
  requirementId: z.string().uuid().optional(),
  eventDate: z.string().datetime(),
  eventEndDate: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().optional(),
  reminderDays: z.array(z.number().int()).optional(),
  assignedTo: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateCalendarEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  eventType: z.enum([
    'deadline', 'reminder', 'review', 'submission_window_open',
    'submission_window_close', 'payment_due', 'meeting', 'audit', 'other'
  ]).optional(),
  status: z.enum(['scheduled', 'completed', 'missed', 'cancelled', 'rescheduled']).optional(),
  eventDate: z.string().datetime().optional(),
  eventEndDate: z.string().datetime().optional(),
  assignedTo: z.array(z.string().uuid()).optional(),
  completionNotes: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const queryCalendarEventsSchema = z.object({
  entityId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function calendarRoutes(
  fastify: FastifyInstance,
  options: { db: Database }
) {
  const service = new ComplianceService(options.db);

  // ---------------------------------------------------------------------------
  // POST /calendar/events - Create calendar event
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createCalendarEventSchema>;
  }>('/calendar/events', {
    schema: {
      body: createCalendarEventSchema,
    },
  }, async (request, reply) => {
    try {
      const tenantId = request.headers['x-tenant-id'] as string;
      if (!tenantId) {
        return reply.status(400).send({ error: 'Missing x-tenant-id header' });
      }

      const event = await service.createCalendarEvent({
        tenantId,
        entityId: request.body.entityId,
        title: request.body.title,
        description: request.body.description,
        eventType: request.body.eventType,
        regulator: request.body.regulator,
        category: request.body.category,
        obligationId: request.body.obligationId,
        requirementId: request.body.requirementId,
        eventDate: new Date(request.body.eventDate),
        eventEndDate: request.body.eventEndDate ? new Date(request.body.eventEndDate) : undefined,
        allDay: request.body.allDay,
        isRecurring: request.body.isRecurring,
        recurrenceRule: request.body.recurrenceRule,
        reminderDays: request.body.reminderDays,
        assignedTo: request.body.assignedTo,
        metadata: request.body.metadata,
      });

      return reply.status(201).send(event);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /calendar/events - List calendar events by date range
  // ---------------------------------------------------------------------------
  fastify.get<{
    Querystring: z.infer<typeof queryCalendarEventsSchema>;
  }>('/calendar/events', {
    schema: {
      querystring: queryCalendarEventsSchema,
    },
  }, async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      return reply.status(400).send({ error: 'Missing x-tenant-id header' });
    }

    const events = await service.getCalendarEventsByDateRange(
      tenantId,
      new Date(request.query.startDate),
      new Date(request.query.endDate),
      request.query.entityId
    );

    return reply.send({
      data: events,
      total: events.length,
    });
  });

  // ---------------------------------------------------------------------------
  // GET /calendar/events/:id - Get single calendar event
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: { id: string };
  }>('/calendar/events/:id', async (request, reply) => {
    const event = await service.getCalendarEvent(request.params.id);

    if (!event) {
      return reply.status(404).send({ error: 'Calendar event not found' });
    }

    return reply.send(event);
  });

  // ---------------------------------------------------------------------------
  // PATCH /calendar/events/:id - Update calendar event
  // ---------------------------------------------------------------------------
  fastify.patch<{
    Params: { id: string };
    Body: z.infer<typeof updateCalendarEventSchema>;
  }>('/calendar/events/:id', {
    schema: {
      body: updateCalendarEventSchema,
    },
  }, async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const updated = await service.updateCalendarEvent(
      request.params.id,
      {
        title: request.body.title,
        description: request.body.description,
        eventType: request.body.eventType,
        status: request.body.status,
        eventDate: request.body.eventDate ? new Date(request.body.eventDate) : undefined,
        eventEndDate: request.body.eventEndDate ? new Date(request.body.eventEndDate) : undefined,
        assignedTo: request.body.assignedTo,
        completionNotes: request.body.completionNotes,
        metadata: request.body.metadata,
      },
      userId
    );

    if (!updated) {
      return reply.status(404).send({ error: 'Calendar event not found' });
    }

    return reply.send(updated);
  });

  // ---------------------------------------------------------------------------
  // DELETE /calendar/events/:id - Delete calendar event
  // ---------------------------------------------------------------------------
  fastify.delete<{
    Params: { id: string };
  }>('/calendar/events/:id', async (request, reply) => {
    const deleted = await service.deleteCalendarEvent(request.params.id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Calendar event not found' });
    }

    return reply.status(204).send();
  });

  // ---------------------------------------------------------------------------
  // POST /calendar/events/:id/complete - Mark event as completed
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
    Body: { completionNotes?: string };
  }>('/calendar/events/:id/complete', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;

    const updated = await service.updateCalendarEvent(
      request.params.id,
      {
        status: 'completed',
        completedAt: new Date(),
        completedBy: userId,
        completionNotes: request.body.completionNotes,
      },
      userId
    );

    if (!updated) {
      return reply.status(404).send({ error: 'Calendar event not found' });
    }

    return reply.send(updated);
  });

  // ---------------------------------------------------------------------------
  // POST /obligations/:id/calendar - Create calendar events for obligation
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: { id: string };
  }>('/obligations/:id/calendar', async (request, reply) => {
    const obligation = await service.getObligation(request.params.id);

    if (!obligation) {
      return reply.status(404).send({ error: 'Obligation not found' });
    }

    const events = await service.createCalendarEventsForObligation(obligation);

    return reply.status(201).send({
      data: events,
      total: events.length,
    });
  });
}
