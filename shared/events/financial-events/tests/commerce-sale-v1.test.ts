/**
 * Runs the shared conformance cases (conformance/commerce-sale-v1/CASES.json)
 * with zod and with ajv against the contract of record, the JSON Schema, and
 * checks that the zod schemas mirror that schema field by field. Python runs
 * the same cases in foundational/accounting/tests/test_commerce_posting_contract.py.
 */
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { COMMERCE_EVENT_NAMESPACE } from '@ecosystem/contracts-financial';
import {
  CommerceContractError,
  canonicalJson,
  checkRefundAgainstSale,
  commerceAggregateId,
  commerceEventId,
  commerceIdempotencyKey,
  commerceSaleEventSchema,
  commerceSaleRecordedEventSchema,
  commerceSaleRefundedEventSchema,
  financialEventSchema,
  replayDigest,
  saleKeyOf,
  type CommerceSaleEvent,
  type CommerceSaleRefundedEvent,
} from '../src/index.js';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Patch = { op: 'add' | 'replace' | 'remove'; path: string; value?: Json }[];
interface Cases {
  namespace: string;
  valid: { name: string; replayDigest: string; event: CommerceSaleEvent }[];
  invalid: { name: string; base: string; patch: Patch; rule: string }[];
  refundAgainstSale: {
    name: string;
    refund: string;
    sale: string;
    patch: Patch;
    rule: string | null;
  }[];
  uuidV5: { name: string; uuid: string }[];
}

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const cases = read('../conformance/commerce-sale-v1/CASES.json') as Cases;
const schema = read('../schema/commerce-sale-events.v1.schema.json') as Record<string, Json>;
const events = new Map(cases.valid.map((item) => [item.name, item.event]));

const ajv = new Ajv2020({ strict: true, allErrors: true });
ajv.addKeyword('x-semantic-rules');
addFormats(ajv);
const validateSchema = ajv.compile(schema);

/** RFC 6902 add, replace and remove; the path '' replaces the whole document. */
function patched(base: unknown, patch: Patch): unknown {
  let doc = structuredClone(base) as Json;
  for (const { op, path, value } of patch) {
    if (path === '') {
      doc = structuredClone(value) as Json;
      continue;
    }
    const parts = path.slice(1).split('/');
    const last = parts.pop() as string;
    let target = doc as Record<string, Json> | Json[];
    for (const part of parts)
      target = (target as Record<string, Json>)[part] as Record<string, Json>;
    if (Array.isArray(target)) {
      const index = Number(last);
      if (op === 'add') target.splice(index, 0, structuredClone(value) as Json);
      else if (op === 'replace') target[index] = structuredClone(value) as Json;
      else target.splice(index, 1);
    } else if (op === 'remove') {
      expect(last in target).toBe(true);
      delete target[last];
    } else {
      expect(last in target).toBe(op === 'replace');
      target[last] = structuredClone(value) as Json;
    }
  }
  return doc;
}

function event(name: string): CommerceSaleEvent {
  const found = events.get(name);
  if (!found) throw new Error(`no valid case named ${name}`);
  return found;
}

// zod also runs the cross-field rules on well-typed data that failed a pattern
// or bound, so a structural rejection may carry rule issues as well; a rule
// rejection has no structural issue and names exactly its rule.
const isRuleIssue = (issue: z.ZodIssue): boolean => issue.code === z.ZodIssueCode.custom;
const ruleIds = (error: z.ZodError): string[] =>
  error.issues.filter(isRuleIssue).map((issue) => issue.message.split(' ')[0] as string);

