/**
 * Create Legal Entity Command
 */

import { z } from 'zod';
import { CreateLegalEntityInputSchema } from '../../domain/entity/models/legal-entity.js';

export const CreateLegalEntityCommandSchema = CreateLegalEntityInputSchema.extend({
  actorId: z.string().uuid().optional(),
});

export type CreateLegalEntityCommand = z.infer<typeof CreateLegalEntityCommandSchema>;
