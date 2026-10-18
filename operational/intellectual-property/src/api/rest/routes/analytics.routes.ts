/**
 * Analytics Routes
 *
 * REST API endpoints for enforcement analytics.
 *
 * @module api/rest/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  EnforcementAnalyticsService,
  createEnforcementAnalyticsService,
} from '../../../application/services/enforcement-analytics.service.js';
import type {
  AnalyticsPeriod,
  AnalyticsPeriodGranularity,
  SuccessCriteria,
} from '../../../application/services/enforcement-analytics-types.js';
import type { Database } from '../../../infrastructure/persistence/database.js';

// ============================================================================
// Schemas
// ============================================================================

const granularitySchema = z.enum(['day', 'week', 'month', 'quarter', 'year']);

const dateRangeSchema = z.object({
  from: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  granularity: granularitySchema.optional(),
});

const successCriteriaSchema = z.enum([
  'favorable_outcome',
  'recovery_exceeds_cost',
  'stopped_infringement',
  'settlement_achieved',
]);

// ============================================================================
// Types
// ============================================================================

interface DateRangeQuery {
  from?: string;
  to?: string;
  granularity?: AnalyticsPeriodGranularity;
}

interface SuccessRateQuery extends DateRangeQuery {
  criteria?: SuccessCriteria;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse date range from query parameters.
 */
function parseDateRange(query: DateRangeQuery): AnalyticsPeriod {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: query.from ? new Date(query.from) : defaultFrom,
    to: query.to ? new Date(query.to) : defaultTo,
    granularity: query.granularity ?? 'month',
  };
}

