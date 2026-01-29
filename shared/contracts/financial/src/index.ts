/**
 * @ecosystem/contracts-financial
 * Financial DTOs for cross-service communication
 */

import { z } from 'zod';

// ============================================================================
// Money & Currency
// ============================================================================

export const currencyCodeSchema = z.string().length(3).toUpperCase();
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

export const moneySchema = z.object({
  amount: z.number().int(), // Stored in smallest unit (cents, pence, etc.)
  currency: currencyCodeSchema,
});

export type Money = z.infer<typeof moneySchema>;

// ============================================================================
// Bank Account Contracts
// ============================================================================

export const bankAccountTypeSchema = z.enum([
  'checking',
  'savings',
  'money_market',
  'certificate_of_deposit',
]);

export const bankAccountSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  accountName: z.string().min(1).max(200),
  accountType: bankAccountTypeSchema,
  bankName: z.string().min(1).max(200),
  accountNumber: z.string(), // Last 4 digits only in responses
  routingNumber: z.string().optional(),
  iban: z.string().optional(),
  swiftCode: z.string().optional(),
  currency: currencyCodeSchema,
  balance: moneySchema.optional(),
  status: z.enum(['active', 'inactive', 'closed', 'frozen']),
  isPrimary: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type BankAccount = z.infer<typeof bankAccountSchema>;

// ============================================================================
// Transaction Contracts
// ============================================================================

export const transactionTypeSchema = z.enum([
  'payment',
  'receipt',
  'transfer',
  'refund',
  'fee',
  'interest',
  'adjustment',
]);

export const transactionStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'reversed',
]);

export const transactionSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  type: transactionTypeSchema,
  status: transactionStatusSchema,
  amount: moneySchema,
  description: z.string().max(500),
  reference: z.string().optional(),
  sourceAccountId: z.string().uuid().optional(),
  destinationAccountId: z.string().uuid().optional(),
  counterparty: z.object({
    name: z.string(),
    accountNumber: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
  processedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Transaction = z.infer<typeof transactionSchema>;

// ============================================================================
// Invoice Contracts
// ============================================================================

export const invoiceStatusSchema = z.enum([
  'draft',
  'sent',
  'viewed',
  'partial',
  'paid',
  'overdue',
  'cancelled',
  'void',
]);

export const invoiceLineItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: moneySchema,
  taxRate: z.number().min(0).max(100).optional(),
  amount: moneySchema,
});

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  entityId: z.string().uuid(),
  customerId: z.string().uuid(),
  status: invoiceStatusSchema,
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  lineItems: z.array(invoiceLineItemSchema),
  subtotal: moneySchema,
  taxAmount: moneySchema,
  total: moneySchema,
  amountPaid: moneySchema,
  amountDue: moneySchema,
  notes: z.string().max(2000).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Invoice = z.infer<typeof invoiceSchema>;
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;

// ============================================================================
// Payment Contracts
// ============================================================================

export const paymentMethodSchema = z.enum([
  'bank_transfer',
  'ach',
  'wire',
  'check',
  'credit_card',
  'debit_card',
]);

export const paymentSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  transactionId: z.string().uuid(),
  amount: moneySchema,
  method: paymentMethodSchema,
  status: transactionStatusSchema,
  paidAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
});

export type Payment = z.infer<typeof paymentSchema>;
