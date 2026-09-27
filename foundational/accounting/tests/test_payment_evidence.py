"""Real domain + local SQLite integration tests, no mock accounting logic."""
import asyncio
import importlib
import sqlite3
from contextlib import closing
import json
import subprocess

import pytest
import sys
from decimal import Decimal


def api():
    try:
        return importlib.import_module("src.payment_evidence")
    except ModuleNotFoundError as exc:
        raise AssertionError("offline payment evidence entrypoint is missing") from exc


def proposal(operation_id="synthetic-payment-001", **changes):
    value = {
        "schema": "synthetic-payment/1",
        "operation_id": operation_id,
        "synthetic": True,
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
        "decision": {"action": "approve", "actor": "synthetic-reviewer", "reason": "Demonstration approval, not authentication", "simulated": True},
    }
    value.update(changes)
    return value


def deliver(db, request, **kwargs):
    return asyncio.run(api().deliver(db, request, **kwargs))


def test_approved_payment_reaches_real_posting_and_survives_reopen(tmp_path):
    from src.domain.general_ledger.services.posting_service import PostingService
    from src.domain.general_ledger.models.journal_entry import JournalEntry
    from src.domain.general_ledger.validators.balance_validator import BalanceValidator

    codes = {PostingService.post_entry.__code__, JournalEntry.validate_for_posting.__code__, BalanceValidator.validate_entry_complete.__code__}
    seen = set()
    def trace(frame, event, _arg):
        if event == "call" and frame.f_code in codes:
            seen.add(frame.f_code)
    db = tmp_path / "evidence.sqlite3"
    sys.setprofile(trace)
    try:
        result = deliver(db, proposal())
    finally:
        sys.setprofile(None)
    assert seen == codes
    assert result["outcome"] == "posted"
    report = api().replay(db)
    assert report["synthetic"] is True
    assert report["authentication"] == "simulated actors; not authentication"
    assert len(report["entries"]) == len(report["evidence"]) == 1
    entry = report["entries"][0]
    assert entry["id"] == result["entry_id"]
    assert entry["status"] == "POSTED"
    assert entry["total_debits"] == entry["total_credits"] == "125.2500"
    assert report["balances"] == {"syn-cash-lab": "-125.2500", "syn-expense-lab": "125.2500"}
    assert report["validation"]["balanced"] is True
    assert report["evidence"][0]["request"] == proposal()
    assert all(isinstance(Decimal(line["amount"]), Decimal) for line in entry["lines"])
    with closing(sqlite3.connect(db)) as connection, connection:
        assert connection.execute("SELECT count(*) FROM ledger_entries").fetchone()[0] == 1


def test_explicit_refusal_is_durable_and_never_posts(tmp_path):
    db = tmp_path / "refused.sqlite3"
    request = proposal(decision={"action": "refuse", "actor": "synthetic-reviewer", "reason": "Demonstration budget refusal", "simulated": True})
    assert deliver(db, request) == {"outcome": "refused", "entry_id": None}
    report = api().replay(db)
    assert report["entries"] == []
    assert report["evidence"][0]["request"] == request
    assert report["evidence"][0]["outcome"] == "refused"
    assert set(report["balances"].values()) == {"0.0000"}


@pytest.mark.parametrize("action", ["approve", "refuse"])
def test_duplicate_delivery_across_process_is_noop_and_conflict_fails_closed(tmp_path, action):
    db = tmp_path / "duplicates.sqlite3"
    request = proposal()
    request["decision"]["action"] = action
    original = deliver(db, request)
    before = api().replay(db)
    process = subprocess.run([sys.executable, "-c", """
import asyncio, json, sys
from src.payment_evidence import deliver
print(json.dumps(asyncio.run(deliver(sys.argv[1], json.loads(sys.argv[2])))))
""", str(db), json.dumps(request)], capture_output=True, text=True)
    assert process.returncode == 0, process.stderr
    assert json.loads(process.stdout) == original
    assert api().replay(db) == before
    with pytest.raises(ValueError, match="conflicting duplicate"):
        deliver(db, {**request, "amount": "99.0000"})
    with pytest.raises(ValueError, match="conflicting duplicate"):
        deliver(db, {**request, "decision": {**request["decision"], "reason": "different reason"}})
    assert api().replay(db) == before


