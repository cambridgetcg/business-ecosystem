/**
 * UK VAT Return Domain Model (MTD Compliant)
 *
 * Represents a VAT return in the 9-box format required by HMRC MTD:
 * Box 1: VAT due on sales
 * Box 2: VAT due on acquisitions from EU
 * Box 3: Total VAT due (box1 + box2)
 * Box 4: VAT reclaimed on purchases
 * Box 5: Net VAT to pay/reclaim (box3 - box4)
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
  periodKey: z.string().max(10), // HMRC period key (e.g., "24AC", "#001")

  // VAT Boxes (MTD format)
  box1: z.string(), // VAT due on sales
  box2: z.string(), // VAT due on acquisitions from EU
  box3: z.string(), // Total VAT due (box1 + box2)
  box4: z.string(), // VAT reclaimed on purchases
  box5: z.string(), // Net VAT (box3 - box4) - positive = pay, negative = reclaim
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
  submissionDeadline: z.date(), // 1 month + 7 days after period end
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
  periodKey: z.string().max(10).optional(),
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
 * Calculate submission deadline
 * VAT returns due: 1 calendar month + 7 days after period end
 */
export function calculateVATDeadline(periodEnd: Date): Date {
  const deadline = new Date(periodEnd);
  deadline.setMonth(deadline.getMonth() + 1);
  deadline.setDate(deadline.getDate() + 7);
  return deadline;
}

/**
 * Generate period key for MTD
 * Format varies but commonly "YY" + quarter letter (A, B, C, D) + month indicator
 */
export function generatePeriodKey(periodEnd: Date): string {
  const year = periodEnd.getFullYear().toString().slice(-2);
  const month = periodEnd.getMonth();

  // Quarter letters (A=Q1, B=Q2, C=Q3, D=Q4)
  const quarterIndex = Math.floor(month / 3);
  const quarterLetter = ['A', 'B', 'C', 'D'][quarterIndex];

  // Month within quarter
  const monthInQuarter = (month % 3) + 1;

  return `${year}${quarterLetter}${monthInQuarter}`;
}

/**
 * MTD VAT Declaration text
 */
export const MTD_VAT_DECLARATION =
  'When you submit this VAT information you are making a legal declaration ' +
  'that the information is true and complete. A false declaration can result ' +
  'in prosecution.';
