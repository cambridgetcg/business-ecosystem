"""Commerce sale events through the real PostingService into local SQLite; no mock accounting."""
import asyncio
import importlib
import sys

import pytest
from hypothesis import given
from hypothesis import strategies as st

from tests.test_commerce_posting_contract import (
    BOOKS_OF,
    contract,
    fee,
    golden_events,
    line,
    refund,
    sale,
)

CLEARING = "syn-clearing-synthetic-market"
# Library-level child processes refuse the network and .env reads, as the CLI runner does.
OFFLINE_PRELUDE = """
import sys
def _guard(event, args):
    if event in ('socket.connect', 'socket.getaddrinfo', 'socket.gethostbyname'):
        raise AssertionError('network access forbidden: ' + event)
    if event == 'open' and str(args[0]).endswith('.env'):
        raise AssertionError('provider environment access forbidden')
sys.addaudithook(_guard)
"""


def api():
    try:
        return importlib.import_module("src.commerce_posting")
    except ModuleNotFoundError as exc:
        raise AssertionError("offline commerce posting entrypoint is missing") from exc


GOLDEN_OUTCOMES = [("posted", None), ("offset", None), ("posted", None), ("refused", "unsupported_treatment_v1"),
                   ("posted", None), ("offset", None), ("refused", "refund_exceeds_sale")]
# The plan's closing balances (debit-positive, GBP), measured by the wire spike.
GOLDEN_BALANCES = {CLEARING: "55.9000", "syn-sales-goods": "-75.0000", "syn-sales-shipping": "-11.0000",
                   "syn-sales-refunds": "23.0000", "syn-selling-fees": "6.7500",
                   "syn-tax-stated-on-sales": "-1.0000", "syn-tax-on-fees": "1.3500"}


def deliver(db, event, **kwargs):
    return asyncio.run(api().deliver(db, event, **kwargs))


def deliver_all(db, events):
    return [deliver(db, event) for event in events]


def ledger_lines(report, event_id):
    item = next(item for item in report["events"] if item["event_id"] == event_id)
    entry = next(entry for entry in report["entries"] if entry["id"] == item["entry_id"])
    return [(line["account_id"], line["entry_type"], line["amount"]) for line in entry["lines"]]


def test_golden_events_post_through_the_real_domain_with_the_planned_balances(tmp_path):
    from src.domain.general_ledger.models.journal_entry import JournalEntry
    from src.domain.general_ledger.services.posting_service import PostingService
    from src.domain.general_ledger.validators.balance_validator import BalanceValidator

    codes = {PostingService.post_entry.__code__, JournalEntry.validate_for_posting.__code__, BalanceValidator.validate_entry_complete.__code__}
    seen = set()

    def trace(frame, event, _arg):
        if event == "call" and frame.f_code in codes:
            seen.add(frame.f_code)
    db = tmp_path / "golden.sqlite3"
    sys.setprofile(trace)
    try:
        results = deliver_all(db, golden_events())
    finally:
        sys.setprofile(None)
    assert seen == codes
    assert [(result["outcome"], result["reason"]) for result in results] == GOLDEN_OUTCOMES
    report = api().replay(db)
    assert [(item["outcome"], item["reason"]) for item in report["events"]] == GOLDEN_OUTCOMES
    assert report["balances"] == GOLDEN_BALANCES
    assert len(report["entries"]) == 5
    assert {entry["currency_code"] for entry in report["entries"]} == {"GBP"}
    assert all(entry["reversal_of_id"] is None for entry in report["entries"])
    t1, t3, _t2, _t5, t4, t6, _t7 = golden_events()
    t1_entry = next(item["entry_id"] for item in report["events"] if item["event_id"] == t1["id"])
    assert [item["compensates_entry_id"] for item in report["events"] if item["event_id"] in (t3["id"], t6["id"])] == [t1_entry, t1_entry]
    assert next(item for item in report["events"] if item["event_id"] == t4["id"])["tax_point_date"] == "2026-10-01"
    periods = {period["id"]: (period["entry_count"], period["total_debits"]) for period in report["periods"]}
    assert periods == {"syn-commerce-2026-09": (3, "97.6000"), "syn-commerce-2026-10": (2, "21.6000")}
    assert report["validation"]["balanced"] is True


