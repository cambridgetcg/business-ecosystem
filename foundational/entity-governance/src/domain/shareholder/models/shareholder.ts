/**
 * Shareholder Domain Model
 *
 * Represents a shareholder (owner) of a legal entity.
 * Note: Detailed share holdings are tracked via shareholdings table.
 */

import { z } from 'zod';
import { AddressSchema } from '../../value-objects/index.js';

// =============================================================================
// Schemas
// =============================================================================

export const ShareholderTypeSchema = z.enum(['individual', 'corporation', 'trust', 'partnership', 'other']);

export const CreateShareholderInputSchema = z.object({
  entityId: z.string().uuid(),
  shareholderType: ShareholderTypeSchema,
  name: z.string().min(1).max(255),
  taxId: z.string().max(50).optional(),
  contactEmail: z.string().email().optional(),
  address: AddressSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateShareholderInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  taxId: z.string().max(50).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  address: AddressSchema.optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const ShareholderSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  shareholderType: ShareholderTypeSchema,
  name: z.string(),
  taxId: z.string().nullable(),
  contactEmail: z.string().nullable(),
  address: AddressSchema.nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int(),
});

// =============================================================================
// Types
// =============================================================================

export type ShareholderType = z.infer<typeof ShareholderTypeSchema>;
export type Shareholder = z.infer<typeof ShareholderSchema>;
export type CreateShareholderInput = z.infer<typeof CreateShareholderInputSchema>;
export type UpdateShareholderInput = z.infer<typeof UpdateShareholderInputSchema>;
