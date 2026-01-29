/**
 * Litigation / Legal Matters - Zod Validators
 */

import { z } from 'zod';

export const MatterTypeEnum = z.enum([
  'LITIGATION', 'ARBITRATION', 'MEDIATION', 'REGULATORY',
  'INTELLECTUAL_PROPERTY', 'EMPLOYMENT_DISPUTE', 'CONTRACT_DISPUTE',
  'COMPLIANCE_INVESTIGATION', 'OTHER'
]);

export const MatterStatusEnum = z.enum([
  'OPEN', 'UNDER_REVIEW', 'IN_DISCOVERY', 'IN_NEGOTIATION',
  'IN_TRIAL', 'SETTLED', 'WON', 'LOST', 'DISMISSED', 'CLOSED'
]);

export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const CreateMatterSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  type: MatterTypeEnum,
  priority: PriorityEnum.default('MEDIUM'),
  
  // Related contracts
  contractIds: z.array(z.string().cuid()).optional(),
  
  // Parties
  internalLead: z.string().max(200).optional(),
  externalCounsel: z.string().max(200).optional(),
  opposingParty: z.string().max(500).optional(),
  
  // Court/Venue
  court: z.string().max(200).optional(),
  jurisdiction: z.string().max(200).optional(),
  caseNumber: z.string().max(100).optional(),
  
  // Dates
  filedDate: z.coerce.date().optional(),
  hearingDate: z.coerce.date().optional(),
  
  // Financial
  estimatedCost: z.number().positive().optional(),
});

export const UpdateMatterSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  type: MatterTypeEnum.optional(),
  status: MatterStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  
  contractIds: z.array(z.string().cuid()).optional(),
  
  internalLead: z.string().max(200).optional(),
  externalCounsel: z.string().max(200).optional(),
  opposingParty: z.string().max(500).optional(),
  
  court: z.string().max(200).optional(),
  jurisdiction: z.string().max(200).optional(),
  caseNumber: z.string().max(100).optional(),
  
  filedDate: z.coerce.date().optional(),
  hearingDate: z.coerce.date().optional(),
  
  estimatedCost: z.number().positive().optional(),
  actualCost: z.number().positive().optional(),
});

export const CloseMatterSchema = z.object({
  outcome: MatterStatusEnum.refine(s => ['SETTLED', 'WON', 'LOST', 'DISMISSED', 'CLOSED'].includes(s)),
  settlement: z.number().positive().optional(),
  actualCost: z.number().positive().optional(),
  notes: z.string().max(5000).optional(),
});

export const MatterActivitySchema = z.object({
  type: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  metadata: z.record(z.unknown()).optional(),
});

export const MatterQuerySchema = z.object({
  type: MatterTypeEnum.optional(),
  status: MatterStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  search: z.string().optional(),
  internalLead: z.string().optional(),
  openOnly: z.coerce.boolean().default(false),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'priority', 'hearingDate', 'estimatedCost']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateMatterInput = z.infer<typeof CreateMatterSchema>;
export type UpdateMatterInput = z.infer<typeof UpdateMatterSchema>;
export type CloseMatterInput = z.infer<typeof CloseMatterSchema>;
export type MatterActivityInput = z.infer<typeof MatterActivitySchema>;
export type MatterQuery = z.infer<typeof MatterQuerySchema>;
