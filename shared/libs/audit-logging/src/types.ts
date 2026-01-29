/**
 * Core audit logging types
 */

export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ACCESS_DENIED'
  | 'EXPORT'
  | 'IMPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'SIGN'
  | 'VERIFY';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  resource: string;
  resourceId: string;
  userId: string;
  userEmail?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  success: boolean;
  errorMessage?: string;
}

export interface AuditLoggerConfig {
  serviceName: string;
  environment: string;
  elasticsearchUrl?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  prettyPrint?: boolean;
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  tenantId?: string;
  resource?: string;
  action?: AuditAction;
  limit?: number;
  offset?: number;
}
