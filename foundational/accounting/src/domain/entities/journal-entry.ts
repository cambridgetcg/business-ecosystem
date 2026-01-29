import { z } from 'zod';
import { Decimal } from 'decimal.js';
import type { Money, CurrencyCode } from '@foundational/shared';

/**
 * Journal Entry Entity - Double-entry bookkeeping record
 */

export const JournalEntryStatusSchema = z.enum([
  'draft',
  'posted',
  'reversed',
]);
export type JournalEntryStatus = z.infer<typeof JournalEntryStatusSchema>;

export const JournalLineSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  debitAmount: z.string().optional(), // Decimal as string
  creditAmount: z.string().optional(), // Decimal as string
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  memo: z.string().max(500).optional(),
  lineNumber: z.number().int().positive(),
});

export type JournalLine = z.infer<typeof JournalLineSchema>;

export const SourceDocumentSchema = z.object({
  documentType: z.string(),
  documentId: z.string(),
  documentDate: z.date().optional(),
  reference: z.string().optional(),
});

export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

export const JournalEntrySchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  periodId: z.string().uuid(),
  entryNumber: z.string(),
  entryDate: z.date(),
  description: z.string().min(1).max(500),
  status: JournalEntryStatusSchema,
  lines: z.array(JournalLineSchema).min(2),
  sourceDocument: SourceDocumentSchema.optional(),
  reversalOfEntryId: z.string().uuid().optional(),
  reversedByEntryId: z.string().uuid().optional(),
  postedAt: z.date().optional(),
  postedBy: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().optional(),
  version: z.number().int().positive(),
});

export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const CreateJournalEntryInputSchema = z.object({
  entityId: z.string().uuid(),
  periodId: z.string().uuid(),
  entryDate: z.date(),
  description: z.string().min(1).max(500),
  lines: z.array(z.object({
    accountId: z.string().uuid(),
    debitAmount: z.string().optional(),
    creditAmount: z.string().optional(),
    memo: z.string().max(500).optional(),
  })).min(2),
  sourceDocument: SourceDocumentSchema.optional(),
});

export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntryInputSchema>;

/**
 * Validate that journal entry balances (debits = credits)
 */
export function validateJournalEntryBalance(lines: JournalLine[]): boolean {
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  for (const line of lines) {
    if (line.debitAmount) {
      totalDebits = totalDebits.plus(line.debitAmount);
    }
    if (line.creditAmount) {
      totalCredits = totalCredits.plus(line.creditAmount);
    }
  }

  return totalDebits.equals(totalCredits);
}

/**
 * Calculate total debits for a journal entry
 */
export function calculateTotalDebits(lines: JournalLine[]): Decimal {
  return lines.reduce((sum, line) => {
    return line.debitAmount ? sum.plus(line.debitAmount) : sum;
  }, new Decimal(0));
}

/**
 * Calculate total credits for a journal entry
 */
export function calculateTotalCredits(lines: JournalLine[]): Decimal {
  return lines.reduce((sum, line) => {
    return line.creditAmount ? sum.plus(line.creditAmount) : sum;
  }, new Decimal(0));
}
