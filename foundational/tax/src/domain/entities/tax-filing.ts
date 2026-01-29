import { z } from 'zod';
import type { CurrencyCode } from '@foundational/shared';
import { TaxTypeSchema } from './tax-jurisdiction.js';

/**
 * Tax Filing Entity - Actual filed tax return
 */

export const FilingStatusSchema = z.enum([
  'draft',
  'in_review',
  'approved',
  'filed',
  'accepted',
  'rejected',
  'amended',
]);
export type FilingStatus = z.infer<typeof FilingStatusSchema>;

export const FilingMethodSchema = z.enum([
  'electronic',
  'paper',
  'extension',
]);
export type FilingMethod = z.infer<typeof FilingMethodSchema>;

export const TaxFilingSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  jurisdictionId: z.string().uuid(),
  taxType: TaxTypeSchema,
  formNumber: z.string().max(50), // e.g., "1120", "1065", "990"
  taxYear: z.number().int(),
  taxPeriodStart: z.date(),
  taxPeriodEnd: z.date(),
  status: FilingStatusSchema,
  filingMethod: FilingMethodSchema,
  dueDate: z.date(),
  filedDate: z.date().optional(),
  acceptedDate: z.date().optional(),
  confirmationNumber: z.string().max(100).optional(),
  taxableIncome: z.string().optional(), // Decimal as string
  taxLiability: z.string().optional(),
  taxPaid: z.string().optional(),
  refundDue: z.string().optional(),
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  amendsPriorFilingId: z.string().uuid().optional(),
  documentStorageKey: z.string().max(500).optional(),
  preparedBy: z.string().uuid().optional(),
  reviewedBy: z.string().uuid().optional(),
  approvedBy: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type TaxFiling = z.infer<typeof TaxFilingSchema>;

export const CreateTaxFilingInputSchema = z.object({
  entityId: z.string().uuid(),
  jurisdictionId: z.string().uuid(),
  taxType: TaxTypeSchema,
  formNumber: z.string().max(50),
  taxYear: z.number().int(),
  taxPeriodStart: z.date(),
  taxPeriodEnd: z.date(),
  dueDate: z.date(),
  filingMethod: FilingMethodSchema,
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
});

export type CreateTaxFilingInput = z.infer<typeof CreateTaxFilingInputSchema>;
