/**
 * @ecosystem/commerce-intake
 * The producer end of the first wire: provider records in, commerce sale
 * events (contract version 1) out, appended to an events.ndjson spool.
 */

export { IntakeError } from './errors.js';
export {
  FIXTURE_FORMAT,
  FIXTURE_SOURCE,
  mapSyntheticSales,
  syntheticSalesSchema,
  ukTaxPointDate,
  type SyntheticSales,
} from './fixture-adapter.js';
export {
  IMPORT_RESULT_SCHEMA,
  importFixture,
  intakeTimestamp,
  type ImportResult,
} from './intake.js';
export { appendToSpool, readSpool, type SpooledEvent } from './spool.js';
