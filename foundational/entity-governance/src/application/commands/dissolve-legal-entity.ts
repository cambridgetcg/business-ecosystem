/**
 * Dissolve Legal Entity Command
 */

import { z } from 'zod';

export const DissolveLegalEntityCommandSchema = z.object({
  entityId: z.string().uuid(),
  dissolutionDate: z.date(),
  reason: z.string().max(500).optional(),
  actorId: z.string().uuid().optional(),
});

export type DissolveLegalEntityCommand = z.infer<typeof DissolveLegalEntityCommandSchema>;