@pytest.mark.parametrize("changes", [
    {"synthetic": False}, {"synthetic": "true"}, {"synthetic": 1},
    {"entity_id": "real-company"}, {"project_id": "synthetic-unknown"},
    {"owner_id": "unknown-owner"}, {"owner_id": "github-owner"},
    {"direction": "inbound"}, {"currency": "USD"},
    {"counterparty_id": "real-supplier"}, {"schema": "other/1"},
    {"debit_account_id": "syn-expense-other"}, {"credit_account_id": "syn-cash-other"},
    {"period_id": "syn-period-other-2026-09"}, {"date": "2026-10-01"},
    {"date": "2026-09-31"}, {"description": ""}, {"extra": "ignored?"},
    {"operation_id": "not-synthetic"},
    {"decision": None}, {"decision": {}},
    {"decision": {"action": "approve", "actor": "", "reason": "ok", "simulated": True}},
    {"decision": {"action": "approve", "actor": "synthetic-reviewer", "reason": " ", "simulated": True}},
    {"decision": {"action": "allow", "actor": "synthetic-reviewer", "reason": "ok", "simulated": True}},
    {"decision": {"action": "approve", "actor": "unknown", "reason": "ok", "simulated": True}},
    {"decision": {"action": "approve", "actor": "synthetic-reviewer", "reason": "ok", "simulated": False}},
])
def test_invalid_or_out_of_scope_request_fails_closed(tmp_path, changes):
    db = tmp_path / "scope.sqlite3"
    deliver(db, proposal())
    before = api().replay(db)
    with pytest.raises(ValueError):
        deliver(db, {**proposal("synthetic-invalid"), **changes})
    assert api().replay(db) == before


@pytest.mark.parametrize("amount", ["NaN", "sNaN", "Infinity", "-Infinity", "0", "-1", "1e4", "1.00001", "1000000.0001", 1.2, True, None, " 1", "01", "1_000"])
def test_nonfinite_or_noncanonical_amount_fails_closed(tmp_path, amount):
    db = tmp_path / "number.sqlite3"
    with pytest.raises(ValueError):
        deliver(db, proposal(amount=amount))
    assert not db.exists()



def reversal(original_id, operation_id="synthetic-reversal-001", **changes):
    request = {key: value for key, value in proposal().items() if key in {"synthetic", "entity_id", "project_id", "owner_id", "date", "description", "decision"}}
    request.update(schema="synthetic-reversal/1", operation_id=operation_id, original_entry_id=original_id,
                   description="SYNTHETIC cancellation of demonstrated supplies")
    request.update(changes)
    return request


@pytest.mark.parametrize("surrogate", ["\ud800", "\udfff"])
@pytest.mark.parametrize("field", ["reason", "description", "original_entry_id"])
@pytest.mark.parametrize("action", ["approve", "refuse"])
def test_non_scalar_text_is_rejected_before_creating_or_changing_a_database(tmp_path, surrogate, field, action):
    request = reversal("synthetic-unused-target") if field == "original_entry_id" else proposal("synthetic-malformed-text")
    request["decision"]["action"] = action
    if field == "reason":
        request["decision"]["reason"] = "Malformed text " + surrogate
    elif field == "description":
        request[field] = "SYNTHETIC malformed text " + surrogate
    else:
        request[field] = "synthetic-target-" + surrogate
    fresh = tmp_path / "never-created.sqlite3"
    with pytest.raises(ValueError, match="Unicode scalar"):
        deliver(fresh, request)
    assert not fresh.exists()
    existing = tmp_path / "unchanged.sqlite3"
    deliver(existing, proposal())
    before_report, before_bytes = api().replay(existing), existing.read_bytes()
    with pytest.raises(ValueError, match="Unicode scalar"):
        deliver(existing, request)
    assert existing.read_bytes() == before_bytes
    assert api().replay(existing) == before_report


def test_real_reversal_retains_original_and_compensates_exactly_once(tmp_path):
    from src.domain.general_ledger.services.posting_service import PostingService
    db = tmp_path / "reversal.sqlite3"
    original_id = deliver(db, proposal())["entry_id"]
    original = api().replay(db)["entries"][0]
    seen = []
    def trace(frame, event, _arg):
        if event == "call" and frame.f_code is PostingService.create_reversal.__code__:
            seen.append(True)
    sys.setprofile(trace)
    try:
        result = deliver(db, reversal(original_id))
    finally:
        sys.setprofile(None)
    assert seen
    assert result["outcome"] == "reversed"
    report = api().replay(db)
    assert len(report["entries"]) == len(report["evidence"]) == 2
    assert report["entries"][0] == original
    compensation = report["entries"][1]
    assert compensation["reversal_of_id"] == original_id
    assert compensation["total_debits"] == compensation["total_credits"] == "125.2500"
    assert set(report["balances"].values()) == {"0.0000"}
    assert deliver(db, reversal(original_id)) == result
    with pytest.raises(ValueError, match="already reversed"):
        deliver(db, reversal(original_id, "synthetic-reversal-second"))
    assert api().replay(db) == report


@pytest.mark.parametrize("target", ["missing", "refused", "reversal"])
def test_reversal_cannot_compensate_missing_refused_or_compensating_entry(tmp_path, target):
    db = tmp_path / "no-reversal.sqlite3"
    original_id = deliver(db, proposal())["entry_id"]
    if target == "reversal":
        original_id = deliver(db, reversal(original_id))["entry_id"]
    elif target == "refused":
        refused = proposal("synthetic-refused-target")
        refused["decision"]["action"] = "refuse"
        assert deliver(db, refused)["entry_id"] is None
        original_id = refused["operation_id"]
    else:
        original_id = "synthetic-nonexistent-entry"
    before = api().replay(db)
    with pytest.raises(ValueError):
        deliver(db, reversal(original_id, "synthetic-invalid-reversal"))
    assert api().replay(db) == before