def test_hydrated_accounts_carry_the_books_currency(tmp_path):
    from src.commerce_posting.storage import AccountRepository, connect

    db = tmp_path / "currency.sqlite3"
    deliver_all(db, golden_events()[:1])
    connection = connect(db, readonly=True)
    try:
        account = asyncio.run(AccountRepository(connection, BOOKS_OF["entityId"]).get_by_id(CLEARING))
    finally:
        connection.close()
    # The domain model defaults to USD; these books are GBP.
    assert account is not None and account.currency_code == "GBP"


def test_sale_and_refund_lines_follow_the_posting_rules(tmp_path):
    db = tmp_path / "rules.sqlite3"
    t1, t3 = golden_events()[:2]
    deliver_all(db, [t1, t3])
    report = api().replay(db)
    assert ledger_lines(report, t1["id"]) == [
        (CLEARING, "DEBIT", "24.3000"), ("syn-selling-fees", "DEBIT", "2.7500"), ("syn-tax-on-fees", "DEBIT", "0.5500"),
        ("syn-sales-goods", "CREDIT", "20.0000"), ("syn-sales-shipping", "CREDIT", "3.0000"), ("syn-tax-stated-on-sales", "CREDIT", "4.6000")]
    assert ledger_lines(report, t3["id"]) == [
        ("syn-sales-refunds", "DEBIT", "10.0000"), ("syn-tax-stated-on-sales", "DEBIT", "2.0000"),
        (CLEARING, "CREDIT", "10.8000"), ("syn-selling-fees", "CREDIT", "1.0000"), ("syn-tax-on-fees", "CREDIT", "0.2000")]
    entry = next(entry for entry in report["entries"] if entry["source_document"] == t3["payload"]["idempotencyKey"])
    assert (entry["source_document_type"], entry["entry_date"], entry["fiscal_period_id"]) == ("CREDIT_MEMO", "2026-09-20", "syn-commerce-2026-09")


def test_negative_net_moves_clearing_to_the_other_side(tmp_path):
    db = tmp_path / "negative.sqlite3"
    small = sale("syn-sale-small", "2026-09-10", [line("L1", "goods", 100, 20)], [fee("F1", 200, 40)])
    credit = refund("syn-refund-small", small, "2026-09-11", [("L1", 50, 10)], [("F1", 100, 20)])
    deliver_all(db, [small, credit])
    report = api().replay(db)
    # Fees above the gross: the channel takes money back, so clearing is credited.
    assert ledger_lines(report, small["id"]) == [
        (CLEARING, "CREDIT", "1.2000"), ("syn-selling-fees", "DEBIT", "2.0000"), ("syn-tax-on-fees", "DEBIT", "0.4000"),
        ("syn-sales-goods", "CREDIT", "1.0000"), ("syn-tax-stated-on-sales", "CREDIT", "0.2000")]
    assert ledger_lines(report, credit["id"]) == [
        ("syn-sales-refunds", "DEBIT", "0.5000"), ("syn-tax-stated-on-sales", "DEBIT", "0.1000"), (CLEARING, "DEBIT", "0.6000"),
        ("syn-selling-fees", "CREDIT", "1.0000"), ("syn-tax-on-fees", "CREDIT", "0.2000")]
    assert report["balances"][CLEARING] == "-0.6000"


def test_zero_lines_are_omitted_and_provider_collected_tax_is_never_posted(tmp_path):
    db = tmp_path / "memo.sqlite3"
    export = sale("syn-sale-export", "2026-09-12", [line("L1", "goods", 1000, 0, "zero_rated")], providerCollectedTax=350)
    deliver(db, export)
    assert ledger_lines(api().replay(db), export["id"]) == [(CLEARING, "DEBIT", "10.0000"), ("syn-sales-goods", "CREDIT", "10.0000")]


