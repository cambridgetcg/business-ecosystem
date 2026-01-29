/**
 * Request Context Middleware
 *
 * Provides request-scoped context including:
 * - User/tenant identification
 * - Request tracing
 * - DI child container
 *
 * @module api/rest/middleware
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { createChildContainer } from '../../../core/di/index.js';

/**
 * Container interface for request scope.
 */
interface ScopedContainer {
  resolve<T>(token: symbol): T;
}

/**
 * Request context containing scoped dependencies.
 */
export interface RequestContext {
  /** Unique request ID for tracing */
  requestId: string;
  /** Tenant/organization ID from auth */
  tenantId?: string | undefined;
  /** User ID from auth */
  userId?: string | undefined;
  /** Request timestamp */
  timestamp: Date;
  /** Scoped DI container */
  container: ScopedContainer;
  /** Correlation ID for distributed tracing */
  correlationId?: string | undefined;
}

// Extend FastifyRequest to include context
declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext;
  }
}

/**
 * Create request context.
 */
function createRequestContext(request: FastifyRequest): RequestContext {
  // Extract headers
  const correlationId = request.headers['x-correlation-id'] as string | undefined;
  const tenantId = request.headers['x-tenant-id'] as string | undefined;
  const userId = request.headers['x-user-id'] as string | undefined;

  // Create child container for request-scoped dependencies
  const container = createChildContainer();

  return {
    requestId: request.id,
    tenantId,
    userId,
    timestamp: new Date(),
    container,
    correlationId: correlationId ?? request.id,
  };
}

/**
 * Register context middleware with Fastify.
 */
export async function registerContextMiddleware(app: FastifyInstance): Promise<void> {
  // Add context to every request
  app.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.ctx = createRequestContext(request);
  });

  // Add correlation ID to response headers
  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, _payload) => {
    reply.header('x-request-id', request.id);
    if (request.ctx?.correlationId) {
      reply.header('x-correlation-id', request.ctx.correlationId);
    }
  });
}

/**
 * Get context from request.
 */
export function getContext(request: FastifyRequest): RequestContext {
  return request.ctx;
}

/**
 * Resolve a dependency from request context.
 */
export function resolveFromContext<T>(request: FastifyRequest, token: symbol): T {
  return request.ctx.container.resolve<T>(token);
}
