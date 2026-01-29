/**
 * @ecosystem/contracts-audit
 * Audit and compliance DTOs for cross-service communication
 */

import { z } from 'zod';

// ============================================================================
// Audit Entry Contracts
// ============================================================================

export const auditActionSchema = z.enum([
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'ACCESS_DENIED',
  'EXPORT',
  'IMPORT',
  'APPROVE',
  'REJECT',
  'SIGN',
  'VERIFY',
  'ENCRYPT',
  'DECRYPT',
]);

export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.coerce.date(),
  action: auditActionSchema,
  resource: z.string(),
  resourceId: z.string(),
  userId: z.string().uuid(),
  userEmail: z.string().email().optional(),
  tenantId: z.string().uuid().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  oldValue: z.record(z.unknown()).optional(),
  newValue: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  correlationId: z.string().uuid().optional(),
  success: z.boolean(),
  errorMessage: z.string().optional(),
});

export type AuditEntry = z.infer<typeof auditEntrySchema>;

// ============================================================================
// Compliance Status Contracts
// ============================================================================

export const complianceStatusSchema = z.enum([
  'compliant',
  'non_compliant',
  'pending_review',
  'remediation_required',
  'exempted',
  'not_applicable',
]);

export type ComplianceStatus = z.infer<typeof complianceStatusSchema>;

export const complianceRequirementSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  regulation: z.string(), // e.g., 'GDPR', 'SOX', 'HIPAA'
  category: z.string(),
  status: complianceStatusSchema,
  dueDate: z.coerce.date().optional(),
  lastReviewDate: z.coerce.date().optional(),
  nextReviewDate: z.coerce.date().optional(),
  assignedTo: z.string().uuid().optional(),
  evidence: z.array(z.string().uuid()).optional(), // Document IDs
  notes: z.string().max(5000).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ComplianceRequirement = z.infer<typeof complianceRequirementSchema>;

// ============================================================================
// Risk Assessment Contracts
// ============================================================================

export const riskLevelSchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'minimal',
]);

export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const riskAssessmentSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  assessmentType: z.string(),
  riskLevel: riskLevelSchema,
  score: z.number().min(0).max(100),
  factors: z.array(z.object({
    name: z.string(),
    weight: z.number().min(0).max(1),
    score: z.number().min(0).max(100),
    notes: z.string().optional(),
  })),
  recommendations: z.array(z.string()).optional(),
  assessedBy: z.string().uuid(),
  assessedAt: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;

// ============================================================================
// Audit Report Contracts
// ============================================================================

export const auditReportSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300),
  type: z.enum(['internal', 'external', 'regulatory', 'compliance']),
  scope: z.string().max(2000),
  period: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }),
  findings: z.array(z.object({
    id: z.string().uuid(),
    severity: riskLevelSchema,
    title: z.string(),
    description: z.string(),
    recommendation: z.string(),
    status: z.enum(['open', 'in_progress', 'resolved', 'accepted']),
  })),
  conclusion: z.string().max(5000).optional(),
  auditorId: z.string().uuid(),
  reviewedBy: z.string().uuid().optional(),
  status: z.enum(['draft', 'in_review', 'final', 'archived']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AuditReport = z.infer<typeof auditReportSchema>;
