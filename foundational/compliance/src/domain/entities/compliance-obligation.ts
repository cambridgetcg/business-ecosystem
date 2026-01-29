import { z } from 'zod';
import { RequirementCategorySchema, RegulatorTypeSchema } from './regulatory-requirement.js';

/**
 * Compliance Obligation Entity
 * An entity's specific obligation arising from a regulatory requirement
 */

export const ObligationStatusSchema = z.enum([
  'pending',
  'in_progress',
  'under_review',
  'completed',
  'overdue',
  'waived',
  'not_applicable',
]);
export type ObligationStatus = z.infer<typeof ObligationStatusSchema>;

export const ComplianceObligationSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  requirementId: z.string().uuid(),
  regulator: RegulatorTypeSchema,
  category: RequirementCategorySchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  status: ObligationStatusSchema,
  dueDate: z.date(),
  completedDate: z.date().optional(),
  completedBy: z.string().uuid().optional(),
  reviewedBy: z.string().uuid().optional(),
  reviewedDate: z.date().optional(),
  evidenceDocuments: z.array(z.string()).optional(), // Storage keys
  notes: z.string().max(2000).optional(),
  reminderSent: z.boolean().default(false),
  escalated: z.boolean().default(false),
  escalatedTo: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type ComplianceObligation = z.infer<typeof ComplianceObligationSchema>;

export const CreateObligationInputSchema = z.object({
  entityId: z.string().uuid(),
  requirementId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  dueDate: z.date(),
});

export type CreateObligationInput = z.infer<typeof CreateObligationInputSchema>;
