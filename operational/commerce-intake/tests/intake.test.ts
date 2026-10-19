import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canonicalJson, type CommerceSaleEvent } from '@ecosystem/events-financial';
import { IntakeError } from '../src/errors.js';
import { importFixture, intakeTimestamp } from '../src/intake.js';
import { readSpool } from '../src/spool.js';

const FIXTURE = new URL('../fixtures/synthetic-sales-2026-09-10.json', import.meta.url).pathname;
const AT = '2026-10-18T12:00:00Z';
// The contract's golden events as canonical lines: the golden spool that
// accounting's Python builder writes and posts, byte for byte.
const cases = JSON.parse(
  readFileSync(
    new URL(
      '../../../shared/events/financial-events/conformance/commerce-sale-v1/CASES.json',
      import.meta.url
    ),
    'utf8'
  )
) as { valid: { name: string; event: CommerceSaleEvent }[] };
const GOLDEN_SPOOL = Buffer.from(
  cases.valid
    .filter((item) => item.name.startsWith('golden-'))
    .map((item) => `${canonicalJson(item.event)}\n`)
    .join('')
);

let directory: string;
let spool: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'commerce-intake-'));
  spool = join(directory, 'events.ndjson');
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

/** A copy of the golden fixture with `change` applied to its parsed JSON. */
function variant(change: (file: { records: Record<string, unknown>[] }) => void): string {
  const file = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { records: Record<string, unknown>[] };
  change(file);
  const path = join(directory, 'fixture.json');
  writeFileSync(path, JSON.stringify(file));
  return path;
}

function expectIntakeError(action: () => unknown, message: RegExp): void {
  expect(action).toThrow(IntakeError);
  expect(action).toThrow(message);
}

describe('import into the spool', () => {
  it('appends every event once as a canonical JSON line, then skips them all', () => {
    const first = importFixture(FIXTURE, spool, AT);
    expect(first).toMatchObject({ events: 7, appended: 7, skipped: 0 });
    const bytes = readFileSync(spool);
    expect(bytes.equals(GOLDEN_SPOOL)).toBe(true);

    const again = importFixture(FIXTURE, spool, '2026-10-19T08:00:00Z');
    expect(again).toMatchObject({ events: 7, appended: 0, skipped: 7 });
    expect(again.event_ids).toStrictEqual(first.event_ids);
    expect(readFileSync(spool).equals(bytes)).toBe(true);
  });

  it('appends only what is new', () => {
    const partial = variant((file) => {
      file.records = file.records.slice(0, 3);
    });
    expect(importFixture(partial, spool, AT)).toMatchObject({ appended: 3, skipped: 0 });
    expect(importFixture(FIXTURE, spool, AT)).toMatchObject({ appended: 4, skipped: 3 });
    expect(readFileSync(spool).equals(GOLDEN_SPOOL)).toBe(true);
  });

  it('refuses the same id with different content and writes nothing', () => {
    importFixture(FIXTURE, spool, AT);
    const before = readFileSync(spool);
    const changed = variant((file) => {
      const sale = file.records[0] as { lines: { net: number }[] };
      (sale.lines[0] as { net: number }).net += 1;
    });
    expectIntakeError(() => importFixture(changed, spool, AT), /conflicting duplicate event_id/);
    expect(readFileSync(spool).equals(before)).toBe(true);
  });

  it('refuses a conflict inside one file before creating the spool', () => {
    const changed = variant((file) => {
      const copy = structuredClone(file.records[0]) as { lines: { net: number }[] };
      (copy.lines[0] as { net: number }).net += 1;
      file.records.push(copy);
    });
    expectIntakeError(() => importFixture(changed, spool, AT), /conflicting duplicate event_id/);
    expect(existsSync(spool)).toBe(false);
  });

  it('skips a repeated record inside one file', () => {
    const repeated = variant((file) => {
      file.records.push(structuredClone(file.records[0]) as Record<string, unknown>);
    });
    expect(importFixture(repeated, spool, AT)).toMatchObject({
      events: 8,
      appended: 7,
      skipped: 1,
    });
  });

  it('checks a refund against its known sale (S7) and writes nothing when it does not match', () => {
    const mismatched = variant((file) => {
      const refund = file.records[1] as { lines: { lineRef: string }[] };
      (refund.lines[0] as { lineRef: string }).lineRef = 'L9';
    });
    expectIntakeError(() => importFixture(mismatched, spool, AT), /^S7 refund names a lineRef/);
    expect(existsSync(spool)).toBe(false);
  });

  it('passes on a refund whose sale it has not seen, for the consumer to retry', () => {
    const refundsOnly = variant((file) => {
      file.records = file.records.filter((record) => record.type === 'REFUND');
    });
    expect(importFixture(refundsOnly, spool, AT)).toMatchObject({ appended: 3 });
  });

  it('refuses a fixture that is not synthetic-sales/1', () => {
    const wrong = variant((file) => {
      (file.records[0] as Record<string, unknown>).buyerEmail = 'buyer@example.com';
    });
    expectIntakeError(() => importFixture(wrong, spool, AT), /not synthetic-sales\/1/);
    expect(existsSync(spool)).toBe(false);
  });
});

