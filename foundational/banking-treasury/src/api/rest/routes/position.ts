/**
 * Real-time Cash Position API Routes
 *
 * Endpoints for real-time cash position visibility with <1 minute freshness.
 *
 * @module api/rest/routes/position
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { cacheService } from '../../../infrastructure/cache/cache-service.js';
import { CashPositionService } from '../../../services/cash-management/cash-position-service.js';
import {
  DatabaseAccountDataSource,
  DatabaseFXRateSource,
  DatabaseCashFlowSource,
} from '../../../services/cash-management/data-sources.js';
import type { CashPosition, ProjectionHorizon, LiquidityThreshold } from '../../../services/cash-management/types.js';

// Initialize cash position service with data sources
const cashPositionService = new CashPositionService(
  new DatabaseAccountDataSource(),
  new DatabaseFXRateSource(),
  new DatabaseCashFlowSource()
);

/**
 * Serialize a CashPosition (converts Maps to objects for JSON)
 */
function serializeCashPosition(position: CashPosition) {
  return {
    entityId: position.entityId,
    timestamp: position.timestamp.toISOString(),
    balancesByCurrency: Object.fromEntries(position.balancesByCurrency),
    balancesByBank: Object.fromEntries(position.balancesByBank),
    balancesByAccount: Object.fromEntries(
      Array.from(position.balancesByAccount.entries()).map(([id, bal]) => [id, {
        ...bal,
        lastUpdated: bal.lastUpdated.toISOString(),
      }])
    ),
    totalInBaseCurrency: position.totalInBaseCurrency,
    baseCurrency: position.baseCurrency,
    fxRatesUsed: position.fxRatesUsed.map(fx => ({
      ...fx,
      timestamp: fx.timestamp.toISOString(),
    })),
    dataFreshness: {
      ...position.dataFreshness,
      oldestData: position.dataFreshness.oldestData.toISOString(),
      newestData: position.dataFreshness.newestData.toISOString(),
    },
  };
}

const projectionSchema = z.object({
  entityId: z.string().uuid(),
  days: z.number().int().min(1).max(365).default(30),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  baseCurrency: z.string().length(3).toUpperCase().default('USD'),
});

const thresholdSchema = z.object({
  entityId: z.string().uuid(),
  currency: z.string().length(3).toUpperCase(),
  minimumBalance: z.number(),
  targetBalance: z.number(),
  maximumBalance: z.number().optional(),
  alertLeadDays: z.number().int().min(0).default(7),
});

