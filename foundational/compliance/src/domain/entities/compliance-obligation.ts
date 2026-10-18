import { z } from 'zod';
import { RequirementCategorySchema, RegulatorTypeSchema, JurisdictionSchema } from './regulatory-requirement.js';

/**
 * Compliance Obligation Entity
 * An entity's specific obligation arising from a regulatory requirement
 */

export const ObligationStatusSchema = z.enum([
  'pending',
  'in_progress',
  'under_review',
  'submitted',
  'completed',
  'overdue',
  'waived',
  'not_applicable',
  'failed',
]);
export type ObligationStatus = z.infer<typeof ObligationStatusSchema>;

export const ObligationPrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);
export type ObligationPriority = z.infer<typeof ObligationPrioritySchema>;

export const ComplianceObligationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  requirementId: z.string().uuid(),

  // Regulator reference
  regulator: RegulatorTypeSchema,
  jurisdiction: JurisdictionSchema,
  category: RequirementCategorySchema,

  // Obligation details
  title: z.string().min(1).max(255),
  description: z.string().max(4000).nullable(),
  formReference: z.string().nullable(),

  // Status
  status: ObligationStatusSchema,
  priority: ObligationPrioritySchema,

  // Timing
  periodStart: z.date().nullable(),
  periodEnd: z.date().nullable(),
  dueDate: z.date(),
  submittedDate: z.date().nullable(),
  completedDate: z.date().nullable(),

  // Assignment
  assignedTo: z.string().uuid().nullable(),
  assignedToName: z.string().nullable(),
  assignedAt: z.date().nullable(),

  // Review
  reviewedBy: z.string().uuid().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedDate: z.date().nullable(),
  reviewNotes: z.string().max(2000).nullable(),

  // Completion
  completedBy: z.string().uuid().nullable(),
  completedByName: z.string().nullable(),
  completionNotes: z.string().max(2000).nullable(),

  // Evidence
  evidenceDocuments: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    storageKey: z.string(),
    uploadedAt: z.date(),
    uploadedBy: z.string().uuid(),
  })).nullable(),

  // External references
  submissionReference: z.string().nullable(), // HMRC receipt, CH reference
  externalUrl: z.string().url().nullable(),

  // Reminders and escalation
  reminderSentAt: z.date().nullable(),
  escalated: z.boolean().default(false),
  escalatedAt: z.date().nullable(),
  escalatedTo: z.string().uuid().nullable(),
  escalationReason: z.string().max(500).nullable(),

  // Cost tracking
  filingFee: z.number().nullable(),
  penaltyAmount: z.number().nullable(),
  totalCost: z.number().nullable(),

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

export type ComplianceObligation = z.infer<typeof ComplianceObligationSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateObligationInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  requirementId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(4000).optional(),
  periodStart: z.date().optional(),
  periodEnd: z.date().optional(),
  dueDate: z.date(),
  priority: ObligationPrioritySchema.optional(),
  assignedTo: z.string().uuid().optional(),
  filingFee: z.number().optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateObligationInput = z.infer<typeof CreateObligationInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdateObligationInputSchema = z.object({
  status: ObligationStatusSchema.optional(),
  priority: ObligationPrioritySchema.optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.date().optional(),
  notes: z.string().max(4000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export type UpdateObligationInput = z.infer<typeof UpdateObligationInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if obligation is overdue
 */
export function isOverdue(obligation: ComplianceObligation): boolean {
  if (obligation.status === 'completed' || obligation.status === 'waived' || obligation.status === 'not_applicable') {
    return false;
  }
  return new Date() > obligation.dueDate;
}

/**
 * Get days until due (negative if overdue)
 */
export function getDaysUntilDue(obligation: ComplianceObligation): number {
  const now = new Date();
  const dueDate = new Date(obligation.dueDate);
  return Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if obligation needs attention (due within 7 days or overdue)
 */
export function needsAttention(obligation: ComplianceObligation): boolean {
  if (obligation.status === 'completed' || obligation.status === 'waived' || obligation.status === 'not_applicable') {
    return false;
  }
  return getDaysUntilDue(obligation) <= 7;
}

/**
 * Check if escalation is needed
 */
export function needsEscalation(obligation: ComplianceObligation): boolean {
  if (obligation.escalated) return false;
  if (obligation.status === 'completed' || obligation.status === 'waived') return false;

  // Escalate if overdue
  if (isOverdue(obligation)) return true;

  // Escalate critical/high priority within 3 days
  if ((obligation.priority === 'critical' || obligation.priority === 'high') && getDaysUntilDue(obligation) <= 3) {
    return true;
  }

  return false;
}

/**
 * Get status color
 */
export function getStatusColor(status: ObligationStatus): string {
  const colors: Record<ObligationStatus, string> = {
    pending: '#6B7280',
    in_progress: '#3B82F6',
    under_review: '#8B5CF6',
    submitted: '#10B981',
    completed: '#059669',
    overdue: '#DC2626',
    waived: '#9CA3AF',
    not_applicable: '#D1D5DB',
    failed: '#EF4444',
  };
  return colors[status];
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: ObligationPriority): string {
  const colors: Record<ObligationPriority, string> = {
    critical: '#DC2626',
    high: '#EA580C',
    medium: '#CA8A04',
    low: '#2563EB',
  };
  return colors[priority];
}

/**
 * Get status label
 */
export function getStatusLabel(status: ObligationStatus): string {
  const labels: Record<ObligationStatus, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    submitted: 'Submitted',
    completed: 'Completed',
    overdue: 'Overdue',
    waived: 'Waived',
    not_applicable: 'Not Applicable',
    failed: 'Failed',
  };
  return labels[status];
}

/**
 * Can transition to status
 */
export function canTransitionTo(current: ObligationStatus, target: ObligationStatus): boolean {
  const validTransitions: Record<ObligationStatus, ObligationStatus[]> = {
    pending: ['in_progress', 'waived', 'not_applicable'],
    in_progress: ['under_review', 'submitted', 'completed', 'waived'],
    under_review: ['in_progress', 'submitted', 'completed', 'failed'],
    submitted: ['completed', 'failed'],
    completed: [],
    overdue: ['in_progress', 'submitted', 'completed', 'waived'],
    waived: [],
    not_applicable: [],
    failed: ['in_progress', 'pending'],
  };

  return validTransitions[current]?.includes(target) ?? false;
}

/**
 * Calculate priority based on due date and category
 */
export function calculatePriority(daysUntilDue: number, category: string): ObligationPriority {
  // Critical tax deadlines
  const criticalCategories = ['corporation_tax', 'vat', 'paye', 'data_breach'];

  if (daysUntilDue < 0) return 'critical'; // Overdue
  if (criticalCategories.includes(category) && daysUntilDue <= 7) return 'critical';
  if (daysUntilDue <= 3) return 'high';
  if (daysUntilDue <= 14) return 'medium';
  return 'low';
}
