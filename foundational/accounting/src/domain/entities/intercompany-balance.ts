import { z } from 'zod';
import type { CurrencyCode, Money } from '@foundational/shared';

/**
 * Intercompany Balance Entity - Tracking balances between related entities
 */

export const IntercompanyBalanceSchema = z.object({
  id: z.string().uuid(),
  fromEntityId: z.string().uuid(),
  toEntityId: z.string().uuid(),
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  receivableBalance: z.string(), // Decimal as string - amount fromEntity is owed by toEntity
  payableBalance: z.string(), // Decimal as string - amount fromEntity owes to toEntity
  asOfDate: z.date(),
  lastTransactionDate: z.date().optional(),
  lastTransactionId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type IntercompanyBalance = z.infer<typeof IntercompanyBalanceSchema>;

/**
 * Intercompany Transaction - Individual transaction between entities
 */
export const IntercompanyTransactionTypeSchema = z.enum([
  'goods_sale',
  'services',
  'loan',
  'loan_repayment',
  'interest',
  'dividend',
  'management_fee',
  'royalty',
  'cost_allocation',
  'capital_contribution',
  'other',
]);
export type IntercompanyTransactionType = z.infer<typeof IntercompanyTransactionTypeSchema>;

export const IntercompanyTransactionSchema = z.object({
  id: z.string().uuid(),
  fromEntityId: z.string().uuid(),
  toEntityId: z.string().uuid(),
  transactionType: IntercompanyTransactionTypeSchema,
  amount: z.string(), // Decimal as string
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  transactionDate: z.date(),
  description: z.string().max(500),
  fromJournalEntryId: z.string().uuid().optional(),
  toJournalEntryId: z.string().uuid().optional(),
  transferPricingDocId: z.string().uuid().optional(),
  isEliminated: z.boolean().default(false),
  eliminationEntryId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type IntercompanyTransaction = z.infer<typeof IntercompanyTransactionSchema>;

export const RecordIntercompanyTransactionInputSchema = z.object({
  fromEntityId: z.string().uuid(),
  toEntityId: z.string().uuid(),
  transactionType: IntercompanyTransactionTypeSchema,
  amount: z.string(),
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  transactionDate: z.date(),
  description: z.string().max(500),
});

export type RecordIntercompanyTransactionInput = z.infer<typeof RecordIntercompanyTransactionInputSchema>;
