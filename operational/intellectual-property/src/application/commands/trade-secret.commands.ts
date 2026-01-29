/**
 * Trade Secret Commands
 * Write operations for trade secret management
 */

import { z } from 'zod';

const TradeSecretCategorySchema = z.enum([
  'technical', 'business', 'financial', 'customer', 'process', 'formula', 'other'
]);

const SensitivityLevelSchema = z.enum([
  'confidential', 'highly_confidential', 'restricted'
]);

const AccessLevelSchema = z.enum(['read', 'write', 'admin']);

export const CreateTradeSecretCommandSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  category: TradeSecretCategorySchema,
  sensitivityLevel: SensitivityLevelSchema,
  ownerId: z.string().uuid(),
  custodianId: z.string().uuid().optional(),
  identifiedDate: z.coerce.date(),
  economicValueDescription: z.string().min(1).max(2000),
  estimatedValue: z.number().int().min(0).optional(),
  actorId: z.string().uuid().optional(),
});

export type CreateTradeSecretCommand = z.infer<typeof CreateTradeSecretCommandSchema>;

export const UpdateTradeSecretCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(5000).optional(),
  economicValueDescription: z.string().min(1).max(2000).optional(),
  actorId: z.string().uuid().optional(),
});

export type UpdateTradeSecretCommand = z.infer<typeof UpdateTradeSecretCommandSchema>;

export const GrantAccessCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  userId: z.string().uuid(),
  accessLevel: AccessLevelSchema,
  grantedBy: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type GrantAccessCommand = z.infer<typeof GrantAccessCommandSchema>;

export const RevokeAccessCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  userId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type RevokeAccessCommand = z.infer<typeof RevokeAccessCommandSchema>;

export const DiscloseTradeSecretCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
  actorId: z.string().uuid().optional(),
});

export type DiscloseTradeSecretCommand = z.infer<typeof DiscloseTradeSecretCommandSchema>;

export const AbandonTradeSecretCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type AbandonTradeSecretCommand = z.infer<typeof AbandonTradeSecretCommandSchema>;

export const ConvertToPatentCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  patentApplicationId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
});

export type ConvertToPatentCommand = z.infer<typeof ConvertToPatentCommandSchema>;

export const UpdateReviewDateCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  reviewDate: z.coerce.date(),
  actorId: z.string().uuid().optional(),
});

export type UpdateReviewDateCommand = z.infer<typeof UpdateReviewDateCommandSchema>;

export const UpdateEstimatedValueCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  estimatedValue: z.number().int().min(0),
  actorId: z.string().uuid().optional(),
});

export type UpdateEstimatedValueCommand = z.infer<typeof UpdateEstimatedValueCommandSchema>;

export const AssignCustodianCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  custodianId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type AssignCustodianCommand = z.infer<typeof AssignCustodianCommandSchema>;

export const UpdateSensitivityLevelCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  sensitivityLevel: SensitivityLevelSchema,
  actorId: z.string().uuid().optional(),
});

export type UpdateSensitivityLevelCommand = z.infer<typeof UpdateSensitivityLevelCommandSchema>;

export const DeleteTradeSecretCommandSchema = z.object({
  tradeSecretId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type DeleteTradeSecretCommand = z.infer<typeof DeleteTradeSecretCommandSchema>;
