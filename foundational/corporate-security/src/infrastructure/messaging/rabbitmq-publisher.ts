/**
 * RabbitMQ Security Event Publisher
 *
 * Wraps @ecosystem/messaging EventBus to publish security domain events
 * to the ecosystem message bus.
 *
 * @module infrastructure/messaging/rabbitmq-publisher
 */

import { randomUUID } from 'crypto';
import type { DomainEvent, EventMetadata, EventBus } from '@ecosystem/messaging';
import type { ISecurityEventPublisher } from '../../core/events/event-publisher.js';

/**
 * Security event types published by this service
 */
export const SecurityEventTypes = {
  // Identity events
  IDENTITY_CREATED: 'security.identity.created',
  IDENTITY_UPDATED: 'security.identity.updated',
  IDENTITY_VERIFIED: 'security.identity.verified',
  IDENTITY_LOCKED: 'security.identity.locked',
  IDENTITY_UNLOCKED: 'security.identity.unlocked',
  IDENTITY_DELETED: 'security.identity.deleted',

  // Authentication events
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

  // Access control events
  ROLE_CREATED: 'security.access.role_created',
  ROLE_UPDATED: 'security.access.role_updated',
  ROLE_DELETED: 'security.access.role_deleted',
  ROLE_ASSIGNED: 'security.access.role_assigned',
  ROLE_REVOKED: 'security.access.role_revoked',
  PERMISSION_GRANTED: 'security.access.permission_granted',
  PERMISSION_DENIED: 'security.access.permission_denied',

  // Incident events
  INCIDENT_CREATED: 'security.incident.created',
  INCIDENT_UPDATED: 'security.incident.updated',
  INCIDENT_ESCALATED: 'security.incident.escalated',
  INCIDENT_CONTAINED: 'security.incident.contained',
  INCIDENT_RESOLVED: 'security.incident.resolved',
  INCIDENT_CLOSED: 'security.incident.closed',

  // Audit events
  CRITICAL_ACTION: 'security.audit.critical_action',
  ANOMALY_DETECTED: 'security.audit.anomaly_detected',
  COMPLIANCE_VIOLATION: 'security.audit.compliance_violation',
} as const;

export type SecurityEventType = typeof SecurityEventTypes[keyof typeof SecurityEventTypes];

/**
 * RabbitMQ-backed Security Event Publisher
 * Implements ISecurityEventPublisher and publishes to the ecosystem event bus
 */
export class RabbitMQSecurityEventPublisher implements ISecurityEventPublisher {
  private readonly source = 'corporate-security';

  constructor(
    private readonly eventBus: EventBus | null
  ) {}

