/**
 * Security Governance Domain Models
 *
 * Models for security policies, metrics, committees, and program management.
 *
 * @module domain/security-governance/models/governance
 */

import { z } from 'zod';

// =============================================================================
// SECURITY POLICY
// =============================================================================

export const PolicyTypeSchema = z.enum([
  'policy',
  'standard',
  'procedure',
  'guideline',
  'baseline',
]);

export const PolicyDomainSchema = z.enum([
  'information_security',
  'access_control',
  'data_protection',
  'network_security',
  'application_security',
  'physical_security',
  'business_continuity',
  'incident_response',
  'vendor_management',
  'acceptable_use',
  'privacy',
  'compliance',
  'risk_management',
  'asset_management',
  'cryptography',
  'human_resources',
]);

export const SecurityPolicySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Policy identification
  title: z.string().min(1).max(300),
  policyNumber: z.string(),
  type: PolicyTypeSchema,
  domain: PolicyDomainSchema,
  version: z.string(),

  // Status
  status: z.enum(['draft', 'pending_review', 'pending_approval', 'approved', 'published', 'retired']),

  // Content
  purpose: z.string(),
  scope: z.string(),
  policyStatement: z.string(),
  requirements: z.array(z.object({
    id: z.string(),
    requirement: z.string(),
    mandatory: z.boolean().default(true),
    controlReference: z.string().optional(),
  })),
  exceptions: z.array(z.object({
    condition: z.string(),
    approvalRequired: z.boolean().default(true),
  })).optional(),
  definitions: z.record(z.string()).optional(),

  // References
  parentPolicyId: z.string().uuid().optional(),
  relatedPolicies: z.array(z.string().uuid()).optional(),
  regulatoryReferences: z.array(z.string()).optional(),
  frameworkMappings: z.array(z.object({
    framework: z.string(),
    controls: z.array(z.string()),
  })).optional(),

  // Ownership
  ownerId: z.string().uuid(),
  ownerName: z.string(),
  departmentId: z.string().uuid().optional(),
  custodianId: z.string().uuid().optional(),
  custodianName: z.string().optional(),

  // Audience
  applicableRoles: z.array(z.string()).optional(),
  applicableDepartments: z.array(z.string().uuid()).optional(),
  applicableLocations: z.array(z.string()).optional(),

  // Lifecycle
  effectiveDate: z.date(),
  expirationDate: z.date().optional(),
  reviewFrequency: z.enum(['annual', 'semi_annual', 'quarterly', 'as_needed']),
  lastReviewedAt: z.date().optional(),
  nextReviewDue: z.date().optional(),

  // Approval
  approvals: z.array(z.object({
    approverId: z.string().uuid(),
    approverName: z.string(),
    approverTitle: z.string(),
    approvedAt: z.date(),
    comments: z.string().optional(),
  })).optional(),

  // Compliance
  acknowledgmentRequired: z.boolean().default(true),
  acknowledgmentCount: z.number().int().default(0),
  complianceRate: z.number().min(0).max(100).optional(),

  // Documents
  documentUrl: z.string().url().optional(),
  attachmentUrls: z.array(z.string().url()).optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SecurityPolicy = z.infer<typeof SecurityPolicySchema>;

// =============================================================================
// POLICY ACKNOWLEDGMENT
// =============================================================================

export const PolicyAcknowledgmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  policyId: z.string().uuid(),

  // Identity
  identityId: z.string().uuid(),
  identityName: z.string(),
  departmentId: z.string().uuid().optional(),

  // Acknowledgment
  acknowledgedAt: z.date(),
  acknowledgedVersion: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),

  // Attestation
  attestationText: z.string().optional(),
  electronicSignature: z.string().optional(),

  // Training
  trainingCompletedAt: z.date().optional(),
  trainingScore: z.number().min(0).max(100).optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});

export type PolicyAcknowledgment = z.infer<typeof PolicyAcknowledgmentSchema>;

