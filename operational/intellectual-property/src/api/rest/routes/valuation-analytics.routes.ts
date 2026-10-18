/**
 * Valuation Analytics Routes
 *
 * REST API for IP Valuation Analytics: Portfolio value tracking,
 * valuation changes, methodology comparison, impairments, and alerts.
 *
 * @module api/rest/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  ValuationAnalyticsService,
  createValuationAnalyticsService,
} from '../../../application/services/valuation-analytics.service.js';
import type {
  TrendGranularity,
  ValuationAnalyticsFilters,
} from '../../../application/services/valuation-analytics-types.js';

// ============================================================================
// SCHEMAS
// ============================================================================

const TrendGranularitySchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);

const AssetTypeSchema = z.enum(['patent', 'trademark', 'copyright', 'trade_secret', 'license']);

const MethodologySchema = z.enum([
  'cost', 'market', 'income', 'relief_from_royalty', 'excess_earnings',
  'real_options', 'monte_carlo', 'comparable_transactions'
]);

const PurposeSchema = z.enum([
  'financial_reporting', 'tax', 'litigation', 'licensing', 'sale',
  'financing', 'insurance', 'internal_planning', 'm_and_a'
]);

// ============================================================================
// ROUTES
// ============================================================================

export async function valuationAnalyticsRoutes(fastify: FastifyInstance): Promise<void> {
  // Get database from decorated property (set in app.ts)
  const db = (fastify as FastifyInstance & { db: any }).db;
  const analyticsService = createValuationAnalyticsService(db);

  // ==========================================================================
  // PORTFOLIO VALUE ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/v1/analytics/valuations/portfolio-value
   *
   * Get the current portfolio value snapshot with breakdowns by asset type
   * and business unit.
   */
  fastify.get(
    '/valuations/portfolio-value',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | string[] | undefined>;
      const filters = parseFilters(query);

      const snapshot = await analyticsService.getPortfolioValueSnapshot(filters);

      return reply.send({
        data: {
          snapshotDate: snapshot.snapshotDate.toISOString(),
          totalValue: snapshot.totalValue,
          currency: snapshot.currency,
          valueByAssetType: snapshot.valueByAssetType,
          valueByBusinessUnit: snapshot.valueByBusinessUnit,
          statistics: {
            assetCount: snapshot.assetCount,
            valuationCount: snapshot.valuationCount,
            averageAssetValue: snapshot.averageAssetValue,
            medianAssetValue: snapshot.medianAssetValue,
            topAssetsValue: snapshot.topAssetsValue,
          },
          changeFromPrevious: snapshot.changeFromPrevious,
        },
      });
    }
  );

  /**
   * GET /api/v1/analytics/valuations/portfolio-value/trend
   *
   * Get portfolio value trend over time with specified granularity.
   */
  fastify.get(
    '/valuations/portfolio-value/trend',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | string[] | undefined>;
      const filters = parseFilters(query);
      const granularity = (query.granularity as TrendGranularity) ?? 'monthly';

      // Validate granularity
      const validGranularity = TrendGranularitySchema.safeParse(granularity);
      if (!validGranularity.success) {
        return reply.status(400).send({
          error: 'Invalid granularity',
          validValues: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
        });
      }

      const trend = await analyticsService.getPortfolioValueTrend(filters, granularity);

      return reply.send({
        data: {
          periodStart: trend.periodStart.toISOString(),
          periodEnd: trend.periodEnd.toISOString(),
          granularity: trend.granularity,
          totalTrend: {
            id: trend.totalTrend.id,
            name: trend.totalTrend.name,
            dataPoints: trend.totalTrend.dataPoints.map(dp => ({
              date: dp.date.toISOString(),
              value: dp.value,
              label: dp.label,
            })),
            totalChange: trend.totalTrend.totalChange,
            percentageChange: trend.totalTrend.percentageChange,
          },
          statistics: trend.statistics,
        },
      });
    }
  );

  /**
   * GET /api/v1/analytics/valuations/portfolio-value/history
   *
   * Get historical portfolio value snapshots.
   */
  fastify.get(
    '/valuations/portfolio-value/history',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | string[] | undefined>;
      const granularity = (query.granularity as TrendGranularity) ?? 'monthly';

      const startDate = query.startDate
        ? new Date(query.startDate as string)
        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate
        ? new Date(query.endDate as string)
        : new Date();

      const snapshots = await analyticsService.getHistoricalSnapshots(
        { startDate, endDate },
        granularity
      );

      return reply.send({
        data: snapshots.map(s => ({
          snapshotDate: s.snapshotDate.toISOString(),
          totalValue: s.totalValue,
          currency: s.currency,
          assetCount: s.assetCount,
          valuationCount: s.valuationCount,
          changeFromPrevious: s.changeFromPrevious,
        })),
        meta: {
          periodStart: startDate.toISOString(),
          periodEnd: endDate.toISOString(),
          granularity,
          count: snapshots.length,
        },
      });
    }
  );

  // ==========================================================================
  // VALUATION CHANGES ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/v1/analytics/valuations/changes
   *
   * Analyze valuation changes over a period including gainers, losers,
   * and change reasons.
   */
  fastify.get(
    '/valuations/changes',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | string[] | undefined>;
      const filters = parseFilters(query);

      const analysis = await analyticsService.analyzeValuationChanges(filters);

      return reply.send({
        data: {
          periodStart: analysis.periodStart.toISOString(),
          periodEnd: analysis.periodEnd.toISOString(),
          summary: {
            totalRevaluations: analysis.totalRevaluations,
            netValueChange: analysis.netValueChange,
            netPercentageChange: analysis.netPercentageChange,
          },
          largestGainers: analysis.largestGainers.map(serializeChange),
          largestLosers: analysis.largestLosers.map(serializeChange),
          largestPercentageGainers: analysis.largestPercentageGainers.map(serializeChange),
          largestPercentageLosers: analysis.largestPercentageLosers.map(serializeChange),
          changesByReason: analysis.changesByReason,
          changesByAssetType: analysis.changesByAssetType,
          revaluationTriggers: analysis.revaluationTriggers,
        },
      });
    }
  );

  /**
   * GET /api/v1/analytics/valuations/changes/:assetType/:assetId
   *
   * Get valuation history for a specific asset.
   */
  fastify.get(
    '/valuations/changes/:assetType/:assetId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { assetType, assetId } = request.params as { assetType: string; assetId: string };

      const changes = await analyticsService.getAssetValuationHistory(assetType, assetId);

      return reply.send({
        data: changes.map(serializeChange),
        meta: {
          assetType,
          assetId,
          totalChanges: changes.length,
        },
      });
    }
  );

  // ==========================================================================
  // METHODOLOGY COMPARISON ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/v1/analytics/valuations/methodology-comparison
   *
   * Compare valuation methodologies across the portfolio.
   */
  fastify.get(
    '/valuations/methodology-comparison',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | string[] | undefined>;
      const filters = parseFilters(query);

      const comparison = await analyticsService.compareMethodologies(filters);

      return reply.send({
        data: {
          analysisDate: comparison.analysisDate.toISOString(),
          totalAssetsAnalyzed: comparison.totalAssetsAnalyzed,
          methodologyDistribution: comparison.methodologyDistribution,
          averageMethodologyVariance: comparison.averageMethodologyVariance,
          assetsWithMultipleMethodologies: comparison.assetsWithMultipleMethodologies.map(a => ({
            assetId: a.assetId,
            assetName: a.assetName,
            assetType: a.assetType,
            latestValueByMethodology: a.latestValueByMethodology,
            methodologyVariance: a.methodologyVariance,
            recommendedMethodology: a.recommendedMethodology,
          })),
          methodologyByAssetType: comparison.methodologyByAssetType,
          methodologyByPurpose: comparison.methodologyByPurpose,
        },
      });
    }
  );

  // ==========================================================================
  // IMPAIRMENT TRACKING ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/v1/analytics/valuations/impairments
   *
   * Get impairment summary and tracking for the portfolio.
   */
  fastify.get(
    '/valuations/impairments',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | string[] | undefined>;
      const filters = parseFilters(query);

      const summary = await analyticsService.getImpairmentSummary(filters);

      return reply.send({
        data: {
          period: {
            start: summary.periodStart.toISOString(),
            end: summary.periodEnd.toISOString(),
          },
          summary: {
            totalEvents: summary.totalEvents,
            totalImpairmentAmount: summary.totalImpairmentAmount,
            averageImpairmentAmount: summary.averageImpairmentAmount,
          },
          impairmentsByMonth: summary.impairmentsByMonth.map(m => ({
            month: m.month.toISOString(),
            count: m.count,
            amount: m.amount,
          })),
          impairmentsByReason: summary.impairmentsByReason,
          impairmentsByAssetType: summary.impairmentsByAssetType,
          assetsWithIndicators: summary.assetsWithIndicators,
          events: summary.events.map(e => ({
            id: e.id,
            valuationId: e.valuationId,
            assetId: e.assetId,
            assetName: e.assetName,
            assetType: e.assetType,
            impairmentDate: e.impairmentDate.toISOString(),
            carryingValueBefore: e.carryingValueBefore,
            fairValueAtImpairment: e.fairValueAtImpairment,
            impairmentAmount: e.impairmentAmount,
            impairmentPercentage: e.impairmentPercentage,
            primaryReason: e.primaryReason,
            reversible: e.reversible,
          })),
        },
      });
    }
  );

  // ==========================================================================
  // ALERTS ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/v1/analytics/valuations/alerts
   *
   * Get valuation alerts including revaluations due, expirations,
   * and impairment indicators.
   */
  fastify.get(
    '/valuations/alerts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | string[] | undefined>;
      const filters = parseFilters(query);

      const alertSummary = await analyticsService.getValuationAlerts(filters);

      return reply.send({
        data: {
          summary: {
            totalAlerts: alertSummary.totalAlerts,
            bySeverity: alertSummary.bySeverity,
            byType: alertSummary.byType,
          },
          criticalAlerts: alertSummary.criticalAlerts.map(serializeAlert),
          alertsDueThisWeek: alertSummary.alertsDueThisWeek.map(serializeAlert),
          alertsDueThisMonth: alertSummary.alertsDueThisMonth.map(serializeAlert),
          overdueAlerts: alertSummary.overdueAlerts.map(serializeAlert),
          allAlerts: alertSummary.allAlerts.map(serializeAlert),
        },
      });
    }
  );

  /**
   * GET /api/v1/analytics/valuations/alerts/:assetType/:assetId
   *
   * Get alerts for a specific asset.
   */
  fastify.get(
    '/valuations/alerts/:assetType/:assetId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { assetType, assetId } = request.params as { assetType: string; assetId: string };

      const alerts = await analyticsService.getAssetAlerts(assetType, assetId);

      return reply.send({
        data: alerts.map(serializeAlert),
        meta: {
          assetType,
          assetId,
          totalAlerts: alerts.length,
        },
      });
    }
  );

  // ==========================================================================
  // DASHBOARD ENDPOINT
  // ==========================================================================

  /**
   * GET /api/v1/analytics/valuations/dashboard
   *
   * Get a combined dashboard view of key valuation analytics metrics.
   */
  fastify.get(
    '/valuations/dashboard',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | string[] | undefined>;
      const filters = parseFilters(query);

      // Fetch all data in parallel
      const [snapshot, alertSummary, impairmentSummary, changeAnalysis] = await Promise.all([
        analyticsService.getPortfolioValueSnapshot(filters),
        analyticsService.getValuationAlerts(filters),
        analyticsService.getImpairmentSummary(filters),
        analyticsService.analyzeValuationChanges(filters),
      ]);

      return reply.send({
        data: {
          portfolioValue: {
            totalValue: snapshot.totalValue,
            currency: snapshot.currency,
            assetCount: snapshot.assetCount,
            valuationCount: snapshot.valuationCount,
            valueByAssetType: snapshot.valueByAssetType,
          },
          alerts: {
            totalAlerts: alertSummary.totalAlerts,
            criticalCount: alertSummary.bySeverity.critical,
            highCount: alertSummary.bySeverity.high,
            overdueCount: alertSummary.overdueAlerts.length,
          },
          impairments: {
            totalEvents: impairmentSummary.totalEvents,
            totalAmount: impairmentSummary.totalImpairmentAmount,
            assetsAtRisk: impairmentSummary.assetsWithIndicators.length,
          },
          changes: {
            totalRevaluations: changeAnalysis.totalRevaluations,
            netValueChange: changeAnalysis.netValueChange,
            netPercentageChange: changeAnalysis.netPercentageChange,
          },
          generatedAt: new Date().toISOString(),
        },
      });
    }
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse query parameters into analytics filters.
 */
