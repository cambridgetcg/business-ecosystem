/**
 * Timeline Routes
 * Unified activity timeline across all operational domains
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import pino from 'pino';
import type { DomainClient } from '../domain-client.js';
import type { OperationalDomain } from '../types.js';

const logger = pino({ name: 'operational-gateway-timeline' });

export interface TimelineEvent {
  id: string;
  domain: OperationalDomain;
  type: string;
  action: string;
  title: string;
  description?: string;
  entityId: string;
  referenceId: string;
  referenceType: string;
  actor?: {
    id: string;
    name?: string;
    email?: string;
  };
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const timelineQuerySchema = z.object({
  entityId: z.string().uuid().optional(),
  domains: z.string().optional().transform(s => s?.split(',') as OperationalDomain[] | undefined),
  types: z.string().optional().transform(s => s?.split(',')),
  actions: z.string().optional().transform(s => s?.split(',')),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createTimelineRoutes(domainClients: Map<OperationalDomain, DomainClient>) {
  const router = new Hono();

  /**
   * GET /timeline
   * Unified activity timeline across domains
   */
  router.get('/', zValidator('query', timelineQuerySchema), async (c) => {
    const query = c.req.valid('query');
    const { entityId, domains, types, actions, dateFrom, dateTo, limit, offset } = query;

    logger.info({ entityId, domains }, 'Fetching timeline');

    const targetDomains = domains || (Array.from(domainClients.keys()) as OperationalDomain[]);

    // Fetch activity from each domain in parallel
    const timelinePromises = targetDomains.map(async (domain) => {
      const client = domainClients.get(domain);
      if (!client) return [];

      try {
        // This would call an activity/timeline endpoint on each service
        // For now, simulate with recent activity from summary
        if (!entityId) return [];

        const summary = await client.getSummary(entityId);
        return summary.recentActivity.map((activity, idx) => ({
          id: `${domain}-${entityId}-${idx}`,
          domain,
          type: activity.type,
          action: 'update',
          title: activity.description,
          entityId,
          referenceId: activity.reference || '',
          referenceType: activity.type,
          timestamp: activity.timestamp,
        }));
      } catch (error) {
        logger.error({ domain, error }, 'Failed to fetch timeline for domain');
        return [];
      }
    });

    let events = (await Promise.all(timelinePromises)).flat() as TimelineEvent[];

    // Apply filters
    if (types && types.length > 0) {
      events = events.filter(e => types.includes(e.type));
    }
    if (actions && actions.length > 0) {
      events = events.filter(e => actions.includes(e.action));
    }
    if (dateFrom) {
      events = events.filter(e => new Date(e.timestamp) >= new Date(dateFrom));
    }
    if (dateTo) {
      events = events.filter(e => new Date(e.timestamp) <= new Date(dateTo));
    }

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const paginatedEvents = events.slice(offset, offset + limit);

    return c.json({
      events: paginatedEvents,
      total: events.length,
      limit,
      offset,
      domains: targetDomains,
    });
  });

  /**
   * GET /timeline/entities/:entityId
   * Activity timeline for a specific entity
   */
  router.get('/entities/:entityId', zValidator('query', z.object({
    domains: z.string().optional().transform(s => s?.split(',') as OperationalDomain[] | undefined),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })), async (c) => {
    const entityId = c.req.param('entityId');
    const { domains, limit, offset } = c.req.valid('query');

    const targetDomains = domains || (Array.from(domainClients.keys()) as OperationalDomain[]);

    const timelinePromises = targetDomains.map(async (domain) => {
      const client = domainClients.get(domain);
      if (!client) return [];

      try {
        const summary = await client.getSummary(entityId);
        return summary.recentActivity.map((activity, idx) => ({
          id: `${domain}-${entityId}-${idx}`,
          domain,
          type: activity.type,
          action: 'update',
          title: activity.description,
          entityId,
          referenceId: activity.reference || '',
          referenceType: activity.type,
          timestamp: activity.timestamp,
        }));
      } catch (error) {
        logger.error({ domain, entityId, error }, 'Failed to fetch entity timeline');
        return [];
      }
    });

    const events = (await Promise.all(timelinePromises)).flat() as TimelineEvent[];
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const paginatedEvents = events.slice(offset, offset + limit);

    return c.json({
      entityId,
      events: paginatedEvents,
      total: events.length,
      limit,
      offset,
    });
  });

  /**
   * GET /timeline/summary
   * Timeline summary/statistics
   */
  router.get('/summary', zValidator('query', z.object({
    entityId: z.string().uuid().optional(),
    days: z.coerce.number().int().min(1).max(365).default(30),
  })), async (c) => {
    const { entityId, days } = c.req.valid('query');

    const targetDomains = Array.from(domainClients.keys()) as OperationalDomain[];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Aggregate activity counts by domain and type
    const summary: Record<OperationalDomain, { total: number; byType: Record<string, number> }> = {} as any;

    for (const domain of targetDomains) {
      const client = domainClients.get(domain);
      if (!client) continue;

      try {
        if (entityId) {
          const domainSummary = await client.getSummary(entityId);
          const recentActivity = domainSummary.recentActivity.filter(
            a => new Date(a.timestamp) >= cutoffDate
          );

          const byType: Record<string, number> = {};
          for (const activity of recentActivity) {
            byType[activity.type] = (byType[activity.type] || 0) + 1;
          }

          summary[domain] = {
            total: recentActivity.length,
            byType,
          };
        } else {
          summary[domain] = { total: 0, byType: {} };
        }
      } catch (error) {
        summary[domain] = { total: 0, byType: {} };
      }
    }

    const totalActivity = Object.values(summary).reduce((sum, s) => sum + s.total, 0);

    return c.json({
      period: {
        days,
        from: cutoffDate.toISOString(),
        to: new Date().toISOString(),
      },
      totalActivity,
      byDomain: summary,
      entityId,
    });
  });

  return router;
}
