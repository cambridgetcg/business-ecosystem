/**
 * Compliance Domain Events
 *
 * Event definitions for compliance-related domain events.
 *
 * @module core/events/domain-events
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// EVENT TYPES
// =============================================================================

export const OBLIGATION_EVENTS = {
  CREATED: 'compliance.obligation.created',
  UPDATED: 'compliance.obligation.updated',
  ASSIGNED: 'compliance.obligation.assigned',
  STATUS_CHANGED: 'compliance.obligation.status_changed',
  SUBMITTED: 'compliance.obligation.submitted',
  COMPLETED: 'compliance.obligation.completed',
  OVERDUE: 'compliance.obligation.overdue',
  ESCALATED: 'compliance.obligation.escalated',
} as const;

export const DEADLINE_EVENTS = {
  APPROACHING: 'compliance.deadline.approaching',
  IMMINENT: 'compliance.deadline.imminent',
  MISSED: 'compliance.deadline.missed',
} as const;

export const REQUIREMENT_EVENTS = {
  CREATED: 'compliance.requirement.created',
  UPDATED: 'compliance.requirement.updated',
  MAPPED: 'compliance.requirement.mapped',
  SUNSET: 'compliance.requirement.sunset',
} as const;

export const FINDING_EVENTS = {
  CREATED: 'compliance.finding.created',
  ASSIGNED: 'compliance.finding.assigned',
  REMEDIATION_STARTED: 'compliance.finding.remediation_started',
  REMEDIATION_COMPLETED: 'compliance.finding.remediation_completed',
  VERIFIED: 'compliance.finding.verified',
  CLOSED: 'compliance.finding.closed',
  ESCALATED: 'compliance.finding.escalated',
} as const;

export const REPORT_EVENTS = {
  GENERATED: 'compliance.report.generated',
  APPROVED: 'compliance.report.approved',
  DISTRIBUTED: 'compliance.report.distributed',
} as const;

// =============================================================================
// EVENT INTERFACES
// =============================================================================

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: T;
  metadata: {
    tenantId?: string;
    userId?: string;
    correlationId: string;
    source: string;
    timestamp: Date;
  };
  occurredAt: Date;
}

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
  return {
    id: uuidv4(),
    type,
    aggregateType,
    aggregateId,
    payload,
    metadata: {
      tenantId: options?.tenantId,
      userId: options?.userId,
      correlationId: options?.correlationId ?? uuidv4(),
      source: 'compliance',
      timestamp: new Date(),
    },
    occurredAt: new Date(),
  };
}

// =============================================================================
// OBLIGATION EVENTS
// =============================================================================

export interface ObligationCreatedPayload {
  tenantId: string;
  entityId: string;
  requirementId: string;
  title: string;
  dueDate: Date;
  priority: string;
  regulator: string;
  category: string;
}

export function obligationCreated(
  obligationId: string,
  payload: ObligationCreatedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<ObligationCreatedPayload> {
  return createEvent(OBLIGATION_EVENTS.CREATED, 'Obligation', obligationId, payload, options);
}

export interface ObligationStatusChangedPayload {
  tenantId: string;
  entityId: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
  reason?: string;
}

export function obligationStatusChanged(
  obligationId: string,
  payload: ObligationStatusChangedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<ObligationStatusChangedPayload> {
  return createEvent(OBLIGATION_EVENTS.STATUS_CHANGED, 'Obligation', obligationId, payload, options);
}

export interface ObligationOverduePayload {
  tenantId: string;
  entityId: string;
  title: string;
  dueDate: Date;
  daysOverdue: number;
  priority: string;
  assignedTo?: string;
}

export function obligationOverdue(
  obligationId: string,
  payload: ObligationOverduePayload,
  options?: { tenantId?: string }
): DomainEvent<ObligationOverduePayload> {
  return createEvent(OBLIGATION_EVENTS.OVERDUE, 'Obligation', obligationId, payload, options);
}

// =============================================================================
// DEADLINE EVENTS
// =============================================================================

export interface DeadlineApproachingPayload {
  tenantId: string;
  entityId: string;
  obligationId: string;
  title: string;
  dueDate: Date;
  daysRemaining: number;
  priority: string;
  assignedTo?: string;
}

export function deadlineApproaching(
  obligationId: string,
  payload: DeadlineApproachingPayload,
  options?: { tenantId?: string }
): DomainEvent<DeadlineApproachingPayload> {
  return createEvent(DEADLINE_EVENTS.APPROACHING, 'Obligation', obligationId, payload, options);
}

export function deadlineImminent(
  obligationId: string,
  payload: DeadlineApproachingPayload,
  options?: { tenantId?: string }
): DomainEvent<DeadlineApproachingPayload> {
  return createEvent(DEADLINE_EVENTS.IMMINENT, 'Obligation', obligationId, payload, options);
}

// =============================================================================
// FINDING EVENTS
// =============================================================================

export interface FindingCreatedPayload {
  tenantId: string;
  entityId: string;
  auditType: string;
  title: string;
  severity: string;
  category: string;
  remediationDueDate?: Date;
}

export function findingCreated(
  findingId: string,
  payload: FindingCreatedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<FindingCreatedPayload> {
  return createEvent(FINDING_EVENTS.CREATED, 'AuditFinding', findingId, payload, options);
}

export interface FindingRemediationPayload {
  tenantId: string;
  entityId: string;
  findingId: string;
  title: string;
  previousStatus: string;
  newStatus: string;
  remediatedBy?: string;
}

export function findingRemediationCompleted(
  findingId: string,
  payload: FindingRemediationPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<FindingRemediationPayload> {
  return createEvent(FINDING_EVENTS.REMEDIATION_COMPLETED, 'AuditFinding', findingId, payload, options);
}

// =============================================================================
// REPORT EVENTS
// =============================================================================

export interface ReportGeneratedPayload {
  tenantId: string;
  entityId?: string;
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  complianceRate: number;
  riskLevel: string;
}

export function reportGenerated(
  reportId: string,
  payload: ReportGeneratedPayload,
  options?: { tenantId?: string; userId?: string }
): DomainEvent<ReportGeneratedPayload> {
  return createEvent(REPORT_EVENTS.GENERATED, 'ComplianceReport', reportId, payload, options);
}
