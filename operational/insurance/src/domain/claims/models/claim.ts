/**
 * Insurance Claim Domain Model
 *
 * Core aggregate for managing insurance claims.
 */

import { z } from 'zod';
import {
  ClaimStatusSchema,
  ClaimTypeSchema,
  PriorityLevelSchema,
  MoneySchema,
  DocumentReferenceSchema,
  type ClaimStatus,
} from '../../value-objects/index.js';

// =============================================================================
// Claimant Schema
// =============================================================================

export const ClaimantSchema = z.object({
  id: z.string().uuid(),
  claimantType: z.enum(['insured', 'third_party', 'employee', 'customer', 'supplier', 'other']),
  name: z.string().min(1).max(255),
  email: z.string().email().nullable(),
  phone: z.string().max(50).nullable(),
  address: z.string().max(500).nullable(),
  companyName: z.string().max(255).nullable(),
  solicitorName: z.string().max(255).nullable(),
  solicitorReference: z.string().max(100).nullable(),
  metadata: z.record(z.unknown()).nullable(),
});
export type Claimant = z.infer<typeof ClaimantSchema>;

// =============================================================================
// Claim Reserve Schema
// =============================================================================

export const ClaimReserveSchema = z.object({
  indemnityReserve: MoneySchema,      // Expected payout
  expenseReserve: MoneySchema,        // Legal/adjustment costs
  totalReserve: MoneySchema,
  reserveHistory: z.array(z.object({
    date: z.date(),
    previousTotal: MoneySchema,
    newTotal: MoneySchema,
    reason: z.string(),
    adjustedBy: z.string().uuid().nullable(),
  })).nullable(),
  lastReviewDate: z.date().nullable(),
  nextReviewDate: z.date().nullable(),
});
export type ClaimReserve = z.infer<typeof ClaimReserveSchema>;

// =============================================================================
// Claim Payment Schema
// =============================================================================

export const ClaimPaymentSchema = z.object({
  id: z.string().uuid(),
  paymentType: z.enum(['indemnity', 'expense', 'defence_cost', 'recovery', 'salvage', 'subrogation']),
  amount: MoneySchema,
  payee: z.string().max(255),
  payeeReference: z.string().max(100).nullable(),
  description: z.string().max(500).nullable(),
  paymentDate: z.date(),
  paymentMethod: z.enum(['bank_transfer', 'cheque', 'direct_debit', 'other']).nullable(),
  reference: z.string().max(100).nullable(),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.date().nullable(),
  metadata: z.record(z.unknown()).nullable(),
});
export type ClaimPayment = z.infer<typeof ClaimPaymentSchema>;

// =============================================================================
// Claim Activity Schema
// =============================================================================

export const ClaimActivitySchema = z.object({
  id: z.string().uuid(),
  activityType: z.enum([
    'note',
    'status_change',
    'reserve_adjustment',
    'payment',
    'document_added',
    'communication',
    'investigation_update',
    'settlement_offer',
    'legal_update',
    'other',
  ]),
  description: z.string().max(2000),
  details: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  isInternal: z.boolean().default(true),
});
export type ClaimActivity = z.infer<typeof ClaimActivitySchema>;

// =============================================================================
// Claim Schema
// =============================================================================

export const ClaimSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  policyId: z.string().uuid(),

  // Claim identification
  claimNumber: z.string().max(50),
  externalClaimNumber: z.string().max(100).nullable(), // Insurer's ref
  claimType: ClaimTypeSchema,
  status: ClaimStatusSchema,
  priority: PriorityLevelSchema,

  // Claim details
  title: z.string().min(1).max(255),
  description: z.string().max(5000),
  incidentDate: z.date(),
  discoveryDate: z.date(),
  notificationDate: z.date(),
  location: z.string().max(500).nullable(),

  // Parties
  claimants: z.array(ClaimantSchema),
  adjusterId: z.string().uuid().nullable(),      // Loss adjuster
  adjusterName: z.string().max(255).nullable(),
  solicitorId: z.string().uuid().nullable(),
  solicitorName: z.string().max(255).nullable(),

  // Financial
  claimedAmount: MoneySchema.nullable(),
  reserve: ClaimReserveSchema.nullable(),
  payments: z.array(ClaimPaymentSchema),
  totalPaid: MoneySchema,
  deductibleApplied: MoneySchema.nullable(),
  recoveries: MoneySchema.nullable(),

  // Settlement
  settlementAmount: MoneySchema.nullable(),
  settlementDate: z.date().nullable(),
  settlementNotes: z.string().max(2000).nullable(),

  // Denial
  denialDate: z.date().nullable(),
  denialReason: z.string().max(1000).nullable(),

  // Coverage
  coverageName: z.string().max(255).nullable(),
  coverageConfirmed: z.boolean().default(false),
  coverageNotes: z.string().max(1000).nullable(),

  // Litigation
  isLitigation: z.boolean().default(false),
  litigationStatus: z.enum(['none', 'pre_action', 'filed', 'discovery', 'trial', 'appeal', 'settled']).nullable(),
  courtReference: z.string().max(100).nullable(),
  trialDate: z.date().nullable(),

  // Subrogation
  subrogationPotential: z.boolean().default(false),
  subrogationStatus: z.enum(['none', 'investigating', 'pursuing', 'recovered', 'abandoned']).nullable(),
  subrogationTarget: z.string().max(255).nullable(),

  // Documents
  documents: z.array(DocumentReferenceSchema).nullable(),

  // Activity log
  activities: z.array(ClaimActivitySchema).nullable(),

  // Assignment
  handlerId: z.string().uuid().nullable(),
  handlerName: z.string().max(255).nullable(),
  teamId: z.string().uuid().nullable(),

  // Dates
  closedDate: z.date().nullable(),
  reopenedDate: z.date().nullable(),
  lastActivityDate: z.date().nullable(),

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

