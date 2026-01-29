/**
 * Audit Logging Middleware
 */

import { Context, MiddlewareHandler, Next } from 'hono';
import { nanoid } from 'nanoid';
import { logger, logAudit, AuditLogEntry } from '../lib/logger.js';

export type AuditEventType =
  | 'API_REQUEST' | 'CONTRACT_CREATED' | 'CONTRACT_UPDATED' | 'CONTRACT_DELETED'
  | 'CONTRACT_SIGNED' | 'CONTRACT_APPROVED' | 'DOCUMENT_UPLOADED' | 'DOCUMENT_DOWNLOADED'
  | 'TEMPLATE_CREATED' | 'TEMPLATE_UPDATED' | 'MATTER_CREATED' | 'MATTER_UPDATED' | 'USER_ACTION';

function getClientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return c.req.header('x-real-ip') || 'unknown';
}

export const requestId: MiddlewareHandler = async (c: Context, next: Next) => {
  const existingId = c.req.header('x-request-id');
  const id = existingId || nanoid(21);
  c.set('requestId', id);
  c.header('X-Request-ID', id);
  await next();
};

export const requestLogger: MiddlewareHandler = async (c: Context, next: Next) => {
  const startTime = Date.now();
  const reqId = c.get('requestId') || nanoid(21);
  
  logger.info({ type: 'request', requestId: reqId, method: c.req.method, path: c.req.path }, c.req.method + ' ' + c.req.path);
  
  await next();
  
  const durationMs = Date.now() - startTime;
  const logLevel = c.res.status >= 500 ? 'error' : c.res.status >= 400 ? 'warn' : 'info';
  logger[logLevel]({ type: 'response', requestId: reqId, statusCode: c.res.status, durationMs }, c.req.method + ' ' + c.req.path + ' ' + c.res.status + ' ' + durationMs + 'ms');
};

export const auditTrail: MiddlewareHandler = async (c: Context, next: Next) => {
  await next();
  if (c.res.status >= 400 || c.req.method === 'GET') return;
  
  const user = c.get('user');
  if (!user) return;
  
  const pathParts = c.req.path.split('/').filter(Boolean);
  const entityType = pathParts[0] || 'unknown';
  const entityId = pathParts[1] || 'unknown';
  
  let action: string;
  switch (c.req.method) {
    case 'POST': action = 'CREATE'; break;
    case 'PUT': case 'PATCH': action = 'UPDATE'; break;
    case 'DELETE': action = 'DELETE'; break;
    default: action = c.req.method;
  }
  
  const auditEntry: AuditLogEntry = {
    action, entityType, entityId, userId: user.id,
    metadata: { requestId: c.get('requestId'), ip: getClientIp(c), path: c.req.path },
  };
  logAudit(auditEntry);
};

export function logAuditEvent(
  c: Context, eventType: AuditEventType, entityType: string, entityId: string,
  changes?: Record<string, { old: unknown; new: unknown }>, metadata?: Record<string, unknown>
): void {
  const user = c.get('user');
  const entry: AuditLogEntry = {
    action: eventType, 
    entityType, 
    entityId, 
    userId: user?.id || 'system',
    metadata: { ...metadata, requestId: c.get('requestId'), ip: getClientIp(c) },
  };
  if (changes) {
    entry.changes = changes;
  }
  logAudit(entry);
}

export default { requestId, requestLogger, auditTrail };
