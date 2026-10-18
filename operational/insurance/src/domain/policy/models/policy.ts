/**
 * Insurance Policy Domain Model
 *
 * Core aggregate for managing insurance policies.
 */

import { z } from 'zod';
import {
  PolicyTypeSchema,
  PolicyStatusSchema,
  PaymentFrequencySchema,
  MoneySchema,
  CoverageSchema,
  RiskAssessmentSchema,
  DocumentReferenceSchema,
  type PolicyStatus,
  type Coverage,
} from '../../value-objects/index.js';

// =============================================================================
// Insurer Schema
// =============================================================================

export const InsurerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  insurerType: z.enum(['primary', 'excess', 'reinsurer', 'coinsurer', 'captive']),
  sharePercentage: z.number().min(0).max(100).default(100),
  contactName: z.string().max(255).nullable(),
  contactEmail: z.string().email().nullable(),
  contactPhone: z.string().max(50).nullable(),
  underwriterName: z.string().max(255).nullable(),
  underwriterEmail: z.string().email().nullable(),
  externalReference: z.string().max(100).nullable(),
  metadata: z.record(z.unknown()).nullable(),
});
export type Insurer = z.infer<typeof InsurerSchema>;

// =============================================================================
// Premium Schedule Schema
// =============================================================================

export const PremiumScheduleSchema = z.object({
  grossPremium: MoneySchema,
  insurerPremiumTax: MoneySchema,     // UK IPT (12% standard, 20% higher rate)
  brokerFee: MoneySchema.nullable(),
  netPremium: MoneySchema,            // After deductions
  paymentFrequency: PaymentFrequencySchema,
  installments: z.array(z.object({
    dueDate: z.date(),
    amount: MoneySchema,
    paidDate: z.date().nullable(),
    paidAmount: MoneySchema.nullable(),
    reference: z.string().nullable(),
  })).nullable(),
  isPaid: z.boolean().default(false),
  paidAt: z.date().nullable(),
});
export type PremiumSchedule = z.infer<typeof PremiumScheduleSchema>;

// =============================================================================
// Policy Schema
// =============================================================================

export const PolicySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(), // The insured entity

  // Policy identification
  policyNumber: z.string().max(50),
  externalPolicyNumber: z.string().max(100).nullable(), // Insurer's ref
  policyType: PolicyTypeSchema,
  status: PolicyStatusSchema,

  // Policy details
  policyName: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),

  // Period
  inceptionDate: z.date(),
  expiryDate: z.date(),
  retroactiveDate: z.date().nullable(),  // For claims-made policies

  // Broker
  brokerId: z.string().uuid().nullable(),
  brokerReference: z.string().max(100).nullable(),

  // Insurers (can have multiple for coinsurance/layered programs)
  insurers: z.array(InsurerSchema),

  // Coverages
  coverages: z.array(CoverageSchema),
  totalLimit: MoneySchema,
  totalDeductible: MoneySchema.nullable(),

  // Premium
  premium: PremiumScheduleSchema.nullable(),

  // Risk assessment
  riskAssessment: RiskAssessmentSchema.nullable(),

  // Renewal
  renewalOfPolicyId: z.string().uuid().nullable(),
  renewedByPolicyId: z.string().uuid().nullable(),
  autoRenewal: z.boolean().default(false),
  renewalReminderDays: z.number().int().default(60),

  // Documents
  documents: z.array(DocumentReferenceSchema).nullable(),

  // Territorial scope
  territorialLimits: z.array(z.string()).nullable(), // ISO country codes
  jurisdictionOfCourts: z.string().max(100).nullable(),

  // Endorsements
  endorsements: z.array(z.object({
    id: z.string().uuid(),
    number: z.string(),
    effectiveDate: z.date(),
    description: z.string(),
    documentKey: z.string().nullable(),
  })).nullable(),

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

