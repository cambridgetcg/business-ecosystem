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
  userEmail?: string | undefined;
  tenantId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  oldValue?: Record<string, unknown> | undefined;
  newValue?: Record<string, unknown> | undefined;
  metadata?: Record<string, unknown> | undefined;
  correlationId?: string | undefined;
  success: boolean;
  errorMessage?: string | undefined;
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
