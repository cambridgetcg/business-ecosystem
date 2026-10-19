/**
 * Commerce sale events: commerce.sale.recorded and commerce.sale.refunded,
 * contract version 1.
 *
 * The contract of record is ../schema/commerce-sale-events.v1.schema.json.
 * These schemas accept exactly what it accepts and add the cross-field rules it
 * lists in x-semantic-rules: S1-S6 and S8 here, S7 in checkRefundAgainstSale
 * (it needs the stored sale), S10 in replayDigest. S9 is stated by the adapter.
 * conformance/commerce-sale-v1/CASES.json is run by this package's tests (zod
 * and ajv) and by foundational/accounting's Python mirror.
 *
 * The envelope does not reuse baseDomainEventSchema: its z.coerce.date() turns
 * '...00Z' into '...00.000Z', which would change the replay digest. Nothing here
 * coerces or transforms, so a parsed event equals its input.
 */

import { createHash } from 'node:crypto';
import { v5 as uuidv5 } from 'uuid';
import { z } from 'zod';
import {
  COMMERCE_EVENT_NAMESPACE,
  booksOfSchema,
  calendarDateSchema,
  commerceChannelSchema,
  commerceCounterpartySchema,
  commerceCurrencySchema,
  commerceIdempotencyKeySchema,
  commerceProviderSchema,
  evidenceClassSchema,
  feeCreditSchema,
  lowercaseUuidSchema,
  minorUnitsSchema,
  refundLineSchema,
  refundReasonSchema,
  saleFeeSchema,
  saleLineSchema,
  signedMinorUnitsSchema,
  utcInstantSchema,
  uuidV5Schema,
  type CommerceProvider,
} from '@ecosystem/contracts-financial';

export const COMMERCE_SALE_RECORDED = 'commerce.sale.recorded';
export const COMMERCE_SALE_REFUNDED = 'commerce.sale.refunded';
export const COMMERCE_SALE_EVENT_TYPES = [COMMERCE_SALE_RECORDED, COMMERCE_SALE_REFUNDED] as const;
export const COMMERCE_CONTRACT_VERSION = 1;

// ============================================================================
// Envelope and payloads
// ============================================================================

/** Trace data: excluded from replay equality (S10), so re-running a producer is not a conflict. */
export const commerceEventMetadataSchema = z
  .object({
    correlationId: lowercaseUuidSchema,
    causationId: lowercaseUuidSchema.optional(),
    userId: lowercaseUuidSchema.optional(),
    tenantId: lowercaseUuidSchema.optional(),
    source: z.string().regex(/^commerce-intake\/[a-z0-9-]{1,40}@[0-9]+\.[0-9]+\.[0-9]+$/),
    timestamp: utcInstantSchema,
  })
  .strict();

const envelope = {
  id: uuidV5Schema,
  aggregateId: uuidV5Schema,
  aggregateType: z.literal('Sale'),
  version: z.literal(COMMERCE_CONTRACT_VERSION),
  occurredAt: utcInstantSchema,
  metadata: commerceEventMetadataSchema,
};

export const saleRecordedPayloadSchema = z
  .object({
    evidenceClass: evidenceClassSchema,
    booksOf: booksOfSchema,
    channel: commerceChannelSchema,
    provider: commerceProviderSchema,
    idempotencyKey: commerceIdempotencyKeySchema,
    taxPointDate: calendarDateSchema,
    currency: commerceCurrencySchema,
    counterparty: commerceCounterpartySchema,
    lines: z.array(saleLineSchema).min(1).max(200),
    fees: z.array(saleFeeSchema).max(50),
    /** Tax the provider collects and remits itself: a memo, never ours, never posted. */
    providerCollectedTax: minorUnitsSchema,
    totals: z
      .object({ gross: minorUnitsSchema, fees: minorUnitsSchema, net: signedMinorUnitsSchema })
      .strict(),
  })
  .strict();

export const saleRefundedPayloadSchema = z
  .object({
    evidenceClass: evidenceClassSchema,
    booksOf: booksOfSchema,
    channel: commerceChannelSchema,
    provider: commerceProviderSchema,
    idempotencyKey: commerceIdempotencyKeySchema,
    saleIdempotencyKey: commerceIdempotencyKeySchema,
    taxPointDate: calendarDateSchema,
    currency: commerceCurrencySchema,
    reason: refundReasonSchema,
    lines: z.array(refundLineSchema).min(1).max(200),
    feeCredits: z.array(feeCreditSchema).max(50),
    providerCollectedTaxRefunded: minorUnitsSchema,
    totals: z
      .object({
        gross: minorUnitsSchema,
        feeCredits: minorUnitsSchema,
        net: signedMinorUnitsSchema,
      })
      .strict(),
  })
  .strict();

