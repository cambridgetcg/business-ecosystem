/**
 * Officer Commands
 *
 * Command objects for officer operations.
 */

import { z } from 'zod';
import { CreateOfficerInputSchema, UpdateOfficerInputSchema } from '../../domain/officer/models/officer.js';

export const AppointOfficerCommandSchema = CreateOfficerInputSchema.extend({
  actorId: z.string().uuid().optional(),
});

export const UpdateOfficerCommandSchema = UpdateOfficerInputSchema.extend({
  officerId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export const TerminateOfficerCommandSchema = z.object({
  officerId: z.string().uuid(),
  terminationDate: z.date(),
  reason: z.string().max(500).optional(),
  actorId: z.string().uuid().optional(),
});

export type AppointOfficerCommand = z.infer<typeof AppointOfficerCommandSchema>;
export type UpdateOfficerCommand = z.infer<typeof UpdateOfficerCommandSchema>;
export type TerminateOfficerCommand = z.infer<typeof TerminateOfficerCommandSchema>;