// =============================================================================
// SECURITY METRICS
// =============================================================================

export const MetricCategorySchema = z.enum([
  'risk',
  'compliance',
  'incidents',
  'vulnerabilities',
  'access',
  'awareness',
  'operations',
  'governance',
]);

export const SecurityMetricSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Metric definition
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  category: MetricCategorySchema,
  description: z.string(),

  // Measurement
  measurementUnit: z.string(),
  measurementFrequency: z.enum(['real_time', 'daily', 'weekly', 'monthly', 'quarterly']),
  dataSource: z.string(),
  calculationMethod: z.string().optional(),

  // Targets
  targetValue: z.number().optional(),
  targetDirection: z.enum(['higher_is_better', 'lower_is_better', 'target_range']).optional(),
  warningThreshold: z.number().optional(),
  criticalThreshold: z.number().optional(),

  // Current state
  currentValue: z.number().optional(),
  previousValue: z.number().optional(),
  trend: z.enum(['improving', 'stable', 'declining']).optional(),
  lastUpdatedAt: z.date().optional(),

  // Historical data
  historicalValues: z.array(z.object({
    date: z.date(),
    value: z.number(),
    notes: z.string().optional(),
  })).optional(),

  // Ownership
  ownerId: z.string().uuid(),
  ownerName: z.string(),

  // Reporting
  reportingLevel: z.enum(['board', 'executive', 'management', 'operational']),
  includeInDashboard: z.boolean().default(true),
  confidential: z.boolean().default(false),

  // Status
  active: z.boolean().default(true),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SecurityMetric = z.infer<typeof SecurityMetricSchema>;

// =============================================================================
// SECURITY COMMITTEE
// =============================================================================

export const SecurityCommitteeSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Committee identification
  name: z.string().min(1).max(200),
  type: z.enum(['steering', 'risk', 'audit', 'incident', 'policy', 'architecture', 'other']),
  status: z.enum(['active', 'inactive', 'disbanded']),

  // Purpose
  purpose: z.string(),
  scope: z.string(),
  authority: z.string(),
  responsibilities: z.array(z.string()),

  // Membership
  chairId: z.string().uuid(),
  chairName: z.string(),
  viceChairId: z.string().uuid().optional(),
  viceChairName: z.string().optional(),
  secretaryId: z.string().uuid().optional(),
  secretaryName: z.string().optional(),
  members: z.array(z.object({
    identityId: z.string().uuid(),
    name: z.string(),
    title: z.string(),
    role: z.enum(['voting', 'non_voting', 'advisory', 'guest']),
    departmentId: z.string().uuid().optional(),
    departmentName: z.string().optional(),
    joinedAt: z.date(),
    term: z.string().optional(),
  })),

  // Meetings
  meetingFrequency: z.enum(['weekly', 'bi_weekly', 'monthly', 'quarterly', 'as_needed']),
  quorumRequirement: z.number().int().optional(),
  typicalDuration: z.string().optional(), // ISO 8601 duration

  // Governance
  charterUrl: z.string().url().optional(),
  reportingTo: z.string().optional(),
  reportsToCommitteeId: z.string().uuid().optional(),

  // Metrics
  totalMeetingsHeld: z.number().int().default(0),
  averageAttendance: z.number().min(0).max(100).optional(),
  lastMeetingDate: z.date().optional(),
  nextMeetingDate: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SecurityCommittee = z.infer<typeof SecurityCommitteeSchema>;

// =============================================================================
// COMMITTEE MEETING
// =============================================================================

