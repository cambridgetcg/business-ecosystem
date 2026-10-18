/**
 * Corporate Security Domain Events
 *
 * Event definitions for security-related domain events.
 * These events are published to the ecosystem event bus for cross-service integration.
 *
 * @module core/events/domain-events
 */

import { v4 as uuidv4 } from 'uuid';
import type { DomainEvent, EventMetadata } from '@ecosystem/messaging';

// =============================================================================
// EVENT TYPE CONSTANTS
// =============================================================================

export const IDENTITY_EVENTS = {
  CREATED: 'security.identity.created',
  UPDATED: 'security.identity.updated',
  VERIFIED: 'security.identity.verified',
  LOCKED: 'security.identity.locked',
  UNLOCKED: 'security.identity.unlocked',
  DELETED: 'security.identity.deleted',
} as const;

export const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'security.auth.login_success',
  LOGIN_FAILURE: 'security.auth.login_failure',
  LOGOUT: 'security.auth.logout',
  SESSION_CREATED: 'security.auth.session_created',
  SESSION_EXPIRED: 'security.auth.session_expired',
  SESSION_REVOKED: 'security.auth.session_revoked',
  MFA_VERIFIED: 'security.auth.mfa_verified',
  MFA_FAILED: 'security.auth.mfa_failed',
  PASSWORD_CHANGED: 'security.auth.password_changed',
  PASSWORD_RESET: 'security.auth.password_reset',
} as const;

export const ACCESS_EVENTS = {
  ROLE_CREATED: 'security.access.role_created',
  ROLE_UPDATED: 'security.access.role_updated',
  ROLE_DELETED: 'security.access.role_deleted',
  ROLE_ASSIGNED: 'security.access.role_assigned',
  ROLE_REVOKED: 'security.access.role_revoked',
  PERMISSION_GRANTED: 'security.access.permission_granted',
  PERMISSION_DENIED: 'security.access.permission_denied',
  POLICY_CREATED: 'security.access.policy_created',
  POLICY_UPDATED: 'security.access.policy_updated',
} as const;

export const INCIDENT_EVENTS = {
  CREATED: 'security.incident.created',
  UPDATED: 'security.incident.updated',
  ESCALATED: 'security.incident.escalated',
  CONTAINED: 'security.incident.contained',
  RESOLVED: 'security.incident.resolved',
  CLOSED: 'security.incident.closed',
} as const;

export const AUDIT_EVENTS = {
  CRITICAL_ACTION: 'security.audit.critical_action',
  COMPLIANCE_VIOLATION: 'security.audit.compliance_violation',
  ANOMALY_DETECTED: 'security.audit.anomaly_detected',
} as const;

// =============================================================================
// EVENT FACTORY
// =============================================================================

function createEvent<T>(
  type: string,
  aggregateType: string,
  aggregateId: string,
  payload: T,
  options?: { tenantId?: string; userId?: string; correlationId?: string }
): DomainEvent<T> {
  const correlationId = options?.correlationId ?? uuidv4();

  return {
    id: uuidv4(),
    type,
    aggregateType,
    aggregateId,
    payload,
    metadata: {
      correlationId,
      userId: options?.userId,
      tenantId: options?.tenantId,
      source: 'corporate-security',
      timestamp: new Date(),
    },
    occurredAt: new Date(),
    version: 1,
  };
}

// =============================================================================
// IDENTITY EVENTS
// =============================================================================

export interface IdentityCreatedPayload {
  tenantId: string;
  email: string;
  status: string;
  ssoProvider?: string;
  createdBy?: string;
}

