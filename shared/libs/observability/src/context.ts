/**
 * Request context and correlation ID management
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { trace, context } from '@opentelemetry/api';
import type { SpanContext } from './types.js';

export interface RequestContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  tenantId?: string;
  serviceName: string;
  startTime: number;
  metadata: Record<string, unknown>;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(
  serviceName: string,
  options?: Partial<RequestContext>
): RequestContext {
  return {
    correlationId: options?.correlationId || randomUUID(),
    requestId: randomUUID(),
    userId: options?.userId,
    tenantId: options?.tenantId,
    serviceName,
    startTime: Date.now(),
    metadata: options?.metadata || {},
  };
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

export function getSpanContext(): SpanContext | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;

  const spanContext = span.spanContext();
  const requestContext = getRequestContext();

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    correlationId: requestContext?.correlationId || spanContext.traceId,
  };
}

export function setContextValue(key: string, value: unknown): void {
  const ctx = asyncLocalStorage.getStore();
  if (ctx) {
    ctx.metadata[key] = value;
  }
}

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';
export const USER_ID_HEADER = 'x-user-id';
export const TENANT_ID_HEADER = 'x-tenant-id';