  /**
   * Publish a single domain event
   */
  async publish<T>(event: DomainEvent<T>): Promise<void> {
    if (!this.eventBus) {
      console.log(`[CorporateSecurity] Event publishing disabled - would publish: ${event.type}`, {
        id: event.id,
        aggregateId: event.aggregateId,
      });
      return;
    }

    try {
      await this.eventBus.publish(event);
      console.log(`[CorporateSecurity] Published event: ${event.type}`, {
        id: event.id,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      console.error(`[CorporateSecurity] Failed to publish event: ${event.type}`, error);
      throw error;
    }
  }

  /**
   * Publish multiple domain events
   */
  async publishBatch<T>(events: DomainEvent<T>[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Helper to create and publish a typed security event
   */
  async publishSecurityEvent<T>(
    eventType: SecurityEventType,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    options?: {
      tenantId?: string;
      userId?: string;
      correlationId?: string;
    }
  ): Promise<void> {
    const event = this.createEvent(eventType, aggregateType, aggregateId, payload, options);
    await this.publish(event);
  }

  /**
   * Publish identity created event
   */
  async publishIdentityCreated(payload: {
    identityId: string;
    tenantId: string;
    email: string;
    status: string;
    createdBy?: string;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.IDENTITY_CREATED,
      'Identity',
      payload.identityId,
      payload,
      { tenantId: payload.tenantId }
    );
  }

  /**
   * Publish identity locked event
   */
  async publishIdentityLocked(payload: {
    identityId: string;
    tenantId: string;
    email: string;
    reason: string;
    lockedBy?: string;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.IDENTITY_LOCKED,
      'Identity',
      payload.identityId,
      payload,
      { tenantId: payload.tenantId }
    );
  }

  /**
   * Publish login success event
   */
  async publishLoginSuccess(payload: {
    identityId: string;
    tenantId: string;
    email: string;
    sessionId: string;
    mfaUsed: boolean;
    ipAddress?: string;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.LOGIN_SUCCESS,
      'Identity',
      payload.identityId,
      payload,
      { tenantId: payload.tenantId, userId: payload.identityId }
    );
  }

  /**
   * Publish login failure event
   */
  async publishLoginFailure(payload: {
    email: string;
    tenantId: string;
    reason: string;
    failedAttempts: number;
    ipAddress?: string;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.LOGIN_FAILURE,
      'Identity',
      payload.email,
      payload,
      { tenantId: payload.tenantId }
    );
  }

  /**
   * Publish role assigned event
   */
  async publishRoleAssigned(payload: {
    assignmentId: string;
    identityId: string;
    tenantId: string;
    roleId: string;
    roleName: string;
    assignedBy: string;
    entityId?: string;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.ROLE_ASSIGNED,
      'RoleAssignment',
      payload.assignmentId,
      payload,
      { tenantId: payload.tenantId, userId: payload.assignedBy }
    );
  }

  /**
   * Publish security incident created event
   */
  async publishIncidentCreated(payload: {
    incidentId: string;
    tenantId: string;
    incidentNumber: string;
    title: string;
    severity: string;
    category: string;
    detectedBy: string;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.INCIDENT_CREATED,
      'SecurityIncident',
      payload.incidentId,
      payload,
      { tenantId: payload.tenantId }
    );
  }

  /**
   * Publish incident escalated event
   */
  async publishIncidentEscalated(payload: {
    incidentId: string;
    tenantId: string;
    incidentNumber: string;
    previousSeverity: string;
    newSeverity: string;
    reason: string;
    escalatedBy: string;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.INCIDENT_ESCALATED,
      'SecurityIncident',
      payload.incidentId,
      payload,
      { tenantId: payload.tenantId, userId: payload.escalatedBy }
    );
  }

  /**
   * Publish critical action audit event
   */
  async publishCriticalAction(payload: {
    auditLogId: string;
    tenantId: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    description: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.CRITICAL_ACTION,
      'AuditLog',
      payload.auditLogId,
      payload,
      { tenantId: payload.tenantId, userId: payload.actorId }
    );
  }

  /**
   * Publish anomaly detected event
   */
  async publishAnomalyDetected(payload: {
    anomalyId: string;
    tenantId: string;
    anomalyType: string;
    severity: string;
    description: string;
    affectedIdentityId?: string;
    indicators: Record<string, unknown>;
  }): Promise<void> {
    await this.publishSecurityEvent(
      SecurityEventTypes.ANOMALY_DETECTED,
      'Anomaly',
      payload.anomalyId,
      payload,
      { tenantId: payload.tenantId }
    );
  }

  /**
   * Create a domain event
   */
  private createEvent<T>(
    type: SecurityEventType,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    options?: {
      tenantId?: string;
      userId?: string;
      correlationId?: string;
    }
  ): DomainEvent<T> {
    const now = new Date();
    const metadata: EventMetadata = {
      correlationId: options?.correlationId ?? randomUUID(),
      source: this.source,
      timestamp: now,
    };

    if (options?.userId) metadata.userId = options.userId;
    if (options?.tenantId) metadata.tenantId = options.tenantId;

    return {
      id: randomUUID(),
      type,
      aggregateId,
      aggregateType,
      payload,
      metadata,
      occurredAt: now,
      version: 1,
    };
  }
}

// Global publisher instance
let globalPublisher: ISecurityEventPublisher | null = null;

/**
 * Set the global event publisher
 */
export function setGlobalEventPublisher(publisher: ISecurityEventPublisher): void {
  globalPublisher = publisher;
}

/**
 * Get the global event publisher
 */
export function getGlobalEventPublisher(): ISecurityEventPublisher | null {
  return globalPublisher;
}