// ============================================================================
// Route Handler
// ============================================================================

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  // Get database from decorated property (set in app.ts)
  const db = (fastify as FastifyInstance & { db: Database }).db;
  const analyticsService = createEnforcementAnalyticsService(db);

  // ==========================================================================
  // Case Outcome Analytics
  // ==========================================================================

  /**
   * @swagger
   * /api/v1/analytics/enforcement/outcomes:
   *   get:
   *     tags:
   *       - analytics
   *     summary: Get case outcome analytics
   *     description: Returns win/loss/settlement rates, outcomes by type and jurisdiction, and trends over time.
   *     parameters:
   *       - name: from
   *         in: query
   *         description: Start date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: to
   *         in: query
   *         description: End date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: granularity
   *         in: query
   *         description: Time period granularity for trends
   *         schema:
   *           type: string
   *           enum: [day, week, month, quarter, year]
   *           default: month
   *     responses:
   *       200:
   *         description: Case outcome analytics
   */
  fastify.get<{ Querystring: DateRangeQuery }>(
    '/enforcement/outcomes',
    {
      schema: {
        tags: ['analytics'],
        summary: 'Get case outcome analytics',
        description: 'Returns win/loss/settlement rates, outcomes by type and jurisdiction, and trends over time.',
        querystring: z.object({
          from: z.string().optional(),
          to: z.string().optional(),
          granularity: granularitySchema.optional(),
        }),
        response: {
          200: z.object({
            period: z.object({
              from: z.date(),
              to: z.date(),
              granularity: granularitySchema.optional(),
            }),
            overall: z.object({
              outcomes: z.object({
                win: z.number(),
                loss: z.number(),
                settlement: z.number(),
                abandoned: z.number(),
                ongoing: z.number(),
              }),
              rates: z.object({
                winRate: z.number(),
                lossRate: z.number(),
                settlementRate: z.number(),
                abandonedRate: z.number(),
              }),
              totalCases: z.number(),
            }),
            byType: z.array(z.any()),
            byJurisdiction: z.array(z.any()),
            trends: z.array(z.any()),
          }),
        },
      },
    },
    async (request, reply) => {
      const period = parseDateRange(request.query);
      const analytics = await analyticsService.getCaseOutcomeAnalytics(period);
      return reply.send(analytics);
    }
  );

  // ==========================================================================
  // Resolution Time Analytics
  // ==========================================================================

  /**
   * @swagger
   * /api/v1/analytics/enforcement/resolution-times:
   *   get:
   *     tags:
   *       - analytics
   *     summary: Get resolution time analytics
   *     description: Returns average time to resolution by type, stage breakdown, industry benchmarks, and bottleneck identification.
   *     parameters:
   *       - name: from
   *         in: query
   *         description: Start date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: to
   *         in: query
   *         description: End date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *     responses:
   *       200:
   *         description: Resolution time analytics
   */
  fastify.get<{ Querystring: DateRangeQuery }>(
    '/enforcement/resolution-times',
    {
      schema: {
        tags: ['analytics'],
        summary: 'Get resolution time analytics',
        description: 'Returns average time to resolution by type, stage breakdown, industry benchmarks, and bottleneck identification.',
        querystring: z.object({
          from: z.string().optional(),
          to: z.string().optional(),
        }),
        response: {
          200: z.object({
            period: z.any(),
            overall: z.object({
              average: z.number(),
              median: z.number(),
              min: z.number(),
              max: z.number(),
              standardDeviation: z.number(),
            }),
            byType: z.array(z.any()),
            byStage: z.any(),
            benchmarks: z.array(z.any()),
            bottlenecks: z.array(z.any()),
            casesAnalyzed: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const period = parseDateRange(request.query);
      const analytics = await analyticsService.getResolutionTimeAnalytics(period);
      return reply.send(analytics);
    }
  );

  // ==========================================================================
  // Cost Analytics
  // ==========================================================================

  /**
   * @swagger
   * /api/v1/analytics/enforcement/costs:
   *   get:
   *     tags:
   *       - analytics
   *     summary: Get cost analytics
   *     description: Returns total enforcement costs, cost by matter type, cost vs recovery ratio, outside counsel spend, and projections.
   *     parameters:
   *       - name: from
   *         in: query
   *         description: Start date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: to
   *         in: query
   *         description: End date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: granularity
   *         in: query
   *         description: Time period granularity for trends
   *         schema:
   *           type: string
   *           enum: [day, week, month, quarter, year]
   *           default: month
   *     responses:
   *       200:
   *         description: Cost analytics
   */
  fastify.get<{ Querystring: DateRangeQuery }>(
    '/enforcement/costs',
    {
      schema: {
        tags: ['analytics'],
        summary: 'Get cost analytics',
        description: 'Returns total enforcement costs, cost by matter type, cost vs recovery ratio, outside counsel spend, and projections.',
        querystring: z.object({
          from: z.string().optional(),
          to: z.string().optional(),
          granularity: granularitySchema.optional(),
        }),
        response: {
          200: z.object({
            period: z.any(),
            overall: z.object({
              costs: z.object({
                internalCounsel: z.number(),
                outsideCounsel: z.number(),
                courtFees: z.number(),
                expertWitnesses: z.number(),
                investigation: z.number(),
                settlement: z.number(),
                other: z.number(),
                total: z.number(),
              }),
              recovery: z.object({
                totalCosts: z.number(),
                totalRecoveries: z.number(),
                netRecovery: z.number(),
                returnOnEnforcement: z.number(),
                costRecoveryRatio: z.number(),
              }),
            }),
            byType: z.array(z.any()),
            outsideCounselSpend: z.array(z.any()),
            projections: z.array(z.any()),
            trends: z.array(z.any()),
            currency: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const period = parseDateRange(request.query);
      const analytics = await analyticsService.getCostAnalytics(period);
      return reply.send(analytics);
    }
  );

  // ==========================================================================
  // Success Rate Metrics
  // ==========================================================================

  /**
   * @swagger
   * /api/v1/analytics/enforcement/success-rates:
   *   get:
   *     tags:
   *       - analytics
   *     summary: Get success rate metrics
   *     description: Returns overall success rate, success by matter type, opposing party type, and jurisdiction.
   *     parameters:
   *       - name: from
   *         in: query
   *         description: Start date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: to
   *         in: query
   *         description: End date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: granularity
   *         in: query
   *         description: Time period granularity for trends
   *         schema:
   *           type: string
   *           enum: [day, week, month, quarter, year]
   *           default: month
   *       - name: criteria
   *         in: query
   *         description: Success criteria to use
   *         schema:
   *           type: string
   *           enum: [favorable_outcome, recovery_exceeds_cost, stopped_infringement, settlement_achieved]
   *           default: favorable_outcome
   *     responses:
   *       200:
   *         description: Success rate metrics
   */
  fastify.get<{ Querystring: SuccessRateQuery }>(
    '/enforcement/success-rates',
    {
      schema: {
        tags: ['analytics'],
        summary: 'Get success rate metrics',
        description: 'Returns overall success rate, success by matter type, opposing party type, and jurisdiction.',
        querystring: z.object({
          from: z.string().optional(),
          to: z.string().optional(),
          granularity: granularitySchema.optional(),
          criteria: successCriteriaSchema.optional(),
        }),
        response: {
          200: z.object({
            period: z.any(),
            overall: z.object({
              successCount: z.number(),
              totalCases: z.number(),
              successRate: z.number(),
              criteria: successCriteriaSchema,
            }),
            byMatterType: z.array(z.any()),
            byOpposingParty: z.array(z.any()),
            byJurisdiction: z.array(z.any()),
            byIPAssetType: z.array(z.any()),
            trends: z.array(z.any()),
          }),
        },
      },
    },
    async (request, reply) => {
      const period = parseDateRange(request.query);
      const criteria = request.query.criteria ?? 'favorable_outcome';
      const analytics = await analyticsService.getSuccessRateMetrics(period, criteria);
      return reply.send(analytics);
    }
  );

  // ==========================================================================
  // Trend Visualization Data
  // ==========================================================================

  /**
   * @swagger
   * /api/v1/analytics/enforcement/trends:
   *   get:
   *     tags:
   *       - analytics
   *     summary: Get trend visualization data
   *     description: Returns monthly/quarterly case counts, settlement amounts over time, cost trends, and resolution time trends.
   *     parameters:
   *       - name: from
   *         in: query
   *         description: Start date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: to
   *         in: query
   *         description: End date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: granularity
   *         in: query
   *         description: Time period granularity
   *         schema:
   *           type: string
   *           enum: [day, week, month, quarter, year]
   *           default: month
   *     responses:
   *       200:
   *         description: Trend visualization data
   */
  fastify.get<{ Querystring: DateRangeQuery }>(
    '/enforcement/trends',
    {
      schema: {
        tags: ['analytics'],
        summary: 'Get trend visualization data',
        description: 'Returns monthly/quarterly case counts, settlement amounts over time, cost trends, and resolution time trends.',
        querystring: z.object({
          from: z.string().optional(),
          to: z.string().optional(),
          granularity: granularitySchema.optional(),
        }),
        response: {
          200: z.object({
            period: z.any(),
            caseCounts: z.array(z.any()),
            settlements: z.array(z.any()),
            costs: z.array(z.any()),
            resolutionTimes: z.array(z.any()),
            successRates: z.array(z.any()),
          }),
        },
      },
    },
    async (request, reply) => {
      const period = parseDateRange(request.query);
      const data = await analyticsService.getTrendVisualizationData(period);
      return reply.send(data);
    }
  );

  // ==========================================================================
  // Dashboard Summary
  // ==========================================================================

  /**
   * @swagger
   * /api/v1/analytics/enforcement/summary:
   *   get:
   *     tags:
   *       - analytics
   *     summary: Get analytics summary for dashboard
   *     description: Returns a quick summary of key enforcement metrics for dashboard display.
   *     parameters:
   *       - name: from
   *         in: query
   *         description: Start date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *       - name: to
   *         in: query
   *         description: End date (ISO 8601 or YYYY-MM-DD)
   *         schema:
   *           type: string
   *           format: date
   *     responses:
   *       200:
   *         description: Analytics summary
   */
  fastify.get<{ Querystring: DateRangeQuery }>(
    '/enforcement/summary',
    {
      schema: {
        tags: ['analytics'],
        summary: 'Get analytics summary for dashboard',
        description: 'Returns a quick summary of key enforcement metrics for dashboard display.',
        querystring: z.object({
          from: z.string().optional(),
          to: z.string().optional(),
        }),
        response: {
          200: z.object({
            period: z.any(),
            activeCases: z.number(),
            closedThisPeriod: z.number(),
            winRate: z.number(),
            averageResolutionDays: z.number(),
            totalCostsThisPeriod: z.number(),
            totalRecoveriesThisPeriod: z.number(),
            criticalCases: z.number(),
            upcomingDeadlines: z.number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const period = parseDateRange(request.query);
      const summary = await analyticsService.getAnalyticsSummary(period);
      return reply.send(summary);
    }
  );
}
