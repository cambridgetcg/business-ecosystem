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

// ============================================================================
// Commerce Sale Contracts (contract version 1)
// ============================================================================
// Building blocks of the commerce.sale.* events in @ecosystem/events-financial.
// The contract of record is the language-neutral JSON Schema at
// shared/events/financial-events/schema/commerce-sale-events.v1.schema.json:
// every pattern and bound below equals the one there, and a test compares them.
// Values are validated exactly as written and never coerced: amounts stay
// integer minor units, and dates and instants stay strings.

/** UUIDv5 namespace of every commerce event id and aggregate id. Ids derive from it: never change it. */
export const COMMERCE_EVENT_NAMESPACE = '6f1d3c52-8a4e-4d7b-9c1e-2b5a7e9f0c31';

export const lowercaseUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const uuidV5Schema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

// The pattern fixes what date-time formats leave open (a space or lowercase t
// as separator, a leap second, year 0000); .datetime() adds the calendar check.
export const utcInstantSchema = z
  .string()
  .regex(/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?Z$/)
  .datetime();
export const calendarDateSchema = z
  .string()
  .regex(/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/)
  .date();

export const commerceCurrencySchema = z.string().regex(/^[A-Z]{3}$/);
export const minorUnitsSchema = z.number().int().min(0).max(100_000_000_000);
export const signedMinorUnitsSchema = z.number().int().min(-100_000_000_000).max(100_000_000_000);
export const commerceRefSchema = z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/);

export const commerceProviderNameSchema = z.enum([
  'synthetic',
  'ebay',
  'stripe',
  'shopify_partner',
  'bank_statement',
  'manual',
]);

/** v1|provider|accountRef|transactionType|transactionId: the provider's natural key. */
export const commerceIdempotencyKeySchema = z
  .string()
  .max(255)
  .regex(
    /^v1\|(synthetic|ebay|stripe|shopify_partner|bank_statement|manual)\|[A-Za-z0-9._:-]{1,64}\|[A-Za-z_]{1,40}\|[A-Za-z0-9._:/-]{1,128}$/
  );

/** synthetic = invented fixture; recorded = a real record replayed offline; live = read at run time. */
export const evidenceClassSchema = z.enum(['synthetic', 'recorded', 'live']);

/** Whose ledger the fact belongs to; decisionRef names the owner decision (or synthetic fixture) that assigned it. */
export const booksOfSchema = z
  .object({
    entityId: lowercaseUuidSchema,
    decisionRef: z
      .string()
      .regex(/^(dec-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]+|synthetic-[a-z0-9-]{1,40})$/),
  })
  .strict();

export const commerceChannelSchema = z
  .object({
    kind: z.enum(['marketplace', 'storefront', 'direct_b2b', 'in_person']),
    name: z.string().regex(/^[a-z0-9-]{1,40}$/),
  })
  .strict();

/** The provider's own identity for the record; transactionId is its raw id, not a UUID. */
export const commerceProviderSchema = z
  .object({
    name: commerceProviderNameSchema,
    accountRef: commerceRefSchema,
    transactionType: z.string().regex(/^[A-Za-z_]{1,40}$/),
    transactionId: z.string().regex(/^[A-Za-z0-9._:/-]{1,128}$/),
    orderRef: z
      .string()
      .regex(/^[A-Za-z0-9._:/-]{1,128}$/)
      .optional(),
  })
  .strict();

/** Only what VAT treatment needs: no names, emails, usernames or addresses. */
export const commerceCounterpartySchema = z
  .object({
    kind: z.enum(['consumer', 'business', 'unknown']),
    country: z.string().regex(/^[A-Z]{2}$/),
  })
  .strict();

export const saleTaxTreatmentSchema = z.enum([
  'standard_rated',
  'reduced_rated',
  'zero_rated',
  'exempt',
  'outside_scope',
  'margin_scheme',
]);
export const feeTaxTreatmentSchema = z.enum([
  'standard_rated',
  'exempt',
  'outside_scope',
  'reverse_charge',
]);
export const taxBasisSchema = z.enum(['source_stated', 'derived_from_inclusive', 'not_applicable']);

export const saleLineSchema = z
  .object({
    lineRef: commerceRefSchema,
    revenueClass: z.enum(['goods', 'shipping']),
    quantity: z.number().int().min(1).max(100_000),
    net: minorUnitsSchema,
    tax: minorUnitsSchema,
    taxTreatment: saleTaxTreatmentSchema,
    taxRateBp: z.number().int().min(0).max(10_000), // basis points: 2000 = 20%
    taxBasis: taxBasisSchema,
  })
  .strict();

export const saleFeeSchema = z
  .object({
    feeRef: commerceRefSchema,
    feeType: z.string().regex(/^[A-Z0-9_]{1,40}$/),
    net: minorUnitsSchema,
    tax: minorUnitsSchema,
    taxTreatment: feeTaxTreatmentSchema,
  })
  .strict();

export const refundLineSchema = z
  .object({ lineRef: commerceRefSchema, net: minorUnitsSchema, tax: minorUnitsSchema })
  .strict();
export const feeCreditSchema = z
  .object({ feeRef: commerceRefSchema, net: minorUnitsSchema, tax: minorUnitsSchema })
  .strict();
export const refundReasonSchema = z.enum([
  'return',
  'cancellation',
  'partial_refund',
  'goodwill',
  'other',
]);

export type EvidenceClass = z.infer<typeof evidenceClassSchema>;
export type BooksOf = z.infer<typeof booksOfSchema>;
export type CommerceChannel = z.infer<typeof commerceChannelSchema>;
export type CommerceProvider = z.infer<typeof commerceProviderSchema>;
export type CommerceCounterparty = z.infer<typeof commerceCounterpartySchema>;
export type SaleTaxTreatment = z.infer<typeof saleTaxTreatmentSchema>;
export type FeeTaxTreatment = z.infer<typeof feeTaxTreatmentSchema>;
export type SaleLine = z.infer<typeof saleLineSchema>;
export type SaleFee = z.infer<typeof saleFeeSchema>;
export type RefundLine = z.infer<typeof refundLineSchema>;
export type FeeCredit = z.infer<typeof feeCreditSchema>;
