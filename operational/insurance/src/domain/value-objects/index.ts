/**
 * Insurance Domain Value Objects
 *
 * Enums and value objects for the insurance domain.
 */

import { z } from 'zod';

// =============================================================================
// Policy Types
// =============================================================================

export const PolicyTypeSchema = z.enum([
  'directors_officers',     // D&O
  'professional_indemnity', // PI / E&O
  'public_liability',       // General liability
  'employers_liability',    // Required in UK
  'cyber_liability',        // Cyber insurance
  'property',               // Commercial property
  'business_interruption',  // BI
  'product_liability',      // Product coverage
  'motor_fleet',            // Vehicle fleet
  'keyman',                 // Key person insurance
  'trade_credit',           // Credit insurance
  'marine_cargo',           // Goods in transit
  'other',
]);
export type PolicyType = z.infer<typeof PolicyTypeSchema>;

// =============================================================================
// Policy Status
// =============================================================================

export const PolicyStatusSchema = z.enum([
  'draft',
  'quoted',
  'bound',
  'active',
  'expired',
  'cancelled',
  'lapsed',
  'renewed',
  'pending_renewal',
]);
export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;

// =============================================================================
// Claim Status
// =============================================================================

export const ClaimStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'investigation',
  'approved',
  'partially_approved',
  'denied',
  'settled',
  'closed',
  'reopened',
  'withdrawn',
]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

// =============================================================================
// Claim Type
// =============================================================================

export const ClaimTypeSchema = z.enum([
  'first_party',    // Damage to insured's own property
  'third_party',    // Liability to others
  'business_interruption',
  'cyber_incident',
  'professional_negligence',
  'employment_practice',
  'product_defect',
  'property_damage',
  'bodily_injury',
  'other',
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

// =============================================================================
// Premium Payment Frequency
// =============================================================================

export const PaymentFrequencySchema = z.enum([
  'annual',
  'semi_annual',
  'quarterly',
  'monthly',
]);
export type PaymentFrequency = z.infer<typeof PaymentFrequencySchema>;

// =============================================================================
// Coverage Limit Type
// =============================================================================

export const LimitTypeSchema = z.enum([
  'per_occurrence',
  'aggregate',
  'per_claim',
  'per_person',
  'any_one_event',
  'any_one_period',
]);
export type LimitType = z.infer<typeof LimitTypeSchema>;

// =============================================================================
// Insurer Type
// =============================================================================

export const InsurerTypeSchema = z.enum([
  'primary',
  'excess',
  'reinsurer',
  'coinsurer',
  'captive',
]);
export type InsurerType = z.infer<typeof InsurerTypeSchema>;

// =============================================================================
// Priority Level
// =============================================================================

export const PriorityLevelSchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);
export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

// =============================================================================
// UK Statutory Requirements
// =============================================================================

export const UK_STATUTORY_REQUIREMENTS = {
  EMPLOYERS_LIABILITY: {
    minimumCover: 5_000_000, // £5M minimum
    currency: 'GBP',
    requiredFor: 'All UK employers (with limited exceptions)',
    regulator: 'HMRC',
    penaltyPerDay: 2500, // £2,500 per day without cover
  },
  MOTOR_INSURANCE: {
    required: true,
    regulator: 'DVLA',
    minimumCover: 'Third party',
  },
} as const;

// =============================================================================
// Money Schema
// =============================================================================

export const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default('GBP'),
});
export type Money = z.infer<typeof MoneySchema>;

// =============================================================================
// Coverage Schema
// =============================================================================

export const CoverageSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable(),
  limitType: LimitTypeSchema,
  limit: MoneySchema,
  deductible: MoneySchema.nullable(),
  coinsurancePercentage: z.number().min(0).max(100).nullable(),
  sublimits: z.array(z.object({
    name: z.string(),
    limit: MoneySchema,
  })).nullable(),
  exclusions: z.array(z.string()).nullable(),
  conditions: z.array(z.string()).nullable(),
});
export type Coverage = z.infer<typeof CoverageSchema>;

// =============================================================================
// Risk Assessment Schema
// =============================================================================

export const RiskAssessmentSchema = z.object({
  overallScore: z.number().min(0).max(100),
  riskLevel: PriorityLevelSchema,
  factors: z.array(z.object({
    factor: z.string(),
    score: z.number().min(0).max(100),
    weight: z.number().min(0).max(1),
    notes: z.string().nullable(),
  })),
  assessedAt: z.date(),
  assessedBy: z.string().uuid().nullable(),
  validUntil: z.date().nullable(),
  recommendations: z.array(z.string()).nullable(),
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// =============================================================================
// Document Reference
// =============================================================================

export const DocumentReferenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['policy_wording', 'schedule', 'endorsement', 'certificate', 'claim_form', 'evidence', 'correspondence', 'other']),
  storageKey: z.string(),
  uploadedAt: z.date(),
  uploadedBy: z.string().uuid().nullable(),
});
export type DocumentReference = z.infer<typeof DocumentReferenceSchema>;