export type Claim = z.infer<typeof ClaimSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateClaimInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  policyId: z.string().uuid(),
  claimType: ClaimTypeSchema,
  priority: PriorityLevelSchema.optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000),
  incidentDate: z.date(),
  discoveryDate: z.date().optional(),
  notificationDate: z.date().optional(),
  location: z.string().max(500).optional(),
  claimants: z.array(ClaimantSchema.omit({ id: true })).optional(),
  claimedAmount: MoneySchema.optional(),
  coverageName: z.string().max(255).optional(),
  handlerId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateClaimInput = z.infer<typeof CreateClaimInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdateClaimInputSchema = z.object({
  status: ClaimStatusSchema.optional(),
  priority: PriorityLevelSchema.optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).nullable().optional(),
  claimedAmount: MoneySchema.nullable().optional(),
  adjusterId: z.string().uuid().nullable().optional(),
  adjusterName: z.string().max(255).nullable().optional(),
  solicitorId: z.string().uuid().nullable().optional(),
  solicitorName: z.string().max(255).nullable().optional(),
  coverageConfirmed: z.boolean().optional(),
  coverageNotes: z.string().max(1000).nullable().optional(),
  handlerId: z.string().uuid().nullable().optional(),
  handlerName: z.string().max(255).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export type UpdateClaimInput = z.infer<typeof UpdateClaimInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if claim is open
 */
export function isClaimOpen(claim: Claim): boolean {
  return !['closed', 'settled', 'withdrawn', 'denied'].includes(claim.status);
}

/**
 * Check if claim can be edited
 */
export function canEditClaim(claim: Claim): boolean {
  return isClaimOpen(claim);
}

/**
 * Check if claim can be closed
 */
export function canCloseClaim(claim: Claim): boolean {
  return claim.status !== 'closed' && claim.status !== 'draft';
}

/**
 * Check if claim can be reopened
 */
export function canReopenClaim(claim: Claim): boolean {
  return claim.status === 'closed' || claim.status === 'denied';
}

/**
 * Check if claim can be approved
 */
export function canApproveClaim(claim: Claim): boolean {
  return claim.status === 'under_review' || claim.status === 'investigation';
}

/**
 * Check if claim can be denied
 */
export function canDenyClaim(claim: Claim): boolean {
  return claim.status === 'under_review' || claim.status === 'investigation';
}

/**
 * Check if claim can be settled
 */
export function canSettleClaim(claim: Claim): boolean {
  return (
    claim.status === 'approved' ||
    claim.status === 'partially_approved' ||
    claim.status === 'investigation'
  );
}

/**
 * Calculate total incurred (reserve + paid)
 */
export function calculateTotalIncurred(claim: Claim): number {
  const reserveAmount = claim.reserve?.totalReserve.amount || 0;
  const paidAmount = claim.totalPaid.amount || 0;
  return reserveAmount + paidAmount;
}

/**
 * Calculate net paid (paid - recoveries)
 */
export function calculateNetPaid(claim: Claim): number {
  const paid = claim.totalPaid.amount || 0;
  const recoveries = claim.recoveries?.amount || 0;
  return paid - recoveries;
}

/**
 * Get claim age in days
 */
export function getClaimAge(claim: Claim): number {
  const startDate = claim.notificationDate || claim.createdAt;
  const endDate = claim.closedDate || new Date();
  return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if claim is overdue for review
 */
export function isOverdueForReview(claim: Claim, reviewIntervalDays: number = 30): boolean {
  if (!isClaimOpen(claim)) return false;

  const lastActivity = claim.lastActivityDate || claim.createdAt;
  const daysSinceActivity = Math.floor(
    (new Date().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceActivity > reviewIntervalDays;
}

/**
 * Get claim status label
 */
export function getClaimStatusLabel(status: ClaimStatus): string {
  const labels: Record<ClaimStatus, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    investigation: 'Investigation',
    approved: 'Approved',
    partially_approved: 'Partially Approved',
    denied: 'Denied',
    settled: 'Settled',
    closed: 'Closed',
    reopened: 'Reopened',
    withdrawn: 'Withdrawn',
  };
  return labels[status];
}

/**
 * Calculate days since incident
 */
export function getDaysSinceIncident(claim: Claim): number {
  return Math.floor(
    (new Date().getTime() - claim.incidentDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Validate claim is within policy period
 */
export function validateClaimPeriod(
  claim: Claim,
  policyInception: Date,
  policyExpiry: Date,
  retroactiveDate?: Date
): { valid: boolean; reason?: string } {
  const checkDate = claim.discoveryDate || claim.incidentDate;

  if (checkDate < policyInception) {
    if (retroactiveDate && claim.incidentDate >= retroactiveDate) {
      return { valid: true };
    }
    return { valid: false, reason: 'Incident occurred before policy inception' };
  }

  if (checkDate >= policyExpiry) {
    return { valid: false, reason: 'Incident discovered after policy expiry' };
  }

  return { valid: true };
}
