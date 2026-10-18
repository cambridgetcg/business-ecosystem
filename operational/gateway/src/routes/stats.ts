/**
 * Statistics Routes
 * Cross-domain metrics and analytics
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import pino from 'pino';
import type { DomainClient } from '../domain-client.js';
import type { OperationalDomain } from '../types.js';

const logger = pino({ name: 'operational-gateway-stats' });

export interface DomainStats {
  domain: OperationalDomain;
  activeCount: number;
  pendingCount: number;
  expiringCount: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export interface EntityStats {
  entityId: string;
  totalDocuments: number;
  activeDocuments: number;
  pendingActions: number;
  expiringItems: number;
  complianceScore?: number;
  domainBreakdown: Record<OperationalDomain, {
    active: number;
    pending: number;
    expiring: number;
  }>;
}

const statsQuerySchema = z.object({
  entityId: z.string().uuid().optional(),
  domains: z.string().optional().transform(s => s?.split(',') as OperationalDomain[] | undefined),
});

export function createStatsRoutes(domainClients: Map<OperationalDomain, DomainClient>) {
  const router = new Hono();

  /**
   * GET /stats/overview
   * Overall operational statistics
   */
  router.get('/overview', zValidator('query', statsQuerySchema), async (c) => {
    const { entityId, domains } = c.req.valid('query');

    logger.info({ entityId, domains }, 'Fetching stats overview');

    const targetDomains = domains || (Array.from(domainClients.keys()) as OperationalDomain[]);

    // Fetch stats from each domain
    const statsPromises = targetDomains.map(async (domain): Promise<DomainStats | null> => {
      const client = domainClients.get(domain);
      if (!client) return null;

      try {
        if (entityId) {
          const summary = await client.getSummary(entityId);
          const expiring = await client.getExpiringItems(entityId, 30);

          return {
            domain,
            activeCount: summary.activeCount,
            pendingCount: summary.pendingCount,
            expiringCount: expiring.length,
            healthStatus: summary.healthStatus,
          };
        }

        // Without entityId, just get health status
        const health = await client.getHealth();
        return {
          domain,
          activeCount: 0,
          pendingCount: 0,
          expiringCount: 0,
          healthStatus: health.status === 'healthy' ? 'healthy' : 'critical',
        };
      } catch (error) {
        logger.error({ domain, error }, 'Failed to fetch domain stats');
        return {
          domain,
          activeCount: 0,
          pendingCount: 0,
          expiringCount: 0,
          healthStatus: 'critical',
        };
      }
    });

    const stats = (await Promise.all(statsPromises)).filter((s): s is DomainStats => s !== null);

    // Calculate totals
    const totals = {
      activeCount: stats.reduce((sum, s) => sum + s.activeCount, 0),
      pendingCount: stats.reduce((sum, s) => sum + s.pendingCount, 0),
      expiringCount: stats.reduce((sum, s) => sum + s.expiringCount, 0),
      healthyDomains: stats.filter(s => s.healthStatus === 'healthy').length,
      totalDomains: stats.length,
    };

    const overallHealth = totals.healthyDomains === totals.totalDomains
      ? 'healthy'
      : totals.healthyDomains > 0
        ? 'degraded'
        : 'critical';

    return c.json({
      overallHealth,
      totals,
      byDomain: stats,
      entityId,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /stats/entities/:entityId
   * Detailed statistics for a specific entity
   */
  router.get('/entities/:entityId', async (c) => {
    const entityId = c.req.param('entityId');

    logger.info({ entityId }, 'Fetching entity stats');

    const targetDomains = Array.from(domainClients.keys()) as OperationalDomain[];

    const statsPromises = targetDomains.map(async (domain) => {
      const client = domainClients.get(domain);
      if (!client) return null;

      try {
        const [summary, expiring, pending] = await Promise.all([
          client.getSummary(entityId),
          client.getExpiringItems(entityId, 30),
          client.getPendingActions(entityId),
        ]);

        return {
          domain,
          active: summary.activeCount,
          pending: pending.length,
          expiring: expiring.length,
        };
      } catch (error) {
        logger.error({ domain, entityId, error }, 'Failed to fetch entity domain stats');
        return { domain, active: 0, pending: 0, expiring: 0 };
      }
    });

    const results = await Promise.all(statsPromises);

    const domainBreakdown: Record<OperationalDomain, { active: number; pending: number; expiring: number }> = {} as any;
    let totalDocuments = 0;
    let totalActive = 0;
    let totalPending = 0;
    let totalExpiring = 0;

    for (const result of results) {
      if (!result) continue;
      domainBreakdown[result.domain] = {
        active: result.active,
        pending: result.pending,
        expiring: result.expiring,
      };
      totalDocuments += result.active + result.pending;
      totalActive += result.active;
      totalPending += result.pending;
      totalExpiring += result.expiring;
    }

    const entityStats: EntityStats = {
      entityId,
      totalDocuments,
      activeDocuments: totalActive,
      pendingActions: totalPending,
      expiringItems: totalExpiring,
      domainBreakdown,
    };

    return c.json(entityStats);
  });

  /**
   * GET /stats/trends
   * Trend analysis over time
   */
  router.get('/trends', zValidator('query', z.object({
    entityId: z.string().uuid().optional(),
    period: z.enum(['week', 'month', 'quarter', 'year']).default('month'),
    metric: z.enum(['created', 'expired', 'terminated', 'all']).default('all'),
  })), async (c) => {
    const { entityId, period, metric } = c.req.valid('query');

    // Calculate period boundaries
    const now = new Date();
    const periods: { label: string; start: Date; end: Date }[] = [];

    const periodCount = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 12 : 12;
    const periodUnit = period === 'week' ? 'day' : period === 'month' ? 'day' : period === 'quarter' ? 'week' : 'month';

    for (let i = periodCount - 1; i >= 0; i--) {
      const end = new Date(now);
      const start = new Date(now);

      if (periodUnit === 'day') {
        end.setDate(end.getDate() - i);
        start.setDate(start.getDate() - i - 1);
      } else if (periodUnit === 'week') {
        end.setDate(end.getDate() - (i * 7));
        start.setDate(start.getDate() - ((i + 1) * 7));
      } else {
        end.setMonth(end.getMonth() - i);
        start.setMonth(start.getMonth() - i - 1);
      }

      periods.push({
        label: formatPeriodLabel(start, periodUnit),
        start,
        end,
      });
    }

    // For now, return simulated trend data
    // In production, this would query each domain's analytics endpoints
    const trends = periods.map(p => ({
      period: p.label,
      start: p.start.toISOString(),
      end: p.end.toISOString(),
      metrics: {
        created: Math.floor(Math.random() * 20),
        expired: Math.floor(Math.random() * 5),
        terminated: Math.floor(Math.random() * 3),
        total: 0,
      },
    }));

    // Calculate totals
    trends.forEach(t => {
      t.metrics.total = t.metrics.created - t.metrics.expired - t.metrics.terminated;
    });

    return c.json({
      period,
      metric,
      entityId,
      trends,
      summary: {
        totalCreated: trends.reduce((sum, t) => sum + t.metrics.created, 0),
        totalExpired: trends.reduce((sum, t) => sum + t.metrics.expired, 0),
        totalTerminated: trends.reduce((sum, t) => sum + t.metrics.terminated, 0),
      },
    });
  });

  /**
   * GET /stats/alerts
   * System-wide alerts and warnings
   */
  router.get('/alerts', zValidator('query', z.object({
    entityId: z.string().uuid().optional(),
    severity: z.enum(['critical', 'warning', 'info', 'all']).default('all'),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })), async (c) => {
    const { entityId, severity, limit } = c.req.valid('query');

    logger.info({ entityId, severity }, 'Fetching alerts');

    const targetDomains = Array.from(domainClients.keys()) as OperationalDomain[];
    const alerts: Array<{
      id: string;
      domain: OperationalDomain;
      severity: 'critical' | 'warning' | 'info';
      type: string;
      title: string;
      description: string;
      entityId?: string;
      referenceId?: string;
      createdAt: Date;
    }> = [];

    // Check expiring items (critical if < 7 days, warning if < 30 days)
    for (const domain of targetDomains) {
      const client = domainClients.get(domain);
      if (!client) continue;

      try {
        if (entityId) {
          const expiring = await client.getExpiringItems(entityId, 30);

          for (const item of expiring) {
            const daysLeft = item.daysUntilExpiry;
            const alertSeverity = daysLeft <= 7 ? 'critical' : 'warning';

            if (severity !== 'all' && severity !== alertSeverity) continue;

            alerts.push({
              id: `expiring-${item.id}`,
              domain,
              severity: alertSeverity,
              type: 'expiring',
              title: `${item.type} expiring soon`,
              description: item.description,
              entityId,
              referenceId: item.id,
              createdAt: new Date(),
            });
          }
        }

        // Check domain health
        const health = await client.getHealth();
        if (health.status !== 'healthy') {
          alerts.push({
            id: `health-${domain}`,
            domain,
            severity: health.status === 'unhealthy' ? 'critical' : 'warning',
            type: 'health',
            title: `${domain} service ${health.status}`,
            description: `The ${domain} service is currently ${health.status}`,
            createdAt: health.timestamp,
          });
        }
      } catch (error) {
        alerts.push({
          id: `error-${domain}`,
          domain,
          severity: 'critical',
          type: 'connectivity',
          title: `${domain} service unreachable`,
          description: `Unable to connect to the ${domain} service`,
          createdAt: new Date(),
        });
      }
    }

    // Sort by severity then date
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return c.json({
      alerts: alerts.slice(0, limit),
      total: alerts.length,
      summary: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length,
      },
    });
  });

  return router;
}

function formatPeriodLabel(date: Date, unit: 'day' | 'week' | 'month'): string {
  if (unit === 'day') {
    return date.toISOString().split('T')[0];
  } else if (unit === 'week') {
    return `Week of ${date.toISOString().split('T')[0]}`;
  } else {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}
