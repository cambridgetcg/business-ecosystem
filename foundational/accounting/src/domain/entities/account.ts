import { z } from 'zod';
import type { CurrencyCode, Money } from '@foundational/shared';

/**
 * Account Entity - Chart of Accounts entry
 */

export const AccountTypeSchema = z.enum([
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const NormalBalanceSchema = z.enum(['debit', 'credit']);
export type NormalBalance = z.infer<typeof NormalBalanceSchema>;

export const AccountSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountType: AccountTypeSchema,
  normalBalance: NormalBalanceSchema,
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  parentAccountId: z.string().uuid().optional(),
  isActive: z.boolean(),
  isBankAccount: z.boolean().default(false),
  linkedBankAccountId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type Account = z.infer<typeof AccountSchema>;

export const CreateAccountInputSchema = z.object({
  entityId: z.string().uuid(),
  accountNumber: z.string().min(1).max(20),
  accountName: z.string().min(1).max(255),
  accountType: AccountTypeSchema,
  currency: z.string().length(3) as z.ZodType<CurrencyCode>,
  parentAccountId: z.string().uuid().optional(),
  isBankAccount: z.boolean().optional(),
  linkedBankAccountId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

/**
 * Derive normal balance from account type
 */
export function deriveNormalBalance(accountType: AccountType): NormalBalance {
  switch (accountType) {
    case 'asset':
    case 'expense':
      return 'debit';
    case 'liability':
    case 'equity':
    case 'revenue':
      return 'credit';
  }
}

/**
 * Check if account can have sub-accounts
 */
export function canHaveSubAccounts(account: Account): boolean {
  return !account.isBankAccount;
}
