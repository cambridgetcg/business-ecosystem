/**
 * Trade Secret Queries
 * Read operations for trade secret management
 */

import { z } from 'zod';

export const GetTradeSecretByIdQuerySchema = z.object({
  tradeSecretId: z.string().uuid(),
});

export type GetTradeSecretByIdQuery = z.infer<typeof GetTradeSecretByIdQuerySchema>;

export const GetTradeSecretsByOwnerQuerySchema = z.object({
  ownerId: z.string().uuid(),
});

export type GetTradeSecretsByOwnerQuery = z.infer<typeof GetTradeSecretsByOwnerQuerySchema>;

export const GetTradeSecretsByCustodianQuerySchema = z.object({
  custodianId: z.string().uuid(),
});

export type GetTradeSecretsByCustodianQuery = z.infer<typeof GetTradeSecretsByCustodianQuerySchema>;

export const ListTradeSecretsQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  status: z.enum(['active', 'disclosed', 'abandoned', 'converted_to_patent']).optional(),
  category: z.enum(['technical', 'business', 'financial', 'customer', 'process', 'formula', 'other']).optional(),
  sensitivityLevel: z.enum(['confidential', 'highly_confidential', 'restricted']).optional(),
});

export type ListTradeSecretsQuery = z.infer<typeof ListTradeSecretsQuerySchema>;

export const SearchTradeSecretsQuerySchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(100).default(50),
});

export type SearchTradeSecretsQuery = z.infer<typeof SearchTradeSecretsQuerySchema>;

export const GetTradeSecretsWithAccessQuerySchema = z.object({
  userId: z.string().uuid(),
});

export type GetTradeSecretsWithAccessQuery = z.infer<typeof GetTradeSecretsWithAccessQuerySchema>;

export const CountTradeSecretsQuerySchema = z.object({
  status: z.enum(['active', 'disclosed', 'abandoned', 'converted_to_patent']).optional(),
  category: z.enum(['technical', 'business', 'financial', 'customer', 'process', 'formula', 'other']).optional(),
  ownerId: z.string().uuid().optional(),
});

export type CountTradeSecretsQuery = z.infer<typeof CountTradeSecretsQuerySchema>;
