import { z } from 'zod';
import type { CurrencyCode } from '@foundational/shared';

/**
 * Tax Position Entity - Uncertain tax position (FIN 48/ASC 740)
 */

export const PositionStatusSchema = z.enum([
  'identified',
  'under_review',
  'documented',
  'resolved',
  'closed',
]);
export type PositionStatus = z.infer<typeof PositionStatusSchema>;

export const RecognitionLevelSchema = z.enum([
  'more_likely_than_not',
  'probable',
  'reasonably_possible',
  'remote',
]);
export type RecognitionLevel = z.infer<typeof RecognitionLevelSchema>;

export const TaxPositionSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  jurisdictionId: z.string().uuid(),
  description: z.string().max(1000),
  taxYears: z.array(z.number().int()), // Affected tax years
  status: PositionStatusSchema,
  recognitionLevel: RecognitionLevelSchema,
  grossExposure: z.string(), // Decimal as string - maximum potential liability
  recognizedAmount: z.string(), // Amount recognized per ASC 740
  unrecognizedBenefit: z.string(), // UTB amount
  interestAccrued: z.string().optional(),
  penaltiesAccrued: z.string().optional(),
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  statuteExpirationDate: z.date().optional(),
  supportingDocuments: z.array(z.string()).optional(), // Storage keys
  relatedFilingIds: z.array(z.string().uuid()).optional(),
  lastAssessmentDate: z.date().optional(),
  nextReviewDate: z.date().optional(),
  notes: z.string().max(2000).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type TaxPosition = z.infer<typeof TaxPositionSchema>;

/**
 * Transfer Pricing Documentation
 */
export const TransferPricingMethodSchema = z.enum([
  'cup', // Comparable Uncontrolled Price
  'resale_price',
  'cost_plus',
  'tnmm', // Transactional Net Margin Method
  'profit_split',
  'other',
]);
export type TransferPricingMethod = z.infer<typeof TransferPricingMethodSchema>;

export const TransferPricingDocSchema = z.object({
  id: z.string().uuid(),
  masterFileId: z.string().uuid().optional(),
  fromEntityId: z.string().uuid(),
  toEntityId: z.string().uuid(),
  transactionType: z.string().max(100),
  transactionDescription: z.string().max(1000),
  method: TransferPricingMethodSchema,
  armLengthRange: z.object({
    low: z.string(),
    median: z.string(),
    high: z.string(),
  }).optional(),
  actualResult: z.string().optional(),
  taxYear: z.number().int(),
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  totalValue: z.string(), // Total transaction value
  documentStorageKey: z.string().max(500).optional(),
  benchmarkStudyDate: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TransferPricingDoc = z.infer<typeof TransferPricingDocSchema>;
