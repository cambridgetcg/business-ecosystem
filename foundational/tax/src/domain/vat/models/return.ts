/**
 * UK VAT Return Domain Model (MTD Compliant)
 *
 * Represents a VAT return in the 9-box format required by HMRC MTD:
 * Box 1: VAT due on sales
 * Box 2: VAT due on acquisitions from EU
 * Box 3: Total VAT due (box1 + box2)
 * Box 4: VAT reclaimed on purchases
 * Box 5: Net VAT to pay/reclaim (the unsigned difference between box3 and box4)
 * Box 6: Total sales excluding VAT
 * Box 7: Total purchases excluding VAT
 * Box 8: Total value of supplies to EU
 * Box 9: Total value of acquisitions from EU
 */

import { z } from 'zod';

// =============================================================================
// Return Status
// =============================================================================

export const VATReturnStatusSchema = z.enum([
  'draft',        // Being prepared
  'calculated',   // Calculated, awaiting submission
  'submitted',    // Submitted to HMRC
  'acknowledged', // HMRC acknowledged receipt
  'error',        // Submission error
  'amended',      // Amendment submitted
]);
export type VATReturnStatus = z.infer<typeof VATReturnStatusSchema>;

// =============================================================================
// VAT Boxes Schema (MTD Format)
// =============================================================================

export const VATBoxesSchema = z.object({
  box1: z.string(), // VAT due on sales - Decimal as string
  box2: z.string(), // VAT due on acquisitions from EU
  box3: z.string(), // Total VAT due (calculated: box1 + box2)
  box4: z.string(), // VAT reclaimed on purchases
  box5: z.string(), // Net VAT (calculated: box3 - box4)
  box6: z.string(), // Total sales excluding VAT (whole pounds)
  box7: z.string(), // Total purchases excluding VAT (whole pounds)
  box8: z.string(), // Total supplies to EU (whole pounds)
  box9: z.string(), // Total acquisitions from EU (whole pounds)
});

export type VATBoxes = z.infer<typeof VATBoxesSchema>;

// =============================================================================
// UK VAT Return
// =============================================================================

export const UKVATReturnSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  registrationId: z.string().uuid(),

  // Period
  periodStart: z.date(),
  periodEnd: z.date(),
  periodKey: z.string().max(10), // Issued by HMRC's obligations endpoint (e.g., "18A1", "#001"), never derived

  // VAT Boxes (MTD format)
  box1: z.string(), // VAT due on sales
  box2: z.string(), // VAT due on acquisitions from EU
  box3: z.string(), // Total VAT due (box1 + box2)
  box4: z.string(), // VAT reclaimed on purchases
  box5: z.string(), // Net VAT: the unsigned difference between box3 and box4 (box3 > box4 = pay, box3 < box4 = reclaim)
  box6: z.string(), // Total sales excluding VAT (whole pounds)
  box7: z.string(), // Total purchases excluding VAT (whole pounds)
  box8: z.string(), // Total supplies to EU (whole pounds)
  box9: z.string(), // Total acquisitions from EU (whole pounds)

  // Flat Rate Scheme
  flatRateScheme: z.boolean(),
  flatRateTurnover: z.string().nullable(), // Turnover for FRS calculation
  flatRatePercentage: z.string().nullable(), // FRS percentage used
  flatRateVAT: z.string().nullable(), // VAT calculated under FRS

  // Status
  status: VATReturnStatusSchema,
  submissionDeadline: z.date(), // 1 calendar month + 7 days after period end; HMRC's obligation `due` is authoritative
  submittedAt: z.date().nullable(),

  // MTD Tracking
  mtdObligationId: z.string().nullable(), // HMRC obligation ID
  mtdReceiptId: z.string().nullable(), // Receipt from successful submission
  mtdFormBundleNumber: z.string().nullable(), // Form bundle reference
  mtdPaymentIndicator: z.string().nullable(), // DD, DIRECT_DEBIT, BANK, etc.

  // Declaration
  declarationAccepted: z.boolean(),
  declarationAcceptedBy: z.string().nullable(),
  declarationAcceptedAt: z.date().nullable(),

  // Adjustments
  adjustments: z.array(z.object({
    description: z.string(),
    boxAffected: z.number().int().min(1).max(9),
    amount: z.string(),
    reason: z.string(),
  })).nullable(),

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

