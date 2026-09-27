# Offline synthetic payment evidence

This is a **local demonstration, not a banking integration, production accounting service, or authenticated approval system**. It imports the real Python `PostingService`, `JournalEntry`, `JournalEntryLine`, `Account`, `FiscalPeriodEntity`, and `BalanceValidator`. It does not start the application, load `.env`/provider settings, make network calls, read customer records, infer an owner from GitHub, or write a live registry.

The implementation lives in `src/payment_evidence/`, deliberately outside `src/application/`: that legacy package eagerly imports ingestion/application dependencies. The independent entrypoint is **`foundational/accounting/scripts/payment_evidence_demo.py`**. The portfolio CLI may invoke this script or link to these instructions; it need not import accounting into its own process.

## Isolated setup and verification

From the repository root, with Python 3.12+ and `uv` available:

```sh
cd foundational/accounting
uv venv --python 3.12 .venv
uv pip sync --python .venv/bin/python requirements-evidence.txt

# No installation, application bootstrap, or network is needed after setup.
.venv/bin/python -W error -m pytest -o addopts= \
  -o asyncio_default_fixture_loop_scope=function tests -q

# Use a private, disposable location; do not point this at another service's DB.
mkdir -p "$HOME/payment-evidence-demo"
.venv/bin/python scripts/payment_evidence_demo.py demo \
  --db "$HOME/payment-evidence-demo/evidence.sqlite3" \
  --out "$HOME/payment-evidence-demo"

# Separate process, fresh read-only DB connection, same persisted records.
.venv/bin/python scripts/payment_evidence_demo.py report \
  --db "$HOME/payment-evidence-demo/evidence.sqlite3" \
  --out "$HOME/payment-evidence-demo/reopened"
```

Use `uv pip sync --offline --python .venv/bin/python requirements-evidence.txt` when the pinned wheels are already cached. Dependency/interpreter setup may require downloads on a fresh machine; the demonstration and tests themselves do not. Do **not** use `uv sync` for this slice: that would install the much broader application/AWS dependency set. The pinned file includes the existing `tests/conftest.py` requirements; `-o addopts=` avoids implicitly requiring the monorepo's coverage plugin.

For a controlled scratch root, pass `--basetemp="$TMPDIR/payment-evidence-pytest"` and set `HYPOTHESIS_STORAGE_DIRECTORY="$TMPDIR/payment-evidence-hypothesis"`. Only use a disposable `--basetemp` directory: pytest clears it. No global packages or Python defaults need to change.

Inherited `PYTHONPATH` or `PYTHONHOME` can shadow a virtual environment's pinned packages. If present, prefix Python commands with `env -u PYTHONPATH -u PYTHONHOME` so the command and its subprocesses use that environment; do not change global tooling settings.

The standalone slice is verified with the pinned requirements on **CPython 3.12.14 and 3.14.3**. Tests cover subprocess networking/`.env` guards, actual domain function tracing, concurrent deliveries, SQLite append-only enforcement, rollback injection, and abrupt process death before/after commit. Set the asyncio fixture loop scope explicitly when treating warnings as errors.

The full command above also exercises the legacy accounting properties. Their balanced-entry generator caps credit count at the available cents, so small debit totals cannot produce a zero or negative credit. A deterministic tiny-total regression preserves strict positivity and exact balance; no financial invariant is relaxed.

## CLI contract

Every invocation requires an explicit local `--db` path; there are no environment-derived defaults, provider adapters, server modes, or reset options. Existing nonempty SQLite schemas—including view-only schemas—must contain an actual `payment_evidence_meta` **table** with the recognized version; a view with that name does not count. Unidentified schemas are rejected without changing database bytes or schema. New files and genuinely empty schemas can still be initialized. New DB parent directories must already exist.

| Command | Arguments | Result |
|---|---|---|
| `demo` | `--db PATH --out DIR` | Approves one synthetic payment, redelivers it, refuses a different proposal, approves a reversal, redelivers the reversal, then reopens and reports. |
| `deliver` | `--db PATH --request FILE` | Processes exactly one strict JSON payment or reversal request. |
| `report` | `--db PATH --out DIR` | Opens SQLite read-only, checks evidence/ledger consistency, writes the two report projections. Does not repost anything. |

Success is exit **0**, one JSON object on stdout. Validation/conflict/I/O/domain errors are exit **2**, a JSON `{"error":"..."}` object on stderr, and no success object. Argument-parser usage errors also exit 2 but use argparse's text format.

`deliver` returns `{"outcome":"posted|refused|reversed","entry_id":"<local ULID>"}`; `entry_id` is JSON `null` for refusal. Exact duplicate deliveries return the same object and append nothing. An `operation_id` is unique across the whole file. Reusing it with any changed request field, actor, action, reason, or amount representation fails closed. Object-key order is immaterial; identifiers and values are never normalized. Use a new operation ID for a new proposal, not to bypass an earlier refusal of the same proposal.

