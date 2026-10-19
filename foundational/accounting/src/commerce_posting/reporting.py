"""Read-only, independently checked projection of the persisted evidence and ledger.

Every stored decision is re-derived from its stored event, in delivery order,
with the same contract and policy code; the journal lines that the real
PostingService wrote must equal the posting rules exactly. The projection
leaves out wall-clock fields, so independent runs over the same events give
identical report bytes.
"""
import hashlib
import json
from decimal import Decimal

from src.domain.general_ledger.validators.balance_validator import BalanceValidator

from .contract import (
    COMMERCE_EVENT_NAMESPACE,
    CONTRACT_VERSION,
    SALE_RECORDED,
    SALE_REFUNDED,
    ContractError,
    check_refund_against_sale,
    replay_digest,
    sale_key_of,
    validate,
)
from .policy import (
    ACTIVATED_EVIDENCE_CLASSES,
    ACTOR,
    BOOKS,
    CHART,
    CLEARING_PREFIX,
    CURRENCY,
    PERIODS,
    POSTABLE_FEE_TREATMENTS,
    POSTABLE_SALE_TREATMENTS,
    TAX_POLICY,
    SaleState,
    period_for,
    refusal,
)
from .rules import amount, posting_lines
from .storage import canonical, hydrate_entry, ledger_id, money

WALL_CLOCK_FIELDS = ("ledger_entries.document.posted_at", "commerce_evidence.recorded_at")


def require(condition, explanation):
    if not condition:
        raise ValueError("evidence integrity: " + explanation)


def _contract_holds(check, *args):
    try:
        check(*args)
    except ContractError as exc:
        require(False, f"stored event breaks the contract: {exc}")