export type UKVATReturn = z.infer<typeof UKVATReturnSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateVATReturnInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid(),
  registrationId: z.string().uuid(),
  periodStart: z.date(),
  periodEnd: z.date(),
  // Required: the key of the obligation this return answers, as HMRC's obligations endpoint
  // returned it (MTDObligation.periodKey). Period keys cannot be derived from dates.
  periodKey: z.string().min(1).max(10),
  flatRateScheme: z.boolean().default(false),
  flatRatePercentage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateVATReturnInput = z.infer<typeof CreateVATReturnInputSchema>;

// =============================================================================
// VAT Transaction Input (for calculation)
// =============================================================================

export const VATTransactionTypeSchema = z.enum([
  'sale',
  'purchase',
  'eu_acquisition',
  'eu_supply',
]);

export const VATRateTypeSchema = z.enum([
  'standard',    // 20%
  'reduced',     // 5%
  'zero',        // 0%
  'exempt',      // No VAT
  'outside_scope', // Not a VAT supply
]);

export const VATTransactionSchema = z.object({
  type: VATTransactionTypeSchema,
  netAmount: z.string(), // Amount excluding VAT
  vatAmount: z.string(), // VAT amount
  rateType: VATRateTypeSchema,
  isEUSupply: z.boolean().default(false),
  isEUAcquisition: z.boolean().default(false),
  isReverseCharge: z.boolean().default(false),
});

export type VATTransaction = z.infer<typeof VATTransactionSchema>;

// =============================================================================
// MTD Obligation
// =============================================================================

export const MTDObligationStatusSchema = z.enum([
  'open',      // Obligation not yet fulfilled
  'fulfilled', // Return submitted
]);

export const MTDObligationSchema = z.object({
  periodKey: z.string(),
  start: z.date(),
  end: z.date(),
  due: z.date(),
  status: MTDObligationStatusSchema,
  received: z.date().optional(),
});

export type MTDObligation = z.infer<typeof MTDObligationSchema>;

// =============================================================================
// Submission Input
// =============================================================================

export const SubmitVATReturnInputSchema = z.object({
  returnId: z.string().uuid(),
  declarationAcceptedBy: z.string(),
  agentReferenceNumber: z.string().optional(), // If submitted by agent
  governmentGatewayId: z.string().optional(),
});

export type SubmitVATReturnInput = z.infer<typeof SubmitVATReturnInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Calculate the usual submission deadline: "1 calendar month and 7 days after the end of an
 * accounting period" (VAT Notice 700/12). A period ending on the last day of a month is due on
 * the 7th of the month after next (31 March -> 7 May, 31 January -> 7 March, 30 June -> 7 August);
 * otherwise the same day next month, clamped to that month's end, plus 7 days.
 *
 * `periodEnd` is read as a UTC calendar date (as `new Date('YYYY-MM-DD')` parses HMRC's dates)
 * and the deadline is returned at UTC midnight. HMRC's obligation `due` date is authoritative;
 * this is only an estimate for synthetic planning.
 *
 * Period keys are not derived here or anywhere: HMRC issues them through the obligations
 * endpoint (MTDObligation.periodKey).
 */
export function calculateVATDeadline(periodEnd: Date): Date {
  const year = periodEnd.getUTCFullYear();
  const month = periodEnd.getUTCMonth();
  const day = periodEnd.getUTCDate();
  const lastDayOfMonth = (y: number, m: number): number => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  const nextMonthLastDay = lastDayOfMonth(year, month + 1);
  const oneMonthLaterDay = day === lastDayOfMonth(year, month)
    ? nextMonthLastDay
    : Math.min(day, nextMonthLastDay);

  // Date.UTC rolls the day past the month end and the month past December.
  return new Date(Date.UTC(year, month + 1, oneMonthLaterDay + 7));
}

/**
 * MTD VAT Declaration text
 */
export const MTD_VAT_DECLARATION =
  'When you submit this VAT information you are making a legal declaration ' +
  'that the information is true and complete. A false declaration can result ' +
  'in prosecution.';
