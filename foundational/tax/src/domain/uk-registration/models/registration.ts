/**
 * UK Tax Registration Domain Model
 *
 * Represents an entity's tax registration with HMRC, including:
 * - Unique Taxpayer Reference (UTR)
 * - VAT registration
 * - PAYE registration
 * - MTD (Making Tax Digital) status
 */

import { z } from 'zod';
import {
  VATSchemeSchema,
  VATQuarterEndSchema,
  UTRSchema,
  VATNumberSchema,
  PAYEReferenceSchema,
  AccountsOfficeReferenceSchema,
} from '../../value-objects/index.js';

// =============================================================================
// Registration Status
// =============================================================================

export const RegistrationStatusSchema = z.enum([
  'pending',     // Application submitted
  'active',      // Registered and active
  'suspended',   // Temporarily suspended
  'deregistered', // Voluntarily deregistered
  'cancelled',   // HMRC cancelled registration
]);
export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>;

// =============================================================================
// UK Tax Registration
// =============================================================================

export const UKTaxRegistrationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),

  // HMRC Identifiers
  companyUTR: UTRSchema.nullable(),
  vatNumber: VATNumberSchema.nullable(),
  payeReference: PAYEReferenceSchema.nullable(),
  accountsOfficeReference: AccountsOfficeReferenceSchema.nullable(),
  corporationTaxReference: z.string().max(20).nullable(),

  // Corporation Tax
  corporationTaxRegistered: z.boolean(),
  corporationTaxRegistrationDate: z.date().nullable(),

  // VAT Registration
  vatRegistered: z.boolean(),
  vatRegistrationDate: z.date().nullable(),
  vatDeregistrationDate: z.date().nullable(),
  vatScheme: VATSchemeSchema.nullable(),
  flatRatePercentage: z.string().nullable(), // Decimal as string
  vatStatus: RegistrationStatusSchema.nullable(),

  // PAYE Registration
  payeRegistered: z.boolean(),
  payeRegistrationDate: z.date().nullable(),
  payeDeregistrationDate: z.date().nullable(),
  payeStatus: RegistrationStatusSchema.nullable(),

  // Accounting Periods
  accountingPeriodEnd: z.date(), // Day and month used for CT periods
  vatQuarterEnd: VATQuarterEndSchema.nullable(),

  // MTD (Making Tax Digital) Status
  mtdVatEnabled: z.boolean(),
  mtdVatMandated: z.boolean(), // Above VAT threshold
  mtdItEnabled: z.boolean(), // Income Tax for Self Assessment

  // VAT Thresholds
  vatThresholdExceeded: z.boolean(),
  annualTurnover: z.string().nullable(), // Estimated annual turnover

  // Contact Details (for HMRC correspondence)
  taxCorrespondenceEmail: z.string().email().nullable(),
  taxCorrespondencePhone: z.string().max(20).nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional(),
  version: z.number().int().positive(),
  deletedAt: z.date().nullable(),
});

export type UKTaxRegistration = z.infer<typeof UKTaxRegistrationSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateUKTaxRegistrationInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),

  // Optional HMRC identifiers (can be added later)
  companyUTR: UTRSchema.optional(),
  corporationTaxReference: z.string().max(20).optional(),

  // Accounting period end (required)
  accountingPeriodEnd: z.date(),

  // Contact
  taxCorrespondenceEmail: z.string().email().optional(),
  taxCorrespondencePhone: z.string().max(20).optional(),

  metadata: z.record(z.unknown()).optional(),
});

