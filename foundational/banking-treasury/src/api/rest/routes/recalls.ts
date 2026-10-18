/**
 * Payment Recall API Routes
 *
 * Endpoints for payment recall requests, responses, and management.
 *
 * @module api/rest/routes/recalls
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { recallService } from '../../../services/payments/recall-service.js';

const createRecallSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.enum([
    'duplicate_payment',
    'wrong_amount',
    'wrong_beneficiary',
    'fraudulent',
    'technical_error',
    'customer_request',
    'compliance',
    'other',
  ]),
  reasonDetails: z.string().min(10).max(1000),
  requestedBy: z.string(),
  urgency: z.enum(['normal', 'urgent']).default('normal'),
});

const respondRecallSchema = z.object({
  decision: z.enum(['accept', 'reject', 'partial']),
  reason: z.string().max(1000).optional(),
  partialAmount: z.number().positive().optional(),
  respondedBy: z.string(),
});

const completeRecallSchema = z.object({
  completedBy: z.string(),
  refundTransactionId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});

export async function recallRoutes(app: FastifyInstance): Promise<void> {

  /**
   * Create a recall request for a payment
   * POST /api/v1/recalls
   */
  app.post('/recalls', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = createRecallSchema.parse(request.body);

      const recall = await recallService.createRecallRequest(input.paymentId, {
        reason: input.reason,
        reasonDetails: input.reasonDetails,
        requestedBy: input.requestedBy,
        urgency: input.urgency,
      });

      return reply.status(201).send({
        success: true,
        data: {
          ...recall,
          requestedAt: recall.requestedAt.toISOString(),
          responseDeadline: recall.responseDeadline.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: (error as Error).message,
        });
      }
      if ((error as Error).message.includes('cannot be recalled') ||
          (error as Error).message.includes('already pending')) {
        return reply.status(400).send({
          success: false,
          error: (error as Error).message,
        });
      }
      request.log.error(error, 'Failed to create recall request');
      return reply.status(500).send({
        success: false,
        error: 'Failed to create recall request',
      });
    }
  });

  /**
   * Get recall request by ID
   * GET /api/v1/recalls/:id
   */
  app.get('/recalls/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const recall = await recallService.getRecall(id);

      if (!recall) {
        return reply.status(404).send({
          success: false,
          error: 'Recall request not found',
        });
      }

      return reply.send({
        success: true,
        data: {
          ...recall,
          requestedAt: recall.requestedAt.toISOString(),
          responseDeadline: recall.responseDeadline.toISOString(),
          respondedAt: recall.respondedAt?.toISOString(),
          completedAt: recall.completedAt?.toISOString(),
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to get recall request');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve recall request',
      });
    }
  });

  /**
   * Get recalls for a payment
   * GET /api/v1/recalls/payment/:paymentId
   */
  app.get('/recalls/payment/:paymentId', async (
    request: FastifyRequest<{ Params: { paymentId: string } }>,
    reply: FastifyReply
  ) => {
    const { paymentId } = request.params;

    try {
      const recalls = await recallService.getRecallsForPayment(paymentId);

      return reply.send({
        success: true,
        data: recalls.map(r => ({
          ...r,
          requestedAt: r.requestedAt.toISOString(),
          responseDeadline: r.responseDeadline.toISOString(),
          respondedAt: r.respondedAt?.toISOString(),
          completedAt: r.completedAt?.toISOString(),
        })),
        count: recalls.length,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get recalls for payment');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve recalls',
      });
    }
  });

  /**
   * Get pending recalls (admin/operations queue)
   * GET /api/v1/recalls/pending
   */
  app.get('/recalls/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    const { includeExpired, limit } = request.query as {
      includeExpired?: string;
      limit?: string;
    };

    try {
      const recalls = await recallService.getPendingRecalls({
        includeExpired: includeExpired === 'true',
        limit: limit ? parseInt(limit) : undefined,
      });

      return reply.send({
        success: true,
        data: recalls.map(r => ({
          ...r,
          requestedAt: r.requestedAt.toISOString(),
          responseDeadline: r.responseDeadline.toISOString(),
          respondedAt: r.respondedAt?.toISOString(),
        })),
        count: recalls.length,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get pending recalls');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve pending recalls',
      });
    }
  });

  /**
   * Respond to a recall request
   * POST /api/v1/recalls/:id/respond
   */
  app.post('/recalls/:id/respond', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const input = respondRecallSchema.parse(request.body);

      const recall = await recallService.respondToRecall({
        recallId: id,
        decision: input.decision,
        reason: input.reason,
        partialAmount: input.partialAmount,
        respondedBy: input.respondedBy,
      });

      return reply.send({
        success: true,
        data: {
          ...recall,
          requestedAt: recall.requestedAt.toISOString(),
          responseDeadline: recall.responseDeadline.toISOString(),
          respondedAt: recall.respondedAt?.toISOString(),
        },
        message: `Recall ${input.decision === 'accept' ? 'accepted' : input.decision === 'reject' ? 'rejected' : 'partially accepted'}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: (error as Error).message,
        });
      }
      if ((error as Error).message.includes('required')) {
        return reply.status(400).send({
          success: false,
          error: (error as Error).message,
        });
      }
      request.log.error(error, 'Failed to respond to recall');
      return reply.status(500).send({
        success: false,
        error: 'Failed to process recall response',
      });
    }
  });

  /**
   * Complete a recall (finalize the refund)
   * POST /api/v1/recalls/:id/complete
   */
  app.post('/recalls/:id/complete', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const input = completeRecallSchema.parse(request.body);

      const recall = await recallService.completeRecall(id, {
        completedBy: input.completedBy,
        refundTransactionId: input.refundTransactionId,
        notes: input.notes,
      });

      return reply.send({
        success: true,
        data: {
          ...recall,
          requestedAt: recall.requestedAt.toISOString(),
          responseDeadline: recall.responseDeadline.toISOString(),
          respondedAt: recall.respondedAt?.toISOString(),
          completedAt: recall.completedAt?.toISOString(),
        },
        message: 'Recall completed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: (error as Error).message,
        });
      }
      request.log.error(error, 'Failed to complete recall');
      return reply.status(500).send({
        success: false,
        error: 'Failed to complete recall',
      });
    }
  });

  /**
   * Expire overdue recalls (admin/scheduled task)
   * POST /api/v1/recalls/expire-overdue
   */
  app.post('/recalls/expire-overdue', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const expiredCount = await recallService.expireOverdueRecalls();

      return reply.send({
        success: true,
        data: { expiredCount },
        message: `Expired ${expiredCount} overdue recall request(s)`,
      });
    } catch (error) {
      request.log.error(error, 'Failed to expire overdue recalls');
      return reply.status(500).send({
        success: false,
        error: 'Failed to expire overdue recalls',
      });
    }
  });
}
