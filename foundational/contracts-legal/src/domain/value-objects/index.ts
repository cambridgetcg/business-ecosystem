/**
 * Contracts Legal - Value Objects
 *
 * Immutable domain primitives for contracts and legal documents.
 */

import { z } from 'zod';

// =============================================================================
// Contract Status
// =============================================================================

export const ContractStatusSchema = z.enum([
  'draft',
  'pending_review',
  'pending_signatures',
  'active',
  'expired',
  'terminated',
  'renewed',
  'suspended',
]);

export type ContractStatus = z.infer<typeof ContractStatusSchema>;

// =============================================================================
// Contract Type
// =============================================================================

export const ContractTypeSchema = z.enum([
  'service_agreement',
  'employment',
  'nda',
  'msa',
  'sow',
  'lease',
  'vendor',
  'partnership',
  'licensing',
  'subscription',
  'loan',
  'consulting',
  'other',
]);

export type ContractType = z.infer<typeof ContractTypeSchema>;

// =============================================================================
// Signature Status
// =============================================================================

export const SignatureStatusSchema = z.enum([
  'pending',
  'signed',
  'declined',
  'expired',
  'voided',
]);

export type SignatureStatus = z.infer<typeof SignatureStatusSchema>;

// =============================================================================
// Party Type
// =============================================================================

export const PartyTypeSchema = z.enum([
  'entity',      // Legal entity from entity-governance
  'individual',  // Individual person
  'external',    // External party not in ecosystem
]);

export type PartyType = z.infer<typeof PartyTypeSchema>;

// =============================================================================
// Party Role
// =============================================================================

export const PartyRoleSchema = z.enum([
  'owner',       // Contract owner/creator
  'counterparty', // Other main party
  'guarantor',   // Guarantor
  'witness',     // Witness
  'notary',      // Notary
]);

export type PartyRole = z.infer<typeof PartyRoleSchema>;

// =============================================================================
// Template Status
// =============================================================================

export const TemplateStatusSchema = z.enum([
  'draft',
  'active',
  'archived',
  'deprecated',
]);

export type TemplateStatus = z.infer<typeof TemplateStatusSchema>;

// =============================================================================
// Money Value Object
// =============================================================================

export const MoneySchema = z.object({
  amount: z.number().int(), // Stored in cents
  currency: z.string().length(3).default('USD'),
});

export type Money = z.infer<typeof MoneySchema>;

// =============================================================================
// Date Range Value Object
// =============================================================================

export const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date().optional(),
});

export type DateRange = z.infer<typeof DateRangeSchema>;

// =============================================================================
// Renewal Terms
// =============================================================================

export const RenewalTypeSchema = z.enum([
  'none',
  'auto',
  'manual',
  'evergreen',
]);

export type RenewalType = z.infer<typeof RenewalTypeSchema>;

export const RenewalTermsSchema = z.object({
  type: RenewalTypeSchema,
  periodMonths: z.number().int().positive().optional(),
  noticeDays: z.number().int().positive().optional(),
  maxRenewals: z.number().int().positive().optional(),
});

export type RenewalTerms = z.infer<typeof RenewalTermsSchema>;

// =============================================================================
// Domain Logic Helpers
// =============================================================================

export function isContractEditable(status: ContractStatus): boolean {
  return status === 'draft' || status === 'pending_review';
}

export function canSignContract(status: ContractStatus): boolean {
  return status === 'pending_signatures';
}

export function isContractActive(status: ContractStatus): boolean {
  return status === 'active';
}

export function canTerminateContract(status: ContractStatus): boolean {
  return status === 'active' || status === 'suspended';
}

export function canRenewContract(status: ContractStatus): boolean {
  return status === 'active' || status === 'expired';
}
