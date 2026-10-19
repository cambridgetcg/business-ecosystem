import { readFileSync } from 'node:fs';
import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { replayDigest, type CommerceSaleEvent } from '@ecosystem/events-financial';
import { IntakeError } from '../src/errors.js';
import {
  FIXTURE_SOURCE,
  mapSyntheticSales,
  syntheticSalesSchema,
  ukTaxPointDate,
  type SyntheticSales,
} from '../src/fixture-adapter.js';

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fixture = (): SyntheticSales =>
  syntheticSalesSchema.parse(read('../fixtures/synthetic-sales-2026-09-10.json'));
// The contract's shared conformance cases: their golden-* events are the
// golden fixture accounting posts (foundational/accounting/tests/fixtures).
const cases = read(
  '../../../shared/events/financial-events/conformance/commerce-sale-v1/CASES.json'
) as {
  valid: { name: string; replayDigest: string; event: CommerceSaleEvent }[];
};
const golden = cases.valid.filter((item) => item.name.startsWith('golden-'));
const GOLDEN_TIMESTAMP = '2026-10-18T12:00:00Z';

describe('fixture adapter', () => {
  it('maps the golden fixture to exactly the contract golden events', () => {
    const events = mapSyntheticSales(fixture(), GOLDEN_TIMESTAMP);
    expect(events).toStrictEqual(golden.map((item) => item.event));
    expect(events.map(replayDigest)).toStrictEqual(golden.map((item) => item.replayDigest));
  });

  it.each([
    ['2026-09-30T23:30:00Z', '2026-10-01'], // 00:30 BST
    ['2026-11-30T23:30:00Z', '2026-11-30'], // GMT
    ['2026-03-29T00:30:00Z', '2026-03-29'], // before BST starts at 01:00Z
    ['2026-03-29T23:30:00Z', '2026-03-30'], // after
    ['2026-10-24T23:30:00Z', '2026-10-25'], // 00:30 BST, the day BST ends
    ['2026-10-25T23:30:00Z', '2026-10-25'], // GMT again
  ])('states the UK tax point of %s as %s (S9)', (instant, date) => {
    expect(ukTaxPointDate(instant)).toBe(date);
  });

  it('makes only synthetic events from the synthetic provider', () => {
    for (const event of mapSyntheticSales(fixture(), GOLDEN_TIMESTAMP)) {
      expect(event.payload.evidenceClass).toBe('synthetic');
      expect(event.payload.provider.name).toBe('synthetic');
      expect(event.metadata.source).toBe(FIXTURE_SOURCE);
    }
  });

  it.each([
    [
      'an owner decision',
      {
        booksOf: {
          entityId: '00000000-0000-4000-8000-00000000b00c',
          decisionRef: 'dec-2026-10-18-1',
        },
      },
    ],
    ['another evidence class', { evidenceClass: 'live' }],
    ['another provider', { provider: 'ebay' }],
    ['an unknown format', { format: 'synthetic-sales/2' }],
  ])('refuses a file that claims %s', (_claim, change) => {
    const changed = {
      ...(read('../fixtures/synthetic-sales-2026-09-10.json') as object),
      ...change,
    };
    expect(syntheticSalesSchema.safeParse(changed).success).toBe(false);
  });

  it('refuses to map a typed file that names an owner decision', () => {
    // SyntheticSales types decisionRef as any string, so only the parse inside
    // the exported mapper keeps a library caller to synthetic books.
    const file = fixture();
    file.booksOf.decisionRef = 'dec-2026-10-18-1';
    expect(() => mapSyntheticSales(file, GOLDEN_TIMESTAMP)).toThrow(IntakeError);
    expect(() => mapSyntheticSales(file, GOLDEN_TIMESTAMP)).toThrow(
      /^input is not synthetic-sales\/1: booksOf\.decisionRef: /
    );
  });

  it('refuses a record whose event breaks the contract, naming the record and rule', () => {
    const file = fixture();
    const [first] = file.records;
    if (first?.type !== 'SALE') throw new Error('the golden fixture starts with a sale');
    file.records = [
      {
        ...first,
        lines: first.lines.map((line) => ({ ...line, taxTreatment: 'zero_rated' as const })),
      },
    ];
    expect(() => mapSyntheticSales(file, GOLDEN_TIMESTAMP)).toThrow(IntakeError);
    expect(() => mapSyntheticSales(file, GOLDEN_TIMESTAMP)).toThrow(/record 1 \(syn-sale-t1\).*S8/);
  });

  it('names this package version in metadata.source', () => {
    const manifest = read('../package.json') as { version: string };
    expect(FIXTURE_SOURCE).toBe(`commerce-intake/fixture@${manifest.version}`);
  });
});

describe('test guard', () => {
  it('refuses network access in this process', () => {
    expect(() => net.connect(9, '127.0.0.1')).toThrow(/network access refused/);
    expect(() => fetch('http://127.0.0.1:9')).toThrow(/network access refused/);
  });
});
