/**
 * Get Legal Entity Query
 */

import { z } from 'zod';

export const GetLegalEntityQuerySchema = z.object({
  entityId: z.string().uuid(),
});

export type GetLegalEntityQuery = z.infer<typeof GetLegalEntityQuerySchema>;
