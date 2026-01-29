/**
 * List Legal Entities Query
 */

import { z } from 'zod';

export const ListLegalEntitiesQuerySchema = z.object({
  status: z.string().optional(),
  entityType: z.string().optional(),
  jurisdictionCountry: z.string().optional(),
  jurisdictionState: z.string().optional(),
  searchTerm: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListLegalEntitiesQuery = z.infer<typeof ListLegalEntitiesQuerySchema>;