function parseFilters(query: Record<string, string | string[] | undefined>): ValuationAnalyticsFilters {
  const filters: ValuationAnalyticsFilters = {};

  if (query.startDate && query.endDate) {
    filters.dateRange = {
      startDate: new Date(query.startDate as string),
      endDate: new Date(query.endDate as string),
    };
  }

  if (query.assetTypes) {
    filters.assetTypes = Array.isArray(query.assetTypes)
      ? query.assetTypes as any[]
      : [query.assetTypes as any];
  }

  if (query.businessUnits) {
    filters.businessUnits = Array.isArray(query.businessUnits)
      ? query.businessUnits
      : [query.businessUnits];
  }

  if (query.methodologies) {
    filters.methodologies = Array.isArray(query.methodologies)
      ? query.methodologies as any[]
      : [query.methodologies as any];
  }

  if (query.purposes) {
    filters.purposes = Array.isArray(query.purposes)
      ? query.purposes as any[]
      : [query.purposes as any];
  }

  if (query.minValue) {
    filters.minValue = parseInt(query.minValue as string, 10);
  }

  if (query.maxValue) {
    filters.maxValue = parseInt(query.maxValue as string, 10);
  }

  if (query.approvedOnly) {
    filters.approvedOnly = query.approvedOnly === 'true';
  }

  if (query.currency) {
    filters.currency = query.currency as string;
  }

  return filters;
}

