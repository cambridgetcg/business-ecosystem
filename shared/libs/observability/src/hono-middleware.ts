/**
 * Hono middleware for observability
 *
 * Provides request tracing, metrics, and correlation ID management for Hono-based services.
 */

import { MiddlewareHandler, Context, Next } from 'hono';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import {
  createRequestContext,
  runWithContext,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  USER_ID_HEADER,
  TENANT_ID_HEADER,
} from './context.js';
import { getMeter, createHttpMetrics, type HttpMetrics } from './metrics.js';
import { getTracer } from './tracer.js';
import type { ObservabilityConfig } from './types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface HonoObservabilityOptions {
  config: ObservabilityConfig;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Create observability middleware for Hono applications
 */
export function createHonoObservability(options: HonoObservabilityOptions): {
  middleware: MiddlewareHandler;
  metrics: HttpMetrics;
} {
  const { config } = options;
  const meter = getMeter(config.serviceName);
  const httpMetrics = createHttpMetrics(meter);
  const tracer = getTracer(config.serviceName);

  const middleware: MiddlewareHandler = async (c: Context, next: Next) => {
    const startTime = Date.now();

    // Extract or generate correlation ID
    const correlationId = c.req.header(CORRELATION_ID_HEADER) || crypto.randomUUID();
    const requestId = crypto.randomUUID();

    // Set response headers
    c.header(CORRELATION_ID_HEADER, correlationId);
    c.header(REQUEST_ID_HEADER, requestId);
    c.header('x-service-name', config.serviceName);

    // Create request context
    const ctx = createRequestContext(config.serviceName, {
      correlationId,
      userId: c.req.header(USER_ID_HEADER),
      tenantId: c.req.header(TENANT_ID_HEADER),
    });

    // Store context in Hono context
    c.set('correlationId', correlationId);
    c.set('requestId', requestId);
    c.set('observabilityContext', ctx);

    // Extract route pattern for metrics
    const routePattern = c.req.routePath || c.req.path;
    const method = c.req.method;

    // Track active requests
    httpMetrics.activeRequests.add(1, { method, route: routePattern });

    // Create span for request
    const spanName = `${method} ${routePattern}`;

    try {
      await tracer.startActiveSpan(spanName, async (span) => {
        span.setAttribute('http.method', method);
        span.setAttribute('http.url', c.req.url);
        span.setAttribute('http.route', routePattern);
        span.setAttribute('correlation_id', correlationId);
        span.setAttribute('request_id', requestId);

        if (ctx.userId) span.setAttribute('user_id', ctx.userId);
        if (ctx.tenantId) span.setAttribute('tenant_id', ctx.tenantId);

        try {
          // Run handler within context
          await runWithContext(ctx, async () => {
            await next();
          });

          const statusCode = c.res.status;
          span.setAttribute('http.status_code', statusCode);

          if (statusCode >= 400) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${statusCode}`,
            });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }

          // Record metrics
          const duration = (Date.now() - startTime) / 1000;
          const labels = {
            method,
            route: routePattern,
            status_code: statusCode.toString(),
          };

          httpMetrics.requestCounter.add(1, labels);
          httpMetrics.requestDuration.record(duration, labels);
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        } finally {
          span.end();
          httpMetrics.activeRequests.add(-1, { method, route: routePattern });
        }
      });
    } catch (error) {
      // Record error metrics
      const duration = (Date.now() - startTime) / 1000;
      httpMetrics.requestCounter.add(1, {
        method,
        route: routePattern,
        status_code: '500',
      });
      httpMetrics.requestDuration.record(duration, {
        method,
        route: routePattern,
        status_code: '500',
      });
      throw error;
    }
  };

  return { middleware, metrics: httpMetrics };
}

/**
 * Simple correlation ID middleware without full tracing
 */
export function correlationIdMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const correlationId = c.req.header(CORRELATION_ID_HEADER) || crypto.randomUUID();
    const requestId = crypto.randomUUID();

    c.header(CORRELATION_ID_HEADER, correlationId);
    c.header(REQUEST_ID_HEADER, requestId);
    c.set('correlationId', correlationId);
    c.set('requestId', requestId);

    await next();
  };
}

/**
 * Timing middleware for simple latency tracking
 */
export function timingMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    c.header('x-response-time', `${duration}ms`);
  };
}

// =============================================================================
// CONTEXT HELPERS
// =============================================================================

declare module 'hono' {
  interface ContextVariableMap {
    correlationId: string;
    requestId: string;
    observabilityContext: ReturnType<typeof createRequestContext>;
  }
}

/**
 * Get correlation ID from Hono context
 */
export function getCorrelationIdFromContext(c: Context): string {
  return c.get('correlationId') || 'unknown';
}

/**
 * Get request ID from Hono context
 */
export function getRequestIdFromContext(c: Context): string {
  return c.get('requestId') || 'unknown';
}

/**
 * Create child span for manual tracing within a request handler
 */
export async function withChildSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = trace.getTracer('default');

  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