describe('reading the spool', () => {
  beforeEach(() => {
    importFixture(FIXTURE, spool, AT);
  });

  it.each([
    ['a torn final line', (text: string) => text.slice(0, -10), /ends with a partial line/],
    ['a line that is not JSON', (text: string) => `${text}{\n`, /line 8 is not JSON/],
    ['a blank line', (text: string) => `${text}\n`, /line 8 is not JSON/],
    // JSON.parse reads 2000.0 as 2000; the canonical form shows the difference.
    [
      'an integral float',
      (text: string) => text.replace('"net":2000,', '"net":2000.0,'),
      /line 1 is not canonical JSON/,
    ],
    [
      'whitespace',
      (text: string) => text.replace('{"aggregateId"', '{ "aggregateId"'),
      /line 1 is not canonical JSON/,
    ],
    [
      'a duplicate key',
      (text: string) => text.replace('{"aggregateId"', '{"aggregateType":"Order","aggregateId"'),
      /line 1 is not canonical JSON/,
    ],
    [
      'an event that breaks the contract',
      (text: string) => text.replace('"net":2000,', '"net":2001,'),
      /line 1 breaks the contract/,
    ],
  ])('refuses %s and leaves it as it is', (_name, damage, message) => {
    const text = readFileSync(spool, 'utf8');
    writeFileSync(spool, damage(text));
    const damaged = readFileSync(spool);
    expectIntakeError(() => importFixture(FIXTURE, spool, AT), message);
    expect(readFileSync(spool).equals(damaged)).toBe(true);
  });

  it('accepts a redelivered copy of a line, and refuses a conflicting one', () => {
    const [first] = readFileSync(spool, 'utf8').split('\n');
    appendFileSync(spool, `${first}\n`);
    expect(readSpool(spool).size).toBe(7);
    // Same id, still contract-valid, different replay digest.
    const event = JSON.parse(first as string) as { occurredAt: string };
    event.occurredAt = '2026-09-14T10:15:01Z';
    appendFileSync(spool, `${canonicalJson(event)}\n`);
    expectIntakeError(() => readSpool(spool), /line 9 conflicts with an earlier line/);
  });
});

describe('intake timestamp', () => {
  it('uses SOURCE_DATE_EPOCH when set, at second precision', () => {
    expect(intakeTimestamp({ SOURCE_DATE_EPOCH: '1792324800' })).toBe(AT);
    expect(intakeTimestamp({}, new Date('2026-10-19T08:00:01.999Z'))).toBe('2026-10-19T08:00:01Z');
  });

  it.each(['', '1.5', '-1', 'now'])('refuses SOURCE_DATE_EPOCH=%j', (value) => {
    expect(() => intakeTimestamp({ SOURCE_DATE_EPOCH: value })).toThrow(IntakeError);
  });
});
