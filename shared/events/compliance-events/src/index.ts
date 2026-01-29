/**
 * @ecosystem/events-compliance
 * Compliance and regulatory domain events
 */

import { z } from 'zod';

// Base schemas
const eventMetadataSchema = z.object({
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  source: z.string(),
  timestamp: z.coerce.date(),
});

const baseDomainEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  aggregateId: z.string().uuid(),
  aggregateType: z.string(),
  version: z.number().int().positive(),
  occurredAt: z.coerce.date(),
  metadata: eventMetadataSchema,
});

// ============================================================================
// KYC Events
// ============================================================================

export const kycVerificationStartedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('kyc.verification_started'),
  aggregateType: z.literal('KycVerification'),
  payload: z.object({
    userId: z.string().uuid(),
    level: z.string(),
  }),
});

export type KycVerificationStartedEvent = z.infer<typeof kycVerificationStartedEventSchema>;

export const kycVerificationCompletedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('kyc.verification_completed'),
  aggregateType: z.literal('KycVerification'),
  payload: z.object({
    userId: z.string().uuid(),
    status: z.enum(['approved', 'rejected']),
    riskScore: z.number().optional(),
  }),
});

export type KycVerificationCompletedEvent = z.infer<typeof kycVerificationCompletedEventSchema>;

// ============================================================================
// Compliance Events
// ============================================================================

export const complianceViolationDetectedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('compliance.violation_detected'),
  aggregateType: z.literal('ComplianceCheck'),
  payload: z.object({
    entityId: z.string().uuid(),
    regulation: z.string(),
    requirement: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    description: z.string(),
  }),
});

export type ComplianceViolationDetectedEvent = z.infer<typeof complianceViolationDetectedEventSchema>;

export const complianceRemediationCompletedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('compliance.remediation_completed'),
  aggregateType: z.literal('ComplianceCheck'),
  payload: z.object({
    violationId: z.string().uuid(),
    remediationActions: z.array(z.string()),
    completedBy: z.string().uuid(),
  }),
});

export type ComplianceRemediationCompletedEvent = z.infer<typeof complianceRemediationCompletedEventSchema>;

// ============================================================================
// Audit Events
// ============================================================================

export const auditFindingCreatedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('audit.finding_created'),
  aggregateType: z.literal('AuditReport'),
  payload: z.object({
    findingId: z.string().uuid(),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'minimal']),
    title: z.string(),
  }),
});

export type AuditFindingCreatedEvent = z.infer<typeof auditFindingCreatedEventSchema>;

export const auditReportFinalizedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('audit.report_finalized'),
  aggregateType: z.literal('AuditReport'),
  payload: z.object({
    reportId: z.string().uuid(),
    title: z.string(),
    findingsCount: z.number().int(),
    criticalCount: z.number().int(),
  }),
});

export type AuditReportFinalizedEvent = z.infer<typeof auditReportFinalizedEventSchema>;

// ============================================================================
// Risk Events
// ============================================================================

export const riskScoreChangedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('risk.score_changed'),
  aggregateType: z.literal('RiskAssessment'),
  payload: z.object({
    entityId: z.string().uuid(),
    previousScore: z.number(),
    newScore: z.number(),
    previousLevel: z.string(),
    newLevel: z.string(),
  }),
});

export type RiskScoreChangedEvent = z.infer<typeof riskScoreChangedEventSchema>;

// ============================================================================
// Event Union
// ============================================================================

export const complianceEventSchema = z.discriminatedUnion('type', [
  kycVerificationStartedEventSchema,
  kycVerificationCompletedEventSchema,
  complianceViolationDetectedEventSchema,
  complianceRemediationCompletedEventSchema,
  auditFindingCreatedEventSchema,
  auditReportFinalizedEventSchema,
  riskScoreChangedEventSchema,
]);

export type ComplianceEvent = z.infer<typeof complianceEventSchema>;

export const COMPLIANCE_EVENT_TYPES = [
  'kyc.verification_started',
  'kyc.verification_completed',
  'compliance.violation_detected',
  'compliance.remediation_completed',
  'audit.finding_created',
  'audit.report_finalized',
  'risk.score_changed',
] as const;
