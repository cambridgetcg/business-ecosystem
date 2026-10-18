/**
 * Vendor Security Domain Models
 *
 * Models for vendor risk assessments, security questionnaires, and ongoing monitoring.
 *
 * @module domain/vendor-security/models/vendor
 */

import { z } from 'zod';

// =============================================================================
// VENDOR RISK ASSESSMENT
// =============================================================================

export const VendorCriticalitySchema = z.enum([
  'critical',      // Business cannot operate without
  'high',          // Significant impact if unavailable
  'medium',        // Moderate impact
  'low',           // Minimal impact
]);

export const VendorRiskRatingSchema = z.enum([
  'very_high',
  'high',
  'medium',
  'low',
  'very_low',
]);

export const AssessmentStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'expired',
  'waived',
]);

export const VendorRiskAssessmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  vendorId: z.string().uuid(),
  vendorName: z.string(),

  // Assessment details
  assessmentType: z.enum(['initial', 'periodic', 'triggered', 'renewal']),
  status: AssessmentStatusSchema,

  // Criticality
  criticality: VendorCriticalitySchema,
  criticalityJustification: z.string().optional(),

  // Data handling
  dataClassification: z.enum(['public', 'internal', 'confidential', 'restricted']),
  handlesPersonalData: z.boolean(),
  handlesFinancialData: z.boolean(),
  handlesHealthData: z.boolean(),
  dataResidency: z.array(z.string()).optional(), // Countries

  // Access
  hasNetworkAccess: z.boolean(),
  hasSystemAccess: z.boolean(),
  hasPhysicalAccess: z.boolean(),
  accessScope: z.string().optional(),

  // Risk scores
  inherentRiskScore: z.number().min(0).max(100),
  residualRiskScore: z.number().min(0).max(100),
  overallRiskRating: VendorRiskRatingSchema,

  // Risk domains
  riskDomains: z.array(z.object({
    domain: z.enum([
      'information_security',
      'data_privacy',
      'business_continuity',
      'compliance',
      'financial',
      'operational',
      'reputational',
    ]),
    score: z.number().min(0).max(100),
    findings: z.array(z.string()).optional(),
    mitigations: z.array(z.string()).optional(),
  })),

  // Questionnaire
  questionnaireId: z.string().uuid().optional(),
  questionnaireCompletedAt: z.date().optional(),

  // Timeline
  assessmentDate: z.date(),
  nextAssessmentDate: z.date(),
  expirationDate: z.date(),

  // Ownership
  assessorId: z.string().uuid(),
  assessorName: z.string(),
  reviewerId: z.string().uuid().optional(),
  reviewerName: z.string().optional(),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.date().optional(),

  // Findings
  totalFindings: z.number().int().default(0),
  criticalFindings: z.number().int().default(0),
  highFindings: z.number().int().default(0),
  openFindings: z.number().int().default(0),

  // Documentation
  reportUrl: z.string().url().optional(),
  evidenceUrls: z.array(z.string().url()).optional(),

  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VendorRiskAssessment = z.infer<typeof VendorRiskAssessmentSchema>;

// =============================================================================
// SECURITY QUESTIONNAIRE
// =============================================================================

export const QuestionTypeSchema = z.enum([
  'yes_no',
  'multiple_choice',
  'text',
  'number',
  'date',
  'file_upload',
  'rating_scale',
]);

export const SecurityQuestionnaireSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),

  // Questionnaire template
  name: z.string().min(1).max(200),
  version: z.string(),
  description: z.string().optional(),

  // Categorization
  category: z.enum(['standard', 'enhanced', 'critical', 'custom']),
  applicableVendorTypes: z.array(z.string()).optional(),
  applicableCriticality: z.array(VendorCriticalitySchema).optional(),

  // Questions
  sections: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    weight: z.number().min(0).max(100).default(1),
    questions: z.array(z.object({
      id: z.string().uuid(),
      text: z.string(),
      type: QuestionTypeSchema,
      required: z.boolean().default(true),
      weight: z.number().min(0).max(100).default(1),
      options: z.array(z.object({
        value: z.string(),
        label: z.string(),
        score: z.number().optional(),
      })).optional(),
      evidenceRequired: z.boolean().default(false),
      guidanceText: z.string().optional(),
      riskDomain: z.string().optional(),
    })),
  })),

  // Scoring
  passingScore: z.number().min(0).max(100).optional(),
  scoringMethod: z.enum(['weighted', 'simple', 'custom']).default('weighted'),

  // Status
  active: z.boolean().default(true),
  effectiveDate: z.date(),
  expirationDate: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SecurityQuestionnaire = z.infer<typeof SecurityQuestionnaireSchema>;

