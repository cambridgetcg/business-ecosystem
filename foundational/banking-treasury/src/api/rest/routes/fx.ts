/**
 * FX (Foreign Exchange) API Routes
 *
 * Endpoints for FX rate quotes, conversions, and historical data.
 * Pattern follows established route conventions from position.ts
 *
 * @module api/rest/routes/fx
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { fxService } from '../../../services/fx/fx-service.js';

const quoteSchema = z.object({
  baseCurrency: z.string().length(3).toUpperCase(),
  quoteCurrency: z.string().length(3).toUpperCase(),
  amount: z.number().positive().optional(),
});

const conversionSchema = z.object({
  fromAmount: z.number().positive(),
  fromCurrency: z.string().length(3).toUpperCase(),
  toCurrency: z.string().length(3).toUpperCase(),
  quoteId: z.string().uuid().optional(),
  reference: z.string().max(100).optional(),
});

const historySchema = z.object({
  baseCurrency: z.string().length(3).toUpperCase(),
  quoteCurrency: z.string().length(3).toUpperCase(),
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  granularity: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
});

export async function fxRoutes(app: FastifyInstance): Promise<void> {

  /**
   * Get FX rate quote
   * GET /api/v1/fx/quote
   */
  app.get('/fx/quote', async (request: FastifyRequest, reply: FastifyReply) => {
    const { baseCurrency, quoteCurrency, amount } = request.query as {
      baseCurrency: string;
      quoteCurrency: string;
      amount?: string;
    };

    if (!baseCurrency || !quoteCurrency) {
      return reply.status(400).send({
        success: false,
        error: 'baseCurrency and quoteCurrency are required',
      });
    }

    try {
      const quote = await fxService.getQuote(
        baseCurrency.toUpperCase(),
        quoteCurrency.toUpperCase(),
        amount ? parseFloat(amount) : undefined
      );

      return reply.send({
        success: true,
        data: {
          ...quote,
          timestamp: quote.timestamp.toISOString(),
          expiresAt: quote.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to get FX quote');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve FX quote',
      });
    }
  });

  /**
   * Execute FX conversion
   * POST /api/v1/fx/convert
   */
  app.post('/fx/convert', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = conversionSchema.parse(request.body);

      const conversion = await fxService.executeConversion(
        input.fromAmount,
        input.fromCurrency,
        input.toCurrency,
        input.quoteId,
        input.reference
      );

      return reply.status(201).send({
        success: true,
        data: {
          ...conversion,
          executedAt: conversion.executedAt.toISOString(),
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
      if ((error as Error).message.includes('expired')) {
        return reply.status(400).send({
          success: false,
          error: 'Quote has expired. Please request a new quote.',
        });
      }
      request.log.error(error, 'Failed to execute conversion');
      return reply.status(500).send({
        success: false,
        error: 'Failed to execute FX conversion',
      });
    }
  });

  /**
   * Get supported currency pairs
   * GET /api/v1/fx/pairs
   */
  app.get('/fx/pairs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pairs = await fxService.getSupportedPairs();

      return reply.send({
        success: true,
        data: pairs,
        count: pairs.length,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get currency pairs');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve currency pairs',
      });
    }
  });

  /**
   * Get rate history
   * POST /api/v1/fx/history
   */
  app.post('/fx/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = historySchema.parse(request.body);

      const history = await fxService.getRateHistory(
        input.baseCurrency,
        input.quoteCurrency,
        input.startDate,
        input.endDate,
        input.granularity
      );

      return reply.send({
        success: true,
        data: {
          baseCurrency: input.baseCurrency,
          quoteCurrency: input.quoteCurrency,
          granularity: input.granularity,
          startDate: input.startDate,
          endDate: input.endDate,
          history,
          dataPoints: history.length,
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
      request.log.error(error, 'Failed to get rate history');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve rate history',
      });
    }
  });

  /**
   * Get conversion history for an entity
   * GET /api/v1/fx/conversions
   */
  app.get('/fx/conversions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId, startDate, endDate, limit } = request.query as {
      entityId: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
    };

    if (!entityId) {
      return reply.status(400).send({
        success: false,
        error: 'entityId query parameter is required',
      });
    }

    try {
      const conversions = await fxService.getConversionHistory(
        entityId,
        startDate,
        endDate,
        limit ? parseInt(limit) : undefined
      );

      return reply.send({
        success: true,
        data: conversions.map(c => ({
          ...c,
          executedAt: c.executedAt.toISOString(),
        })),
        count: conversions.length,
      });
    } catch (error) {
      request.log.error(error, 'Failed to get conversion history');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve conversion history',
      });
    }
  });

  /**
   * Get current rates for multiple pairs
   * POST /api/v1/fx/rates/batch
   */
  app.post('/fx/rates/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      pairs: z.array(z.object({
        baseCurrency: z.string().length(3).toUpperCase(),
        quoteCurrency: z.string().length(3).toUpperCase(),
      })).min(1).max(20),
    });

    try {
      const { pairs } = schema.parse(request.body);

      const quotes = await Promise.all(
        pairs.map(pair =>
          fxService.getQuote(pair.baseCurrency, pair.quoteCurrency)
            .catch(error => ({
              baseCurrency: pair.baseCurrency,
              quoteCurrency: pair.quoteCurrency,
              error: (error as Error).message,
            }))
        )
      );

      return reply.send({
        success: true,
        data: quotes.map(q => {
          if ('error' in q) {
            return q;
          }
          return {
            ...q,
            timestamp: q.timestamp.toISOString(),
            expiresAt: q.expiresAt.toISOString(),
          };
        }),
        requested: pairs.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to get batch rates');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve batch rates',
      });
    }
  });
}
