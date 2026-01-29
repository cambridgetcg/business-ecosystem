/**
 * Patent Queries
 * Read operations for patent retrieval
 */

import { z } from 'zod';

export const GetPatentQuerySchema = z.object({
  patentId: z.string().uuid(),
});

export type GetPatentQuery = z.infer<typeof GetPatentQuerySchema>;

export const ListPatentsQuerySchema = z.object({
  status: z.enum(['draft', 'provisional', 'pending', 'published', 'granted', 'abandoned', 'expired', 'lapsed']).optional(),
  type: z.enum(['utility', 'design', 'plant', 'reissue']).optional(),
  assigneeId: z.string().uuid().optional(),
  jurisdiction: z.string().length(2).optional(),
  searchTerm: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListPatentsQuery = z.infer<typeof ListPatentsQuerySchema>;

export const GetPatentsByInventorQuerySchema = z.object({
  inventorName: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type GetPatentsByInventorQuery = z.infer<typeof GetPatentsByInventorQuerySchema>;

export const CountPatentsQuerySchema = z.object({
  status: z.enum(['draft', 'provisional', 'pending', 'published', 'granted', 'abandoned', 'expired', 'lapsed']).optional(),
  type: z.enum(['utility', 'design', 'plant', 'reissue']).optional(),
  assigneeId: z.string().uuid().optional(),
});

export type CountPatentsQuery = z.infer<typeof CountPatentsQuerySchema>;

export const GetExpiringPatentsQuerySchema = z.object({
  daysUntilExpiration: z.number().int().min(1).max(365).default(90),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type GetExpiringPatentsQuery = z.infer<typeof GetExpiringPatentsQuerySchema>;
