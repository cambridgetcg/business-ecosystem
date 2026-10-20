import { z } from 'zod';
import type { CurrencyCode } from '@foundational/shared';
import { TaxTypeSchema } from './tax-jurisdiction.js';

/**
 * Tax Obligation Entity - Tax liability or payment requirement
 */

export const ObligationStatusSchema = z.enum([
  'estimated',
  'calculated',
  'filed',
  'paid',
  'adjusted',
  'refunded',
  'disputed',
  'closed',
]);
export type ObligationStatus = z.infer<typeof ObligationStatusSchema>;

export const TaxObligationSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  jurisdictionId: z.string().uuid(),
  taxType: TaxTypeSchema,
  taxPeriodStart: z.date(),
  taxPeriodEnd: z.date(),
  filingDueDate: z.date(),
  paymentDueDate: z.date(),
  status: ObligationStatusSchema,
  grossAmount: z.string(), // Decimal as string
  deductions: z.string().optional(),
  credits: z.string().optional(),
  netAmount: z.string(), // Amount due
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  amountPaid: z.string().optional(),
  penalties: z.string().optional(),
  interest: z.string().optional(),
  filingId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type TaxObligation = z.infer<typeof TaxObligationSchema>;

export const CreateTaxObligationInputSchema = z.object({
  entityId: z.string().uuid(),
  jurisdictionId: z.string().uuid(),
  taxType: TaxTypeSchema,
  taxPeriodStart: z.date(),
  taxPeriodEnd: z.date(),
  filingDueDate: z.date(),
  paymentDueDate: z.date(),
  grossAmount: z.string(),
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
});

export type CreateTaxObligationInput = z.infer<typeof CreateTaxObligationInputSchema>;
