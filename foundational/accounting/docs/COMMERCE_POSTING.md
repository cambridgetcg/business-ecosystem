# Offline commerce posting (first wire, consumer)

This is the accounting end of the first wire: **synthetic** commerce sale events go through the real Python `PostingService` into a local SQLite ledger. It is a **local demonstration, not a live channel adapter, a VAT return or production books**. It imports the real `PostingService`, `JournalEntry`, `JournalEntryLine`, `Account`, `FiscalPeriodEntity` and `BalanceValidator`. It does not start the application, load `.env` or provider settings, make network calls, read customer records, or contact eBay, Stripe, Shopify or AWS.

The implementation lives in `src/commerce_posting/`, outside `src/application/` for the same reason as the [payment evidence slice](PAYMENT_EVIDENCE.md): that package eagerly imports application dependencies. The entrypoint is **`scripts/commerce_posting.py`**. It never imports `src.config`, because `foundational/accounting/.env` holds secrets; `tests/test_commerce_posting_cli.py` proves this in a child process that also refuses sockets and any `.env` read.

```
synthetic fixture
  -> operational/commerce-intake (TypeScript, PR W2): map, validate, append to events.ndjson
  -> scripts/commerce_posting.py consume (this slice): PostingService -> SQLite ledger + evidence
  -> scripts/commerce_posting.py report: report.json
```

## Isolated setup and verification

From the repository root, with Python 3.12+ and `uv` available (the same environment as the payment evidence slice):

```sh
cd foundational/accounting
uv venv --python 3.12 .venv
uv pip sync --python .venv/bin/python requirements-evidence.txt

.venv/bin/python -W error -m pytest -o addopts= \
  -o asyncio_default_fixture_loop_scope=function tests -q

# Use a private, disposable location.
mkdir -p "$HOME/commerce-posting-demo"
.venv/bin/python scripts/commerce_posting.py consume \
  --db "$HOME/commerce-posting-demo/ledger.sqlite3" \
  --spool tests/fixtures/commerce_posting/golden-synthetic-2026-09-10.ndjson
.venv/bin/python scripts/commerce_posting.py report \
  --db "$HOME/commerce-posting-demo/ledger.sqlite3" \
  --out "$HOME/commerce-posting-demo"
```

The whole accounting suite runs offline: `tests/conftest.py` installs an audit hook that refuses outbound connections and name lookups in the pytest process, and fails the session if code under test swallowed a refusal. CLI child processes install the same guard through their runner. Prefix commands with `env -u PYTHONPATH -u PYTHONHOME` if those variables are set.

## CLI contract

Every invocation needs an explicit `--db` path; there are no environment defaults, provider adapters, server modes or reset options. A non-empty SQLite file must hold a `commerce_posting_meta` **table** with version `synthetic-commerce-posting/1`; any other schema, including a payment evidence database or a view named like the marker, is rejected without changing its bytes.

| Command | Arguments | Result |
|---|---|---|
| `deliver` | `--db PATH --event FILE` | Delivers one event (strict JSON, at most 262144 bytes). |
| `consume` | `--db PATH --spool FILE` | Delivers an NDJSON spool, one event per line, each in its own transaction. Every line is parsed, contract-checked and period-checked before the first write. A refund that arrives before its sale is parked and retried after the rest. |
| `report` | `--db PATH --out DIR` | Opens SQLite read-only, runs the full integrity check and writes `DIR/report.json`. Writes nothing to the ledger. |

Success is exit **0** and one JSON object on stdout. `deliver` prints `{"event_id", "outcome", "reason", "entry_id", "compensates_entry_id"}`; an exact redelivery prints the same object and appends nothing. `consume` prints `{"schema":"commerce-posting-consume/1","events","appended","duplicates","retried","outcomes":{"posted","offset","refused"}}`. `report` prints the database path, the report path and its `record_digest`.

Errors are exit **2** with `{"error": "..."}` on stderr and nothing on stdout. A refund whose sale is unknown is the one retryable error: `{"error":"unknown_sale","retryable":true,"event_ids":[...]}`. JSON input rejects duplicate keys, `NaN`/`Infinity` and any non-integer number (`2000.0` is not `2000`).

`report.json` is published by writing a new sibling file and atomically replacing the target; it is never written through a link to the database, and a database whose basename case-folds to `report.json` is refused.

## Event contract, version 1

Two event types, `commerce.sale.recorded` and `commerce.sale.refunded`, `aggregateType: "Sale"`, `version: 1`. `src/commerce_posting/contract.py` is a strict mirror of the wire design's JSON Schema plus its cross-field rules:

