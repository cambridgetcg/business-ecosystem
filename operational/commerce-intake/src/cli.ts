#!/usr/bin/env node
/**
 * commerce-intake import --fixture FILE --spool FILE
 *
 * Maps a synthetic-sales/1 fixture to commerce sale events and appends the new
 * ones to the spool. Success is exit 0 and one JSON object on stdout. An
 * input, contract or spool error is exit 2 with {"error": ...} on stderr,
 * nothing on stdout and nothing written. There are no environment defaults
 * apart from SOURCE_DATE_EPOCH, no provider adapters and no network.
 */

import { parseArgs } from 'node:util';
import { canonicalJson } from '@ecosystem/events-financial';
import { IntakeError } from './errors.js';
import { importFixture, intakeTimestamp } from './intake.js';

const USAGE = 'usage: commerce-intake import --fixture FILE --spool FILE';

function isFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).syscall === 'string';
}

function run(argv: string[]): number {
  try {
    let parsed;
    try {
      parsed = parseArgs({
        args: argv,
        allowPositionals: true,
        strict: true,
        options: { fixture: { type: 'string' }, spool: { type: 'string' } },
      });
    } catch (error) {
      throw new IntakeError(`${error instanceof Error ? error.message : String(error)}; ${USAGE}`);
    }
    const { positionals, values } = parsed;
    if (
      positionals.join(' ') !== 'import' ||
      values.fixture === undefined ||
      values.spool === undefined
    ) {
      throw new IntakeError(USAGE);
    }
    const result = importFixture(values.fixture, values.spool, intakeTimestamp());
    process.stdout.write(`${canonicalJson(result)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof IntakeError) {
      process.stderr.write(`${JSON.stringify({ error: error.message, ...error.details })}\n`);
      return 2;
    }
    if (isFileError(error)) {
      process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
      return 2;
    }
    throw error;
  }
}

process.exitCode = run(process.argv.slice(2));