`demo`/`report` return:

```json
{
  "schema": "payment-evidence-cli/1",
  "database": "/absolute/local/path/evidence.sqlite3",
  "report_json": "/absolute/local/path/report.json",
  "report_markdown": "/absolute/local/path/report.md",
  "record_digest": "<SHA-256 of the exact report projection without this field>"
}
```

The output directory contains `report.json` and `report.md`. `demo` additionally writes the exact requests as `approved.json`, `refused.json`, and `reversal.json`. Reports/fixtures in the chosen output directory are regenerable and may be overwritten; SQLite is the durable source of truth. Both report formats carry the same digest, and Markdown includes the exact machine projection. Report-file generation is not part of the financial transaction: after an output-file failure, run `report` again.

Every destination is checked for path, symlink, and hardlink collisions with the database before export and before `demo` starts delivering requests. As a conservative filename restriction, the **resolved database basename must not case-fold to an emitted filename**, even in a different directory: `report` reserves `report.json` and `report.md`; `demo` also reserves `approved.json`, `refused.json`, and `reversal.json`. This rejects prospective aliases such as `APPROVED.JSON` before creating SQLite on case-insensitive filesystems; paths and identifiers are never silently renamed. `demo` rechecks all destinations immediately after the database exists, and each output is checked again immediately before its final publication.

Each output is written to a new sibling file and atomically replaced, never truncated through an existing destination link. A link introduced after the final check is replaced as a directory entry, not followed for writing. Replacement is per file, not a transaction over the whole output set; a late export rejection leaves any already committed evidence intact. Decision reasons are escaped as inert text in the Markdown narrative, including HTML, Markdown punctuation, and line breaks; persisted evidence and the exact fenced JSON projection are unchanged.

A generated request can be safely redelivered in a new process:

```sh
.venv/bin/python scripts/payment_evidence_demo.py deliver \
  --db "$HOME/payment-evidence-demo/evidence.sqlite3" \
  --request "$HOME/payment-evidence-demo/approved.json"
```

## Explicit synthetic input policy

Only this fixture scope is accepted; this is intentionally **not** a general multi-entity payment API:

- Entity: `synthetic-entity-lab`
- Project: `synthetic-project-ledger`
- Assigned synthetic owner: `synthetic-owner-lab`
- Expense/debit account: `syn-expense-lab`
- Cash/credit account: `syn-cash-lab`
- Period: `syn-period-lab-2026-09`, September 2026, initially open
- Counterparty: `synthetic-supplier-paper`; direction: `outbound`; currency: `GBP`
- Demonstration actors: `synthetic-reviewer` or `synthetic-auditor`; **these strings are not authentication or real authorization**.

A payment has **exactly** these fields (unknown or missing fields are errors):

```json
{
  "schema": "synthetic-payment/1",
  "operation_id": "synthetic-payment-001",
  "synthetic": true,
  "entity_id": "synthetic-entity-lab",
  "project_id": "synthetic-project-ledger",
  "owner_id": "synthetic-owner-lab",
  "direction": "outbound",
  "counterparty_id": "synthetic-supplier-paper",
  "currency": "GBP",
  "amount": "125.2500",
  "date": "2026-09-27",
  "period_id": "syn-period-lab-2026-09",
  "debit_account_id": "syn-expense-lab",
  "credit_account_id": "syn-cash-lab",
  "description": "SYNTHETIC paper supplies for the ledger demonstration",
  "decision": {
    "action": "approve",
    "actor": "synthetic-reviewer",
    "reason": "Demonstration approval, not authentication",
    "simulated": true
  }
}
```

Use `"action":"refuse"` with an explicit actor and nonblank reason for a refusal. Both `synthetic` and `simulated` must be the boolean `true`, not `1` or a string. Unknown owners, scope mismatches, unsupported actions, non-synthetic requests, and malformed input fail before a financial write. Rejected malformed requests are **not** persisted as valid decisions.

Amounts are positive fixed-point decimal **strings**, at most four decimal places and at most `1000000`. Floats, booleans, zero, negative values, exponent notation, leading whitespace/zeroes, NaN, and infinities are rejected. The operation ID must match `synthetic-[a-z0-9-]{1,64}`. Dates are valid ISO dates in September 2026. Descriptions begin `SYNTHETIC ` and are at most 500 characters; reasons are nonblank and at most 500 characters. Text must contain valid Unicode scalar values: escaped lone surrogates are rejected before opening a write connection, not repaired or normalized. CLI JSON is limited to 16384 bytes and rejects duplicate keys and nonfinite JSON literals.

