/**
 * Service observability initialization
 *
 * Provides a simple initialization function for services to enable observability.
 *
 * @example
 * ```typescript
 * import { initializeObservability } from '@ecosystem/observability';
 *
 * // At service startup (before any requests)
 * const observability = initializeObservability({
 *   serviceName: 'my-service',
 *   serviceVersion: '1.0.0',
 *   environment: process.env.NODE_ENV || 'development',
 *   tracing: {
 *     enabled: process.env.TRACING_ENABLED === 'true',
 *     endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
 *   },
 *   metrics: {
 *     enabled: process.env.METRICS_ENABLED === 'true',
 *     port: parseInt(process.env.METRICS_PORT || '9464'),
 *   },
 * });
 *
 * // For Hono apps
 * const app = new Hono();
 * app.use('*', observability.honoMiddleware);
 *
 * // For Fastify apps
 * await fastify.register(observability.fastifyPlugin);
 * ```
 */

import { initTracer, shutdownTracer, getTracer } from './tracer.js';
import { initMetrics, shutdownMetrics, getMeter, createHttpMetrics, createBusinessMetrics } from './metrics.js';
import { observabilityFastifyPlugin } from './fastify-plugin.js';
import { createHonoObservability, correlationIdMiddleware, timingMiddleware } from './hono-middleware.js';
import type { ObservabilityConfig } from './types.js';

export interface ObservabilityInstance {
  config: ObservabilityConfig;
  tracer: ReturnType<typeof getTracer>;
  meter: ReturnType<typeof getMeter>;
  httpMetrics: ReturnType<typeof createHttpMetrics>;
  businessMetrics: ReturnType<typeof createBusinessMetrics>;
  honoMiddleware: ReturnType<typeof createHonoObservability>['middleware'];
  fastifyPlugin: typeof observabilityFastifyPlugin;
  fastifyPluginOptions: { config: ObservabilityConfig };
  shutdown: () => Promise<void>;
}

/**
 * Initialize observability for a service
 */
export function initializeObservability(config: ObservabilityConfig): ObservabilityInstance {
  // Initialize tracing
  if (config.tracing?.enabled) {
    initTracer(config);
    console.log(`[Observability] Tracing enabled for ${config.serviceName}`);
  }

  // Initialize metrics
  if (config.metrics?.enabled) {
    initMetrics(config);
    console.log(`[Observability] Metrics enabled on port ${config.metrics.port || 9464}`);
  }

  // Create instances
  const tracer = getTracer(config.serviceName);
  const meter = getMeter(config.serviceName);
  const httpMetrics = createHttpMetrics(meter);
  const businessMetrics = createBusinessMetrics(meter);

  // Create Hono middleware
  const hono = createHonoObservability({ config });

  // Create shutdown function
  const shutdown = async () => {
    console.log(`[Observability] Shutting down for ${config.serviceName}`);
    await shutdownTracer();
    await shutdownMetrics();
  };

  // Register shutdown handlers
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return {
    config,
    tracer,
    meter,
    httpMetrics,
    businessMetrics,
    honoMiddleware: hono.middleware,
    fastifyPlugin: observabilityFastifyPlugin,
    fastifyPluginOptions: { config },
    shutdown,
  };
}

/**
 * Create observability config from environment variables
 */
export function createConfigFromEnv(serviceName: string, serviceVersion?: string): ObservabilityConfig {
  return {
    serviceName,
    serviceVersion: serviceVersion || process.env.SERVICE_VERSION || '0.0.0',
    environment: process.env.NODE_ENV || 'development',
    tracing: {
      enabled: process.env.TRACING_ENABLED === 'true' || process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined,
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    },
    metrics: {
      enabled: process.env.METRICS_ENABLED === 'true',
      port: parseInt(process.env.METRICS_PORT || '9464', 10),
    },
  };
}

// Re-export utilities for manual usage
export { correlationIdMiddleware, timingMiddleware };
