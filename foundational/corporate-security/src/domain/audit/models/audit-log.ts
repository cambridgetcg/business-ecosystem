/**
 * Audit Log Domain Model
 *
 * Immutable security audit trail for all security-relevant events.
 */

import { z } from 'zod';
import {
  SecurityEventTypeSchema,
  IPAddressSchema,
  UserAgentSchema,
  GeoLocationSchema,
} from '../../value-objects/index.js';

// =============================================================================
// Audit Log Schema
// =============================================================================

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Event details
  eventType: SecurityEventTypeSchema,
  eventCategory: z.enum(['authentication', 'authorization', 'administrative', 'security', 'system']),
  severity: z.enum(['info', 'warning', 'error', 'critical']),

  // Actor (who performed the action)
  actorId: z.string().uuid().nullable(),
  actorType: z.enum(['user', 'service', 'system', 'anonymous']),
  actorEmail: z.string().email().nullable(),
  actorName: z.string().nullable(),
  actorRoles: z.array(z.string()).nullable(),

  // Target (what was affected)
  targetType: z.string().nullable(),
  targetId: z.string().uuid().nullable(),
  targetName: z.string().nullable(),

  // Action details
  action: z.string(),
  outcome: z.enum(['success', 'failure', 'partial', 'denied']),
  reason: z.string().nullable(),

  // Request context
  requestId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  ipAddress: IPAddressSchema.nullable(),
  userAgent: UserAgentSchema.nullable(),
  geoLocation: GeoLocationSchema.nullable(),

  // Resource details
  resourceType: z.string().nullable(),
  resourceId: z.string().uuid().nullable(),
  resourcePath: z.string().nullable(),

  // Change tracking
  previousValue: z.record(z.unknown()).nullable(),
  newValue: z.record(z.unknown()).nullable(),

  // Additional context
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),

  // Timestamp (immutable)
  timestamp: z.date(),

  // Integrity
  checksum: z.string().nullable(), // SHA-256 hash for tamper detection
  previousLogId: z.string().uuid().nullable(), // Chain linking
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateAuditLogInputSchema = z.object({
  tenantId: z.string().uuid(),
  eventType: SecurityEventTypeSchema,
  actorId: z.string().uuid().optional(),
  actorType: z.enum(['user', 'service', 'system', 'anonymous']),
  actorEmail: z.string().email().optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  action: z.string(),
  outcome: z.enum(['success', 'failure', 'partial', 'denied']),
  reason: z.string().optional(),
  requestId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  resourcePath: z.string().optional(),
  previousValue: z.record(z.unknown()).optional(),
  newValue: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogInputSchema>;

// =============================================================================
// Query Filters
// =============================================================================

export const AuditLogQuerySchema = z.object({
  tenantId: z.string().uuid(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  eventTypes: z.array(SecurityEventTypeSchema).optional(),
  eventCategories: z.array(z.enum(['authentication', 'authorization', 'administrative', 'security', 'system'])).optional(),
  actorId: z.string().uuid().optional(),
  actorType: z.enum(['user', 'service', 'system', 'anonymous']).optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  outcome: z.enum(['success', 'failure', 'partial', 'denied']).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  ipAddress: z.string().optional(),
  resourceType: z.string().optional(),
  searchTerm: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  orderBy: z.enum(['timestamp_asc', 'timestamp_desc']).default('timestamp_desc'),
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Get event category from event type
 */
export function getEventCategory(eventType: z.infer<typeof SecurityEventTypeSchema>): string {
  const authenticationEvents = [
    'login_success', 'login_failure', 'logout', 'mfa_challenge',
    'mfa_success', 'mfa_failure', 'password_change', 'password_reset',
  ];
  const authorizationEvents = [
    'access_granted', 'access_denied', 'privilege_escalation',
  ];
  const securityEvents = [
    'brute_force_detected', 'anomaly_detected', 'suspicious_activity',
    'data_breach', 'unauthorized_access', 'security_incident_created',
    'security_incident_escalated', 'security_incident_resolved', 'critical_action',
  ];
  const administrativeEvents = [
    'role_assigned', 'role_revoked', 'policy_created', 'policy_modified',
    'user_created', 'user_suspended', 'user_deleted',
  ];

  if (authenticationEvents.includes(eventType)) return 'authentication';
  if (authorizationEvents.includes(eventType)) return 'authorization';
  if (securityEvents.includes(eventType)) return 'security';
  if (administrativeEvents.includes(eventType)) return 'administrative';
  return 'system';
}

/**
 * Get severity from event type
 */
export function getEventSeverity(
  eventType: z.infer<typeof SecurityEventTypeSchema>,
  outcome: string
): 'info' | 'warning' | 'error' | 'critical' {
  const criticalEvents = ['data_breach', 'unauthorized_access', 'privilege_escalation'];
  const highEvents = ['brute_force_detected', 'anomaly_detected', 'suspicious_activity'];
  const warningEvents = ['login_failure', 'mfa_failure', 'access_denied'];

  if (criticalEvents.includes(eventType)) return 'critical';
  if (highEvents.includes(eventType)) return 'error';
  if (warningEvents.includes(eventType) || outcome === 'failure') return 'warning';
  return 'info';
}

/**
 * Calculate checksum for audit log integrity
 */
export function calculateChecksum(log: Partial<AuditLog>, previousChecksum?: string): string {
  const data = JSON.stringify({
    tenantId: log.tenantId,
    eventType: log.eventType,
    actorId: log.actorId,
    targetId: log.targetId,
    action: log.action,
    outcome: log.outcome,
    timestamp: log.timestamp?.toISOString(),
    previousChecksum: previousChecksum || '',
  });

  // Simple hash for demo - in production use crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Verify audit log chain integrity
 */
export function verifyLogIntegrity(
  log: AuditLog,
  previousLog: AuditLog | null
): { valid: boolean; reason?: string } {
  const expectedChecksum = calculateChecksum(log, previousLog?.checksum || undefined);

  if (log.checksum !== expectedChecksum) {
    return { valid: false, reason: 'Checksum mismatch' };
  }

  if (previousLog && log.previousLogId !== previousLog.id) {
    return { valid: false, reason: 'Chain link broken' };
  }

  return { valid: true };
}

/**
 * Format audit log for export
 */
export function formatAuditLogForExport(log: AuditLog): Record<string, unknown> {
  return {
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    eventType: log.eventType,
    category: log.eventCategory,
    severity: log.severity,
    actor: log.actorEmail || log.actorId || 'system',
    action: log.action,
    outcome: log.outcome,
    target: log.targetType ? `${log.targetType}:${log.targetId}` : null,
    resource: log.resourcePath,
    ipAddress: log.ipAddress,
    reason: log.reason,
  };
}

/**
 * Retention periods by severity (days)
 */
export const AUDIT_RETENTION_PERIODS = {
  info: 90,
  warning: 365,
  error: 730,
  critical: 2555, // 7 years
} as const;
