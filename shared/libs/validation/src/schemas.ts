/**
 * Common validation schemas
 */

import { z } from 'zod';

// ============================================================================
// Primitive Schemas
// ============================================================================

export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');
export const urlSchema = z.string().url();
export const dateSchema = z.coerce.date();
export const isoDateStringSchema = z.string().datetime();

// ============================================================================
// Business Schemas
// ============================================================================

export const moneySchema = z.object({
  amount: z.number().int().min(0), // Store in cents
  currency: z.string().length(3).toUpperCase(),
});

export const addressSchema = z.object({
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2).toUpperCase(), // ISO 3166-1 alpha-2
});

export const personNameSchema = z.object({
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
  suffix: z.string().max(20).optional(),
});

// ============================================================================
// Pagination Schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ============================================================================
// ID Schemas for different entities
// ============================================================================

export const entityIdSchema = z.object({
  id: uuidSchema,
});

export const tenantIdSchema = z.object({
  tenantId: uuidSchema,
});

// ============================================================================
// Type exports
// ============================================================================

export type Money = z.infer<typeof moneySchema>;
export type Address = z.infer<typeof addressSchema>;
export type PersonName = z.infer<typeof personNameSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
