/**
 * Patent Commands
 * Write operations for patent management
 */

import { z } from 'zod';

const PatentTypeSchema = z.enum(['utility', 'design', 'plant', 'reissue']);

const PatentClaimSchema = z.object({
  number: z.number().int().positive(),
  text: z.string().min(1),
  isIndependent: z.boolean(),
  dependsOn: z.number().int().positive().optional(),
});

export const CreatePatentCommandSchema = z.object({
  title: z.string().min(1).max(500),
  abstract: z.string().max(5000).optional(),
  type: PatentTypeSchema,
  inventors: z.array(z.string().min(1)).min(1),
  assigneeId: z.string().uuid().optional(),
  jurisdictions: z.array(z.string().length(2)).optional(),
  claims: z.array(PatentClaimSchema).optional(),
  actorId: z.string().uuid().optional(),
});

export type CreatePatentCommand = z.infer<typeof CreatePatentCommandSchema>;

export const UpdatePatentCommandSchema = z.object({
  patentId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  abstract: z.string().max(5000).optional(),
  actorId: z.string().uuid().optional(),
});

export type UpdatePatentCommand = z.infer<typeof UpdatePatentCommandSchema>;

export const FilePatentCommandSchema = z.object({
  patentId: z.string().uuid(),
  applicationNumber: z.string().min(1).max(50),
  filingDate: z.coerce.date(),
  actorId: z.string().uuid().optional(),
});

export type FilePatentCommand = z.infer<typeof FilePatentCommandSchema>;

export const GrantPatentCommandSchema = z.object({
  patentId: z.string().uuid(),
  patentNumber: z.string().min(1).max(50),
  grantDate: z.coerce.date(),
  expirationDate: z.coerce.date(),
  actorId: z.string().uuid().optional(),
});

export type GrantPatentCommand = z.infer<typeof GrantPatentCommandSchema>;

export const AbandonPatentCommandSchema = z.object({
  patentId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
  actorId: z.string().uuid().optional(),
});

export type AbandonPatentCommand = z.infer<typeof AbandonPatentCommandSchema>;

export const AddPatentClaimCommandSchema = z.object({
  patentId: z.string().uuid(),
  claim: PatentClaimSchema,
  actorId: z.string().uuid().optional(),
});

export type AddPatentClaimCommand = z.infer<typeof AddPatentClaimCommandSchema>;

export const AssignPatentCommandSchema = z.object({
  patentId: z.string().uuid(),
  assigneeId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type AssignPatentCommand = z.infer<typeof AssignPatentCommandSchema>;

export const DeletePatentCommandSchema = z.object({
  patentId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type DeletePatentCommand = z.infer<typeof DeletePatentCommandSchema>;