export async function positionRoutes(app: FastifyInstance): Promise<void> {

  /**
   * Get real-time cash position for an entity (cache-first, <1 min freshness)
   * GET /api/v1/position
   */
  app.get('/position', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId, baseCurrency = 'USD', refresh } = request.query as {
      entityId: string;
      baseCurrency?: string;
      refresh?: string;
    };

    if (!entityId) {
      return reply.status(400).send({
        success: false,
        error: 'entityId query parameter is required',
      });
    }

    const cacheKey = `cash-position:realtime:${entityId}:${baseCurrency}`;

    // Check cache unless refresh requested
    if (refresh !== 'true') {
      const cached = await cacheService.get<ReturnType<typeof serializeCashPosition>>(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: cached,
          source: 'cache',
          cachedAt: cached.timestamp,
        });
      }
    }

    try {
      const position = await cashPositionService.getPosition(entityId, baseCurrency);
      const serialized = serializeCashPosition(position);

      // Cache for 30 seconds (real-time requirement)
      await cacheService.set(cacheKey, serialized, 30);

      // Check for liquidity alerts
      const alerts = await cashPositionService.checkLiquidityAlerts(position);

      return reply.send({
        success: true,
        data: serialized,
        alerts: alerts.length > 0 ? alerts.map(a => ({
          ...a,
          triggeredAt: a.triggeredAt.toISOString(),
        })) : undefined,
        source: 'database',
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(error, 'Failed to get cash position');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve cash position',
      });
    }
  });

  /**
   * Get data freshness status for an entity
   * GET /api/v1/position/freshness
   */
  app.get('/position/freshness', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId, baseCurrency = 'USD' } = request.query as {
      entityId: string;
      baseCurrency?: string;
    };

    if (!entityId) {
      return reply.status(400).send({
        success: false,
        error: 'entityId query parameter is required',
      });
    }

    try {
      const position = await cashPositionService.getPosition(entityId, baseCurrency);

      const freshness = position.dataFreshness;
      const ageMs = Date.now() - freshness.oldestData.getTime();

      return reply.send({
        success: true,
        data: {
          entityId,
          overallFreshness: freshness.overallFreshness,
          isRealTime: freshness.overallFreshness === 'real_time',
          meetsTargetFreshness: ageMs < 60000, // <1 minute
          oldestDataAge: {
            milliseconds: ageMs,
            seconds: Math.round(ageMs / 1000),
            formatted: ageMs < 60000
              ? `${Math.round(ageMs / 1000)}s ago`
              : `${Math.round(ageMs / 60000)}m ago`,
          },
          oldestData: freshness.oldestData.toISOString(),
          newestData: freshness.newestData.toISOString(),
          staleAccounts: freshness.staleAccounts,
          staleAccountCount: freshness.staleAccounts.length,
        },
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      request.log.error(error, 'Failed to check data freshness');
      return reply.status(500).send({
        success: false,
        error: 'Failed to check data freshness',
      });
    }
  });

  /**
   * Get consolidated position across multiple entities
   * POST /api/v1/position/consolidated
   */
  app.post('/position/consolidated', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      entityIds: z.array(z.string().uuid()).min(1),
      baseCurrency: z.string().length(3).toUpperCase().default('USD'),
    });

    try {
      const { entityIds, baseCurrency } = schema.parse(request.body);

      const consolidatedPosition = await cashPositionService.getConsolidatedPosition(
        entityIds,
        baseCurrency
      );

      // Serialize the consolidated position
      const entityPositionsObj: Record<string, unknown> = {};
      for (const [entityId, position] of consolidatedPosition.entityPositions) {
        entityPositionsObj[entityId] = serializeCashPosition(position);
      }

      return reply.send({
        success: true,
        data: {
          timestamp: consolidatedPosition.timestamp.toISOString(),
          entityPositions: entityPositionsObj,
          consolidatedByCurrency: Object.fromEntries(consolidatedPosition.consolidatedByCurrency),
          consolidatedByBank: Object.fromEntries(consolidatedPosition.consolidatedByBank),
          totalInBaseCurrency: consolidatedPosition.totalInBaseCurrency,
          baseCurrency: consolidatedPosition.baseCurrency,
          intercompanyEliminations: consolidatedPosition.intercompanyEliminations,
          entityCount: entityIds.length,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to get consolidated position');
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve consolidated position',
      });
    }
  });

  /**
   * Project future cash position
   * POST /api/v1/position/projection
   */
  app.post('/position/projection', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { entityId, days, granularity, baseCurrency } = projectionSchema.parse(request.body);

      const horizon: ProjectionHorizon = { days, granularity };
      const projection = await cashPositionService.projectPosition(entityId, horizon, baseCurrency);

      return reply.send({
        success: true,
        data: {
          entityId: projection.entityId,
          projectionDate: projection.projectionDate.toISOString(),
          horizon: projection.horizon,
          projectedBalance: projection.projectedBalance,
          expectedInflows: projection.expectedInflows.map(f => ({
            ...f,
            expectedDate: f.expectedDate.toISOString(),
          })),
          expectedOutflows: projection.expectedOutflows.map(f => ({
            ...f,
            expectedDate: f.expectedDate.toISOString(),
          })),
          confidenceLevel: projection.confidenceLevel,
          assumptions: projection.assumptions,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to project position');
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate position projection',
      });
    }
  });

  /**
   * Set liquidity thresholds for an entity
   * POST /api/v1/position/thresholds
   */
  app.post('/position/thresholds', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = thresholdSchema.parse(request.body);

      const threshold: LiquidityThreshold = {
        entityId: input.entityId,
        currency: input.currency,
        minimumBalance: { amount: input.minimumBalance, currency: input.currency },
        targetBalance: { amount: input.targetBalance, currency: input.currency },
        maximumBalance: input.maximumBalance
          ? { amount: input.maximumBalance, currency: input.currency }
          : undefined,
        alertLeadDays: input.alertLeadDays,
      };

      cashPositionService.setThresholds(input.entityId, [threshold]);

      return reply.status(201).send({
        success: true,
        data: threshold,
        message: 'Threshold configured successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors,
        });
      }
      request.log.error(error, 'Failed to set threshold');
      return reply.status(500).send({
        success: false,
        error: 'Failed to configure threshold',
      });
    }
  });

  /**
   * Get liquidity alerts history
   * GET /api/v1/position/alerts
   */
  app.get('/position/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { entityId } = request.query as { entityId?: string };

    const alerts = cashPositionService.getAlertHistory(entityId);

    return reply.send({
      success: true,
      data: alerts.map(alert => ({
        ...alert,
        triggeredAt: alert.triggeredAt.toISOString(),
      })),
      count: alerts.length,
    });
  });

  /**
   * Acknowledge a liquidity alert
   * POST /api/v1/position/alerts/:alertId/acknowledge
   */
  app.post('/position/alerts/:alertId/acknowledge', async (
    request: FastifyRequest<{ Params: { alertId: string }; Body: { acknowledgedBy?: string } }>,
    reply: FastifyReply
  ) => {
    const { alertId } = request.params;
    const { acknowledgedBy } = request.body || {};

    const alerts = cashPositionService.getAlertHistory();
    const alert = alerts.find(a => a.alertId === alertId);

    if (!alert) {
      return reply.status(404).send({
        success: false,
        error: 'Alert not found',
      });
    }

    // Note: In a real implementation, this would update the alert in a database
    // For now, we're just marking it acknowledged in memory
    (alert as { acknowledged: boolean }).acknowledged = true;

    return reply.send({
      success: true,
      data: {
        ...alert,
        triggeredAt: alert.triggeredAt.toISOString(),
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date().toISOString(),
      },
    });
  });
}
