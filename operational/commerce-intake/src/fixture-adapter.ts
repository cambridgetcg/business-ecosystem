/**
 * The fixture adapter: maps a synthetic-sales/1 file to commerce sale events,
 * contract version 1. It is the only adapter. A real channel adapter waits for
 * the owner's answers to the prerequisites in docs/PORTFOLIO_BOUNDARIES.md.
 *
 * Activation lives in code: every event this adapter makes is `synthetic`, from
 * the `synthetic` provider, for books whose decisionRef names a synthetic
 * fixture. A file cannot claim anything else.
 */

import { z } from 'zod';
import {
  booksOfSchema,
  commerceChannelSchema,
  commerceCounterpartySchema,
  commerceCurrencySchema,
  commerceProviderSchema,
  commerceRefSchema,
  feeCreditSchema,
  minorUnitsSchema,
  refundLineSchema,
  refundReasonSchema,
  saleFeeSchema,
  saleLineSchema,
  utcInstantSchema,
  type CommerceProvider,
} from '@ecosystem/contracts-financial';
import {
  COMMERCE_CONTRACT_VERSION,
  COMMERCE_SALE_RECORDED,
  COMMERCE_SALE_REFUNDED,
  commerceAggregateId,
  commerceEventId,
  commerceIdempotencyKey,
  commerceSaleEventSchema,
  type CommerceSaleEvent,
} from '@ecosystem/events-financial';
import { IntakeError, describeIssues } from './errors.js';

export const FIXTURE_FORMAT = 'synthetic-sales/1';
/** metadata.source of every event; the version is this package's (a test compares them). */
export const FIXTURE_SOURCE = 'commerce-intake/fixture@0.1.0';

const transactionIdSchema = commerceProviderSchema.shape.transactionId;
const orderRefSchema = commerceProviderSchema.shape.orderRef.unwrap();

const saleRecordSchema = z
  .object({
    type: z.literal('SALE'),
    id: transactionIdSchema,
    orderRef: orderRefSchema.optional(),
    at: utcInstantSchema,
    counterparty: commerceCounterpartySchema,
    lines: z.array(saleLineSchema).min(1).max(200),
    fees: z.array(saleFeeSchema).max(50),
    providerCollectedTax: minorUnitsSchema,
  })
  .strict();

const refundRecordSchema = z
  .object({
    type: z.literal('REFUND'),
    id: transactionIdSchema,
    orderRef: orderRefSchema.optional(),
    saleId: transactionIdSchema,
    at: utcInstantSchema,
    reason: refundReasonSchema,
    lines: z.array(refundLineSchema).min(1).max(200),
    feeCredits: z.array(feeCreditSchema).max(50),
    providerCollectedTaxRefunded: minorUnitsSchema,
  })
  .strict();

export const syntheticSalesSchema = z
  .object({
    format: z.literal(FIXTURE_FORMAT),
    about: z.string(),
    accountRef: commerceRefSchema,
    channel: commerceChannelSchema,
    // A fixture never claims an owner decision.
    booksOf: booksOfSchema.extend({ decisionRef: z.string().regex(/^synthetic-[a-z0-9-]{1,40}$/) }),
    currency: commerceCurrencySchema,
    records: z
      .array(z.discriminatedUnion('type', [saleRecordSchema, refundRecordSchema]))
      .min(1)
      .max(10_000),
  })
  .strict();

export type SyntheticSales = z.infer<typeof syntheticSalesSchema>;
type SaleRecord = z.infer<typeof saleRecordSchema>;
type RefundRecord = z.infer<typeof refundRecordSchema>;

const LONDON = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * S9: the tax point is the calendar date in the books' VAT time zone. For this
 * adapter that is the London date of the record's time, so a sale at
 * 2026-09-30T23:30Z (00:30 BST) falls on 2026-10-01 for every consumer.
 */
export function ukTaxPointDate(instant: string): string {
  const parts = Object.fromEntries(
    LONDON.formatToParts(new Date(instant)).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function sum(items: { net: number; tax: number }[]): number {
  return items.reduce((total, item) => total + item.net + item.tax, 0);
}

function provider(
  file: SyntheticSales,
  type: 'SALE' | 'REFUND',
  id: string,
  orderRef?: string
): CommerceProvider {
  const identity = {
    name: 'synthetic' as const,
    accountRef: file.accountRef,
    transactionType: type,
    transactionId: id,
  };
  return orderRef === undefined ? identity : { ...identity, orderRef };
}

function saleEvent(file: SyntheticSales, record: SaleRecord, timestamp: string): unknown {
  const key = commerceIdempotencyKey(provider(file, 'SALE', record.id));
  const gross = sum(record.lines);
  const fees = sum(record.fees);
  return {
    id: commerceEventId(key),
    type: COMMERCE_SALE_RECORDED,
    aggregateId: commerceAggregateId(key),
    aggregateType: 'Sale',
    version: COMMERCE_CONTRACT_VERSION,
    occurredAt: record.at,
    metadata: { correlationId: commerceEventId(key), source: FIXTURE_SOURCE, timestamp },
    payload: {
      evidenceClass: 'synthetic',
      booksOf: file.booksOf,
      channel: file.channel,
      provider: provider(file, 'SALE', record.id, record.orderRef),
      idempotencyKey: key,
      taxPointDate: ukTaxPointDate(record.at),
      currency: file.currency,
      counterparty: record.counterparty,
      lines: record.lines,
      fees: record.fees,
      providerCollectedTax: record.providerCollectedTax,
      totals: { gross, fees, net: gross - fees },
    },
  };
}

function refundEvent(file: SyntheticSales, record: RefundRecord, timestamp: string): unknown {
  const key = commerceIdempotencyKey(provider(file, 'REFUND', record.id));
  const saleKey = commerceIdempotencyKey(provider(file, 'SALE', record.saleId));
  const gross = sum(record.lines);
  const credited = sum(record.feeCredits);
  return {
    id: commerceEventId(key),
    type: COMMERCE_SALE_REFUNDED,
    aggregateId: commerceAggregateId(saleKey),
    aggregateType: 'Sale',
    version: COMMERCE_CONTRACT_VERSION,
    occurredAt: record.at,
    metadata: {
      correlationId: commerceEventId(saleKey),
      causationId: commerceEventId(saleKey),
      source: FIXTURE_SOURCE,
      timestamp,
    },
    payload: {
      evidenceClass: 'synthetic',
      booksOf: file.booksOf,
      channel: file.channel,
      provider: provider(file, 'REFUND', record.id, record.orderRef),
      idempotencyKey: key,
      saleIdempotencyKey: saleKey,
      taxPointDate: ukTaxPointDate(record.at),
      currency: file.currency,
      reason: record.reason,
      lines: record.lines,
      feeCredits: record.feeCredits,
      providerCollectedTaxRefunded: record.providerCollectedTaxRefunded,
      totals: { gross, feeCredits: credited, net: gross - credited },
    },
  };
}

/** Map every record in file order; each event must satisfy the contract (S1-S6, S8). */
export function mapSyntheticSales(file: SyntheticSales, timestamp: string): CommerceSaleEvent[] {
  return file.records.map((record, index) => {
    const event =
      record.type === 'SALE'
        ? saleEvent(file, record, timestamp)
        : refundEvent(file, record, timestamp);
    const result = commerceSaleEventSchema.safeParse(event);
    if (!result.success) {
      throw new IntakeError(
        `record ${index + 1} (${record.id}) breaks the contract: ${describeIssues(result.error)}`
      );
    }
    return result.data;
  });
}
