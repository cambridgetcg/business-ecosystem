/**
 * The events.ndjson spool: one commerce sale event per line, written as
 * canonical JSON (sorted keys, no whitespace, integers only) and only ever
 * appended to. Consumers such as accounting's `commerce_posting.py consume`
 * read it; they deduplicate on the event id.
 *
 * One writer at a time: there is no lock. A line that is not the canonical
 * form of a contract-valid event, or a final line without its newline (a torn
 * append), is an error to resolve by hand, never something to repair.
 */

import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  canonicalJson,
  commerceSaleEventSchema,
  replayDigest,
  type CommerceSaleEvent,
} from '@ecosystem/events-financial';
import { IntakeError, describeIssues } from './errors.js';

export interface SpooledEvent {
  event: CommerceSaleEvent;
  digest: string;
}

/** Every event already in the spool, by id. A missing spool is empty. */
export function readSpool(path: string): Map<string, SpooledEvent> {
  const spooled = new Map<string, SpooledEvent>();
  if (!existsSync(path)) return spooled;
  const text = readFileSync(path, 'utf8');
  if (text === '') return spooled;
  if (!text.endsWith('\n')) throw new IntakeError(`spool ${path} ends with a partial line`);
  text
    .slice(0, -1)
    .split('\n')
    .forEach((line, index) => {
      const where = `spool ${path} line ${index + 1}`;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw new IntakeError(`${where} is not JSON`);
      }
      // Canonical form also rules out what JSON.parse cannot see: duplicate
      // keys and numbers written as 2000.0, which the Python consumer refuses.
      const result = commerceSaleEventSchema.safeParse(value);
      if (!result.success) {
        throw new IntakeError(`${where} breaks the contract: ${describeIssues(result.error)}`);
      }
      if (canonicalJson(value) !== line) throw new IntakeError(`${where} is not canonical JSON`);
      const digest = replayDigest(result.data);
      const earlier = spooled.get(result.data.id);
      if (earlier && earlier.digest !== digest) {
        throw new IntakeError(`${where} conflicts with an earlier line`, {
          event_id: result.data.id,
        });
      }
      spooled.set(result.data.id, { event: result.data, digest });
    });
  return spooled;
}

/** Append events as canonical JSON lines, then fsync the file (and its directory when new). */
export function appendToSpool(path: string, events: CommerceSaleEvent[]): void {
  if (events.length === 0) return;
  const created = !existsSync(path);
  const data = Buffer.from(events.map((event) => `${canonicalJson(event)}\n`).join(''), 'utf8');
  const file = openSync(path, 'a');
  try {
    let written = 0;
    while (written < data.length) written += writeSync(file, data, written);
    fsyncSync(file);
  } finally {
    closeSync(file);
  }
  if (created) {
    const directory = openSync(dirname(resolve(path)), 'r');
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  }
}
