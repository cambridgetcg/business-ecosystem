import { z } from 'zod';
import { RequirementCategorySchema, RegulatorTypeSchema } from './regulatory-requirement.js';

/**
 * Compliance Program Entities
 *
 * Defines the core components of a compliance program:
 * - Policies: High-level statements of intent and principles
 * - Procedures: Detailed steps for implementing policies
 * - Attestations: Formal acknowledgments of compliance
 */

// =============================================================================
// Policy Entity
// =============================================================================

export const PolicyStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'published',
  'under_review',
  'deprecated',
  'retired',
]);
export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;

export const PolicySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),

  // Policy identification
  policyNumber: z.string().max(50),
  title: z.string().min(1).max(255),
  description: z.string().max(4000),

  // Classification
  category: RequirementCategorySchema,
  regulators: z.array(RegulatorTypeSchema).nullable(),
  relatedRequirementIds: z.array(z.string().uuid()).nullable(),

  // Content
  purpose: z.string().max(2000),
  scope: z.string().max(2000),
  content: z.string(),
  exceptions: z.string().max(2000).nullable(),
  definitions: z.record(z.string()).nullable(),

  // Ownership
  policyOwner: z.string().uuid().nullable(),
  policyOwnerName: z.string().nullable(),
  approver: z.string().uuid().nullable(),
  approverName: z.string().nullable(),

  // Status and lifecycle
  status: PolicyStatusSchema,
  effectiveDate: z.date().nullable(),
  reviewDate: z.date().nullable(),
  expirationDate: z.date().nullable(),
  approvedDate: z.date().nullable(),
  publishedDate: z.date().nullable(),
  lastReviewedDate: z.date().nullable(),

  // Versioning
  versionNumber: z.string().max(20),
  previousVersionId: z.string().uuid().nullable(),
  changeLog: z.string().max(4000).nullable(),

  // Document storage
  documentStorageKey: z.string().max(500).nullable(),

  // Training
  requiresTraining: z.boolean().default(false),
  trainingCourseId: z.string().uuid().nullable(),

  // Acknowledgment
  requiresAcknowledgment: z.boolean().default(false),
  acknowledgmentFrequency: z.enum(['once', 'annual', 'biannual', 'quarterly']).nullable(),

  // Audit
  notes: z.string().max(4000).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
});

export type Policy = z.infer<typeof PolicySchema>;

// =============================================================================
// Procedure Entity
// =============================================================================

export const ProcedureStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'active',
  'under_review',
  'deprecated',
  'retired',
]);
export type ProcedureStatus = z.infer<typeof ProcedureStatusSchema>;

export const ProcedureStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  title: z.string().max(255),
  description: z.string(),
  responsible: z.string().max(255).nullable(),
  expectedDuration: z.string().max(50).nullable(),
  requiredEvidence: z.array(z.string()).nullable(),
  controlIds: z.array(z.string()).nullable(),
});

export type ProcedureStep = z.infer<typeof ProcedureStepSchema>;

export const ProcedureSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),

  // Procedure identification
  procedureNumber: z.string().max(50),
  title: z.string().min(1).max(255),
  description: z.string().max(4000),

  // Relationship to policy
  policyId: z.string().uuid().nullable(),

  // Classification
  category: RequirementCategorySchema,
  controlIds: z.array(z.string().uuid()).nullable(),

  // Content
  purpose: z.string().max(2000),
  scope: z.string().max(2000),
  prerequisites: z.array(z.string()).nullable(),
  steps: z.array(ProcedureStepSchema),
  frequencyOfUse: z.enum(['as_needed', 'daily', 'weekly', 'monthly', 'quarterly', 'annually']),

  // Ownership
  procedureOwner: z.string().uuid().nullable(),
  procedureOwnerName: z.string().nullable(),

  // Status
  status: ProcedureStatusSchema,
  effectiveDate: z.date().nullable(),
  reviewDate: z.date().nullable(),
  lastReviewedDate: z.date().nullable(),

  // Versioning
  versionNumber: z.string().max(20),
  previousVersionId: z.string().uuid().nullable(),

  // Document storage
  documentStorageKey: z.string().max(500).nullable(),

  // Audit
  notes: z.string().max(4000).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
});

export type Procedure = z.infer<typeof ProcedureSchema>;

// =============================================================================
// Attestation Entity
// =============================================================================

export const AttestationTypeSchema = z.enum([
  'policy_acknowledgment',
  'training_completion',
  'compliance_certification',
  'conflict_of_interest',
  'code_of_conduct',
  'data_protection',
  'security_awareness',
  'whistleblower',
  'anti_bribery',
  'custom',
]);
export type AttestationType = z.infer<typeof AttestationTypeSchema>;

export const AttestationStatusSchema = z.enum([
  'pending',
  'completed',
  'expired',
  'declined',
  'not_required',
]);
export type AttestationStatus = z.infer<typeof AttestationStatusSchema>;

export const AttestationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),

  // Attestation type
  attestationType: AttestationTypeSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),

  // What is being attested to
  policyId: z.string().uuid().nullable(),
  procedureId: z.string().uuid().nullable(),
  trainingId: z.string().uuid().nullable(),
  customContent: z.string().nullable(),

  // Attestation statement
  attestationStatement: z.string(),

  // Who must attest
  requiredFor: z.array(z.string().uuid()),
  requiredForGroups: z.array(z.string()).nullable(),

  // Timing
  dueDate: z.date(),
  reminderDays: z.array(z.number().int()).nullable(),
  expirationDate: z.date().nullable(),
  frequencyDays: z.number().int().nullable(),

  // Completion tracking
  completedBy: z.string().uuid().nullable(),
  completedByName: z.string().nullable(),
  completedAt: z.date().nullable(),
  status: AttestationStatusSchema,

  // Response
  response: z.enum(['agree', 'disagree', 'not_applicable']).nullable(),
  comments: z.string().max(2000).nullable(),
  signature: z.string().nullable(),
  ipAddress: z.string().nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
});

