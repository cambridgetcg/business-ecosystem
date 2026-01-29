/**
 * Fastify plugin for observability
 */

import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  createRequestContext,
  runWithContext,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  USER_ID_HEADER,
  TENANT_ID_HEADER,
} from './context.js';
import { getMeter, createHttpMetrics } from './metrics.js';
import type { ObservabilityConfig } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    requestId: string;
  }
}

export interface ObservabilityPluginOptions {
  config: ObservabilityConfig;
}

const observabilityPlugin: FastifyPluginCallback<ObservabilityPluginOptions> = (
  fastify,
  options,
  done
) => {
  const { config } = options;
  const meter = getMeter(config.serviceName);
  const httpMetrics = createHttpMetrics(meter);

  // Add correlation ID to all requests
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const correlationId = 
      (request.headers[CORRELATION_ID_HEADER] as string) || 
      crypto.randomUUID();
    const requestId = crypto.randomUUID();

    request.correlationId = correlationId;
    request.requestId = requestId;

    // Set response headers
    reply.header(CORRELATION_ID_HEADER, correlationId);
    reply.header(REQUEST_ID_HEADER, requestId);

    // Track active requests
    httpMetrics.activeRequests.add(1, {
      method: request.method,
      route: request.routeOptions?.url || 'unknown',
    });
  });

  // Wrap request handling in context
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const ctx = createRequestContext(config.serviceName, {
      correlationId: request.correlationId,
      userId: request.headers[USER_ID_HEADER] as string,
      tenantId: request.headers[TENANT_ID_HEADER] as string,
    });

    // Store context for async operations
    (request as any).__observabilityContext = ctx;
  });

  // Record metrics on response
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = reply.elapsedTime / 1000; // Convert to seconds
    const labels = {
      method: request.method,
      route: request.routeOptions?.url || 'unknown',
      status_code: reply.statusCode.toString(),
    };

    httpMetrics.requestCounter.add(1, labels);
    httpMetrics.requestDuration.record(duration, labels);
    httpMetrics.activeRequests.add(-1, {
      method: request.method,
      route: request.routeOptions?.url || 'unknown',
    });
  });

  // Log errors
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    request.log.error({
      correlationId: request.correlationId,
      requestId: request.requestId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    }, 'Request error');
  });

  done();
};

export const observabilityFastifyPlugin = fp(observabilityPlugin, {
  name: '@ecosystem/observability',
  fastify: '4.x',
});
