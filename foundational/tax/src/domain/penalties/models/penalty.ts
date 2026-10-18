/**
 * Penalty Model
 *
 * Represents tax penalties under UK HMRC regimes including:
 * - Late filing penalties (fixed + daily)
 * - Late payment penalties (percentage-based)
 * - VAT penalty points system
 * - Interest calculations
 */

import { z } from 'zod';

// =============================================================================
// Penalty Types
// =============================================================================

export const PenaltyTypeSchema = z.enum([
  // Filing penalties
  'late_filing_fixed',
  'late_filing_daily',
  'late_filing_percentage',
  'failure_to_notify',

  // Payment penalties
  'late_payment_initial',
  'late_payment_extended',
  'late_payment_12_month',

  // VAT-specific (new points-based system from Jan 2023)
  'vat_penalty_point',
  'vat_late_submission',
  'vat_late_payment',

  // Other
  'inaccuracy',
  'carelessness',
  'deliberate',
  'deliberate_concealed',
  'interest',
]);

export type PenaltyType = z.infer<typeof PenaltyTypeSchema>;

export const TaxTypeForPenaltySchema = z.enum([
  'corporation_tax',
  'vat',
  'paye',
  'cis',
  'self_assessment',
]);

export type TaxTypeForPenalty = z.infer<typeof TaxTypeForPenaltySchema>;

export const PenaltyStatusSchema = z.enum([
  'calculated',    // Initially calculated
  'issued',        // Penalty notice issued by HMRC
  'appealed',      // Under appeal
  'suspended',     // Suspended pending compliance
  'paid',          // Fully paid
  'cancelled',     // Cancelled by HMRC
  'waived',        // Reasonable excuse accepted
  'written_off',   // Written off
]);

export type PenaltyStatus = z.infer<typeof PenaltyStatusSchema>;

// =============================================================================
// Penalty Record
// =============================================================================

export const PenaltyRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),

  // Reference
  taxType: TaxTypeForPenaltySchema,
  taxPeriod: z.string().max(20), // e.g., "2024-25" or "Q1 2024"
  deadlineId: z.string().uuid().optional(), // Link to tax calendar deadline
  returnReference: z.string().max(50).optional(), // HMRC reference

  // Penalty details
  penaltyType: PenaltyTypeSchema,
  description: z.string().max(500),

  // Dates
  originalDueDate: z.date(),
  actualDate: z.date().optional(), // When filed/paid
  daysLate: z.number().int().min(0),

  // Amounts
  penaltyAmount: z.string(),
  interestAmount: z.string().default('0'),
  totalAmount: z.string(),

  // Calculation details
  calculationBasis: z.string().max(200), // e.g., "Fixed penalty", "5% of tax due"
  taxDue: z.string().optional(), // Tax amount used for percentage calculations
  penaltyRate: z.string().optional(), // Rate applied

  // Status
  status: PenaltyStatusSchema,
  issuedDate: z.date().optional(),
  paidDate: z.date().optional(),
  paidAmount: z.string().default('0'),
  outstandingAmount: z.string(),

  // Appeal
  appealDate: z.date().optional(),
  appealReference: z.string().max(50).optional(),
  appealOutcome: z.enum(['pending', 'upheld', 'partially_upheld', 'cancelled']).optional(),
  appealNotes: z.string().max(2000).optional(),

  // Reasonable excuse
  reasonableExcuseClaimed: z.boolean().default(false),
  reasonableExcuseDetails: z.string().max(2000).optional(),
  reasonableExcuseOutcome: z.enum(['pending', 'accepted', 'rejected']).optional(),

  // Audit
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
});

export type PenaltyRecord = z.infer<typeof PenaltyRecordSchema>;

// =============================================================================
// VAT Penalty Points
// =============================================================================

export const VATPenaltyPointSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),

  // Point details
  pointNumber: z.number().int().positive(),
  issuedDate: z.date(),
  expiryDate: z.date(), // 24 months from issue if compliant

  // Related submission
  vatPeriod: z.string().max(20),
  submissionDueDate: z.date(),
  actualSubmissionDate: z.date().optional(),
  daysLate: z.number().int().min(0),

  // Status
  status: z.enum(['active', 'expired', 'cancelled']),
  penaltyTriggered: z.boolean().default(false), // True if this point triggered a penalty

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type VATPenaltyPoint = z.infer<typeof VATPenaltyPointSchema>;

