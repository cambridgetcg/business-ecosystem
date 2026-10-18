/**
 * Request Logging Middleware
 *
 * Structured logging for all gateway requests with:
 * - Request/response timing
 * - Correlation ID tracking
 * - User context
 * - Service routing information
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';

const logger = pino({ name: 'gateway-requests' });

export interface RequestLogContext {
  correlationId: string;
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  userId?: string;
  tenantId?: string;
  service?: string;
  startTime: number;
}

/**
 * Log incoming request
 */
export function logRequest(request: FastifyRequest, serviceName?: string): RequestLogContext {
  const context: RequestLogContext = {
    correlationId: (request as any).correlationId || request.id,
    requestId: request.id,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    userId: (request as any).user?.sub,
    tenantId: (request as any).user?.tenantId,
    service: serviceName,
    startTime: Date.now(),
  };

  logger.info(
    {
      type: 'request',
      ...context,
      headers: {
        'content-type': request.headers['content-type'],
        'content-length': request.headers['content-length'],
      },
    },
    `→ ${request.method} ${request.url}`
  );

  return context;
}

/**
 * Log response
 */
export function logResponse(
  context: RequestLogContext,
  reply: FastifyReply,
  error?: Error
): void {
  const duration = Date.now() - context.startTime;
  const statusCode = reply.statusCode;

  const logData = {
    type: 'response',
    correlationId: context.correlationId,
    requestId: context.requestId,
    method: context.method,
    url: context.url,
    service: context.service,
    statusCode,
    duration,
    userId: context.userId,
    tenantId: context.tenantId,
  };

  if (error) {
    logger.error(
      { ...logData, error: error.message, stack: error.stack },
      `← ${context.method} ${context.url} ${statusCode} (${duration}ms) ERROR`
    );
  } else if (statusCode >= 500) {
    logger.error(logData, `← ${context.method} ${context.url} ${statusCode} (${duration}ms)`);
  } else if (statusCode >= 400) {
    logger.warn(logData, `← ${context.method} ${context.url} ${statusCode} (${duration}ms)`);
  } else {
    logger.info(logData, `← ${context.method} ${context.url} ${statusCode} (${duration}ms)`);
  }
}

/**
 * Create request logging hooks
 */
export function createRequestLoggingHooks() {
  const contextMap = new WeakMap<FastifyRequest, RequestLogContext>();

  return {
    onRequest: (request: FastifyRequest) => {
      const context = logRequest(request);
      contextMap.set(request, context);
    },

    onResponse: (request: FastifyRequest, reply: FastifyReply) => {
      const context = contextMap.get(request);
      if (context) {
        logResponse(context, reply);
        contextMap.delete(request);
      }
    },

    onError: (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const context = contextMap.get(request);
      if (context) {
        logResponse(context, reply, error);
        contextMap.delete(request);
      }
    },
  };
}