describe('commerce sale contract v1: shared conformance cases', () => {
  it('uses the contract namespace', () => {
    expect(cases.namespace).toBe(COMMERCE_EVENT_NAMESPACE);
  });

  it.each(cases.valid)(
    'accepts $name unchanged and derives its ids and digest',
    ({ event, replayDigest: digest }) => {
      expect(validateSchema(event), ajv.errorsText(validateSchema.errors)).toBe(true);
      const parsed = commerceSaleEventSchema.parse(event);
      expect(parsed).toStrictEqual(event);
      expect(financialEventSchema.parse(event)).toStrictEqual(event);
      const typed =
        event.type === 'commerce.sale.recorded'
          ? commerceSaleRecordedEventSchema
          : commerceSaleRefundedEventSchema;
      expect(typed.parse(event)).toStrictEqual(event);
      expect(commerceIdempotencyKey(event.payload.provider)).toBe(event.payload.idempotencyKey);
      expect(commerceEventId(event.payload.idempotencyKey)).toBe(event.id);
      expect(commerceAggregateId(saleKeyOf(event))).toBe(event.aggregateId);
      expect(replayDigest(event)).toBe(digest);
      expect(replayDigest(parsed)).toBe(digest);
    }
  );

  it.each(cases.invalid)('rejects $name ($rule)', ({ base, patch, rule }) => {
    const candidate = patched(event(base), patch);
    expect(validateSchema(candidate)).toBe(rule !== 'schema');
    for (const parser of [commerceSaleEventSchema, financialEventSchema]) {
      const result = parser.safeParse(candidate);
      expect(result.success).toBe(false);
      if (result.success) continue;
      if (rule === 'schema') {
        expect(result.error.issues.some((issue) => !isRuleIssue(issue))).toBe(true);
      } else {
        expect(result.error.issues.every(isRuleIssue)).toBe(true);
        expect(ruleIds(result.error)).toStrictEqual([rule]);
      }
    }
  });

  it.each(cases.refundAgainstSale)(
    'checks $name against the stored sale',
    ({ refund, sale, patch, rule }) => {
      const candidate = patched(event(refund), patch) as CommerceSaleRefundedEvent;
      const check = (): void => checkRefundAgainstSale(candidate, event(sale));
      if (rule === null) {
        expect(check).not.toThrow();
      } else {
        expect(check).toThrow(CommerceContractError);
        expect(check).toThrow(new RegExp(`^${rule} `));
      }
    }
  );

  it.each(cases.uuidV5)('derives UUIDv5 for $name', ({ name, uuid }) => {
    const aggregate = name.startsWith('sale|');
    const derived = aggregate
      ? commerceAggregateId(name.slice('sale|'.length))
      : commerceEventId(name);
    expect(derived).toBe(uuid);
  });
});

describe('commerce sale contract v1: replay digest (S10)', () => {
  const sale = event('golden-t1-sale-standard-rated');

  it('covers the raw values and leaves out metadata', () => {
    const traced = { ...sale, metadata: { ...sale.metadata, timestamp: '2027-01-01T00:00:00Z' } };
    expect(replayDigest(traced)).toBe(replayDigest(sale));
    // z.coerce.date() would re-serialize with milliseconds: still a valid
    // instant, but different raw bytes and so a different digest.
    const coerced = { ...sale, occurredAt: '2026-09-14T10:15:00.000Z' };
    expect(commerceSaleEventSchema.parse(coerced).occurredAt).toBe('2026-09-14T10:15:00.000Z');
    expect(replayDigest(coerced)).not.toBe(replayDigest(sale));
  });

  it('writes canonical JSON with sorted keys and integers only', () => {
    expect(canonicalJson({ b: [2, { d: null, c: 'x' }], a: true })).toBe(
      '{"a":true,"b":[2,{"c":"x","d":null}]}'
    );
    expect(() => canonicalJson({ net: 20.5 })).toThrow(TypeError);
    expect(() => canonicalJson({ net: undefined })).toThrow(TypeError);
  });
});

// Field-by-field parity: both sides are reduced to the same plain description.
type Description = Record<string, unknown>;
const defs = schema.$defs as Record<string, Record<string, Json>>;
const ANNOTATIONS = new Set(['description', '$comment']);

function fromJsonSchema(node: Record<string, Json>): Description {
  if (typeof node.$ref === 'string') {
    const { $ref, ...rest } = node;
    return fromJsonSchema({ ...defs[$ref.split('/').pop() as string], ...rest });
  }
  if (Array.isArray(node.allOf)) {
    // An event: allOf [envelope] + its own type and payload, closed by unevaluatedProperties.
    expect(node.unevaluatedProperties).toBe(false);
    const envelope = defs[
      (node.allOf[0] as Record<string, string>).$ref?.split('/').pop() as string
    ] as Record<string, Json>;
    return fromJsonSchema({
      type: 'object',
      additionalProperties: false,
      required: [...new Set([...(envelope.required as string[]), ...(node.required as string[])])],
      properties: {
        ...(envelope.properties as Record<string, Json>),
        ...(node.properties as Record<string, Json>),
      },
    });
  }
  const keys = Object.keys(node).filter((key) => !ANNOTATIONS.has(key));
  if ('enum' in node) return { enum: [...(node.enum as string[])].sort(), keys };
  if ('const' in node) return { const: node.const };
  if (node.type === 'string') {
    return {
      string: new RegExp(node.pattern as string).source,
      maxLength: node.maxLength,
      format: node.format,
    };
  }
  if (node.type === 'integer') return { integer: [node.minimum, node.maximum] };
  if (node.type === 'array') {
    return {
      array: fromJsonSchema(node.items as Record<string, Json>),
      min: node.minItems ?? 0,
      max: node.maxItems,
    };
  }
  expect(node.type).toBe('object');
  expect(node.additionalProperties).toBe(false);
  const properties = node.properties as Record<string, Record<string, Json>>;
  return {
    required: [...(node.required as string[])].sort(),
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, fromJsonSchema(value)])
    ),
  };
}