export const VATPenaltyPointsStatusSchema = z.object({
  entityId: z.string().uuid(),
  submissionFrequency: z.enum(['monthly', 'quarterly', 'annually']),
  penaltyThreshold: z.number().int().positive(), // 5 for quarterly, 2 for monthly, etc.
  activePoints: z.number().int().min(0),
  nextExpiryDate: z.date().optional(),
  atPenaltyThreshold: z.boolean(),
  complianceResetDate: z.date().optional(), // Date points will expire if compliant
  points: z.array(VATPenaltyPointSchema),
});

export type VATPenaltyPointsStatus = z.infer<typeof VATPenaltyPointsStatusSchema>;

// =============================================================================
// Interest Calculation
// =============================================================================

export const InterestCalculationSchema = z.object({
  id: z.string().uuid(),
  penaltyId: z.string().uuid().optional(),
  taxType: TaxTypeForPenaltySchema,

  // Principal
  principalAmount: z.string(),
  fromDate: z.date(),
  toDate: z.date(),
  daysOutstanding: z.number().int().min(0),

  // Rate
  interestRate: z.string(), // Annual rate
  rateType: z.enum(['hmrc_late_payment', 'hmrc_repayment', 'statutory']),

  // Calculation
  interestAmount: z.string(),
  dailyRate: z.string(),

  // Audit
  calculatedAt: z.date(),
});

export type InterestCalculation = z.infer<typeof InterestCalculationSchema>;

// =============================================================================
// Penalty Summary
// =============================================================================

export interface PenaltySummary {
  entityId: string;
  taxYear: string;
  totalPenalties: number;
  totalPenaltyAmount: string;
  totalInterest: string;
  totalOutstanding: string;
  byStatus: {
    calculated: number;
    issued: number;
    appealed: number;
    paid: number;
    cancelled: number;
  };
  byTaxType: Record<TaxTypeForPenalty, string>;
  vatPenaltyPoints?: VATPenaltyPointsStatus;
}

// =============================================================================
// UK HMRC Penalty Rates (as of 2024)
// =============================================================================

export const UKPenaltyRates = {
  // Corporation Tax late filing
  CT_LATE_FILING_1_DAY: 100,        // £100 - 1 day late
  CT_LATE_FILING_3_MONTHS: 100,      // Additional £100 - 3 months late
  CT_LATE_FILING_6_MONTHS_RATE: 0.10, // 10% of tax due - 6 months late
  CT_LATE_FILING_12_MONTHS_RATE: 0.10, // Additional 10% - 12 months late

  // Corporation Tax late payment
  CT_LATE_PAYMENT_30_DAYS: 0.05,     // 5% - 30 days late
  CT_LATE_PAYMENT_6_MONTHS: 0.05,    // Additional 5% - 6 months late
  CT_LATE_PAYMENT_12_MONTHS: 0.05,   // Additional 5% - 12 months late

  // VAT late payment (new regime from Jan 2023)
  VAT_LATE_PAYMENT_16_30_DAYS: 0.02, // 2% on day 16-30
  VAT_LATE_PAYMENT_31_PLUS_DAYS: 0.02, // Additional 2% from day 31
  VAT_LATE_PAYMENT_DAILY_RATE: 0.04 / 365, // 4% annual rate daily

  // VAT penalty points thresholds
  VAT_POINTS_THRESHOLD_MONTHLY: 5,
  VAT_POINTS_THRESHOLD_QUARTERLY: 4,
  VAT_POINTS_THRESHOLD_ANNUALLY: 2,
  VAT_PENALTY_ON_THRESHOLD: 200,     // £200 per late return at threshold

  // PAYE late payment
  PAYE_LATE_PAYMENT_1_6_DAYS: 0.01,  // 1%
  PAYE_LATE_PAYMENT_6_12_DAYS: 0.02, // 2%
  PAYE_LATE_PAYMENT_12_PLUS_DAYS: 0.04, // 4%

  // Interest rates (updated periodically by HMRC)
  HMRC_LATE_PAYMENT_INTEREST_RATE: 0.075, // 7.5% as of 2024
  HMRC_REPAYMENT_INTEREST_RATE: 0.04,     // 4% repayment interest

  // Inaccuracy penalties
  INACCURACY_CARELESS_MIN: 0.00,
  INACCURACY_CARELESS_MAX: 0.30,
  INACCURACY_DELIBERATE_MIN: 0.20,
  INACCURACY_DELIBERATE_MAX: 0.70,
  INACCURACY_DELIBERATE_CONCEALED_MIN: 0.30,
  INACCURACY_DELIBERATE_CONCEALED_MAX: 1.00,
} as const;
