/**
 * Corporation Tax Period Domain Model
 *
 * Represents a Corporation Tax accounting period with:
 * - Profit computation
 * - Tax calculation (FY2023/24+ rates with marginal relief)
 * - Associated companies handling
 * - Filing and payment tracking
 */

import { z } from 'zod';
import { FinancialYearSchema } from '../../value-objects/index.js';

// =============================================================================
// Period Status
// =============================================================================

export const CTPeriodStatusSchema = z.enum([
  'draft',       // Period created, not calculated
  'calculated',  // Tax liability calculated
  'filed',       // CT600 filed with HMRC
  'amended',     // Amendment filed
  'paid',        // Tax paid in full
  'overdue',     // Payment overdue
]);
export type CTPeriodStatus = z.infer<typeof CTPeriodStatusSchema>;

// =============================================================================
// Corporation Tax Period
// =============================================================================

export const CorporationTaxPeriodSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  registrationId: z.string().uuid(),

  // Period
  periodStart: z.date(),
  periodEnd: z.date(),
  financialYear: FinancialYearSchema, // e.g., "FY2024"

  // Profit Computation - Trading
  tradingProfits: z.string(), // Decimal as string
  tradingLossesBroughtForward: z.string(),
  tradingLossesCarriedBack: z.string(),

  // Non-Trading Income
  investmentIncome: z.string(), // Interest, dividends from non-group companies
  propertyIncome: z.string(),
  otherIncome: z.string(),

  // Chargeable Gains
  chargeableGains: z.string(),
  capitalLossesBroughtForward: z.string(),
  capitalLossesUsed: z.string(),

  // Total Profits
  totalProfitsBeforeDeductions: z.string(),

  // Deductions
  tradingLossesRelief: z.string(),       // Losses set against total profits
  groupRelief: z.string(),               // Losses surrendered from group companies
  managementExpenses: z.string(),        // Investment company expenses
  qualifyingCharitableDonations: z.string(), // Gift Aid donations

  // Profits Chargeable to Corporation Tax
  profitsChargeableToCT: z.string(),

  // Tax Calculation (FY 2023/24+ rates)
  // Small profits rate: 19% (profits <= £50,000 / associated)
  // Main rate: 25% (profits > £250,000 / associated)
  // Marginal relief between thresholds
  associatedCompaniesCount: z.number().int().min(0),
  adjustedLowerLimit: z.string(), // £50,000 / (1 + associated)
  adjustedUpperLimit: z.string(), // £250,000 / (1 + associated)

  // Calculation breakdown
  smallProfitsRateAmount: z.string(),
  mainRateAmount: z.string(),
  marginalReliefAmount: z.string(),
  effectiveRate: z.string(), // Actual rate paid

  // Final liability
  corporationTaxLiability: z.string(),

  // Credits and Reliefs
  rdTaxCredits: z.string().optional(), // R&D tax credits
  foreignTaxCredit: z.string().optional(),
  otherCredits: z.string().optional(),

  // Net Tax Due
  taxDue: z.string(),
  taxPaid: z.string(),
  taxOutstanding: z.string(),

  // Status and Dates
  status: CTPeriodStatusSchema,
  filingDeadline: z.date(),
  paymentDeadline: z.date(),
  calculatedAt: z.date().nullable(),
  filedAt: z.date().nullable(),
  paidAt: z.date().nullable(),

  // HMRC References
  hmrcSubmissionId: z.string().nullable(),
  hmrcReceiptNumber: z.string().nullable(),

  // Audit
  notes: z.string().max(2000).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional(),
  version: z.number().int().positive(),
  deletedAt: z.date().nullable(),
});

export type CorporationTaxPeriod = z.infer<typeof CorporationTaxPeriodSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateCTPeriodInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  registrationId: z.string().uuid(),
  periodStart: z.date(),
  periodEnd: z.date(),
  associatedCompaniesCount: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateCTPeriodInput = z.infer<typeof CreateCTPeriodInputSchema>;

// =============================================================================
// Profit Input (for calculation)
// =============================================================================

export const CTProfitInputSchema = z.object({
  periodId: z.string().uuid(),

  // Trading
  tradingProfits: z.string().default('0'),
  tradingLossesBroughtForward: z.string().default('0'),
  tradingLossesCarriedBack: z.string().default('0'),

  // Non-Trading
  investmentIncome: z.string().default('0'),
  propertyIncome: z.string().default('0'),
  otherIncome: z.string().default('0'),

  // Chargeable Gains
  chargeableGains: z.string().default('0'),
  capitalLossesBroughtForward: z.string().default('0'),

  // Deductions
  tradingLossesRelief: z.string().default('0'),
  groupRelief: z.string().default('0'),
  managementExpenses: z.string().default('0'),
  qualifyingCharitableDonations: z.string().default('0'),

  // Credits
  rdTaxCredits: z.string().optional(),
  foreignTaxCredit: z.string().optional(),
  otherCredits: z.string().optional(),
});

export type CTProfitInput = z.infer<typeof CTProfitInputSchema>;

// =============================================================================
// Tax Calculation Result
// =============================================================================

export const CTCalculationResultSchema = z.object({
  totalProfitsBeforeDeductions: z.string(),
  profitsChargeableToCT: z.string(),
  adjustedLowerLimit: z.string(),
  adjustedUpperLimit: z.string(),
  smallProfitsRateAmount: z.string(),
  mainRateAmount: z.string(),
  marginalReliefAmount: z.string(),
  effectiveRate: z.string(),
  corporationTaxLiability: z.string(),
  totalCredits: z.string(),
  taxDue: z.string(),
  rateApplied: z.enum(['small_profits', 'marginal', 'main']),
});

export type CTCalculationResult = z.infer<typeof CTCalculationResultSchema>;

// =============================================================================
// Domain Helpers
// =============================================================================

/**
 * Get Financial Year from a date
 * FY runs April 1 to March 31
 */
export function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();

  // April onwards is new FY
  if (month >= 3) {
    return `FY${year}`;
  }
  return `FY${year - 1}`;
}

/**
 * Validate period does not exceed 12 months
 */
export function isValidCTPeriod(periodStart: Date, periodEnd: Date): boolean {
  const diffMs = periodEnd.getTime() - periodStart.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Allow up to 366 days (leap year)
  return diffDays > 0 && diffDays <= 366;
}

/**
 * Check if period straddles financial years
 * (requires apportionment if rates differ)
 */
export function straddlesFinancialYears(periodStart: Date, periodEnd: Date): boolean {
  return getFinancialYear(periodStart) !== getFinancialYear(periodEnd);
}