function fromZod(schema: z.ZodTypeAny): Description {
  if (schema instanceof z.ZodEffects) return fromZod(schema.innerType() as z.ZodTypeAny);
  if (schema instanceof z.ZodEnum)
    return { enum: [...(schema.options as string[])].sort(), keys: ['enum'] };
  if (schema instanceof z.ZodLiteral) return { const: schema.value as Json };
  if (schema instanceof z.ZodString) {
    const checks = schema._def.checks;
    const regexes = checks.flatMap((check) => (check.kind === 'regex' ? [check.regex.source] : []));
    expect(regexes).toHaveLength(1);
    const kinds = checks
      .map((check) => check.kind)
      .filter((kind) => kind !== 'regex' && kind !== 'max');
    expect(kinds.length).toBeLessThanOrEqual(1);
    const format = { datetime: 'date-time', date: 'date' }[kinds[0] as string];
    const max = checks.find((check) => check.kind === 'max');
    return { string: regexes[0], maxLength: max?.kind === 'max' ? max.value : undefined, format };
  }
  if (schema instanceof z.ZodNumber) {
    const checks = schema._def.checks;
    expect(checks.some((check) => check.kind === 'int')).toBe(true);
    const bound = (kind: 'min' | 'max'): number | undefined => {
      const found = checks.find((check) => check.kind === kind);
      if (found?.kind !== kind) return undefined;
      expect(found.inclusive).toBe(true);
      return found.value;
    };
    return { integer: [bound('min'), bound('max')] };
  }
  if (schema instanceof z.ZodArray) {
    return {
      array: fromZod(schema.element as z.ZodTypeAny),
      min: schema._def.minLength?.value ?? 0,
      max: schema._def.maxLength?.value,
    };
  }
  expect(schema).toBeInstanceOf(z.ZodObject);
  const object = schema as z.ZodObject<z.ZodRawShape>;
  expect(object._def.unknownKeys).toBe('strict');
  const entries = Object.entries(object.shape);
  return {
    required: entries
      .filter(([, value]) => !(value instanceof z.ZodOptional))
      .map(([key]) => key)
      .sort(),
    properties: Object.fromEntries(
      entries.map(([key, value]) => [
        key,
        fromZod(value instanceof z.ZodOptional ? (value.unwrap() as z.ZodTypeAny) : value),
      ])
    ),
  };
}

describe('commerce sale contract v1: zod mirrors the JSON Schema', () => {
  it('has one variant per event type', () => {
    expect(schema.oneOf).toStrictEqual([
      { $ref: '#/$defs/saleRecordedEvent' },
      { $ref: '#/$defs/saleRefundedEvent' },
    ]);
    expect([...commerceSaleEventSchema.innerType().optionsMap.keys()]).toStrictEqual([
      'commerce.sale.recorded',
      'commerce.sale.refunded',
    ]);
  });

  it.each([
    ['saleRecordedEvent', commerceSaleRecordedEventSchema],
    ['saleRefundedEvent', commerceSaleRefundedEventSchema],
  ] as const)('matches $defs.%s field by field', (definition, zodSchema) => {
    expect(fromZod(zodSchema)).toStrictEqual(
      fromJsonSchema(defs[definition] as Record<string, Json>)
    );
  });

  it('lists the rules the implementations enforce or the adapter states', () => {
    const rules = (schema['x-semantic-rules'] as string[]).map((rule) => rule.split(' ')[0]);
    expect(rules).toStrictEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']);
  });
});