export type CreateUKTaxRegistrationInput = z.infer<typeof CreateUKTaxRegistrationInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdateUKTaxRegistrationInputSchema = z.object({
  companyUTR: UTRSchema.optional(),
  corporationTaxReference: z.string().max(20).optional(),
  accountingPeriodEnd: z.date().optional(),
  taxCorrespondenceEmail: z.string().email().nullable().optional(),
  taxCorrespondencePhone: z.string().max(20).nullable().optional(),
  annualTurnover: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateUKTaxRegistrationInput = z.infer<typeof UpdateUKTaxRegistrationInputSchema>;

// =============================================================================
// VAT Registration Input
// =============================================================================

export const RegisterForVATInputSchema = z.object({
  registrationId: z.string().uuid(),
  vatNumber: VATNumberSchema,
  registrationDate: z.date(),
  scheme: VATSchemeSchema.default('standard'),
  flatRatePercentage: z.string().optional(), // Required if scheme is flat_rate
  vatQuarterEnd: VATQuarterEndSchema,
  mtdEnabled: z.boolean().default(true),
});

export type RegisterForVATInput = z.infer<typeof RegisterForVATInputSchema>;

// =============================================================================
// PAYE Registration Input
// =============================================================================

export const RegisterForPAYEInputSchema = z.object({
  registrationId: z.string().uuid(),
  payeReference: PAYEReferenceSchema,
  accountsOfficeReference: AccountsOfficeReferenceSchema,
  registrationDate: z.date(),
});

export type RegisterForPAYEInput = z.infer<typeof RegisterForPAYEInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if entity is required to register for VAT
 * VAT registration threshold (2024/25): £90,000
 */
export function isVATRegistrationRequired(annualTurnover: number): boolean {
  const VAT_THRESHOLD = 90000;
  return annualTurnover > VAT_THRESHOLD;
}

/**
 * Check if voluntary VAT registration is beneficial
 * Usually beneficial if entity makes significant zero-rated supplies
 * or has substantial input VAT to reclaim
 */
export function canVoluntarilyRegisterForVAT(annualTurnover: number): boolean {
  const VAT_THRESHOLD = 90000;
  return annualTurnover <= VAT_THRESHOLD && annualTurnover > 0;
}

/**
 * Get next VAT period dates based on quarter end and current date
 */
export function getNextVATPeriod(
  quarterEnd: 'march' | 'april' | 'may',
  fromDate: Date = new Date()
): { periodStart: Date; periodEnd: Date; submissionDeadline: Date } {
  const quarterMonths: Record<string, number[]> = {
    march: [2, 5, 8, 11],   // Mar, Jun, Sep, Dec (0-indexed)
    april: [3, 6, 9, 0],    // Apr, Jul, Oct, Jan
    may: [4, 7, 10, 1],     // May, Aug, Nov, Feb
  };

  const months = quarterMonths[quarterEnd];
  const currentMonth = fromDate.getMonth();
  const currentYear = fromDate.getFullYear();

  // Find next quarter end month
  let nextEndMonth = months.find(m => m > currentMonth);
  let endYear = currentYear;

  if (nextEndMonth === undefined) {
    nextEndMonth = months[0];
    endYear = currentYear + 1;
  }

  // Period end is last day of the quarter end month
  const periodEnd = new Date(endYear, nextEndMonth + 1, 0); // Last day of month

  // Period start is first day 3 months before
  const startMonth = nextEndMonth - 2;
  const startYear = startMonth < 0 ? endYear - 1 : endYear;
  const adjustedStartMonth = startMonth < 0 ? startMonth + 12 : startMonth;
  const periodStart = new Date(startYear, adjustedStartMonth, 1);

  // Submission deadline is 1 month + 7 days after period end
  const submissionDeadline = new Date(periodEnd);
  submissionDeadline.setMonth(submissionDeadline.getMonth() + 1);
  submissionDeadline.setDate(submissionDeadline.getDate() + 7);

  return { periodStart, periodEnd, submissionDeadline };
}

/**
 * Get Corporation Tax accounting period deadlines
 */
export function getCorporationTaxDeadlines(
  periodEnd: Date
): { filingDeadline: Date; paymentDeadline: Date } {
  // Filing deadline: 12 months after period end
  const filingDeadline = new Date(periodEnd);
  filingDeadline.setFullYear(filingDeadline.getFullYear() + 1);

  // Payment deadline: 9 months and 1 day after period end
  const paymentDeadline = new Date(periodEnd);
  paymentDeadline.setMonth(paymentDeadline.getMonth() + 9);
  paymentDeadline.setDate(paymentDeadline.getDate() + 1);

  return { filingDeadline, paymentDeadline };
}
