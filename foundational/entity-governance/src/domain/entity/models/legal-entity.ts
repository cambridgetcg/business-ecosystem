/**
 * Legal Entity Domain Model
 *
 * Core aggregate root for entity governance domain.
 */

import { z } from 'zod';
import {
  EntityTypeSchema,
  EntityStatusSchema,
  JurisdictionSchema,
  type EntityType,
  type EntityStatus,
  type Jurisdiction,
} from '../../value-objects/index.js';

// =============================================================================
// Schema
// =============================================================================

export const LegalEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  legalName: z.string().min(1).max(500),
  entityType: EntityTypeSchema,
  status: EntityStatusSchema,
  jurisdiction: JurisdictionSchema,
  incorporationDate: z.date().optional(),
  dissolutionDate: z.date().optional(),
  taxId: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional(),
  version: z.number().int().positive(),
  deletedAt: z.date().optional(),
});

export type LegalEntity = z.infer<typeof LegalEntitySchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateLegalEntityInputSchema = z.object({
  name: z.string().min(1).max(255),
  legalName: z.string().min(1).max(500),
  entityType: EntityTypeSchema,
  jurisdictionCountry: z.string().length(2),
  jurisdictionState: z.string().max(100).optional(),
  incorporationDate: z.date().optional(),
  taxId: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateLegalEntityInput = z.infer<typeof CreateLegalEntityInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdateLegalEntityInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  legalName: z.string().min(1).max(500).optional(),
  status: EntityStatusSchema.optional(),
  taxId: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateLegalEntityInput = z.infer<typeof UpdateLegalEntityInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

export function canDissolve(entity: LegalEntity): boolean {
  return entity.status === 'active' || entity.status === 'inactive';
}

export function canMerge(entity: LegalEntity): boolean {
  return entity.status === 'active';
}

export function isActive(entity: LegalEntity): boolean {
  return entity.status === 'active' && entity.deletedAt === undefined;
}
