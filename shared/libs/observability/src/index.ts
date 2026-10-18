/**
 * @ecosystem/observability
 * Unified observability setup for the business ecosystem
 *
 * Provides:
 * - Distributed tracing with OpenTelemetry
 * - Prometheus metrics
 * - Request context and correlation ID management
 * - Framework plugins for Fastify and Hono
 *
 * @example
 * ```typescript
 * import { initializeObservability, createConfigFromEnv } from '@ecosystem/observability';
 *
 * const config = createConfigFromEnv('my-service');
 * const observability = initializeObservability(config);
 *
 * // Hono
 * app.use('*', observability.honoMiddleware);
 *
 * // Fastify
 * await fastify.register(observability.fastifyPlugin, observability.fastifyPluginOptions);
 * ```
 */

export * from './tracer.js';
export * from './metrics.js';
export * from './context.js';
export * from './fastify-plugin.js';
export * from './hono-middleware.js';
export * from './types.js';
export * from './init.js';

// Re-export commonly used types
export type { ObservabilityConfig, TracingConfig, MetricsConfig, SpanContext } from './types.js';
export type { HttpMetrics, DatabaseMetrics, BusinessMetrics } from './metrics.js';
export type { ObservabilityInstance } from './init.js';
