/**
 * @ecosystem/events-financial
 * Financial domain events
 */

import { z } from 'zod';

// ============================================================================
// Base Event Schema (shared)
// ============================================================================

const eventMetadataSchema = z.object({
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  source: z.string(),
  timestamp: z.coerce.date(),
});

const baseDomainEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  aggregateId: z.string().uuid(),
  aggregateType: z.string(),
  version: z.number().int().positive(),
  occurredAt: z.coerce.date(),
  metadata: eventMetadataSchema,
});

const moneySchema = z.object({
  amount: z.number().int(),
  currency: z.string().length(3),
});

// ============================================================================
// Transaction Events
// ============================================================================

export const transactionCreatedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('transaction.created'),
  aggregateType: z.literal('Transaction'),
  payload: z.object({
    entityId: z.string().uuid(),
    type: z.string(),
    amount: moneySchema,
    sourceAccountId: z.string().uuid().optional(),
    destinationAccountId: z.string().uuid().optional(),
  }),
});

export type TransactionCreatedEvent = z.infer<typeof transactionCreatedEventSchema>;

export const transactionCompletedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('transaction.completed'),
  aggregateType: z.literal('Transaction'),
  payload: z.object({
    processedAt: z.coerce.date(),
    amount: moneySchema,
  }),
});

export type TransactionCompletedEvent = z.infer<typeof transactionCompletedEventSchema>;

export const transactionFailedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('transaction.failed'),
  aggregateType: z.literal('Transaction'),
  payload: z.object({
    reason: z.string(),
    errorCode: z.string().optional(),
  }),
});

export type TransactionFailedEvent = z.infer<typeof transactionFailedEventSchema>;

// ============================================================================
// Invoice Events
// ============================================================================

export const invoiceCreatedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('invoice.created'),
  aggregateType: z.literal('Invoice'),
  payload: z.object({
    invoiceNumber: z.string(),
    customerId: z.string().uuid(),
    total: moneySchema,
    dueDate: z.coerce.date(),
  }),
});

export type InvoiceCreatedEvent = z.infer<typeof invoiceCreatedEventSchema>;

export const invoicePaidEventSchema = baseDomainEventSchema.extend({
  type: z.literal('invoice.paid'),
  aggregateType: z.literal('Invoice'),
  payload: z.object({
    paymentId: z.string().uuid(),
    amountPaid: moneySchema,
    paidAt: z.coerce.date(),
  }),
});

export type InvoicePaidEvent = z.infer<typeof invoicePaidEventSchema>;

export const invoiceOverdueEventSchema = baseDomainEventSchema.extend({
  type: z.literal('invoice.overdue'),
  aggregateType: z.literal('Invoice'),
  payload: z.object({
    dueDate: z.coerce.date(),
    amountDue: moneySchema,
    daysPastDue: z.number().int(),
  }),
});

export type InvoiceOverdueEvent = z.infer<typeof invoiceOverdueEventSchema>;

// ============================================================================
// Account Events
// ============================================================================

export const accountBalanceChangedEventSchema = baseDomainEventSchema.extend({
  type: z.literal('account.balance_changed'),
  aggregateType: z.literal('BankAccount'),
  payload: z.object({
    previousBalance: moneySchema,
    newBalance: moneySchema,
    transactionId: z.string().uuid(),
  }),
});

export type AccountBalanceChangedEvent = z.infer<typeof accountBalanceChangedEventSchema>;

// ============================================================================
// Event Union
// ============================================================================

export const financialEventSchema = z.discriminatedUnion('type', [
  transactionCreatedEventSchema,
  transactionCompletedEventSchema,
  transactionFailedEventSchema,
  invoiceCreatedEventSchema,
  invoicePaidEventSchema,
  invoiceOverdueEventSchema,
  accountBalanceChangedEventSchema,
]);

export type FinancialEvent = z.infer<typeof financialEventSchema>;

export const FINANCIAL_EVENT_TYPES = [
  'transaction.created',
  'transaction.completed',
  'transaction.failed',
  'invoice.created',
  'invoice.paid',
  'invoice.overdue',
  'account.balance_changed',
] as const;