export type Attestation = z.infer<typeof AttestationSchema>;

// =============================================================================
// Create Inputs
// =============================================================================

export const CreatePolicyInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  policyNumber: z.string().max(50),
  title: z.string().min(1).max(255),
  description: z.string().max(4000),
  category: RequirementCategorySchema,
  regulators: z.array(RegulatorTypeSchema).optional(),
  relatedRequirementIds: z.array(z.string().uuid()).optional(),
  purpose: z.string().max(2000),
  scope: z.string().max(2000),
  content: z.string(),
  exceptions: z.string().max(2000).optional(),
  definitions: z.record(z.string()).optional(),
  policyOwner: z.string().uuid().optional(),
  effectiveDate: z.date().optional(),
  reviewDate: z.date().optional(),
  requiresTraining: z.boolean().optional(),
  requiresAcknowledgment: z.boolean().optional(),
  acknowledgmentFrequency: z.enum(['once', 'annual', 'biannual', 'quarterly']).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreatePolicyInput = z.infer<typeof CreatePolicyInputSchema>;

export const CreateProcedureInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  procedureNumber: z.string().max(50),
  title: z.string().min(1).max(255),
  description: z.string().max(4000),
  policyId: z.string().uuid().optional(),
  category: RequirementCategorySchema,
  controlIds: z.array(z.string().uuid()).optional(),
  purpose: z.string().max(2000),
  scope: z.string().max(2000),
  prerequisites: z.array(z.string()).optional(),
  steps: z.array(ProcedureStepSchema),
  frequencyOfUse: z.enum(['as_needed', 'daily', 'weekly', 'monthly', 'quarterly', 'annually']),
  procedureOwner: z.string().uuid().optional(),
  effectiveDate: z.date().optional(),
  reviewDate: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateProcedureInput = z.infer<typeof CreateProcedureInputSchema>;

export const CreateAttestationInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  attestationType: AttestationTypeSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  policyId: z.string().uuid().optional(),
  procedureId: z.string().uuid().optional(),
  trainingId: z.string().uuid().optional(),
  customContent: z.string().optional(),
  attestationStatement: z.string(),
  requiredFor: z.array(z.string().uuid()),
  requiredForGroups: z.array(z.string()).optional(),
  dueDate: z.date(),
  reminderDays: z.array(z.number().int()).optional(),
  expirationDate: z.date().optional(),
  frequencyDays: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateAttestationInput = z.infer<typeof CreateAttestationInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if policy needs review
 */
export function policyNeedsReview(policy: Policy): boolean {
  if (!policy.reviewDate) return false;
  return new Date() >= policy.reviewDate;
}

/**
 * Check if policy is active
 */
export function isPolicyActive(policy: Policy): boolean {
  if (policy.status !== 'published') return false;
  const now = new Date();
  if (policy.effectiveDate && policy.effectiveDate > now) return false;
  if (policy.expirationDate && policy.expirationDate < now) return false;
  return true;
}

/**
 * Get days until policy review
 */
export function daysUntilPolicyReview(policy: Policy): number | null {
  if (!policy.reviewDate) return null;
  const now = new Date();
  return Math.ceil((policy.reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if attestation is overdue
 */
export function isAttestationOverdue(attestation: Attestation): boolean {
  if (attestation.status === 'completed') return false;
  return new Date() > attestation.dueDate;
}

/**
 * Get attestation completion rate
 */
export function calculateAttestationCompletionRate(
  completed: number,
  total: number
): number {
  if (total === 0) return 100;
  return Math.round((completed / total) * 100 * 10) / 10;
}

/**
 * Standard compliance policies for UK companies
 */
export const UK_STANDARD_POLICIES = [
  {
    policyNumber: 'POL-001',
    title: 'Anti-Bribery and Corruption Policy',
    category: 'aml' as const,
    purpose: 'To ensure compliance with the UK Bribery Act 2010',
    requiresTraining: true,
    requiresAcknowledgment: true,
    acknowledgmentFrequency: 'annual' as const,
  },
  {
    policyNumber: 'POL-002',
    title: 'Anti-Money Laundering Policy',
    category: 'aml' as const,
    purpose: 'To prevent money laundering and terrorist financing',
    requiresTraining: true,
    requiresAcknowledgment: true,
    acknowledgmentFrequency: 'annual' as const,
  },
  {
    policyNumber: 'POL-003',
    title: 'Data Protection Policy',
    category: 'gdpr' as const,
    purpose: 'To ensure compliance with UK GDPR and Data Protection Act 2018',
    requiresTraining: true,
    requiresAcknowledgment: true,
    acknowledgmentFrequency: 'annual' as const,
  },
  {
    policyNumber: 'POL-004',
    title: 'Whistleblowing Policy',
    category: 'corporate_governance' as const,
    purpose: 'To provide a mechanism for reporting wrongdoing',
    requiresAcknowledgment: true,
    acknowledgmentFrequency: 'once' as const,
  },
  {
    policyNumber: 'POL-005',
    title: 'Conflicts of Interest Policy',
    category: 'corporate_governance' as const,
    purpose: 'To identify, disclose, and manage conflicts of interest',
    requiresAcknowledgment: true,
    acknowledgmentFrequency: 'annual' as const,
  },
  {
    policyNumber: 'POL-006',
    title: 'Information Security Policy',
    category: 'data_retention' as const,
    purpose: 'To protect company information assets',
    requiresTraining: true,
    requiresAcknowledgment: true,
    acknowledgmentFrequency: 'annual' as const,
  },
] as const;