@pytest.mark.parametrize("changes,reason", [
    ({"booksOf": {"entityId": "00000000-0000-4000-8000-0000000000aa", "decisionRef": "synthetic-books-lab"}}, "not_our_books"),
    ({"booksOf": {"entityId": BOOKS_OF["entityId"], "decisionRef": "synthetic-other-books"}}, "not_our_books"),
    ({"evidenceClass": "recorded"}, "evidence_class_not_activated"),
    ({"evidenceClass": "live"}, "evidence_class_not_activated"),
    ({"currency": "USD"}, "unsupported_currency_v1"),
    ({"lines": [line("L1", "goods", 1000, 50, "reduced_rated", rate=500)]}, "unsupported_treatment_v1"),
    ({"lines": [line("L1", "goods", 1000, 0, "exempt")]}, "unsupported_treatment_v1"),
    ({"lines": [line("L1", "goods", 1000, 0, "outside_scope")]}, "unsupported_treatment_v1"),
    ({"lines": [line("L1", "goods", 1000, 0, "margin_scheme")]}, "unsupported_treatment_v1"),
    ({"fees": [fee("F1", 100, 0, "reverse_charge")]}, "unsupported_treatment_v1"),
    ({"fees": [fee("F1", 100, 20, "exempt")]}, "unsupported_treatment_v1"),
    ({"lines": [line("L1", "goods", 0, 0)], "fees": []}, "zero_value"),
])
def test_policy_refusal_records_evidence_and_never_posts(tmp_path, changes, reason):
    db = tmp_path / "refusal.sqlite3"
    deliver(db, golden_events()[0])
    before = api().replay(db)
    event = sale("syn-sale-refused", "2026-09-15", [line("L1", "goods", 1000, 200)], **changes)
    result = deliver(db, event)
    assert result == {"event_id": event["id"], "outcome": "refused", "reason": reason, "entry_id": None, "compensates_entry_id": None}
    after = api().replay(db)
    for key in ("entries", "accounts", "balances", "periods"):
        assert after[key] == before[key]
    assert after["events"][:-1] == before["events"]
    assert (after["events"][-1]["outcome"], after["events"][-1]["reason"]) == ("refused", reason)
    assert deliver(db, event) == result
    assert api().replay(db) == after


def test_refund_policy_gates_and_inherited_refusal(tmp_path):
    db = tmp_path / "refund-refusals.sqlite3"
    t1, _t3, _t2, t5 = golden_events()[:4]
    deliver_all(db, [t1, t5])
    zero = refund("syn-refund-zero", t1, "2026-09-16", [("L1", 0, 0)])
    of_refused_sale = refund("syn-refund-margin", t5, "2026-09-26", [("L1", 900, 0)])
    recorded = refund("syn-refund-recorded", t1, "2026-09-16", [("L1", 100, 20)], evidenceClass="recorded")
    assert [deliver(db, event)["reason"] for event in (zero, of_refused_sale, recorded)] == [
        "zero_value", "unsupported_treatment_v1", "evidence_class_not_activated"]
    assert len(api().replay(db)["entries"]) == 1


def test_no_event_type_can_carry_merchant_store_credit():
    c = contract()
    assert set(c.EVENTS) == {"commerce.sale.recorded", "commerce.sale.refunded"}
    for event_type in ("commerce.store_credit.issued", "commerce.store_credit.redeemed", "rewards.store_credit.issued"):
        event = {**golden_events()[0], "type": event_type}
        with pytest.raises(c.ContractError, match="unsupported event type"):
            c.validate(event)


@given(st.lists(st.tuples(st.sampled_from(["goods", "shipping"]), st.integers(0, 10**6), st.booleans()), min_size=1, max_size=5),
       st.lists(st.tuples(st.integers(0, 10**5), st.integers(0, 2 * 10**4)), max_size=3))
def test_posting_rules_balance_and_clear_the_stated_net(lines, fees):
    from src.commerce_posting.rules import posting_lines
    from src.domain.general_ledger.models.journal_entry_line import EntryType

    event = sale("syn-sale-property", "2026-09-10",
                 [line(f"L{index}", cls, net, net // 5 if taxed else 0, "standard_rated" if taxed else "zero_rated")
                  for index, (cls, net, taxed) in enumerate(lines)],
                 [fee(f"F{index}", net, tax) for index, (net, tax) in enumerate(fees)])
    contract().validate(event)
    rows = posting_lines(event)
    debits = sum(minor for _, side, minor in rows if side == EntryType.DEBIT)
    credits = sum(minor for _, side, minor in rows if side == EntryType.CREDIT)
    assert debits == credits
    assert all(minor > 0 for _, _, minor in rows)
    assert len({account for account, _, _ in rows}) == len(rows)
    clearing = sum(minor if side == EntryType.DEBIT else -minor for account, side, minor in rows if account == CLEARING)
    assert clearing == event["payload"]["totals"]["net"]