export function identityCreated(
  identityId: string,
  payload: IdentityCreatedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<IdentityCreatedPayload> {
  return createEvent(IDENTITY_EVENTS.CREATED, 'Identity', identityId, payload, options);
}

export interface IdentityLockedPayload {
  tenantId: string;
  email: string;
  reason: string;
  lockedUntil?: Date;
  lockedBy?: string;
}

export function identityLocked(
  identityId: string,
  payload: IdentityLockedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<IdentityLockedPayload> {
  return createEvent(IDENTITY_EVENTS.LOCKED, 'Identity', identityId, payload, options);
}

// =============================================================================
// AUTH EVENTS
// =============================================================================

export interface LoginSuccessPayload {
  tenantId: string;
  identityId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
  mfaUsed: boolean;
  sessionId: string;
}

export function loginSuccess(
  identityId: string,
  payload: LoginSuccessPayload,
  options?: { tenantId?: string }
): DomainEvent<LoginSuccessPayload> {
  return createEvent(AUTH_EVENTS.LOGIN_SUCCESS, 'Identity', identityId, payload, {
    ...options,
    userId: identityId,
  });
}

export interface LoginFailurePayload {
  tenantId: string;
  email: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  failedAttempts: number;
}

export function loginFailure(
  email: string,
  payload: LoginFailurePayload,
  options?: { tenantId?: string }
): DomainEvent<LoginFailurePayload> {
  return createEvent(AUTH_EVENTS.LOGIN_FAILURE, 'Identity', email, payload, options);
}

export interface SessionCreatedPayload {
  tenantId: string;
  identityId: string;
  sessionId: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export function sessionCreated(
  sessionId: string,
  payload: SessionCreatedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<SessionCreatedPayload> {
  return createEvent(AUTH_EVENTS.SESSION_CREATED, 'Session', sessionId, payload, options);
}

// =============================================================================
// ACCESS EVENTS
// =============================================================================

export interface RoleAssignedPayload {
  tenantId: string;
  identityId: string;
  roleId: string;
  roleName: string;
  assignedBy: string;
  entityId?: string;
  validUntil?: Date;
}

export function roleAssigned(
  assignmentId: string,
  payload: RoleAssignedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<RoleAssignedPayload> {
  return createEvent(ACCESS_EVENTS.ROLE_ASSIGNED, 'RoleAssignment', assignmentId, payload, options);
}

export interface PermissionDeniedPayload {
  tenantId: string;
  identityId: string;
  resourceType: string;
  resourceId?: string;
  action: string;
  reason: string;
  ipAddress?: string;
}

export function permissionDenied(
  requestId: string,
  payload: PermissionDeniedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<PermissionDeniedPayload> {
  return createEvent(ACCESS_EVENTS.PERMISSION_DENIED, 'AccessRequest', requestId, payload, options);
}

// =============================================================================
// INCIDENT EVENTS
// =============================================================================

export interface IncidentCreatedPayload {
  tenantId: string;
  incidentNumber: string;
  title: string;
  severity: string;
  category: string;
  detectedBy: string;
  affectedResources?: string[];
}

export function incidentCreated(
  incidentId: string,
  payload: IncidentCreatedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<IncidentCreatedPayload> {
  return createEvent(INCIDENT_EVENTS.CREATED, 'SecurityIncident', incidentId, payload, options);
}

export interface IncidentEscalatedPayload {
  tenantId: string;
  incidentNumber: string;
  previousSeverity: string;
  newSeverity: string;
  reason: string;
  escalatedBy: string;
}

export function incidentEscalated(
  incidentId: string,
  payload: IncidentEscalatedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<IncidentEscalatedPayload> {
  return createEvent(INCIDENT_EVENTS.ESCALATED, 'SecurityIncident', incidentId, payload, options);
}

// =============================================================================
// AUDIT EVENTS
// =============================================================================

export interface CriticalActionPayload {
  tenantId: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  description: string;
}

export function criticalAction(
  auditLogId: string,
  payload: CriticalActionPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<CriticalActionPayload> {
  return createEvent(AUDIT_EVENTS.CRITICAL_ACTION, 'AuditLog', auditLogId, payload, options);
}

export interface AnomalyDetectedPayload {
  tenantId: string;
  anomalyType: string;
  severity: string;
  description: string;
  affectedIdentityId?: string;
  affectedResourceId?: string;
  indicators: Record<string, unknown>;
}

export function anomalyDetected(
  anomalyId: string,
  payload: AnomalyDetectedPayload,
  options?: { tenantId?: string }
): DomainEvent<AnomalyDetectedPayload> {
  return createEvent(AUDIT_EVENTS.ANOMALY_DETECTED, 'Anomaly', anomalyId, payload, options);
}
