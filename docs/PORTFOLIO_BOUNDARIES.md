# From portfolio evidence to business records

A repository is a source, a Pages project or Worker is a hosting surface, and a
portfolio grouping describes purpose. None is automatically a registered legal
entity, an approved vendor, a bank account, or authority to transact.

Use the [private map workflow](PORTFOLIO_MAP.md) to inspect and revise source
attribution. Use the [synthetic accounting example](../foundational/accounting/docs/PAYMENT_EVIDENCE.md)
to exercise local ledger behavior. Keep reviewed data and runtime execution
separate; both are useful, but they prove different things.

## Three interfaces, one evidence set

| Interface | Responsibility | Does not grant |
| --- | --- | --- |
| Human | Explain purposes, decisions, source links, limits and next questions | Approval merely by viewing a page |
| Agent | Exact identities, schema, revisions, typed records and replayable outcomes | Authority to choose its own business permissions |
| Private operator | Review source evidence, investigate unknowns and select explicit local inputs | Permission to publish the inventory or contact customers |

These are presentation and responsibility boundaries, not access-control rules.
Private source IDs, account metadata and local paths must not enter public site
bundles, fixtures or committed inventory snapshots. The one in-repository private
area, the estate layer's gitignored `estate/private/`, is a recorded exception
(decision `dec-2026-10-17-1`, described in [the map workflow](PORTFOLIO_MAP.md));
it is never committed and does not change this rule.

## Selecting a real project

Before a real business adapter is enabled, record and verify each of:

1. **Legal context:** registered entity identifier and jurisdiction, source of that
   information, and the relationship between that entity and the selected activity.
   A privacy notice can declare a controller; it does not by itself prove ownership
   of every repository, asset or bank account.
2. **Authority:** who may propose, approve, refuse, revoke and reverse which
   operations; amount/currency limits; separation of duties; and how actual
   identity and authority are authenticated. A supplied actor string is not proof.
3. **System of record:** the specific transaction source and accounting ledger,
   the event contract and version, identifiers and acknowledgement rules. A
   similarly named legacy checkout is not automatically the current producer.
4. **Data boundary:** allowed fields, entity/project scope, retention, access,
   processor obligations and an explicit decision about customer information.
5. **Operational acceptance:** transactional posting/evidence, restart and duplicate
   handling, conflicting replay refusal, negative paths, compensating reversal,
   reconciliation, monitoring and recovery against an isolated test system.
6. **Release boundary:** reviewed source revision, reproducible build, explicit
   target and deployment permission, and verification of the deployed consumer.

Missing information stays unassigned. Do not derive `LegalEntity.id` from a
repository slug or turn an illustrative company into a registered entity record.

## Local demonstration is not activation

Synthetic proposals and reviewers demonstrate a decision flow. They are not live
payments, production authentication or evidence of commercial activity. A local
SQLite record demonstrates persistence under that adapter; it does not establish
PostgreSQL deployment, a running message broker, or successful bank integration.

The example should call the accounting domain implementation rather than copy its
validation into a convenient test double. Its command and persistence boundaries
are documented with the example. Human explanations and machine records must be
projections of its stored evidence, not independently composed success narratives.

A posted entry is corrected through a linked compensating entry, not erased or
edited into a different transaction. A denied proposal is not a failed payment:
it must not produce a journal entry merely to make a timeline look complete.

## Development and release

Work from an inspected, current source revision. Preserve unrelated dirty trees;
do not import unfinished banking, approval, audit or infrastructure code merely
because it exists in another checkout. Source interfaces, fixture behavior,
deployment provenance and live behavior need separate acceptance evidence.

Run the focused checks described in the two owning guides before release. Their
passing results do not replace the monorepo's existing gates. Record any baseline
CI failures instead of weakening tests, skipping frozen lock validation or calling
an untested release healthy. Do not run a Terraform deployment as a substitute for
verifying these offline tools.
