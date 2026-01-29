/**
 * Audit trail service for compliance logging
 */

import { randomUUID } from 'crypto';
import type { AuditAction, AuditEntry, AuditQuery, AuditLoggerConfig } from './types.js';
import { createLogger, type Logger } from './logger.js';

export interface AuditContext {
  userId: string;
  userEmail?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface AuditTrailService {
  log(
    action: AuditAction,
    resource: string,
    resourceId: string,
    context: AuditContext,
    options?: {
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      success?: boolean;
      errorMessage?: string;
    }
  ): Promise<void>;
  query(query: AuditQuery): Promise<AuditEntry[]>;
}

export class InMemoryAuditTrailService implements AuditTrailService {
  private entries: AuditEntry[] = [];
  private logger: Logger;

  constructor(config: AuditLoggerConfig) {
    this.logger = createLogger(config);
  }

  async log(
    action: AuditAction,
    resource: string,
    resourceId: string,
    context: AuditContext,
    options: {
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      success?: boolean;
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    const entry: AuditEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      action,
      resource,
      resourceId,
      userId: context.userId,
      userEmail: context.userEmail,
      tenantId: context.tenantId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId,
      oldValue: options.oldValue,
      newValue: options.newValue,
      metadata: options.metadata,
      success: options.success ?? true,
      errorMessage: options.errorMessage,
    };

    this.entries.push(entry);
    
    this.logger.info('Audit entry created', {
      auditId: entry.id,
      action,
      resource,
      resourceId,
      userId: context.userId,
      success: entry.success,
    });
  }

  async query(query: AuditQuery): Promise<AuditEntry[]> {
    let results = [...this.entries];

    if (query.startDate) {
      results = results.filter(e => e.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(e => e.timestamp <= query.endDate!);
    }
    if (query.userId) {
      results = results.filter(e => e.userId === query.userId);
    }
    if (query.tenantId) {
      results = results.filter(e => e.tenantId === query.tenantId);
    }
    if (query.resource) {
      results = results.filter(e => e.resource === query.resource);
    }
    if (query.action) {
      results = results.filter(e => e.action === query.action);
    }

    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const offset = query.offset || 0;
    const limit = query.limit || 50;
    return results.slice(offset, offset + limit);
  }
}
