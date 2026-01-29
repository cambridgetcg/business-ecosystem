/**
 * Real Estate - Zod Validators
 */

import { z } from 'zod';

export const PropertyTypeEnum = z.enum([
  'OFFICE', 'RETAIL', 'WAREHOUSE', 'INDUSTRIAL',
  'RESIDENTIAL', 'LAND', 'MIXED_USE', 'OTHER'
]);

export const AddressSchema = z.object({
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100).default('US'),
});

export const CreatePropertySchema = z.object({
  type: PropertyTypeEnum,
  address: AddressSchema,
  
  // Property details
  squareFeet: z.number().int().positive().optional(),
  lotSize: z.number().positive().optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  
  // Ownership
  owned: z.boolean().default(false),
  purchaseDate: z.coerce.date().optional(),
  purchasePrice: z.number().positive().optional(),
  
  // Valuation
  currentValue: z.number().positive().optional(),
  valuationDate: z.coerce.date().optional(),
  
  // Related contracts (leases, etc.)
  contractIds: z.array(z.string().cuid()).optional(),
});

export const UpdatePropertySchema = z.object({
  type: PropertyTypeEnum.optional(),
  address: AddressSchema.partial().optional(),
  squareFeet: z.number().int().positive().optional(),
  lotSize: z.number().positive().optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  owned: z.boolean().optional(),
  purchaseDate: z.coerce.date().optional(),
  purchasePrice: z.number().positive().optional(),
  currentValue: z.number().positive().optional(),
  valuationDate: z.coerce.date().optional(),
  contractIds: z.array(z.string().cuid()).optional(),
});

export const PropertyQuerySchema = z.object({
  type: PropertyTypeEnum.optional(),
  owned: z.coerce.boolean().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  minSquareFeet: z.coerce.number().optional(),
  maxSquareFeet: z.coerce.number().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'currentValue', 'squareFeet', 'city']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;
export type PropertyQuery = z.infer<typeof PropertyQuerySchema>;