export const CommitteeMeetingSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  committeeId: z.string().uuid(),

  // Meeting details
  meetingNumber: z.string(),
  date: z.date(),
  duration: z.number().int(), // minutes
  location: z.string().optional(),
  virtual: z.boolean().default(false),
  virtualLink: z.string().url().optional(),

  // Attendance
  attendees: z.array(z.object({
    identityId: z.string().uuid(),
    name: z.string(),
    attended: z.boolean(),
    proxy: z.string().optional(),
  })),
  quorumMet: z.boolean(),

  // Content
  agenda: z.array(z.object({
    order: z.number().int(),
    topic: z.string(),
    presenter: z.string().optional(),
    duration: z.number().int().optional(),
    type: z.enum(['discussion', 'decision', 'information', 'action_review']),
  })),

  // Minutes
  minutesStatus: z.enum(['pending', 'draft', 'approved', 'published']),
  minutesUrl: z.string().url().optional(),
  minutesApprovedAt: z.date().optional(),

  // Decisions
  decisions: z.array(z.object({
    id: z.string().uuid(),
    topic: z.string(),
    decision: z.string(),
    votesFor: z.number().int().optional(),
    votesAgainst: z.number().int().optional(),
    abstentions: z.number().int().optional(),
    unanimous: z.boolean().optional(),
  })).optional(),

  // Action items
  actionItems: z.array(z.object({
    id: z.string().uuid(),
    description: z.string(),
    assignedTo: z.string(),
    assignedToId: z.string().uuid().optional(),
    dueDate: z.date(),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
    completedAt: z.date().optional(),
  })).optional(),

  // Next meeting
  nextMeetingDate: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CommitteeMeeting = z.infer<typeof CommitteeMeetingSchema>;

// =============================================================================
// SECURITY PROGRAM
// =============================================================================

export const SecurityProgramSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Program identification
  name: z.string().min(1).max(200),
  version: z.string(),
  status: z.enum(['developing', 'active', 'maturing', 'optimizing']),

  // Scope
  description: z.string(),
  mission: z.string(),
  vision: z.string(),
  objectives: z.array(z.object({
    id: z.string().uuid(),
    objective: z.string(),
    targetDate: z.date().optional(),
    status: z.enum(['not_started', 'in_progress', 'achieved', 'at_risk']),
    keyResults: z.array(z.string()).optional(),
  })),

  // Framework
  frameworks: z.array(z.object({
    name: z.string(),
    version: z.string().optional(),
    certificationStatus: z.enum(['none', 'pursuing', 'certified', 'expired']).optional(),
    certificationDate: z.date().optional(),
    certificationExpiry: z.date().optional(),
  })),

  // Maturity
  maturityModel: z.enum(['cmmi', 'nist_csf', 'custom', 'none']).optional(),
  currentMaturityLevel: z.number().min(1).max(5).optional(),
  targetMaturityLevel: z.number().min(1).max(5).optional(),
  maturityAssessmentDate: z.date().optional(),

  // Leadership
  cisoId: z.string().uuid().optional(),
  cisoName: z.string().optional(),
  securityTeamSize: z.number().int().optional(),

  // Budget
  annualBudget: z.number().optional(),
  budgetCurrency: z.string().length(3).optional(),
  budgetUtilization: z.number().min(0).max(100).optional(),

  // Key metrics summary
  riskScore: z.number().min(0).max(100).optional(),
  complianceScore: z.number().min(0).max(100).optional(),
  incidentCount: z.number().int().optional(),
  vulnerabilityCount: z.number().int().optional(),
  openRisks: z.number().int().optional(),

  // Documents
  charterUrl: z.string().url().optional(),
  strategyUrl: z.string().url().optional(),
  roadmapUrl: z.string().url().optional(),

  // Reporting
  lastBoardReportDate: z.date().optional(),
  nextBoardReportDate: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SecurityProgram = z.infer<typeof SecurityProgramSchema>;

// =============================================================================
// SECURITY EXCEPTION
// =============================================================================

