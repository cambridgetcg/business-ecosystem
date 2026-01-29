/**
 * License Queries
 * Read operations for license retrieval
 */

import { z } from 'zod';

export const GetLicenseQuerySchema = z.object({
  licenseId: z.string().uuid(),
});

export type GetLicenseQuery = z.infer<typeof GetLicenseQuerySchema>;

export const ListLicensesQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'suspended', 'terminated', 'expired']).optional(),
  licenseType: z.enum(['exclusive', 'non_exclusive', 'sole', 'sublicense']).optional(),
  ipType: z.enum(['patent', 'trademark', 'copyright', 'trade_secret']).optional(),
  licensorId: z.string().uuid().optional(),
  licenseeId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListLicensesQuery = z.infer<typeof ListLicensesQuerySchema>;

export const GetLicensesByAssetQuerySchema = z.object({
  ipType: z.enum(['patent', 'trademark', 'copyright', 'trade_secret']),
  ipAssetId: z.string().uuid(),
  includeInactive: z.boolean().default(false),
});

export type GetLicensesByAssetQuery = z.infer<typeof GetLicensesByAssetQuerySchema>;

export const GetLicensesByPartyQuerySchema = z.object({
  partyId: z.string().uuid(),
  role: z.enum(['licensor', 'licensee', 'both']).default('both'),
  status: z.enum(['draft', 'active', 'suspended', 'terminated', 'expired']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type GetLicensesByPartyQuery = z.infer<typeof GetLicensesByPartyQuerySchema>;

export const CountLicensesQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'suspended', 'terminated', 'expired']).optional(),
  licenseType: z.enum(['exclusive', 'non_exclusive', 'sole', 'sublicense']).optional(),
  ipType: z.enum(['patent', 'trademark', 'copyright', 'trade_secret']).optional(),
});

export type CountLicensesQuery = z.infer<typeof CountLicensesQuerySchema>;

export const GetExpiringLicensesQuerySchema = z.object({
  daysUntilExpiration: z.number().int().min(1).max(365).default(90),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type GetExpiringLicensesQuery = z.infer<typeof GetExpiringLicensesQuerySchema>;

export const GetSublicensesQuerySchema = z.object({
  parentLicenseId: z.string().uuid(),
});

export type GetSublicensesQuery = z.infer<typeof GetSublicensesQuerySchema>;