@pytest.mark.parametrize("target", ["missing", "refused", "compensation", "already-reversed"])
def test_refused_reversal_records_unvalidated_target_without_financial_movement(tmp_path, target):
    db = tmp_path / "refusal-distinction.sqlite3"
    original_id = deliver(db, proposal())["entry_id"]
    if target == "missing":
        target_id = "synthetic-no-such-entry"
    elif target == "refused":
        refused = proposal("synthetic-refused-target")
        refused["decision"]["action"] = "refuse"
        assert deliver(db, refused)["entry_id"] is None
        target_id = refused["operation_id"]
    else:
        compensation_id = deliver(db, reversal(original_id))["entry_id"]
        target_id = compensation_id if target == "compensation" else original_id
    before = api().replay(db)
    request = reversal(target_id, "synthetic-refusal-of-reversal")
    # The equivalent approval does not succeed or add evidence.
    with pytest.raises(ValueError):
        deliver(db, request)
    assert api().replay(db) == before
    request["decision"]["action"] = "refuse"
    assert deliver(db, request) == {"outcome": "refused", "entry_id": None}
    after = api().replay(db)
    for key in ("entries", "accounts", "periods", "balances"):
        assert after[key] == before[key]
    assert after["evidence"][:-1] == before["evidence"]
    assert after["evidence"][-1]["request"] == request
    assert deliver(db, request) == {"outcome": "refused", "entry_id": None}
    assert api().replay(db) == after


@pytest.mark.parametrize("stage", ["after_ledger_insert", "after_balance_update", "after_period_update", "before_evidence", "after_evidence", "before_commit"])
@pytest.mark.parametrize("kind", ["payment", "reversal"])
def test_injected_failure_rolls_back_entire_operation(tmp_path, stage, kind):
    db = tmp_path / "atomic.sqlite3"
    original = deliver(db, proposal())
    request = proposal("synthetic-second") if kind == "payment" else reversal(original["entry_id"])
    before = api().replay(db)
    def fail(point):
        if point == stage:
            raise RuntimeError("injected " + point)
    with pytest.raises(RuntimeError, match="injected"):
        deliver(db, request, _checkpoint=fail)
    assert api().replay(db) == before
    deliver(db, request)
    assert len(api().replay(db)["entries"]) == 2


@pytest.mark.parametrize("stage", ["after_ledger_insert", "after_evidence", "after_commit"])
def test_process_death_recovers_atomic_state_and_delivery_can_retry(tmp_path, stage):
    db = tmp_path / "crash.sqlite3"
    first = deliver(db, proposal())
    before = api().replay(db)
    request = reversal(first["entry_id"])
    process = subprocess.run([sys.executable, "-c", """
import asyncio, json, os, sys
from src.payment_evidence import deliver
def die(point):
    if point == sys.argv[3]:
        os._exit(73)
asyncio.run(deliver(sys.argv[1], json.loads(sys.argv[2]), _checkpoint=die))
""", str(db), json.dumps(request), stage], capture_output=True, text=True)
    assert process.returncode == 73, process.stderr
    if stage != "after_commit":
        assert api().replay(db) == before
    deliver(db, request)
    after = api().replay(db)
    assert len(after["entries"]) == len(after["evidence"]) == 2
    assert set(after["balances"].values()) == {"0.0000"}


@pytest.mark.parametrize("table", ["ledger_entries", "evidence"])
@pytest.mark.parametrize("operation", ["UPDATE", "DELETE"])
def test_journal_and_evidence_are_append_only(tmp_path, table, operation):
    db = tmp_path / "append-only.sqlite3"
    deliver(db, proposal())
    before = api().replay(db)
    statement = f"DELETE FROM {table}" if operation == "DELETE" else f"UPDATE {table} SET scope=scope"
    with closing(sqlite3.connect(db)) as connection, connection, pytest.raises(sqlite3.IntegrityError, match="append-only"):
        connection.execute(statement)
    assert api().replay(db) == before


@pytest.mark.parametrize("stage", ["before_evidence", "after_evidence", "before_commit"])
def test_refusal_failure_does_not_leave_partial_evidence(tmp_path, stage):
    db = tmp_path / "refusal-failure.sqlite3"
    deliver(db, proposal())
    request = proposal("synthetic-refusal-failure")
    request["decision"]["action"] = "refuse"
    before = api().replay(db)
    def fail(point):
        if point == stage:
            raise RuntimeError("injected refusal failure")
    with pytest.raises(RuntimeError, match="injected refusal"):
        deliver(db, request, _checkpoint=fail)
    assert api().replay(db) == before
