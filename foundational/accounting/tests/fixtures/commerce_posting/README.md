# Commerce posting fixtures

All data here is synthetic. No file holds a real order, buyer, account or amount.

| File | What it is |
|---|---|
| `golden-synthetic-2026-09-10.ndjson` | The seven synthetic September–October 2026 transactions of the wire spike (T1, T3, T2, T5, T4, T6, T7, in delivery order), one canonical JSON event per line. `tests/test_commerce_posting_contract.py::golden_events` regenerates it byte for byte, and it equals the `golden-*` valid cases of the shared conformance file. |

The contract of record is not here. The JSON Schema is `shared/events/financial-events/schema/commerce-sale-events.v1.schema.json`, and the shared conformance cases, with every event's `id`, `aggregateId` and S10 replay digest, are in `shared/events/financial-events/conformance/commerce-sale-v1/CASES.json`. The TypeScript tests (zod and ajv) and `tests/test_commerce_posting_contract.py` both run them.

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