// =============================================================================
// QUESTIONNAIRE RESPONSE
// =============================================================================

export const QuestionnaireResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  questionnaireId: z.string().uuid(),
  vendorId: z.string().uuid(),
  assessmentId: z.string().uuid().optional(),

  // Status
  status: z.enum(['draft', 'submitted', 'under_review', 'completed', 'rejected']),

  // Responses
  responses: z.array(z.object({
    questionId: z.string().uuid(),
    sectionId: z.string().uuid(),
    answer: z.unknown(), // Type depends on question type
    score: z.number().optional(),
    evidenceUrls: z.array(z.string().url()).optional(),
    notes: z.string().optional(),
    reviewerNotes: z.string().optional(),
    flagged: z.boolean().default(false),
  })),

  // Scoring
  totalScore: z.number().min(0).max(100).optional(),
  sectionScores: z.record(z.number()).optional(),
  passed: z.boolean().optional(),

  // Timeline
  sentAt: z.date().optional(),
  startedAt: z.date().optional(),
  submittedAt: z.date().optional(),
  reviewedAt: z.date().optional(),
  completedAt: z.date().optional(),
  dueDate: z.date().optional(),

  // Respondent
  respondentName: z.string().optional(),
  respondentEmail: z.string().email().optional(),
  respondentTitle: z.string().optional(),

  // Reviewer
  reviewerId: z.string().uuid().optional(),
  reviewerName: z.string().optional(),

  // Follow-up
  requiresFollowUp: z.boolean().default(false),
  followUpNotes: z.string().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type QuestionnaireResponse = z.infer<typeof QuestionnaireResponseSchema>;

// =============================================================================
// VENDOR REMEDIATION
// =============================================================================

export const RemediationStatusSchema = z.enum([
  'open',
  'in_progress',
  'pending_verification',
  'verified',
  'closed',
  'overdue',
  'accepted_risk',
]);

export const VendorRemediationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  vendorId: z.string().uuid(),
  assessmentId: z.string().uuid(),

  // Finding
  findingId: z.string().uuid(),
  findingTitle: z.string(),
  findingDescription: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  riskDomain: z.string(),

  // Remediation
  status: RemediationStatusSchema,
  remediationPlan: z.string(),
  expectedCompletionDate: z.date(),
  actualCompletionDate: z.date().optional(),

  // Tracking
  assignedTo: z.string().uuid().optional(),
  assignedToName: z.string().optional(),
  lastUpdateDate: z.date().optional(),
  lastUpdateNotes: z.string().optional(),

  // Verification
  verifiedBy: z.string().uuid().optional(),
  verifiedAt: z.date().optional(),
  verificationNotes: z.string().optional(),
  evidenceUrls: z.array(z.string().url()).optional(),

  // Extensions
  extensionRequested: z.boolean().default(false),
  extensionApproved: z.boolean().optional(),
  newExpectedDate: z.date().optional(),
  extensionReason: z.string().optional(),

  // Risk acceptance
  riskAccepted: z.boolean().default(false),
  riskAcceptedBy: z.string().uuid().optional(),
  riskAcceptedAt: z.date().optional(),
  riskAcceptanceJustification: z.string().optional(),
  riskAcceptanceExpiresAt: z.date().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VendorRemediation = z.infer<typeof VendorRemediationSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

export function isAssessmentExpired(assessment: VendorRiskAssessment): boolean {
  return assessment.expirationDate < new Date();
}

export function isAssessmentDue(assessment: VendorRiskAssessment, daysThreshold: number = 30): boolean {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  return assessment.nextAssessmentDate <= threshold;
}

export function calculateInherentRisk(
  criticality: z.infer<typeof VendorCriticalitySchema>,
  dataClassification: string,
  hasSystemAccess: boolean
): number {
  const criticalityScores: Record<string, number> = {
    critical: 40,
    high: 30,
    medium: 20,
    low: 10,
  };

  const dataScores: Record<string, number> = {
    restricted: 30,
    confidential: 20,
    internal: 10,
    public: 5,
  };

  let score = criticalityScores[criticality] ?? 20;
  score += dataScores[dataClassification] ?? 10;
  if (hasSystemAccess) score += 20;

  return Math.min(score, 100);
}

export function isRemediationOverdue(remediation: VendorRemediation): boolean {
  if (remediation.status === 'closed' || remediation.status === 'verified') return false;
  return remediation.expectedCompletionDate < new Date();
}
