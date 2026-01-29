/**
 * Trademark Queries
 * Read operations for trademark retrieval
 */

import { z } from 'zod';

export const GetTrademarkQuerySchema = z.object({
  trademarkId: z.string().uuid(),
});

export type GetTrademarkQuery = z.infer<typeof GetTrademarkQuerySchema>;

export const ListTrademarksQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'published', 'opposed', 'registered', 'cancelled', 'expired', 'abandoned']).optional(),
  type: z.enum(['word', 'design', 'combined', 'sound', 'color', '3d']).optional(),
  ownerId: z.string().uuid().optional(),
  niceClass: z.number().int().min(1).max(45).optional(),
  jurisdiction: z.string().length(2).optional(),
  searchTerm: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListTrademarksQuery = z.infer<typeof ListTrademarksQuerySchema>;

export const SearchTrademarksByMarkQuerySchema = z.object({
  mark: z.string().min(1),
  fuzzyMatch: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type SearchTrademarksByMarkQuery = z.infer<typeof SearchTrademarksByMarkQuerySchema>;

export const CountTrademarksQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'published', 'opposed', 'registered', 'cancelled', 'expired', 'abandoned']).optional(),
  type: z.enum(['word', 'design', 'combined', 'sound', 'color', '3d']).optional(),
  ownerId: z.string().uuid().optional(),
});

export type CountTrademarksQuery = z.infer<typeof CountTrademarksQuerySchema>;

export const GetRenewableTrademarksQuerySchema = z.object({
  daysUntilRenewal: z.number().int().min(1).max(365).default(90),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type GetRenewableTrademarksQuery = z.infer<typeof GetRenewableTrademarksQuerySchema>;
