/**
 * @ecosystem/contracts-entity
 * Legal entity and corporate structure DTOs
 */

import { z } from 'zod';

// ============================================================================
// Address
// ============================================================================

export const addressSchema = z.object({
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2).toUpperCase(), // ISO 3166-1 alpha-2
});

export type Address = z.infer<typeof addressSchema>;

// ============================================================================
// Entity Types
// ============================================================================

export const entityTypeSchema = z.enum([
  'corporation',
  'llc',
  'partnership',
  'sole_proprietorship',
  'nonprofit',
  'trust',
  'branch',
  'subsidiary',
]);

export type EntityType = z.infer<typeof entityTypeSchema>;

export const entityStatusSchema = z.enum([
  'active',
  'inactive',
  'dissolved',
  'merged',
  'pending_formation',
]);

export type EntityStatus = z.infer<typeof entityStatusSchema>;

// ============================================================================
// Legal Entity Contracts
// ============================================================================

export const legalEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(300),
  tradingName: z.string().max(300).optional(),
  type: entityTypeSchema,
  status: entityStatusSchema,
  taxId: z.string().optional(), // EIN, VAT, etc.
  registrationNumber: z.string().optional(),
  jurisdictionCountry: z.string().length(2),
  jurisdictionState: z.string().optional(),
  formationDate: z.coerce.date().optional(),
  fiscalYearEnd: z.string().regex(/^\d{2}-\d{2}$/).optional(), // MM-DD
  registeredAddress: addressSchema,
  mailingAddress: addressSchema.optional(),
  parentEntityId: z.string().uuid().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type LegalEntity = z.infer<typeof legalEntitySchema>;

// ============================================================================
// Officer & Director Contracts
// ============================================================================

export const officerRoleSchema = z.enum([
  'ceo',
  'cfo',
  'coo',
  'cto',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'director',
  'manager',
  'member',
  'partner',
  'registered_agent',
]);

export type OfficerRole = z.infer<typeof officerRoleSchema>;

export const officerSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  personId: z.string().uuid().optional(),
  entityOfficerId: z.string().uuid().optional(), // If officer is another entity
  role: officerRoleSchema,
  title: z.string().max(200).optional(),
  appointedDate: z.coerce.date(),
  resignedDate: z.coerce.date().optional(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Officer = z.infer<typeof officerSchema>;

// ============================================================================
// Shareholder/Member Contracts
// ============================================================================

export const ownershipTypeSchema = z.enum([
  'common_stock',
  'preferred_stock',
  'membership_interest',
  'partnership_interest',
  'beneficial_ownership',
]);

export const shareholderSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  ownerId: z.string().uuid(), // Can be person or entity
  ownerType: z.enum(['person', 'entity']),
  ownershipType: ownershipTypeSchema,
  shares: z.number().int().positive().optional(),
  percentage: z.number().min(0).max(100),
  votingPercentage: z.number().min(0).max(100).optional(),
  acquiredDate: z.coerce.date(),
  disposedDate: z.coerce.date().optional(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Shareholder = z.infer<typeof shareholderSchema>;

// ============================================================================
// Corporate Structure
// ============================================================================

export interface CorporateStructureNode {
  entityId: string;
  name: string;
  type: EntityType;
  ownershipPercentage: number;
  children?: CorporateStructureNode[] | undefined;
}

export const corporateStructureNodeSchema: z.ZodType<CorporateStructureNode> = z.object({
  entityId: z.string().uuid(),
  name: z.string(),
  type: entityTypeSchema,
  ownershipPercentage: z.number().min(0).max(100),
  children: z.array(z.lazy(() => corporateStructureNodeSchema)).optional(),
});
