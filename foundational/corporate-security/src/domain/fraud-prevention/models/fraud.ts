/**
 * Fraud Prevention Domain Models
 *
 * Models for internal controls, segregation of duties, and fraud investigations.
 *
 * @module domain/fraud-prevention/models/fraud
 */

import { z } from 'zod';

// =============================================================================
// INTERNAL CONTROL
// =============================================================================

export const ControlTypeSchema = z.enum([
  'preventive',
  'detective',
  'corrective',
  'directive',
  'compensating',
]);

export const ControlFrequencySchema = z.enum([
  'continuous',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annually',
  'event_driven',
]);

export const InternalControlSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Control identification
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  type: ControlTypeSchema,
  category: z.enum(['financial', 'operational', 'compliance', 'it', 'strategic']),

  // Description
  description: z.string(),
  objective: z.string(),
  riskAddressed: z.string(),

  // Implementation
  frequency: ControlFrequencySchema,
  automated: z.boolean().default(false),
  systemId: z.string().uuid().optional(),

  // Ownership
  ownerId: z.string().uuid(),
  ownerName: z.string(),
  departmentId: z.string().uuid().optional(),
  performedBy: z.array(z.string().uuid()).optional(),

  // Documentation
  procedureUrl: z.string().url().optional(),
  evidenceRequirements: z.array(z.string()).optional(),

  // Effectiveness
  effectiveness: z.enum(['effective', 'partially_effective', 'ineffective', 'not_tested']),
  lastTestDate: z.date().optional(),
  nextTestDate: z.date().optional(),
  testingFrequency: ControlFrequencySchema.optional(),

  // Deficiencies
  hasDeficiency: z.boolean().default(false),
  deficiencyDescription: z.string().optional(),
  remediationPlan: z.string().optional(),
  remediationDueDate: z.date().optional(),

  // Related controls
  compensatingControls: z.array(z.string().uuid()).optional(),
  relatedRiskIds: z.array(z.string().uuid()).optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type InternalControl = z.infer<typeof InternalControlSchema>;

// =============================================================================
// SEGREGATION OF DUTIES
// =============================================================================

export const SODConflictSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Conflict identification
  name: z.string().min(1).max(200),
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),

  // Conflicting duties
  duty1: z.object({
    roleId: z.string().uuid().optional(),
    roleName: z.string(),
    permission: z.string(),
    description: z.string(),
  }),
  duty2: z.object({
    roleId: z.string().uuid().optional(),
    roleName: z.string(),
    permission: z.string(),
    description: z.string(),
  }),

  // Risk
  riskDescription: z.string(),
  potentialImpact: z.string(),

  // Status
  status: z.enum(['active', 'mitigated', 'accepted', 'resolved']),

  // Mitigation
  mitigatingControlId: z.string().uuid().optional(),
  mitigatingControlDescription: z.string().optional(),

  // Violations
  currentViolations: z.number().int().default(0),
  lastViolationDate: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SODConflict = z.infer<typeof SODConflictSchema>;

export const SODViolationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  conflictId: z.string().uuid(),

  // Violator
  identityId: z.string().uuid(),
  identityName: z.string(),

  // Violation details
  detectedAt: z.date(),
  detectionMethod: z.enum(['automated', 'manual_review', 'audit', 'incident']),

  // Status
  status: z.enum(['open', 'under_review', 'remediated', 'accepted', 'closed']),

  // Review
  reviewedBy: z.string().uuid().optional(),
  reviewedAt: z.date().optional(),
  reviewNotes: z.string().optional(),

  // Resolution
  resolution: z.enum(['role_removed', 'compensating_control', 'risk_accepted', 'false_positive']).optional(),
  resolvedBy: z.string().uuid().optional(),
  resolvedAt: z.date().optional(),
  resolutionNotes: z.string().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SODViolation = z.infer<typeof SODViolationSchema>;

// =============================================================================
// FRAUD INVESTIGATION
// =============================================================================

export const FraudCategorySchema = z.enum([
  'asset_misappropriation',
  'financial_statement_fraud',
  'corruption',
  'expense_fraud',
  'vendor_fraud',
  'payroll_fraud',
  'theft',
  'embezzlement',
  'bribery',
  'conflict_of_interest',
  'cyber_fraud',
  'identity_fraud',
  'other',
]);