export type Policy = z.infer<typeof PolicySchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreatePolicyInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  policyType: PolicyTypeSchema,
  policyName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  inceptionDate: z.date(),
  expiryDate: z.date(),
  retroactiveDate: z.date().optional(),
  brokerId: z.string().uuid().optional(),
  brokerReference: z.string().max(100).optional(),
  insurers: z.array(InsurerSchema.omit({ id: true })).min(1),
  coverages: z.array(CoverageSchema).min(1),
  totalLimit: MoneySchema,
  totalDeductible: MoneySchema.optional(),
  premium: PremiumScheduleSchema.optional(),
  autoRenewal: z.boolean().optional(),
  renewalReminderDays: z.number().int().optional(),
  territorialLimits: z.array(z.string()).optional(),
  jurisdictionOfCourts: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreatePolicyInput = z.infer<typeof CreatePolicyInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdatePolicyInputSchema = z.object({
  policyName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  expiryDate: z.date().optional(),
  brokerId: z.string().uuid().nullable().optional(),
  brokerReference: z.string().max(100).nullable().optional(),
  autoRenewal: z.boolean().optional(),
  renewalReminderDays: z.number().int().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export type UpdatePolicyInput = z.infer<typeof UpdatePolicyInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if policy is currently active
 */
export function isPolicyActive(policy: Policy): boolean {
  if (policy.status !== 'active') return false;
  if (policy.deletedAt) return false;

  const now = new Date();
  return policy.inceptionDate <= now && policy.expiryDate > now;
}

/**
 * Check if policy can be edited
 */
export function canEditPolicy(policy: Policy): boolean {
  return policy.status === 'draft' || policy.status === 'quoted';
}

/**
 * Check if policy can be bound (activated)
 */
export function canBindPolicy(policy: Policy): boolean {
  return policy.status === 'quoted';
}

/**
 * Check if policy can be cancelled
 */
export function canCancelPolicy(policy: Policy): boolean {
  return policy.status === 'active' || policy.status === 'bound';
}

/**
 * Check if policy can be renewed
 */
export function canRenewPolicy(policy: Policy): boolean {
  if (policy.renewedByPolicyId) return false; // Already renewed
  return (
    policy.status === 'active' ||
    policy.status === 'expired' ||
    policy.status === 'pending_renewal'
  );
}

/**
 * Check if policy is expiring soon
 */
export function isExpiringSoon(policy: Policy, daysThreshold: number = 60): boolean {
  if (policy.status !== 'active') return false;

  const now = new Date();
  const daysUntilExpiry = Math.floor(
    (policy.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysUntilExpiry <= daysThreshold && daysUntilExpiry >= 0;
}

/**
 * Get days until policy expiry
 */
export function getDaysUntilExpiry(policy: Policy): number {
  const now = new Date();
  return Math.floor(
    (policy.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Check if a claim date falls within policy period
 */
export function isWithinPolicyPeriod(
  policy: Policy,
  claimDate: Date,
  discoveryDate?: Date
): boolean {
  const date = discoveryDate || claimDate;
  return date >= policy.inceptionDate && date < policy.expiryDate;
}

/**
 * Get coverage by name
 */
export function getCoverage(policy: Policy, coverageName: string): Coverage | null {
  return policy.coverages.find((c) => c.name === coverageName) || null;
}

/**
 * Calculate total insured value
 */
export function getTotalInsuredValue(policy: Policy): number {
  return policy.coverages.reduce((sum, c) => sum + c.limit.amount, 0);
}

/**
 * Get policy status label
 */
export function getPolicyStatusLabel(status: PolicyStatus): string {
  const labels: Record<PolicyStatus, string> = {
    draft: 'Draft',
    quoted: 'Quoted',
    bound: 'Bound',
    active: 'Active',
    expired: 'Expired',
    cancelled: 'Cancelled',
    lapsed: 'Lapsed',
    renewed: 'Renewed',
    pending_renewal: 'Pending Renewal',
  };
  return labels[status];
}

/**
 * Calculate UK Insurance Premium Tax
 * Standard rate: 12%, Higher rate: 20% (for travel, appliance warranties, etc.)
 */
export function calculateIPT(
  netPremium: number,
  isHigherRate: boolean = false
): number {
  const rate = isHigherRate ? 0.20 : 0.12;
  return Math.round(netPremium * rate * 100) / 100;
}

/**
 * Check if employers' liability meets UK minimum
 */
export function meetsEmployersLiabilityMinimum(policy: Policy): boolean {
  if (policy.policyType !== 'employers_liability') return true;

  const coverage = policy.coverages.find(
    (c) => c.limitType === 'any_one_event' || c.limitType === 'per_occurrence'
  );

  if (!coverage) return false;

  // UK minimum is £5,000,000
  if (coverage.limit.currency === 'GBP') {
    return coverage.limit.amount >= 5_000_000;
  }

  // Approximate conversion for other currencies
  return false;
}