def build_report(connection):
    require(not connection.execute("PRAGMA foreign_key_check").fetchall(), "foreign key mismatch")
    require(connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "SQLite integrity check")
    books = [(row["entity_id"], json.loads(row["document"])) for row in connection.execute("SELECT * FROM books ORDER BY entity_id")]
    require(books == [(entity_id, {"entityId": entity_id, "decisionRef": ref}) for entity_id, ref in sorted(BOOKS.items())], "books mismatch")
    accounts = [dict(row) for row in connection.execute("SELECT * FROM accounts ORDER BY id")]
    periods = [{**dict(row), "document": json.loads(row["document"])} for row in connection.execute("SELECT * FROM periods ORDER BY id")]
    entries = {row["id"]: dict(row) for row in connection.execute("SELECT * FROM ledger_entries ORDER BY rowid")}
    evidence = [dict(row) for row in connection.execute("SELECT * FROM commerce_evidence ORDER BY seq")]
    for account in accounts:
        expected_type = CHART.get(account["id"], "ASSET" if account["id"].startswith(CLEARING_PREFIX) else None)
        require(account["books"] in BOOKS and account["account_type"] == expected_type, "account scope/type")
    for period in periods:
        document = period["document"]
        require(period["books"] in BOOKS and period["id"] in PERIODS, "period scope")
        require({key: document[key] for key in PERIODS[period["id"]]} == PERIODS[period["id"]] and document["status"] == "OPEN", "period definition")
    expected_balances = {account["id"]: Decimal("0") for account in accounts}
    expected_periods = {period["id"]: [Decimal("0"), Decimal("0"), 0] for period in periods}
    validator = BalanceValidator()
    sales, linked, events = {}, set(), []
    for item in evidence:
        event = json.loads(item["event"])
        _contract_holds(validate, event)
        payload, refund = event["payload"], event["type"] == SALE_REFUNDED
        require((item["event_id"], item["idempotency_key"], item["event_type"], item["sale_idempotency_key"], item["replay_digest"])
                == (event["id"], payload["idempotencyKey"], event["type"], sale_key_of(event), replay_digest(event)),
                "evidence columns differ from the stored event")
        sale = None
        if refund:
            sale = sales.get(item["sale_idempotency_key"])
            require(sale is not None, "refund recorded before its sale")
            _contract_holds(check_refund_against_sale, event, sale.event)
        reason = refusal(event, sale)
        outcome = "refused" if reason else "offset" if refund else "posted"
        require((item["outcome"], item["reason"]) == (outcome, reason), "stored decision differs from the v1 policy")
        if reason:
            require(item["entry_id"] is None and item["compensates_entry_id"] is None, "refusal with a ledger link")
        else:
            stored = entries.get(item["entry_id"])
            require(item["entry_id"] == ledger_id("entry", event["id"]) and stored is not None
                    and stored["event_id"] == event["id"] and stored["books"] == payload["booksOf"]["entityId"],
                    "missing matching journal entry")
            linked.add(item["entry_id"])
            document = json.loads(stored["document"])
            entry = hydrate_entry(document)
            require(entry.id == item["entry_id"] and entry.is_posted and entry.currency_code == CURRENCY
                    and entry.reversal_of_id is None, "entry identity/status/currency")
            require(all(line.amount.is_finite() and line.amount > 0 for line in entry.lines), "nonfinite or nonpositive amount")
            validator.validate_entry_complete(entry)
            debits, credits = entry.calculate_totals()
            require(debits == credits == entry.total_debits == entry.total_credits, "journal totals")
            require(entry.entry_date.isoformat() == payload["taxPointDate"] and entry.fiscal_period_id in expected_periods
                    and entry.fiscal_period_id == period_for(payload["taxPointDate"]), "entry date/period")
            require((entry.source_document, entry.source_document_type, entry.posted_by, entry.created_by)
                    == (payload["idempotencyKey"], "CREDIT_MEMO" if refund else "RECEIPT", ACTOR, ACTOR), "entry provenance")
            require([(line.account_id, line.entry_type, line.amount) for line in entry.lines]
                    == [(account_id, side, amount(minor_units)) for account_id, side, minor_units in posting_lines(event)],
                    "posting rules/ledger lines mismatch")
            require([(line.line_number, line.id) for line in entry.lines]
                    == [(number, ledger_id("line", entry.id, str(number))) for number in range(len(entry.lines))], "line identity")
            for line in entry.lines:
                require(line.account_id in expected_balances, "line account scope")
                expected_balances[line.account_id] += line.signed_amount
            totals = expected_periods[entry.fiscal_period_id]
            totals[0] += debits
            totals[1] += credits
            totals[2] += 1
            require(item["compensates_entry_id"] == (sale.entry_id if refund else None), "refund link")
            if refund:
                sale.apply(event)
        if not refund:
            sales[payload["idempotencyKey"]] = SaleState(event, outcome, reason, item["entry_id"])
        events.append({"seq": item["seq"], "event_id": event["id"], "type": event["type"],
                       "idempotency_key": payload["idempotencyKey"], "sale_idempotency_key": sale_key_of(event),
                       "tax_point_date": payload["taxPointDate"], "replay_digest": item["replay_digest"],
                       "outcome": outcome, "reason": reason, "entry_id": item["entry_id"],
                       "compensates_entry_id": item["compensates_entry_id"]})
    require(set(entries) == linked, "journal entry without matching evidence")
    for sale in sales.values():
        for ref, items, done in (("lineRef", sale.event["payload"]["lines"], sale.refunded),
                                 ("feeRef", sale.event["payload"]["fees"], sale.credited)):
            for item in items:
                net, tax = done.get(item[ref], (0, 0))
                require(net <= item["net"] and tax <= item["tax"], "refunds exceed their sale")
    for account in accounts:
        actual = Decimal(account["balance"])
        require(actual.is_finite() and actual == expected_balances[account["id"]], "account balance mismatch")
    for period in periods:
        document = period["document"]
        require([Decimal(document["total_debits"]), Decimal(document["total_credits"]), document["entry_count"]]
                == expected_periods[period["id"]], "period totals mismatch")
    trial = validator.calculate_trial_balance({key: (value, "DEBIT") for key, value in expected_balances.items()})
    require(trial.is_balanced, "trial balance mismatch")
    report = {
        "schema": "commerce-posting-report/1",
        "contract": {"types": [SALE_RECORDED, SALE_REFUNDED], "version": CONTRACT_VERSION,
                     "namespace": str(COMMERCE_EVENT_NAMESPACE), "authority": "shared/events/financial-events/schema/commerce-sale-events.v1.schema.json"},
        "policy": {"books": [document for _, document in books], "evidence_classes": list(ACTIVATED_EVIDENCE_CLASSES),
                   "currency": CURRENCY, "tax_policy": TAX_POLICY,
                   "postable_sale_treatments": list(POSTABLE_SALE_TREATMENTS), "postable_fee_treatments": list(POSTABLE_FEE_TREATMENTS)},
        "posting_engine": "src.domain.general_ledger.services.posting_service.PostingService",
        "events": events,
        "entries": [{key: value for key, value in json.loads(row["document"]).items() if key != "posted_at"} for row in entries.values()],
        "accounts": [{key: account[key] for key in ("id", "account_type", "balance")} for account in accounts],
        "balances": {account["id"]: account["balance"] for account in accounts},
        "periods": [{"id": period["id"], **period["document"]} for period in periods],
        "validation": {"decisions_rederived": True, "ledger_matches_rules": True, "balanced": True,
                       "balances_match_lines": True, "periods_match_entries": True, "refund_caps_hold": True,
                       "trial_debits": money(trial.total_debit_balances), "trial_credits": money(trial.total_credit_balances)},
        "wall_clock_fields_excluded": list(WALL_CLOCK_FIELDS),
    }
    report["record_digest"] = hashlib.sha256(canonical(report).encode()).hexdigest()
    return report