| Rule | Checked where |
|---|---|
| S1 `id` = UUIDv5(namespace, `idempotencyKey`) | contract |
| S2 `aggregateId` = UUIDv5(namespace, `"sale|"` + the sale's key) | contract |
| S3 `idempotencyKey` = `v1|provider|accountRef|transactionType|transactionId` | contract |
| S4/S5 totals equal the sums of lines, fees and fee credits | contract |
| S6 `lineRef`/`feeRef` unique within an event | contract |
| S7 a refund matches its stored sale (books, currency, channel, account, line and fee refs); caps | flow (identity, error) and policy (caps, refusal) |
| S8 tax-free treatments state no tax; `taxBasis` is `not_applicable` exactly when tax is 0 | contract |
| S9 `taxPointDate` is stated by the adapter in the books' VAT time zone | adapter |
| S10 replay digest | contract |

Values are validated exactly as delivered and never normalized. Timestamps stay strings ending in `Z`: a parser that re-serializes `…00Z` as `…00.000Z` would change the bytes. The **replay digest** is the SHA-256 of canonical JSON (sorted keys, no whitespace, UTF-8) over the raw `{type, version, aggregateId, occurredAt, payload}`; `metadata` is trace data and is excluded. Every contract string is ASCII by pattern or enum, so this equals RFC 8785 output and a sorted-key `JSON.stringify`; Node 20 and CPython agree on the vectors in `tests/fixtures/commerce_posting/id-and-digest-vectors.json`.

**Authority.** The schema copy the tests use, `tests/fixtures/commerce_posting/commerce-sale-events.v1.schema.provisional-copy.json`, is provisional. PR W1 makes the shared contract authoritative (schema, conformance files and the namespace constant in `contracts-financial`); the parity test then reads that file and the copy is deleted. The namespace here, `6f1d3c52-8a4e-4d7b-9c1e-2b5a7e9f0c31`, is the wire spike's and must match W1's.

## Activation policy (v1)

Activation lives in code (`src/commerce_posting/policy.py`), so changing it is a reviewed change, never a setting:

- **Books.** Only `booksOf = {entityId: 00000000-0000-4000-8000-00000000b00c, decisionRef: synthetic-books-lab}`. No real entity is assigned until the owner records that decision.
- **Evidence class.** Only `synthetic`. `recorded` and `live` are refused.
- **Currency.** GBP only. Journal entries and accounts default to USD in the domain model (`journal_entry.py:184`, `account.py:136`), so every entry and account here sets GBP explicitly.
- **Tax.** One v1 policy, `source-stated/1`: tax is posted exactly as the event states it, for standard-rated and zero-rated sale lines, and for standard-rated, exempt or outside-scope fees (fee tax only on standard-rated fees). Reduced rate, margin scheme, reverse charge and anything that needs a VAT scheme decision (flat rate, cash accounting) are refused rather than guessed.
- **Store credit.** There is no event type for merchant store credit, so it can never reach this ledger.

Refusal reasons, checked in this order: `not_our_books`, `evidence_class_not_activated`, `unsupported_currency_v1`, then `unsupported_treatment_v1` (sales) or the sale's own refusal and `refund_exceeds_sale` (refunds), then `zero_value`. A refund of a refused sale inherits that sale's reason.

## Posting rules

Account ids are synthetic. Amounts are the event's integer minor units summed per account, never recomputed from rates. Zero lines are omitted because the domain refuses non-positive amounts. Provider-collected tax is a memo and is never posted.

| Event | Account | Type | Side | Amount |
|---|---|---|---|---|
| sale | `syn-clearing-<channel>` | ASSET | Dr (Cr if net < 0) | \|totals.net\| |
| sale | `syn-selling-fees` | EXPENSE | Dr | Σ fee net |
| sale | `syn-tax-on-fees` | ASSET | Dr | Σ fee tax |
| sale | `syn-sales-goods` / `syn-sales-shipping` | REVENUE | Cr | Σ line net by revenue class |
| sale | `syn-tax-stated-on-sales` | LIABILITY | Cr | Σ line tax |
| refund | `syn-sales-refunds` (contra-revenue) | REVENUE | Dr | Σ refund net |
| refund | `syn-tax-stated-on-sales` | LIABILITY | Dr | Σ refund tax |
| refund | `syn-clearing-<channel>` | ASSET | Cr (Dr if net < 0) | \|totals.net\| |
| refund | `syn-selling-fees` / `syn-tax-on-fees` | EXPENSE / ASSET | Cr | Σ fee-credit net / tax |

Each entry has `entry_date = taxPointDate`, `source_document = idempotencyKey`, `source_document_type` `RECEIPT` (sale) or `CREDIT_MEMO` (refund), `currency_code = GBP` and actor `commerce-posting-v1`. Periods are September and October 2026, open; an event whose tax point falls outside them is an error.

## Refunds are offsetting entries, not reversals

A refund is a new business event: it can be partial, fall in a later period, and return some fees or none. It posts a **new** offsetting entry and its evidence row links the sale's entry through `compensates_entry_id` (not unique: a sale can have several refunds). The engine's one-time `create_reversal` is never used by this slice; it stays for corrections. In the wire spike, reversing a sale after a partial refund double-counted the refund.

Refund caps are cumulative per sale line and per fee, for net and tax separately. Refused refunds never count towards a cap.

## Errors versus refusals

| Kind | Examples | What is written |
|---|---|---|
| Error (exit 2) | malformed JSON; contract violation; unsupported type or version; conflicting duplicate; refund that does not match its sale (S7); tax point outside the open periods; `unknown_sale` (retryable) | Nothing. An existing database keeps its exact bytes; a path that did not exist is not created. |
| Refusal (exit 0) | any reason above | One evidence row with the event, the reason and no journal entry. |

## Idempotency, ordering and retry

- `commerce_evidence` has `event_id UNIQUE` and `idempotency_key UNIQUE`. Redelivery with the same replay digest returns the stored result and appends nothing. The same event id with a different digest is `conflicting duplicate event_id`.
- A refund for a sale that has not arrived is the retryable error `unknown_sale`. `consume` parks such refunds and retries them after the rest of the spool, repeating while retries make progress.
- Within `consume`, deliveries already committed stay committed when a later line fails; re-running is safe because exact replays append nothing.

## Durability and integrity

1. Contract validation and the period check run before any database is opened.
2. Each delivery is one SQLite transaction (`BEGIN IMMEDIATE`, `synchronous=FULL`, `foreign_keys=ON`), including schema creation on a new file, so a failed first delivery leaves no schema behind.
3. A full integrity check runs before any write and again on the uncommitted result before commit. It re-validates every stored event, re-derives every stored decision in delivery order with the same contract and policy code, compares each journal entry's lines with the posting rules, recomputes balances and period totals from lines, checks the trial balance, refund links and refund caps, and recomputes each replay digest.
4. Ledger entries and evidence rows are append-only (SQLite triggers) and linked by deferred foreign keys in both directions.
5. Journal entry and line ids are derived from the event id (UUIDv5, written as a 26-character ULID), so recovery after a crash converges on exactly the ledger that never crashed.
6. Tests inject failures after the ledger insert, balance update and period update, before and after the evidence row, and before commit; child processes are killed with `os._exit` after the ledger insert, after the evidence row and after commit.

## Report

`report.json` (`commerce-posting-report/1`) is a projection of the stored records: per-event outcomes (which the VAT view in a later PR can take its inclusion decisions from), entries with their lines, accounts and balances (debit-positive), periods, the active policy and a `record_digest`. It leaves out the two wall-clock fields, `posted_at` in each stored entry and `recorded_at` in each evidence row, which stay in SQLite. Two independent runs over the same events therefore write identical bytes.

## Golden fixture

`tests/fixtures/commerce_posting/golden-synthetic-2026-09-10.ndjson` holds the wire spike's seven synthetic transactions. Outcomes: T1 posted, T3 offset, T2 posted, T5 refused (`unsupported_treatment_v1`, margin scheme), T4 posted (tax point 2026-10-01 for 2026-09-30T23:30Z), T6 offset, T7 refused (`refund_exceeds_sale`). Closing balances: clearing 55.90, goods −75.00, shipping −11.00, refunds 23.00, fees 6.75, tax stated on sales −1.00, tax on fees 1.35.

## Why not the existing import mapper

`src/domain/ingestion/mappers/journal_entry_mapper.py:187` (`JournalEntryMapper`) already turns imported rows into journal entries, but it has no tests, no idempotency and no evidence records. Merging the two import paths is recorded as an idea, not done here.

## Limits

- Synthetic evidence only. No real books, channel adapter, VAT return, FX, payouts, disputes or held-for-seller funds.
- The local schema has no migration path to the production PostgreSQL schema. The production column for `source_document` is 200 characters, and keys can reach 254.
- The integrity check re-reads the whole ledger on every delivery, which is fine for fixtures, not for volume.
- A change to the v1 policy changes what the integrity check re-derives, so it needs a new database marker.
- Append-only triggers protect ordinary SQL, not a file owner who drops them; the check then still notices changed records. The digest correlates outputs; it is not a signature.
- Nothing here is activation. A live adapter needs the owner's answers to the prerequisites in [`docs/PORTFOLIO_BOUNDARIES.md`](../../../docs/PORTFOLIO_BOUNDARIES.md).