export const InvestigationStatusSchema = z.enum([
  'reported',
  'under_review',
  'investigating',
  'pending_action',
  'closed_substantiated',
  'closed_unsubstantiated',
  'closed_insufficient_evidence',
  'referred_external',
]);

export const FraudInvestigationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  caseNumber: z.string(),

  // Allegation
  category: FraudCategorySchema,
  status: InvestigationStatusSchema,
  priority: z.enum(['critical', 'high', 'medium', 'low']),

  // Description
  allegationSummary: z.string(),
  allegationDetails: z.string(),
  allegedAmount: z.number().optional(),
  currency: z.string().length(3).optional(),

  // Reporting
  reportedAt: z.date(),
  reportedBy: z.string().uuid().optional(),
  reportingChannel: z.enum(['hotline', 'manager', 'audit', 'anonymous', 'external', 'other']),
  isAnonymous: z.boolean().default(false),

  // Subjects
  subjects: z.array(z.object({
    identityId: z.string().uuid().optional(),
    name: z.string(),
    role: z.string().optional(),
    department: z.string().optional(),
    status: z.enum(['alleged', 'cleared', 'substantiated']),
  })),

  // Investigation team
  leadInvestigatorId: z.string().uuid(),
  leadInvestigatorName: z.string(),
  investigationTeam: z.array(z.string().uuid()).optional(),

  // Timeline
  assignedAt: z.date().optional(),
  investigationStartedAt: z.date().optional(),
  investigationCompletedAt: z.date().optional(),
  closedAt: z.date().optional(),

  // Findings
  findingsSummary: z.string().optional(),
  evidenceSummary: z.string().optional(),
  substantiated: z.boolean().optional(),
  actualLoss: z.number().optional(),
  recoveredAmount: z.number().optional(),

  // Actions
  disciplinaryAction: z.string().optional(),
  processImprovements: z.array(z.string()).optional(),
  controlEnhancements: z.array(z.string()).optional(),

  // Legal
  referredToLegal: z.boolean().default(false),
  referredToLawEnforcement: z.boolean().default(false),
  legalCaseNumber: z.string().optional(),

  // Documents
  reportUrl: z.string().url().optional(),
  evidenceUrls: z.array(z.string().url()).optional(),

  // Confidentiality
  confidentialityLevel: z.enum(['standard', 'restricted', 'highly_restricted']),
  accessList: z.array(z.string().uuid()).optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FraudInvestigation = z.infer<typeof FraudInvestigationSchema>;

// =============================================================================
// FRAUD INDICATOR
// =============================================================================

export const FraudIndicatorSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Indicator
  name: z.string().min(1).max(200),
  category: FraudCategorySchema,
  description: z.string(),

  // Detection
  detectionMethod: z.enum(['rule_based', 'anomaly', 'pattern', 'threshold', 'manual']),
  dataSource: z.string(),
  threshold: z.string().optional(),
  ruleLogic: z.string().optional(),

  // Risk
  riskLevel: z.enum(['critical', 'high', 'medium', 'low']),
  falsePositiveRate: z.number().min(0).max(100).optional(),

  // Status
  active: z.boolean().default(true),
  lastTriggeredAt: z.date().optional(),
  triggerCount: z.number().int().default(0),

  // Response
  alertRecipients: z.array(z.string().uuid()).optional(),
  autoCreateInvestigation: z.boolean().default(false),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FraudIndicator = z.infer<typeof FraudIndicatorSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

export function isControlEffective(control: InternalControl): boolean {
  return control.effectiveness === 'effective';
}

export function isControlDueForTesting(control: InternalControl, daysThreshold: number = 30): boolean {
  if (!control.nextTestDate) return false;
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  return control.nextTestDate <= threshold;
}

export function calculateSODRiskScore(conflict: SODConflict): number {
  const severityScores: Record<string, number> = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
  };

  const baseScore = severityScores[conflict.severity] ?? 0;
  const violationPenalty = Math.min(conflict.currentViolations * 10, 50);

  return Math.min(baseScore + violationPenalty, 100);
}