A reversal has exactly: `schema` (`synthetic-reversal/1`), `operation_id`, `synthetic`, `entity_id`, `project_id`, `owner_id`, `date`, `description`, `decision`, and `original_entry_id` (the actual local journal-entry ID, not a proposal ID). It has no user-supplied amount or account fields. `PostingService.create_reversal` supplies the opposite lines from the retained original. **Approval** of missing originals, refused proposals, compensation-of-compensation, or a second reversal under a different operation ID is rejected and is not recorded as a successful decision. An explicitly **refused** reversal proposal is evidence-only: after input-policy validation it can record any of those target references, without confirming the target's existence or reversibility and without any ledger movement. This deliberate distinction records refusal, not a successful or authorized reversal.

## Real accounting and durability boundaries

1. Strict synthetic-policy validation runs before opening a write connection.
2. SQLite `BEGIN IMMEDIATE` serializes duplicate checks and financial writes, including competing processes. A full integrity projection rejects inconsistent or nonfinite starting balances before any financial write. The prospective state is rechecked after evidence insertion and before commit, so an injected bad repository write also rolls back.
3. The application constructs the real `JournalEntry`; the actual `PostingService.post_entry` calls domain posting validation and `BalanceValidator`, saves the entry, updates balances, and updates period statistics.
4. Lightweight repository ports persist those real domain objects to **local SQLite JSON/TEXT**. This is not the application's PostgreSQL/async ORM repository or schema. Decimal amounts are stored losslessly as strings; SQLite `REAL` arithmetic is never used. Account and period repository reads/writes are scoped.
5. The final evidence record contains the original proposal, explicit decision/actor/reason, outcome, linked entry, and recording time. Ledger entries, account balances, period statistics, and evidence commit **together**, with `foreign_keys=ON` and `synchronous=FULL`.
6. Deferred bidirectional foreign keys prevent an unpaired journal success/evidence success from committing. Unique operation IDs and unique reversal links are durable. SQLite triggers reject updates/deletes of ledger entries and evidence.
7. Reversal uses the real `create_reversal` API and posts the returned draft through the same real posting API. The original stored document stays unchanged; a unique `reversal_of_id` links the one compensating entry. The entry repository derives the original's `reversed_by_id` on hydration rather than editing historical data.
8. Replay opens a fresh read-only snapshot, validates real entry balances, reconstructs account movement using domain signed amounts, checks trial balance/period totals, and verifies the proposal/decision/entry links. The same integrity projection compares SQL and JSON reversal links and independently rejects multiple compensations of one original before commit and on replay. The report is derived from this snapshot—not from the in-memory return values of the demo.

The demo's approved payment debits synthetic expense and credits synthetic cash by `125.2500 GBP`. Refusal posts nothing. After compensation there are **two posted entries, three evidence records, and zero net balance in both accounts**. Starting cash is zero; the intermediate negative cash is intentional synthetic arithmetic, not a funds-availability check or bank execution.

Tests inject exceptions after ledger insertion, balance update, period update, before/after evidence, and before commit. Child processes terminate abruptly (`os._exit`) after ledger insertion, after evidence, and after commit. The last case models a committed transaction whose acknowledgement was lost; retry returns the existing result. These tests exercise real SQLite recovery, not mocked accounting logic.

### Minimum committed-source corrections

The new offline import regressions exposed eager persistence imports and a runtime `JournalEntry`/`JournalEntryLine` circular import. Persistence package exports are now lazy; the line model's parent import is type-checking-only. Related exports are cached together, and the package-level `unit_of_work` remains the callable factory whether its class, factory, or actual submodule is imported first. Import-order tests load the real package and unit-of-work source with dependency-only stubs, without application bootstrap.

Direct service regressions also showed that `post_entry` omitted `JournalEntry.validate_for_posting()` and only checked whether a period was open—not whether the entry date belonged to it. The minimal service correction invokes that existing domain validation and `period.can_accept_entry(entry.entry_date)`. No posting or reversal algorithm was replaced.

## Limits

- Local synthetic evidence only. No production tenancy, customer record ingestion, bank submission, authentication, funds checks, tax, FX, or runtime adapter certification.
- The local schema has no migration path to the production PostgreSQL schema. Do not repurpose it for real books.
- Append-only triggers protect ordinary SQL/API mutation, not a file owner who can drop triggers or replace the database. The digest correlates the two reports; it is not a signature or external attestation.
- Rejected malformed requests and duplicate delivery attempts are not a separate immutable attempt log. Valid decisions and successful effects are durable; exact retries are no-ops.
- Durability assumes ordinary SQLite/local-filesystem semantics. Network filesystems, hardware failure, disk corruption, and hostile database replacement are outside the demonstrated guarantee.
- No deployment, commit, provider configuration, or production readiness is implied by a successful offline run.
