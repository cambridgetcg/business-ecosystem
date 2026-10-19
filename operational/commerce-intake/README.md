# commerce-intake

The producer end of the first wire. It reads provider records, maps each one to a commerce sale event (`commerce.sale.recorded` or `commerce.sale.refunded`, contract version 1), checks it against the contract and appends the new events to an `events.ndjson` spool. Accounting's `scripts/commerce_posting.py consume` reads that spool (see [`foundational/accounting/docs/COMMERCE_POSTING.md`](../../foundational/accounting/docs/COMMERCE_POSTING.md)).

```
synthetic-sales/1 fixture
  -> commerce-intake import (this package): map, validate, append to events.ndjson (fsync)
  -> commerce_posting.py consume (accounting): PostingService -> SQLite ledger -> report.json
```

It is a **local demonstration on synthetic data**. The only adapter reads the `synthetic-sales/1` fixture format, and every event it makes is `synthetic`, from the `synthetic` provider, for books whose `decisionRef` names a synthetic fixture: a file cannot claim anything else. A real channel adapter waits for the owner's answers to the prerequisites in [`docs/PORTFOLIO_BOUNDARIES.md`](../../docs/PORTFOLIO_BOUNDARIES.md). Nothing here reads `.env` or provider settings or makes a network call.

## Usage

```sh
pnpm --filter @ecosystem/commerce-intake run build
node operational/commerce-intake/dist/cli.js import \
  --fixture operational/commerce-intake/fixtures/synthetic-sales-2026-09-10.json \
  --spool "$HOME/commerce-wire-demo/events.ndjson"
```

| Outcome | Exit | Output |
|---|---|---|
| Imported | 0 | One JSON object on stdout: `{"schema":"commerce-intake-import/1","spool","events","appended","skipped","event_ids"}` |
| Input, contract or spool error | 2 | `{"error": ...}` on stderr (with `event_id` when one event is at fault), nothing on stdout, nothing written |

`SOURCE_DATE_EPOCH` (whole seconds), when set, is the intake time recorded in each event's `metadata.timestamp`; otherwise the current time is used, to the second. With `SOURCE_DATE_EPOCH=1792324800` the fixture produces, byte for byte, the golden spool that accounting posts (`foundational/accounting/tests/fixtures/commerce_posting/golden-synthetic-2026-09-10.ndjson`).

## Contract and mapping

The contract of record is the JSON Schema in [`shared/events/financial-events/schema/`](../../shared/events/financial-events/schema/commerce-sale-events.v1.schema.json); this package validates every event with the zod schemas of `@ecosystem/events-financial`, which run the same conformance cases. The fixture adapter states:

- the idempotency key `v1|synthetic|<accountRef>|SALE or REFUND|<id>`, and the event and aggregate ids derived from it (UUIDv5);
- the tax point (rule S9) as the Europe/London calendar date of the record's time, so a sale at 2026-09-30T23:30Z (00:30 BST) falls on 2026-10-01;
- the totals, from the lines, fees and fee credits.

Tax amounts and treatments are taken as the record states them; nothing is derived from rates.

## The spool

- One event per line, written as canonical JSON (sorted keys, no whitespace, integers only), and only appended to. After each write the file is fsynced, and its directory too when the file is new.
- An event whose id is already in the spool is **skipped** when its replay digest (contract rule S10, which leaves out `metadata`) is the same, so re-importing is idempotent and a new intake time is not a change. The same id with a **different** digest is a conflicting duplicate: exit 2 and nothing written.
- Every record is mapped and checked, and the spool is read in full, before anything is written. A refund whose sale is already known (in the spool or earlier in the file) must match it (rule S7); a refund whose sale is unknown is passed on, and the consumer retries it once the sale arrives.
- A spool line that is not the canonical form of a contract-valid event, or a final line without its newline (a torn append), is an error to resolve by hand. The canonical check also catches what `JSON.parse` cannot see, such as `2000.0` or a duplicate key, both of which the Python consumer refuses.
- One writer at a time: there is no lock.

## Tests

`pnpm --filter @ecosystem/commerce-intake run test` (vitest; turbo builds first). The tests cover the mapping against the contract's golden events, the UK tax point across both clock changes, idempotent re-import, conflicts inside a file and against the spool, S7, damaged spools, and the CLI in child processes. A guard (`tests/no-network.mjs`) refuses sockets, name lookups and `fetch` in the test process and in every child.

## No STATUS.md, PATH.md or LIGHT.md

This package deliberately has none. Under owner decision D6 (dec-2026-10-17-7) no work here may cause an AWS action, and a push to `main` that touches any `**/STATUS.md`, `**/PATH.md` or `**/LIGHT.md` starts `.github/workflows/progress-sync.yml`, which configures AWS credentials and syncs to AWS.

The repository's own `pnpm progress:check` expects a STATUS.md in every app, so it lists this package as missing one. That check already fails on `main` (0 of 14 apps have a valid STATUS.md; exit 1), and it runs only inside `progress-sync.yml` (on those same pushes to `main` or `develop`, or by hand), never on a pull request. This package's measured state is what `ci.yml` reports: its lint, typecheck, build and test all run there.

## Not here

- No outbox and no Postgres: event ids are deterministic and the consumer deduplicates on them, so an outbox adds nothing to correctness for a file importer.
- No real channel adapter, no VAT derivation from VAT-inclusive prices (a rounding policy that needs an accountant), no payouts, disputes or FX.