export const SecurityExceptionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Exception identification
  exceptionNumber: z.string(),
  title: z.string().min(1).max(300),
  status: z.enum(['draft', 'pending_approval', 'approved', 'denied', 'expired', 'revoked']),

  // Policy/control reference
  policyId: z.string().uuid().optional(),
  policyName: z.string().optional(),
  controlId: z.string().uuid().optional(),
  controlName: z.string().optional(),
  requirementDescription: z.string(),

  // Exception details
  justification: z.string(),
  businessNeed: z.string(),
  scope: z.string(),
  affectedSystems: z.array(z.string()).optional(),
  affectedProcesses: z.array(z.string()).optional(),

  // Risk assessment
  riskAssessment: z.object({
    inherentRisk: z.enum(['critical', 'high', 'medium', 'low']),
    residualRisk: z.enum(['critical', 'high', 'medium', 'low']),
    riskDescription: z.string(),
    mitigatingControls: z.array(z.string()),
  }),

  // Compensating controls
  compensatingControls: z.array(z.object({
    description: z.string(),
    effectiveness: z.enum(['high', 'medium', 'low']),
    monitoringMethod: z.string().optional(),
  })).optional(),

  // Requestor
  requestorId: z.string().uuid(),
  requestorName: z.string(),
  requestorDepartment: z.string().optional(),
  requestedAt: z.date(),

  // Approval
  approvalLevel: z.enum(['ciso', 'security_committee', 'executive', 'board']),
  approvers: z.array(z.object({
    approverId: z.string().uuid(),
    approverName: z.string(),
    approverTitle: z.string(),
    decision: z.enum(['approved', 'denied', 'pending']),
    decidedAt: z.date().optional(),
    comments: z.string().optional(),
  })),

  // Validity
  effectiveDate: z.date().optional(),
  expirationDate: z.date(),
  renewable: z.boolean().default(true),
  renewalCount: z.number().int().default(0),

  // Monitoring
  reviewFrequency: z.enum(['monthly', 'quarterly', 'semi_annually']),
  lastReviewedAt: z.date().optional(),
  nextReviewDue: z.date().optional(),
  reviewNotes: z.string().optional(),

  // Remediation
  remediationPlan: z.string().optional(),
  remediationDueDate: z.date().optional(),
  remediationProgress: z.number().min(0).max(100).optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SecurityException = z.infer<typeof SecurityExceptionSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

export function isPolicyDueForReview(policy: SecurityPolicy): boolean {
  if (!policy.nextReviewDue) return false;
  return new Date() >= policy.nextReviewDue;
}

export function calculatePolicyComplianceRate(
  totalApplicable: number,
  acknowledged: number,
): number {
  if (totalApplicable === 0) return 100;
  return Math.round((acknowledged / totalApplicable) * 100);
}

export function isMetricOnTarget(metric: SecurityMetric): boolean {
  if (metric.currentValue === undefined || metric.targetValue === undefined) {
    return false;
  }

  switch (metric.targetDirection) {
    case 'higher_is_better':
      return metric.currentValue >= metric.targetValue;
    case 'lower_is_better':
      return metric.currentValue <= metric.targetValue;
    default:
      return metric.currentValue === metric.targetValue;
  }
}

export function isExceptionValid(exception: SecurityException): boolean {
  if (exception.status !== 'approved') return false;
  if (!exception.effectiveDate || !exception.expirationDate) return false;

  const now = new Date();
  return now >= exception.effectiveDate && now <= exception.expirationDate;
}

export function calculateSecurityMaturityScore(program: SecurityProgram): number {
  const baseScore = (program.currentMaturityLevel ?? 1) * 20;

  let adjustments = 0;
  if (program.riskScore !== undefined) {
    adjustments += (100 - program.riskScore) * 0.1;
  }
  if (program.complianceScore !== undefined) {
    adjustments += program.complianceScore * 0.1;
  }

  return Math.min(Math.round(baseScore + adjustments), 100);
}

export function getCommitteeQuorumStatus(
  committee: SecurityCommittee,
  attendeeCount: number,
): 'quorum_met' | 'quorum_not_met' | 'unknown' {
  if (!committee.quorumRequirement) return 'unknown';
  return attendeeCount >= committee.quorumRequirement ? 'quorum_met' : 'quorum_not_met';
}
