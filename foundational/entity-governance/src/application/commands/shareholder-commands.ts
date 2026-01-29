/**
 * Shareholder Commands
 */

import { z } from 'zod';
import { CreateShareholderInputSchema, UpdateShareholderInputSchema } from '../../domain/shareholder/models/shareholder.js';

export const AddShareholderCommandSchema = CreateShareholderInputSchema.extend({
  actorId: z.string().uuid().optional(),
});

export const UpdateShareholderCommandSchema = UpdateShareholderInputSchema.extend({
  shareholderId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export const RemoveShareholderCommandSchema = z.object({
  shareholderId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type AddShareholderCommand = z.infer<typeof AddShareholderCommandSchema>;
export type UpdateShareholderCommand = z.infer<typeof UpdateShareholderCommandSchema>;
export type RemoveShareholderCommand = z.infer<typeof RemoveShareholderCommandSchema>;
