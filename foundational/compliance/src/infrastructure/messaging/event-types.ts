/**
 * Compliance Event Types
 *
 * Defines all domain events published by the compliance service.
 */

// =============================================================================
// Event Type Constants
// =============================================================================

export const ComplianceEventTypes = {
  // Obligations
  OBLIGATION_CREATED: 'compliance.obligation.created',
  OBLIGATION_UPDATED: 'compliance.obligation.updated',
  OBLIGATION_COMPLETED: 'compliance.obligation.completed',
  OBLIGATION_OVERDUE: 'compliance.obligation.overdue',
  OBLIGATION_ESCALATED: 'compliance.obligation.escalated',

  // Requirements
  REQUIREMENT_CREATED: 'compliance.requirement.created',
  REQUIREMENT_UPDATED: 'compliance.requirement.updated',
  REQUIREMENT_DEACTIVATED: 'compliance.requirement.deactivated',

  // Calendar
  CALENDAR_EVENT_CREATED: 'compliance.calendar.event_created',
  CALENDAR_EVENT_UPDATED: 'compliance.calendar.event_updated',
  CALENDAR_REMINDER_SENT: 'compliance.calendar.reminder_sent',
  DEADLINE_APPROACHING: 'compliance.calendar.deadline_approaching',

  // Findings
  FINDING_CREATED: 'compliance.finding.created',
  FINDING_UPDATED: 'compliance.finding.updated',
  FINDING_CLOSED: 'compliance.finding.closed',
  FINDING_ESCALATED: 'compliance.finding.escalated',

  // Reports
  REPORT_GENERATED: 'compliance.report.generated',
  REPORT_APPROVED: 'compliance.report.approved',
  REPORT_DISTRIBUTED: 'compliance.report.distributed',

  // BOI Filing
  BOI_FILING_CREATED: 'compliance.boi.filing_created',
  BOI_FILING_SUBMITTED: 'compliance.boi.filing_submitted',
  BOI_FILING_ACCEPTED: 'compliance.boi.filing_accepted',
  BOI_FILING_REJECTED: 'compliance.boi.filing_rejected',

  // Compliance Status
  COMPLIANCE_STATUS_CHANGED: 'compliance.status.changed',
  COMPLIANCE_BREACH_DETECTED: 'compliance.breach.detected',
} as const;

export type ComplianceEventType = typeof ComplianceEventTypes[keyof typeof ComplianceEventTypes];

// =============================================================================
// Event Payloads
// =============================================================================

export interface ObligationCreatedPayload {
  obligationId: string;
  tenantId: string;
  entityId: string;
  requirementId: string;
  title: string;
  regulator: string;
  category: string;
  dueDate: string;
  priority: string;
}

export interface ObligationUpdatedPayload {
  obligationId: string;
  tenantId: string;
  entityId: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  updatedBy?: string;
}

export interface ObligationCompletedPayload {
  obligationId: string;
  tenantId: string;
  entityId: string;
  title: string;
  regulator: string;
  completedAt: string;
  completedBy?: string;
  daysBeforeDeadline: number;
}

export interface ObligationOverduePayload {
  obligationId: string;
  tenantId: string;
  entityId: string;
  title: string;
  regulator: string;
  dueDate: string;
  daysOverdue: number;
  priority: string;
}

export interface ObligationEscalatedPayload {
  obligationId: string;
  tenantId: string;
  entityId: string;
  title: string;
  escalatedTo: string;
  escalationReason: string;
  previousAssignee?: string;
}

export interface DeadlineApproachingPayload {
  obligationId: string;
  tenantId: string;
  entityId: string;
  title: string;
  regulator: string;
  dueDate: string;
  daysUntilDue: number;
  assignedTo?: string;
}

export interface FindingCreatedPayload {
  findingId: string;
  tenantId: string;
  entityId: string;
  title: string;
  severity: string;
  auditType: string;
  regulator?: string;
  remediationDueDate?: string;
}

export interface FindingClosedPayload {
  findingId: string;
  tenantId: string;
  entityId: string;
  title: string;
  severity: string;
  closedAt: string;
  closedBy?: string;
  remediationSummary?: string;
}

export interface ReportGeneratedPayload {
  reportId: string;
  tenantId: string;
  entityId?: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  complianceRate: number;
  riskLevel: string;
}

export interface BOIFilingSubmittedPayload {
  filingId: string;
  tenantId: string;
  entityId: string;
  filingType: string;
  submittedAt: string;
  submittedBy?: string;
}

export interface ComplianceStatusChangedPayload {
  tenantId: string;
  entityId: string;
  previousStatus: string;
  newStatus: string;
  reason: string;
  changedAt: string;
}

export interface ComplianceBreachDetectedPayload {
  tenantId: string;
  entityId: string;
  obligationId?: string;
  requirementId?: string;
  breachType: string;
  severity: string;
  description: string;
  detectedAt: string;
}

// =============================================================================
// External Event Types (Events we consume)
// =============================================================================

export const ExternalEventTypes = {
  // From Entity Governance
  ENTITY_CREATED: 'entity-governance.entity.created',
  ENTITY_UPDATED: 'entity-governance.entity.updated',
  ENTITY_DISSOLVED: 'entity-governance.entity.dissolved',
  OFFICER_APPOINTED: 'entity-governance.officer.appointed',
  OFFICER_RESIGNED: 'entity-governance.officer.resigned',
  SHAREHOLDER_ADDED: 'entity-governance.shareholder.added',

  // From KYC Identity
  KYC_VERIFICATION_APPROVED: 'kyc-identity.verification.approved',
  KYC_VERIFICATION_REJECTED: 'kyc-identity.verification.rejected',
  AML_ALERT_CREATED: 'kyc-identity.aml.alert_created',

  // From Tax
  TAX_FILING_COMPLETED: 'tax.filing.completed',
  TAX_FILING_FAILED: 'tax.filing.failed',

  // From Data Privacy
  DATA_BREACH_REPORTED: 'data-privacy.breach.reported',
  DPIA_REQUIRED: 'data-privacy.dpia.required',
} as const;

export type ExternalEventType = typeof ExternalEventTypes[keyof typeof ExternalEventTypes];