// Structure only. They are not exported from the package: parsing with them
// would skip the cross-field rules. index.ts uses them in financialEventSchema.
export const saleRecordedStructureSchema = z
  .object({
    ...envelope,
    type: z.literal(COMMERCE_SALE_RECORDED),
    payload: saleRecordedPayloadSchema,
  })
  .strict();
export const saleRefundedStructureSchema = z
  .object({
    ...envelope,
    type: z.literal(COMMERCE_SALE_REFUNDED),
    payload: saleRefundedPayloadSchema,
  })
  .strict();

export type CommerceSaleRecordedEvent = z.infer<typeof saleRecordedStructureSchema>;
export type CommerceSaleRefundedEvent = z.infer<typeof saleRefundedStructureSchema>;
export type CommerceSaleEvent = CommerceSaleRecordedEvent | CommerceSaleRefundedEvent;

// ============================================================================
// Identity (S1-S3)
// ============================================================================

/** S3: the provider's natural key. */
export function commerceIdempotencyKey(provider: CommerceProvider): string {
  return [
    'v1',
    provider.name,
    provider.accountRef,
    provider.transactionType,
    provider.transactionId,
  ].join('|');
}

/** S1: the event id is UUIDv5 of the idempotency key, so a re-import has the same identity. */
export function commerceEventId(idempotencyKey: string): string {
  return uuidv5(idempotencyKey, COMMERCE_EVENT_NAMESPACE);
}

/** S2: a sale and all its refunds share one aggregate, keyed by the sale's idempotency key. */
export function commerceAggregateId(saleIdempotencyKey: string): string {
  return uuidv5(`sale|${saleIdempotencyKey}`, COMMERCE_EVENT_NAMESPACE);
}

export function saleKeyOf(event: CommerceSaleEvent): string {
  return event.type === COMMERCE_SALE_RECORDED
    ? event.payload.idempotencyKey
    : event.payload.saleIdempotencyKey;
}

// ============================================================================
// Replay equality (S10)
// ============================================================================

