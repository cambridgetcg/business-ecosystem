/**
 * Health Check Routes
 * Pattern: @ecosystem/health library integration
 */

import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import type { CacheService } from '../../../infrastructure/cache/index.js';

export interface HealthRoutesOptions {
  pool: Pool;
  cache: CacheService;
}

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, opts) => {
  const { pool, cache } = opts;

  // Liveness probe - just confirms the process is running
  app.get('/health/live', {
    schema: {
      tags: ['health'],
      summary: 'Liveness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  // Readiness probe - checks dependencies
  app.get('/health/ready', {
    schema: {
      tags: ['health'],
      summary: 'Readiness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Check database connectivity
    try {
      await pool.query('SELECT 1');
    } catch {
      reply.status(503);
      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  });

  // Detailed health check
  app.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Detailed health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            uptime: { type: 'number' },
            components: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  status: { type: 'string' },
                  latencyMs: { type: 'number' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const components: ComponentHealth[] = [];

    // Check PostgreSQL
    const pgStart = Date.now();
    try {
      await pool.query('SELECT 1 as health');
      components.push({
        name: 'postgres',
        status: 'healthy',
        latencyMs: Date.now() - pgStart,
        details: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
      });
    } catch (error) {
      components.push({
        name: 'postgres',
        status: 'unhealthy',
        latencyMs: Date.now() - pgStart,
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    }

    // Check Redis/Cache
    const cacheStart = Date.now();
    try {
      const pong = await cache.ping();
      components.push({
        name: 'cache',
        status: pong ? 'healthy' : 'degraded',
        latencyMs: Date.now() - cacheStart,
        details: {
          connected: cache.isConnected(),
          type: process.env.REDIS_URL ? 'redis' : 'memory',
        },
      });
    } catch (error) {
      components.push({
        name: 'cache',
        status: 'unhealthy',
        latencyMs: Date.now() - cacheStart,
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    }

    // Check memory
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    components.push({
      name: 'memory',
      status: heapUsedPercent > 90 ? 'degraded' : 'healthy',
      details: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsedPercent: Math.round(heapUsedPercent),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
    });

    // Determine overall status
    const hasCriticalFailure = components.some(
      (c) => c.status === 'unhealthy' && (c.name === 'postgres')
    );
    const hasAnyFailure = components.some((c) => c.status === 'unhealthy');
    const hasDegraded = components.some((c) => c.status === 'degraded');

    let status: HealthStatus = 'healthy';
    if (hasCriticalFailure) status = 'unhealthy';
    else if (hasAnyFailure || hasDegraded) status = 'degraded';

    return {
      status,
      service: 'intellectual-property',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: process.uptime(),
      components,
    };
  });

  // Service info
  app.get('/', {
    schema: {
      tags: ['health'],
      summary: 'Service info',
    },
  }, async () => {
    return {
      service: 'intellectual-property',
      version: '0.1.0',
      description: 'IP portfolio management - patents, trademarks, copyrights',
      domains: [
        'patents',
        'trademarks',
        'copyrights',
        'trade-secrets',
        'ip-licensing',
        'ip-enforcement',
        'domain-names',
        'ip-strategy',
      ],
    };
  });
};
