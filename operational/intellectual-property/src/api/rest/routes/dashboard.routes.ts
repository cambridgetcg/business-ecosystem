/**
 * Dashboard Routes
 *
 * REST API endpoints for portfolio health dashboard data aggregation.
 * Provides summary statistics, deadline tracking, compliance status,
 * enforcement overview, valuations summary, and activity feeds.
 *
 * @module api/rest/routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createDashboardService } from '../../../application/services/dashboard.service.js';
import { createComplianceDashboardService } from '../../../application/services/compliance-dashboard.service.js';

// ============================================================================
// Response Schemas for Swagger Documentation
// ============================================================================

const assetCountByStatusSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    count: { type: 'integer' },
  },
};

const assetSummarySchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['patent', 'trademark', 'copyright', 'trade_secret', 'license', 'domain'] },
    total: { type: 'integer' },
    byStatus: { type: 'array', items: assetCountByStatusSchema },
  },
};

const portfolioSummaryResponseSchema = {
  type: 'object',
  properties: {
    assets: { type: 'array', items: assetSummarySchema },
    totalAssets: { type: 'integer' },
    totalValuation: { type: 'integer', nullable: true },
    valuationCurrency: { type: 'string' },
    lastUpdated: { type: 'string', format: 'date-time' },
  },
};

const upcomingDeadlineSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    assetId: { type: 'string' },
    assetType: { type: 'string' },
    deadlineType: { type: 'string' },
    dueDate: { type: 'string', format: 'date-time' },
    priority: { type: 'string' },
    description: { type: 'string' },
  },
};

const deadlinesDashboardResponseSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'object',
      properties: {
        overdue: { type: 'integer' },
        dueThisWeek: { type: 'integer' },
        dueThisMonth: { type: 'integer' },
        total: { type: 'integer' },
      },
    },
    byAssetType: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          assetType: { type: 'string' },
          overdue: { type: 'integer' },
          dueThisWeek: { type: 'integer' },
          dueThisMonth: { type: 'integer' },
        },
      },
    },
    byPriority: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'string' },
          count: { type: 'integer' },
        },
      },
    },
    upcoming: { type: 'array', items: upcomingDeadlineSchema },
  },
};

const complianceStatusSchema = {
  type: 'object',
  properties: {
    compliant: { type: 'integer' },
    dueSoon: { type: 'integer' },
    overdue: { type: 'integer' },
  },
};

const complianceDashboardResponseSchema = {
  type: 'object',
  properties: {
    trademarkCompliance: {
      type: 'object',
      properties: {
        section8: complianceStatusSchema,
        section9: complianceStatusSchema,
        section15: complianceStatusSchema,
      },
    },
    patentMaintenance: {
      type: 'object',
      properties: {
        paid: { type: 'integer' },
        upcoming: { type: 'integer' },
        gracePeriod: { type: 'integer' },
        overdue: { type: 'integer' },
      },
    },
    domainRenewals: {
      type: 'object',
      properties: {
        current: { type: 'integer' },
        expiringThisMonth: { type: 'integer' },
        expiringThisQuarter: { type: 'integer' },
        expired: { type: 'integer' },
      },
    },
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
  },
};

const enforcementDashboardResponseSchema = {
  type: 'object',
  properties: {
    activeMatters: { type: 'integer' },
    totalMatters: { type: 'integer' },
    byStatus: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          count: { type: 'integer' },
        },
      },
    },
    byPriority: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'string' },
          count: { type: 'integer' },
        },
      },
    },
    recentActivity: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          matterId: { type: 'string' },
          matterNumber: { type: 'string', nullable: true },
          title: { type: 'string' },
          activityType: { type: 'string' },
          activityDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
        },
      },
    },
    totalEstimatedDamages: { type: 'integer' },
    totalSettlements: { type: 'integer' },
  },
};

const valuationsDashboardResponseSchema = {
  type: 'object',
  properties: {
    totalPortfolioValue: { type: 'integer' },
    currency: { type: 'string' },
    byAssetType: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          assetType: { type: 'string' },
          totalValue: { type: 'integer' },
          count: { type: 'integer' },
        },
      },
    },
    recentValuations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          valuationNumber: { type: 'string', nullable: true },
          title: { type: 'string' },
          status: { type: 'string' },
          selectedValue: { type: 'integer', nullable: true },
          currency: { type: 'string' },
          approvedDate: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
    pendingCount: { type: 'integer' },
    approvedCount: { type: 'integer' },
  },
};

const activityDashboardResponseSchema = {
  type: 'object',
  properties: {
    recentEvents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          action: { type: 'string' },
          actorId: { type: 'string' },
          occurredAt: { type: 'string', format: 'date-time' },
          metadata: { type: 'object' },
        },
      },
    },
    byType: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          count: { type: 'integer' },
        },
      },
    },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          count: { type: 'integer' },
        },
      },
    },
    totalEventsLast30Days: { type: 'integer' },
  },
};

// ============================================================================
// Routes
// ============================================================================

export async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  const getDashboardService = () => createDashboardService((fastify as any).db);
  const getComplianceDashboardService = () => createComplianceDashboardService((fastify as any).db);

  /**
   * GET /api/v1/dashboard/summary
   * Get portfolio summary with counts by asset type and status.
   */
  fastify.get(
    '/summary',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get portfolio summary',
        description: 'Returns total counts by asset type (patents, trademarks, copyrights, trade secrets, licenses, domains), counts by status for each type, and total portfolio valuation.',
        response: {
          200: portfolioSummaryResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getDashboardService();
      const summary = await service.getPortfolioSummary();

      return reply.send({
        assets: summary.assets,
        totalAssets: summary.totalAssets,
        totalValuation: summary.totalValuation,
        valuationCurrency: summary.valuationCurrency,
        lastUpdated: summary.lastUpdated.toISOString(),
      });
    }
  );

  /**
   * GET /api/v1/dashboard/deadlines
   * Get deadlines summary with overdue, upcoming, and breakdown by type/priority.
   */
  fastify.get(
    '/deadlines',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get deadlines summary',
        description: 'Returns deadlines summary including overdue count, due this week, due this month, breakdown by asset type and priority, and list of next 10 upcoming deadlines.',
        response: {
          200: deadlinesDashboardResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getDashboardService();
      const dashboard = await service.getDeadlinesDashboard();

      return reply.send({
        summary: dashboard.summary,
        byAssetType: dashboard.byAssetType,
        byPriority: dashboard.byPriority,
        upcoming: dashboard.upcoming.map((d) => ({
          ...d,
          dueDate: d.dueDate.toISOString(),
        })),
      });
    }
  );

  /**
   * GET /api/v1/dashboard/compliance
   * Get compliance status for trademarks, patents, and domains.
   */
  fastify.get(
    '/compliance',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get compliance status',
        description: 'Returns trademark Section 8/9/15 status, patent maintenance fee status, domain renewal status, and overall compliance score.',
        response: {
          200: complianceDashboardResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getDashboardService();
      const compliance = await service.getComplianceDashboard();

      return reply.send(compliance);
    }
  );

  /**
   * GET /api/v1/dashboard/compliance/detailed
   * Get comprehensive compliance dashboard data for all IP types.
   */
  fastify.get(
    '/compliance/detailed',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get detailed compliance dashboard',
        description: 'Returns comprehensive compliance status for all IP types including trademarks (Section 8/9/15, Madrid), patents (maintenance fees by window), domains (expiration, disputes), and copyrights (registration, renewal, duration tracking).',
        response: {
          200: {
            type: 'object',
            properties: {
              trademark: { type: 'object' },
              patent: { type: 'object' },
              domain: { type: 'object' },
              copyright: { type: 'object' },
              overall: { type: 'object' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getComplianceDashboardService();
      const dashboard = await service.getComplianceDashboard();

      return reply.send(dashboard);
    }
  );

  /**
   * GET /api/v1/dashboard/compliance/trademark
   * Get detailed trademark compliance status.
   */
  fastify.get(
    '/compliance/trademark',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get trademark compliance status',
        description: 'Returns detailed trademark compliance including Section 8, Section 9, Section 15 status, Madrid Protocol status, upcoming deadlines, and compliance score.',
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getComplianceDashboardService();
      const status = await service.getTrademarkComplianceStatus();

      return reply.send(status);
    }
  );

  /**
   * GET /api/v1/dashboard/compliance/patent
   * Get detailed patent maintenance fee compliance status.
   */
  fastify.get(
    '/compliance/patent',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get patent compliance status',
        description: 'Returns detailed patent maintenance fee status by window (3.5yr, 7.5yr, 11.5yr), grace period tracking, upcoming fees, and compliance score.',
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getComplianceDashboardService();
      const status = await service.getPatentComplianceStatus();

      return reply.send(status);
    }
  );

  /**
   * GET /api/v1/dashboard/compliance/domain
   * Get detailed domain compliance status.
   */
  fastify.get(
    '/compliance/domain',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get domain compliance status',
        description: 'Returns detailed domain status including expiration tracking, UDRP dispute status, registrar distribution, auto-renewal status, and compliance score.',
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getComplianceDashboardService();
      const status = await service.getDomainComplianceStatus();

      return reply.send(status);
    }
  );

  /**
   * GET /api/v1/dashboard/compliance/copyright
   * Get detailed copyright compliance status.
   */
  fastify.get(
    '/compliance/copyright',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get copyright compliance status',
        description: 'Returns detailed copyright status including registration rate, renewal requirements (pre-1978 works), duration tracking, and compliance score.',
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getComplianceDashboardService();
      const status = await service.getCopyrightComplianceStatus();

      return reply.send(status);
    }
  );

  /**
   * GET /api/v1/dashboard/enforcement
   * Get enforcement matters overview.
   */
  fastify.get(
    '/enforcement',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get enforcement summary',
        description: 'Returns active enforcement matters count, matters by status and priority, recent activity (last 30 days), and financial totals.',
        response: {
          200: enforcementDashboardResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getDashboardService();
      const enforcement = await service.getEnforcementDashboard();

      return reply.send({
        activeMatters: enforcement.activeMatters,
        totalMatters: enforcement.totalMatters,
        byStatus: enforcement.byStatus,
        byPriority: enforcement.byPriority,
        recentActivity: enforcement.recentActivity.map((a) => ({
          ...a,
          activityDate: a.activityDate.toISOString(),
        })),
        totalEstimatedDamages: enforcement.totalEstimatedDamages,
        totalSettlements: enforcement.totalSettlements,
      });
    }
  );

  /**
   * GET /api/v1/dashboard/valuations
   * Get valuations summary.
   */
  fastify.get(
    '/valuations',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get valuations summary',
        description: 'Returns total portfolio value (sum of approved valuations), value by asset type, recent valuations, and pending valuations count.',
        response: {
          200: valuationsDashboardResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getDashboardService();
      const valuations = await service.getValuationsDashboard();

      return reply.send({
        totalPortfolioValue: valuations.totalPortfolioValue,
        currency: valuations.currency,
        byAssetType: valuations.byAssetType,
        recentValuations: valuations.recentValuations.map((v) => ({
          ...v,
          approvedDate: v.approvedDate?.toISOString() ?? null,
        })),
        pendingCount: valuations.pendingCount,
        approvedCount: valuations.approvedCount,
      });
    }
  );

  /**
   * GET /api/v1/dashboard/activity
   * Get recent activity feed.
   */
  fastify.get(
    '/activity',
    {
      schema: {
        tags: ['dashboard'],
        summary: 'Get activity feed',
        description: 'Returns recent events (last 30 days), activity by type, and activity timeline data.',
        response: {
          200: activityDashboardResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const service = getDashboardService();
      const activity = await service.getActivityDashboard();

      return reply.send({
        recentEvents: activity.recentEvents.map((e) => ({
          ...e,
          occurredAt: e.occurredAt.toISOString(),
        })),
        byType: activity.byType,
        timeline: activity.timeline,
        totalEventsLast30Days: activity.totalEventsLast30Days,
      });
    }
  );
}

export default dashboardRoutes;
