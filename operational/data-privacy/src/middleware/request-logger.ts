/**
 * Request Logging Middleware
 * Provides structured logging with request correlation
 */

import type { Context, Next } from 'hono';
import { randomUUID } from 'crypto';
import { logger, createRequestLogger, perfLogger, securityLogger } from '../lib/logger.js';

const REQUEST_ID_HEADER = 'X-Request-Id';
const CORRELATION_ID_HEADER = 'X-Correlation-Id';

/**
 * Request logging middleware
 * Adds request ID, logs request/response, and tracks timing
 */
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();

    // Get or generate request ID
    const requestId = c.req.header(REQUEST_ID_HEADER) || randomUUID();
    const correlationId = c.req.header(CORRELATION_ID_HEADER) || requestId;

    // Create request-scoped logger
    const reqLogger = createRequestLogger(requestId);

    // Store in context for use in handlers
    c.set('requestId', requestId);
    c.set('correlationId', correlationId);
    c.set('logger', reqLogger);

    // Add request ID to response headers
    c.header(REQUEST_ID_HEADER, requestId);
    c.header(CORRELATION_ID_HEADER, correlationId);

    // Log incoming request
    reqLogger.info({
      type: 'request_start',
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      ip: getClientIP(c),
      userAgent: c.req.header('user-agent'),
    }, `${c.req.method} ${c.req.path}`);

    try {
      await next();
    } catch (error) {
      // Log error
      reqLogger.error({
        type: 'request_error',
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack,
        } : error,
      }, 'Request error');
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      const status = c.res.status;

      // Log request completion
      reqLogger.info({
        type: 'request_complete',
        method: c.req.method,
        path: c.req.path,
        status,
        duration,
      }, `${c.req.method} ${c.req.path} ${status} ${duration}ms`);

      // Log slow requests
      if (duration > 1000) {
        perfLogger.warn({
          requestId,
          method: c.req.method,
          path: c.req.path,
          duration,
          threshold: 1000,
        }, `Slow request: ${c.req.path} took ${duration}ms`);
      }

      // Log 4xx/5xx responses
      if (status >= 400) {
        const logLevel = status >= 500 ? 'error' : 'warn';
        securityLogger[logLevel]({
          requestId,
          method: c.req.method,
          path: c.req.path,
          status,
          ip: getClientIP(c),
        }, `HTTP ${status}: ${c.req.method} ${c.req.path}`);
      }
    }
  };
}

/**
 * Get client IP address from request
 */
function getClientIP(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
         c.req.header('x-real-ip') ||
         c.req.header('cf-connecting-ip') ||
         'unknown';
}

/**
 * Middleware to track API metrics
 */
export function metricsCollector() {
  // In-memory metrics (would use Prometheus/CloudWatch in production)
  const metrics = {
    requests: new Map<string, number>(),
    latencies: new Map<string, number[]>(),
    errors: new Map<string, number>(),
  };

  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const key = `${c.req.method}:${c.req.path.split('/').slice(0, 4).join('/')}`;

    try {
      await next();
    } finally {
      const duration = Date.now() - startTime;
      const status = c.res.status;

      // Track request count
      metrics.requests.set(key, (metrics.requests.get(key) || 0) + 1);

      // Track latencies (keep last 100)
      const latencies = metrics.latencies.get(key) || [];
      latencies.push(duration);
      if (latencies.length > 100) latencies.shift();
      metrics.latencies.set(key, latencies);

      // Track errors
      if (status >= 400) {
        const errorKey = `${key}:${status}`;
        metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);
      }
    }

    // Expose metrics getter
    c.set('getMetrics', () => {
      const summary: Record<string, any> = {};
      for (const [key, count] of metrics.requests) {
        const latencies = metrics.latencies.get(key) || [];
        summary[key] = {
          count,
          avgLatency: latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0,
          p95Latency: latencies.length > 0
            ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
            : 0,
        };
      }
      return summary;
    });
  };
}