/**
 * Canonical JSON: object keys sorted, no whitespace. Every contract key and
 * string is ASCII, so the UTF-16 key order here equals Python's sort_keys and
 * RFC 8785. Numbers must be safe integers, written without a fraction or
 * exponent, exactly as Python writes them.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new TypeError(`canonical JSON holds integers only, not ${value}`);
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${members.join(',')}}`;
  }
  throw new TypeError(`canonical JSON cannot hold a ${typeof value}`);
}

/** S10: SHA-256 of canonical JSON of the raw values; metadata is trace data and is excluded. */
export function replayDigest(event: CommerceSaleEvent): string {
  const { type, version, aggregateId, occurredAt, payload } = event;
  const input = canonicalJson({ type, version, aggregateId, occurredAt, payload });
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// ============================================================================
// Cross-field rules (S1-S6, S8)
// ============================================================================

const TAX_FREE_SALE_TREATMENTS: readonly string[] = [
  'zero_rated',
  'exempt',
  'outside_scope',
  'margin_scheme',
];
const TAX_FREE_FEE_TREATMENTS: readonly string[] = ['exempt', 'outside_scope'];

function repeats(refs: string[]): boolean {
  return new Set(refs).size !== refs.length;
}

function sum(items: { net: number; tax: number }[]): number {
  return items.reduce((total, item) => total + item.net + item.tax, 0);
}

/** Adds one custom issue per broken rule; each message starts with the rule id. */
export function checkCommerceSaleRules(event: CommerceSaleEvent, ctx: z.RefinementCtx): void {
  const issue = (message: string, path: (string | number)[]): void => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
  };
  const { payload } = event;
  if (event.id !== commerceEventId(payload.idempotencyKey)) {
    issue('S1 id is not UUIDv5 of the idempotency key', ['id']);
  }
  if (event.aggregateId !== commerceAggregateId(saleKeyOf(event))) {
    issue('S2 aggregateId is not UUIDv5 of the sale key', ['aggregateId']);
  }
  if (payload.idempotencyKey !== commerceIdempotencyKey(payload.provider)) {
    issue('S3 idempotency key does not match the provider fields', ['payload', 'idempotencyKey']);
  }
  if (repeats(payload.lines.map((line) => line.lineRef))) {
    issue('S6 lineRef values repeat', ['payload', 'lines']);
  }
  const gross = sum(payload.lines);
  if (event.type === COMMERCE_SALE_RECORDED) {
    const { fees, totals } = event.payload;
    if (repeats(fees.map((fee) => fee.feeRef))) {
      issue('S6 feeRef values repeat', ['payload', 'fees']);
    }
    if (totals.gross !== gross || totals.fees !== sum(fees) || totals.net !== gross - sum(fees)) {
      issue('S4 totals differ from the lines', ['payload', 'totals']);
    }
    event.payload.lines.forEach((line, index) => {
      const at = ['payload', 'lines', index];
      if (TAX_FREE_SALE_TREATMENTS.includes(line.taxTreatment) && line.tax !== 0) {
        issue(`S8 ${line.taxTreatment} line states tax`, [...at, 'tax']);
      }
      if ((line.taxBasis === 'not_applicable') !== (line.tax === 0)) {
        issue('S8 taxBasis not_applicable must match zero tax', [...at, 'taxBasis']);
      }
    });
    fees.forEach((fee, index) => {
      if (TAX_FREE_FEE_TREATMENTS.includes(fee.taxTreatment) && fee.tax !== 0) {
        issue(`S8 ${fee.taxTreatment} fee states tax`, ['payload', 'fees', index, 'tax']);
      }
    });
  } else {
    const { feeCredits, totals } = event.payload;
    if (repeats(feeCredits.map((fee) => fee.feeRef))) {
      issue('S6 feeRef values repeat', ['payload', 'feeCredits']);
    }
    const credited = sum(feeCredits);
    if (
      totals.gross !== gross ||
      totals.feeCredits !== credited ||
      totals.net !== gross - credited
    ) {
      issue('S5 totals differ from the lines', ['payload', 'totals']);
    }
  }
}

export const commerceSaleRecordedEventSchema =
  saleRecordedStructureSchema.superRefine(checkCommerceSaleRules);
export const commerceSaleRefundedEventSchema =
  saleRefundedStructureSchema.superRefine(checkCommerceSaleRules);
export const commerceSaleEventSchema = z
  .discriminatedUnion('type', [saleRecordedStructureSchema, saleRefundedStructureSchema])
  .superRefine(checkCommerceSaleRules);

// ============================================================================
// S7: a refund against its stored sale
// ============================================================================

export class CommerceContractError extends Error {
  override name = 'CommerceContractError';
}

/** S7 identity rules for a refund and its sale. Cumulative refund caps are the consumer's policy. */
export function checkRefundAgainstSale(
  refund: CommerceSaleRefundedEvent,
  sale: CommerceSaleEvent
): void {
  if (sale.type !== COMMERCE_SALE_RECORDED) {
    throw new CommerceContractError('S7 saleIdempotencyKey names an event that is not a sale');
  }
  const ours = refund.payload;
  const sold = sale.payload;
  const same: [string, boolean][] = [
    // First the sale it names: another sale can share every field below.
    ['saleIdempotencyKey', ours.saleIdempotencyKey === sold.idempotencyKey],
    ['booksOf.entityId', ours.booksOf.entityId === sold.booksOf.entityId],
    ['currency', ours.currency === sold.currency],
    ['channel', ours.channel.kind === sold.channel.kind && ours.channel.name === sold.channel.name],
    ['provider.accountRef', ours.provider.accountRef === sold.provider.accountRef],
  ];
  for (const [name, equal] of same) {
    if (!equal) throw new CommerceContractError(`S7 refund ${name} differs from its sale`);
  }
  const lineRefs = new Set(sold.lines.map((line) => line.lineRef));
  if (!ours.lines.every((line) => lineRefs.has(line.lineRef))) {
    throw new CommerceContractError('S7 refund names a lineRef its sale does not have');
  }
  const feeRefs = new Set(sold.fees.map((fee) => fee.feeRef));
  if (!ours.feeCredits.every((fee) => feeRefs.has(fee.feeRef))) {
    throw new CommerceContractError('S7 refund names a feeRef its sale does not have');
  }
}