/**
 * Serialize a valuation change for API response.
 */
function serializeChange(change: {
  valuationId: string;
  valuationNumber: string;
  assetName: string;
  assetType: string;
  previousValue: number;
  currentValue: number;
  absoluteChange: number;
  percentageChange: number;
  previousDate: Date;
  currentDate: Date;
  primaryReason: string;
  methodologyChanged: boolean;
  currency: string;
}) {
  return {
    valuationId: change.valuationId,
    valuationNumber: change.valuationNumber,
    assetName: change.assetName,
    assetType: change.assetType,
    previousValue: change.previousValue,
    currentValue: change.currentValue,
    absoluteChange: change.absoluteChange,
    percentageChange: change.percentageChange,
    previousDate: change.previousDate.toISOString(),
    currentDate: change.currentDate.toISOString(),
    primaryReason: change.primaryReason,
    methodologyChanged: change.methodologyChanged,
    currency: change.currency,
  };
}

/**
 * Serialize an alert for API response.
 */
function serializeAlert(alert: {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  assetName?: string;
  assetType?: string;
  valuationId?: string;
  createdAt: Date;
  dueDate?: Date;
  daysUntilDue?: number;
  acknowledged: boolean;
  recommendedAction?: string;
}) {
  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    description: alert.description,
    assetName: alert.assetName,
    assetType: alert.assetType,
    valuationId: alert.valuationId,
    createdAt: alert.createdAt.toISOString(),
    dueDate: alert.dueDate?.toISOString(),
    daysUntilDue: alert.daysUntilDue,
    acknowledged: alert.acknowledged,
    recommendedAction: alert.recommendedAction,
  };
}

export default valuationAnalyticsRoutes;
