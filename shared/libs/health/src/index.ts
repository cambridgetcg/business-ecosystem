/**
 * @ecosystem/health
 * Health check utilities for the business ecosystem
 */

import { Pool } from 'pg';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  components: ComponentHealth[];
}

export interface HealthChecker {
  name: string;
  check: () => Promise<ComponentHealth>;
  critical?: boolean;
}

const healthCheckers: HealthChecker[] = [];

export function registerHealthCheck(checker: HealthChecker): void {
  healthCheckers.push(checker);
}

export function clearHealthChecks(): void {
  healthCheckers.length = 0;
}

export async function runHealthChecks(
  service: string,
  version: string
): Promise<HealthCheckResult> {
  const components: ComponentHealth[] = [];

  for (const checker of healthCheckers) {
    try {
      const result = await Promise.race([
        checker.check(),
        new Promise<ComponentHealth>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        ),
      ]);
      components.push(result);
    } catch (error) {
      components.push({
        name: checker.name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const hasCriticalFailure = components.some(
    (c, i) => c.status === 'unhealthy' && healthCheckers[i]?.critical
  );
  const hasAnyFailure = components.some((c) => c.status === 'unhealthy');
  const hasDegraded = components.some((c) => c.status === 'degraded');

  let status: HealthStatus = 'healthy';
  if (hasCriticalFailure) status = 'unhealthy';
  else if (hasAnyFailure || hasDegraded) status = 'degraded';

  return {
    status,
    service,
    version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    components,
  };
}

export function createPostgresHealthCheck(pool: Pool, name = 'postgres'): HealthChecker {
  return {
    name,
    critical: true,
    check: async (): Promise<ComponentHealth> => {
      const start = Date.now();
      try {
        await pool.query('SELECT 1 as health');
        return {
          name,
          status: 'healthy',
          latencyMs: Date.now() - start,
          details: {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
          },
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Connection failed',
        };
      }
    },
  };
}

export function createRedisHealthCheck(
  redis: { ping: () => Promise<string> },
  name = 'redis'
): HealthChecker {
  return {
    name,
    critical: false,
    check: async (): Promise<ComponentHealth> => {
      const start = Date.now();
      try {
        const result = await redis.ping();
        return {
          name,
          status: result === 'PONG' ? 'healthy' : 'degraded',
          latencyMs: Date.now() - start,
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Connection failed',
        };
      }
    },
  };
}

export function createRabbitMQHealthCheck(
  connection: { isConnected?: () => boolean },
  name = 'rabbitmq'
): HealthChecker {
  return {
    name,
    critical: false,
    check: async (): Promise<ComponentHealth> => {
      const isConnected = connection.isConnected?.() ?? false;
      if (isConnected) {
        return { name, status: 'healthy' };
      }
      return { name, status: 'unhealthy', message: 'Not connected' };
    },
  };
}

export function createMemoryHealthCheck(
  thresholdPercent = 90,
  name = 'memory'
): HealthChecker {
  return {
    name,
    critical: false,
    check: async (): Promise<ComponentHealth> => {
      const usage = process.memoryUsage();
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

      return {
        name,
        status: heapUsedPercent > thresholdPercent ? 'degraded' : 'healthy',
        details: {
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
          heapUsedPercent: Math.round(heapUsedPercent),
          rss: Math.round(usage.rss / 1024 / 1024),
        },
      };
    },
  };
}

export function healthRoutes(
  fastify: any,
  options: { service: string; version: string }
) {
  fastify.get('/health/live', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/health/ready', async () => {
    const result = await runHealthChecks(options.service, options.version);
    return {
      status: result.status === 'unhealthy' ? 'not_ready' : 'ready',
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/health', async () => {
    return runHealthChecks(options.service, options.version);
  });
}
