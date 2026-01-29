import { z } from 'zod';
import { RequirementCategorySchema } from './regulatory-requirement.js';

/**
 * Audit Finding Entity
 * Records findings from internal or external compliance audits
 */

export const FindingSeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'informational',
]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingStatusSchema = z.enum([
  'open',
  'in_remediation',
  'pending_verification',
  'closed',
  'accepted_risk',
  'false_positive',
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const AuditTypeSchema = z.enum([
  'internal',
  'external',
  'regulatory',
  'self_assessment',
  'third_party',
]);
export type AuditType = z.infer<typeof AuditTypeSchema>;

export const AuditFindingSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  auditId: z.string().uuid().optional(),
  auditType: AuditTypeSchema,
  category: RequirementCategorySchema,
  title: z.string().min(1).max(255),
  description: z.string().max(4000),
  severity: FindingSeveritySchema,
  status: FindingStatusSchema,
  rootCause: z.string().max(2000).optional(),
  recommendation: z.string().max(2000).optional(),
  managementResponse: z.string().max(2000).optional(),
  remediationPlan: z.string().max(2000).optional(),
  remediationDueDate: z.date().optional(),
  remediationCompletedDate: z.date().optional(),
  verifiedBy: z.string().uuid().optional(),
  verifiedDate: z.date().optional(),
  relatedRequirementIds: z.array(z.string().uuid()).optional(),
  evidenceDocuments: z.array(z.string()).optional(),
  identifiedDate: z.date(),
  identifiedBy: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type AuditFinding = z.infer<typeof AuditFindingSchema>;
