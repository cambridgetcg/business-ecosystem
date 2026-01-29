/**
 * Update Legal Entity Command
 */

import { z } from 'zod';
import { UpdateLegalEntityInputSchema } from '../../domain/entity/models/legal-entity.js';

export const UpdateLegalEntityCommandSchema = UpdateLegalEntityInputSchema.extend({
  entityId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type UpdateLegalEntityCommand = z.infer<typeof UpdateLegalEntityCommandSchema>;
