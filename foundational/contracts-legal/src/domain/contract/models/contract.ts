/**
 * Contract Domain Model
 *
 * Core aggregate root for the contracts domain.
 * Represents a legal agreement between parties.
 */

import { z } from 'zod';
import {
  ContractStatusSchema,
  ContractTypeSchema,
  MoneySchema,
  RenewalTermsSchema,
  type ContractStatus,
} from '../../value-objects/index.js';

// =============================================================================
// Contract Party Schema
// =============================================================================

export const ContractPartySchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  partyType: z.enum(['entity', 'individual', 'external']),
  partyRole: z.enum(['owner', 'counterparty', 'guarantor', 'witness', 'notary']),
  entityId: z.string().uuid().nullable(), // Reference to entity-governance
  personId: z.string().uuid().nullable(), // Reference to person
  externalName: z.string().max(255).nullable(),
  externalEmail: z.string().email().nullable(),
  signatureRequired: z.boolean().default(true),
  signedAt: z.date().nullable(),
  signedBy: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ContractParty = z.infer<typeof ContractPartySchema>;

// =============================================================================
// Contract Schema
// =============================================================================

export const ContractSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  contractNumber: z.string().max(50),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),
  contractType: ContractTypeSchema,
  status: ContractStatusSchema,

  // Ownership
  ownerEntityId: z.string().uuid(), // Entity that owns this contract

  // Template reference
  templateId: z.string().uuid().nullable(),
  templateVersion: z.number().int().nullable(),

  // Dates
  effectiveDate: z.date().nullable(),
  expirationDate: z.date().nullable(),
  executedDate: z.date().nullable(),
  terminatedDate: z.date().nullable(),

  // Financial terms
  totalValue: MoneySchema.nullable(),
  paymentTerms: z.string().max(500).nullable(),

  // Renewal
  renewalTerms: RenewalTermsSchema.nullable(),
  renewalCount: z.number().int().default(0),

  // Document storage
  documentStorageKey: z.string().max(500).nullable(),
  documentVersion: z.number().int().default(1),

  // External references
  externalContractId: z.string().max(100).nullable(), // DocuSign envelope ID, etc.

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  deletedAt: z.date().nullable(),
});

export type Contract = z.infer<typeof ContractSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateContractInputSchema = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  contractType: ContractTypeSchema,
  ownerEntityId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  effectiveDate: z.date().optional(),
  expirationDate: z.date().optional(),
  totalValue: MoneySchema.optional(),
  paymentTerms: z.string().max(500).optional(),
  renewalTerms: RenewalTermsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateContractInput = z.infer<typeof CreateContractInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdateContractInputSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  effectiveDate: z.date().nullable().optional(),
  expirationDate: z.date().nullable().optional(),
  totalValue: MoneySchema.nullable().optional(),
  paymentTerms: z.string().max(500).nullable().optional(),
  renewalTerms: RenewalTermsSchema.nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export type UpdateContractInput = z.infer<typeof UpdateContractInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if contract can be edited
 */
export function canEditContract(contract: Contract): boolean {
  return contract.status === 'draft' || contract.status === 'pending_review';
}

/**
 * Check if contract can be sent for signatures
 */
export function canSendForSignatures(contract: Contract): boolean {
  return contract.status === 'draft' || contract.status === 'pending_review';
}

/**
 * Check if contract is fully executed (all signatures collected)
 */
export function isFullyExecuted(contract: Contract, parties: ContractParty[]): boolean {
  const requiredSignatures = parties.filter(p => p.signatureRequired);
  const signedParties = requiredSignatures.filter(p => p.signedAt !== null);
  return requiredSignatures.length > 0 && signedParties.length === requiredSignatures.length;
}

/**
 * Check if contract can be activated
 */
export function canActivateContract(contract: Contract, parties: ContractParty[]): boolean {
  return contract.status === 'pending_signatures' && isFullyExecuted(contract, parties);
}

/**
 * Check if contract can be terminated
 */
export function canTerminateContract(contract: Contract): boolean {
  return contract.status === 'active' || contract.status === 'suspended';
}

/**
 * Check if contract can be renewed
 */
export function canRenewContract(contract: Contract): boolean {
  if (contract.status !== 'active' && contract.status !== 'expired') {
    return false;
  }

  if (!contract.renewalTerms || contract.renewalTerms.type === 'none') {
    return false;
  }

  if (contract.renewalTerms.maxRenewals && contract.renewalCount >= contract.renewalTerms.maxRenewals) {
    return false;
  }

  return true;
}

/**
 * Check if contract is expiring soon (within N days)
 */
export function isExpiringSoon(contract: Contract, daysThreshold: number = 30): boolean {
  if (contract.status !== 'active' || !contract.expirationDate) {
    return false;
  }

  const now = new Date();
  const expirationDate = new Date(contract.expirationDate);
  const daysUntilExpiration = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return daysUntilExpiration <= daysThreshold && daysUntilExpiration >= 0;
}

/**
 * Get contract status label
 */
export function getContractStatusLabel(status: ContractStatus): string {
  const labels: Record<ContractStatus, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    pending_signatures: 'Pending Signatures',
    active: 'Active',
    expired: 'Expired',
    terminated: 'Terminated',
    renewed: 'Renewed',
    suspended: 'Suspended',
  };
  return labels[status];
}

/**
 * Calculate days until expiration
 */
export function getDaysUntilExpiration(contract: Contract): number | null {
  if (!contract.expirationDate) {
    return null;
  }

  const now = new Date();
  const expirationDate = new Date(contract.expirationDate);
  return Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
