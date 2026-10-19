/**
 * One import: read a fixture, map and validate every record, compare with the
 * spool, then append the new events in one write. Everything is checked
 * before anything is written, so an error leaves the spool's bytes unchanged.
 *
 * An event whose id is already spooled is skipped when its replay digest (S10)
 * is the same, so re-importing is idempotent and metadata such as the intake
 * timestamp never counts as a change. The same id with a different digest is a
 * conflicting duplicate: an error.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CommerceContractError,
  checkRefundAgainstSale,
  replayDigest,
  type CommerceSaleEvent,
} from '@ecosystem/events-financial';
import { IntakeError, describeIssues } from './errors.js';
import { mapSyntheticSales, syntheticSalesSchema, type SyntheticSales } from './fixture-adapter.js';
import { appendToSpool, readSpool, type SpooledEvent } from './spool.js';

export const IMPORT_RESULT_SCHEMA = 'commerce-intake-import/1';

export interface ImportResult {
  schema: typeof IMPORT_RESULT_SCHEMA;
  spool: string;
  events: number;
  appended: number;
  skipped: number;
  event_ids: string[];
}

/** The intake time recorded in metadata: SOURCE_DATE_EPOCH when set, so runs are reproducible. */
export function intakeTimestamp(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date()
): string {
  const epoch = env.SOURCE_DATE_EPOCH;
  let time = now.getTime();
  if (epoch !== undefined) {
    if (!/^[0-9]{1,12}$/.test(epoch))
      throw new IntakeError('SOURCE_DATE_EPOCH must be whole seconds');
    time = Number(epoch) * 1000;
  }
  return new Date(Math.floor(time / 1000) * 1000).toISOString().replace('.000Z', 'Z');
}

function readFixture(path: string): SyntheticSales {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new IntakeError(`fixture ${path} is not JSON`);
    throw error;
  }
  const result = syntheticSalesSchema.safeParse(value);
  if (!result.success) {
    throw new IntakeError(
      `fixture ${path} is not synthetic-sales/1: ${describeIssues(result.error)}`
    );
  }
  return result.data;
}

export function importFixture(
  fixturePath: string,
  spoolPath: string,
  timestamp: string
): ImportResult {
  const events = mapSyntheticSales(readFixture(fixturePath), timestamp);
  const known: Map<string, SpooledEvent> = readSpool(spoolPath);
  const byKey = new Map<string, CommerceSaleEvent>();
  for (const { event } of known.values()) byKey.set(event.payload.idempotencyKey, event);

  const fresh: CommerceSaleEvent[] = [];
  let skipped = 0;
  for (const event of events) {
    const digest = replayDigest(event);
    const earlier = known.get(event.id);
    if (earlier) {
      if (earlier.digest !== digest) {
        throw new IntakeError('conflicting duplicate event_id', { event_id: event.id });
      }
      skipped += 1;
      continue;
    }
    // S7 when the sale is known; a refund whose sale is not is left for the
    // consumer, which retries it once the sale arrives.
    const sale =
      event.type === 'commerce.sale.refunded'
        ? byKey.get(event.payload.saleIdempotencyKey)
        : undefined;
    if (event.type === 'commerce.sale.refunded' && sale) {
      try {
        checkRefundAgainstSale(event, sale);
      } catch (error) {
        if (error instanceof CommerceContractError) {
          throw new IntakeError(error.message, { event_id: event.id });
        }
        throw error;
      }
    }
    known.set(event.id, { event, digest });
    byKey.set(event.payload.idempotencyKey, event);
    fresh.push(event);
  }
  appendToSpool(spoolPath, fresh);
  return {
    schema: IMPORT_RESULT_SCHEMA,
    spool: resolve(spoolPath),
    events: events.length,
    appended: fresh.length,
    skipped,
    event_ids: events.map((event) => event.id),
  };
}
