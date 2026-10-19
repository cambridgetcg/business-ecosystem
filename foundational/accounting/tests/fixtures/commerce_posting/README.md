# Commerce posting fixtures

All data here is synthetic. No file holds a real order, buyer, account or amount.

| File | What it is |
|---|---|
| `commerce-sale-events.v1.schema.provisional-copy.json` | A **provisional copy** of the commerce sale event JSON Schema from the first-wire design pass (2026-10-18). It is not the contract of record. PR W1 commits the authoritative schema and conformance files under `shared/events/financial-events/`; when that lands, the parity test reads W1's file and this copy is deleted. |
| `golden-synthetic-2026-09-10.ndjson` | The seven synthetic September–October 2026 transactions of the wire spike (T1, T3, T2, T5, T4, T6, T7, in delivery order), one canonical JSON event per line. `tests/test_commerce_posting_contract.py::golden_events` regenerates it byte for byte. |
| `typescript-spike-sale.json`, `typescript-spike-refund.json` | Two events written by the TypeScript spike (Node 20, `uuid` v5, validated by ajv against the schema above). They are cross-language vectors for the ids and the replay digest. |
| `id-and-digest-vectors.json` | Expected `id`, `aggregateId` and S10 replay digest for every event above. Node 20.20.2 and CPython agreed on every value when it was written; W1 can move them into its `CASES.json`. |

Golden outcomes and closing balances (debit-positive, GBP):

| Event | Outcome |
|---|---|
| T1 sale, standard-rated goods and shipping, fee with VAT | posted |
| T3 partial refund of T1 with a fee credit | offset |
| T2 zero-rated export sale with a fee | posted |
| T5 margin-scheme sale | refused: `unsupported_treatment_v1` |
| T4 sale at 2026-09-30T23:30Z, tax point 2026-10-01 | posted |
| T6 refund of the rest of T1 in October | offset |
| T7 refund of more than T2 sold | refused: `refund_exceeds_sale` |

| Account | Closing balance |
|---|---|
| `syn-clearing-synthetic-market` | 55.90 |
| `syn-sales-goods` | −75.00 |
| `syn-sales-shipping` | −11.00 |
| `syn-sales-refunds` | 23.00 |
| `syn-selling-fees` | 6.75 |
| `syn-tax-stated-on-sales` | −1.00 |
| `syn-tax-on-fees` | 1.35 |
