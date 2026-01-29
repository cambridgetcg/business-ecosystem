/**
 * Trademark Commands
 * Write operations for trademark management
 */

import { z } from 'zod';

const TrademarkTypeSchema = z.enum(['word', 'design', 'combined', 'sound', 'color', '3d']);

const NiceClassificationSchema = z.object({
  classNumber: z.number().int().min(1).max(45),
  description: z.string().min(1),
  goodsServices: z.array(z.string().min(1)),
});

export const CreateTrademarkCommandSchema = z.object({
  mark: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  type: TrademarkTypeSchema,
  ownerId: z.string().uuid(),
  niceClasses: z.array(NiceClassificationSchema).optional(),
  jurisdictions: z.array(z.string().length(2)).optional(),
  logoUrl: z.string().url().optional(),
  actorId: z.string().uuid().optional(),
});

export type CreateTrademarkCommand = z.infer<typeof CreateTrademarkCommandSchema>;

export const UpdateTrademarkCommandSchema = z.object({
  trademarkId: z.string().uuid(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  actorId: z.string().uuid().optional(),
});

export type UpdateTrademarkCommand = z.infer<typeof UpdateTrademarkCommandSchema>;

export const FileTrademarkCommandSchema = z.object({
  trademarkId: z.string().uuid(),
  applicationNumber: z.string().min(1).max(50),
  filingDate: z.coerce.date(),
  actorId: z.string().uuid().optional(),
});

export type FileTrademarkCommand = z.infer<typeof FileTrademarkCommandSchema>;

export const RegisterTrademarkCommandSchema = z.object({
  trademarkId: z.string().uuid(),
  registrationNumber: z.string().min(1).max(50),
  registrationDate: z.coerce.date(),
  expirationDate: z.coerce.date(),
  actorId: z.string().uuid().optional(),
});

export type RegisterTrademarkCommand = z.infer<typeof RegisterTrademarkCommandSchema>;

export const RenewTrademarkCommandSchema = z.object({
  trademarkId: z.string().uuid(),
  newExpirationDate: z.coerce.date(),
  actorId: z.string().uuid().optional(),
});

export type RenewTrademarkCommand = z.infer<typeof RenewTrademarkCommandSchema>;

export const AddNiceClassCommandSchema = z.object({
  trademarkId: z.string().uuid(),
  niceClass: NiceClassificationSchema,
  actorId: z.string().uuid().optional(),
});

export type AddNiceClassCommand = z.infer<typeof AddNiceClassCommandSchema>;

export const OpposeTrademarkCommandSchema = z.object({
  trademarkId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type OpposeTrademarkCommand = z.infer<typeof OpposeTrademarkCommandSchema>;

export const CancelTrademarkCommandSchema = z.object({
  trademarkId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type CancelTrademarkCommand = z.infer<typeof CancelTrademarkCommandSchema>;

export const DeleteTrademarkCommandSchema = z.object({
  trademarkId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type DeleteTrademarkCommand = z.infer<typeof DeleteTrademarkCommandSchema>;
