import { z } from 'zod';
import type { CurrencyCode } from '@foundational/shared';

/**
 * Tax Jurisdiction Entity - Defines tax authority and rules
 */

export const TaxAuthorityTypeSchema = z.enum([
  'federal',
  'state',
  'local',
  'international',
]);
export type TaxAuthorityType = z.infer<typeof TaxAuthorityTypeSchema>;

export const TaxTypeSchema = z.enum([
  'income',
  'franchise',
  'sales',
  'use',
  'payroll',
  'property',
  'excise',
  'vat',
  'withholding',
  'estimated',
]);
export type TaxType = z.infer<typeof TaxTypeSchema>;

export const TaxJurisdictionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(20), // e.g., "US-FED", "US-CA", "DE"
  authorityType: TaxAuthorityTypeSchema,
  country: z.string().length(2), // ISO 3166-1 alpha-2
  state: z.string().max(100).optional(),
  locality: z.string().max(100).optional(),
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  fiscalYearEnd: z.string().regex(/^\d{2}-\d{2}$/), // MM-DD format
  taxTypes: z.array(TaxTypeSchema),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaxJurisdiction = z.infer<typeof TaxJurisdictionSchema>;

/**
 * Tax Nexus - Connection between entity and jurisdiction
 */
export const NexusTypeSchema = z.enum([
  'physical_presence',
  'economic_nexus',
  'factor_presence',
  'employee_presence',
  'registration',
  'doing_business',
]);
export type NexusType = z.infer<typeof NexusTypeSchema>;

export const TaxNexusSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  jurisdictionId: z.string().uuid(),
  nexusType: NexusTypeSchema,
  establishedDate: z.date(),
  terminatedDate: z.date().optional(),
  filingRequired: z.boolean(),
  nexusFactors: z.record(z.unknown()).optional(), // Revenue thresholds, etc.
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaxNexus = z.infer<typeof TaxNexusSchema>;
