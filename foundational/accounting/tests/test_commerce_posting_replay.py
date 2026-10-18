"""Replay, conflicts, ordering, caps and durability; all probes use synthetic local databases."""
import asyncio
import copy
import json
import sqlite3
import subprocess
import sys
from contextlib import closing

import pytest

from tests.test_commerce_posting import CLEARING, OFFLINE_PRELUDE, api, deliver, deliver_all
from tests.test_commerce_posting_contract import contract, fee, golden_events, line, refund, sale


def consume(db, events):
    return asyncio.run(api().consume(db, events))


# Pinned so any change to the golden report's content is a reviewed change
# (CPython 3.12 and 3.14 produced the same bytes when it was recorded).
GOLDEN_RECORD_DIGEST = "bb8e7cffd3aa2fc925570031e1d059e002077d0d2cea6e4101eb32c98cba6da8"


def test_two_independent_runs_give_identical_reports(tmp_path):
    first, second = tmp_path / "first.sqlite3", tmp_path / "second.sqlite3"
    deliver_all(first, golden_events())
    consume(second, golden_events())
    one, two = api().replay(first), api().replay(second)
    assert contract().canonical_json(one) == contract().canonical_json(two)
    assert one["record_digest"] == two["record_digest"] == GOLDEN_RECORD_DIGEST


def test_replaying_everything_changes_nothing(tmp_path):
    db = tmp_path / "replay.sqlite3"
    results = deliver_all(db, golden_events())
    before_bytes, before = db.read_bytes(), api().replay(db)
    assert deliver_all(db, golden_events()) == results
    process = subprocess.run([sys.executable, "-c", OFFLINE_PRELUDE + """
import asyncio, json, sys
from src.commerce_posting import consume
print(json.dumps(asyncio.run(consume(sys.argv[1], json.loads(sys.argv[2])))))
""", str(db), json.dumps(golden_events())], capture_output=True, text=True)
    assert process.returncode == 0, process.stderr
    assert json.loads(process.stdout) == {"events": 7, "appended": 0, "duplicates": 7, "retried": 0,
                                          "outcomes": {"posted": 3, "offset": 2, "refused": 2}}
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before


def test_redelivery_with_new_trace_metadata_is_a_duplicate(tmp_path):
    db = tmp_path / "metadata.sqlite3"
    event = golden_events()[0]
    first = deliver(db, event)
    before_bytes = db.read_bytes()
    traced = copy.deepcopy(event)
    traced["metadata"].update(timestamp="2026-11-01T08:00:00Z", causationId="00000000-0000-4000-8000-000000000001")
    assert deliver(db, traced) == first
    assert db.read_bytes() == before_bytes


@pytest.mark.parametrize("variant", ["amount", "raw-timestamp"])
def test_same_event_id_with_different_content_fails_closed(tmp_path, variant):
    db = tmp_path / "conflict.sqlite3"
    deliver_all(db, golden_events()[:2])
    before_bytes, before = db.read_bytes(), api().replay(db)
    if variant == "amount":
        changed = sale("syn-sale-t1", "2026-09-14", [line("L1", "goods", 2100, 420, quantity=2), line("S1", "shipping", 300, 60)],
                       [fee("F1", 275, 55)], occurred_at="2026-09-14T10:15:00Z")
    else:
        changed = copy.deepcopy(golden_events()[0])
        changed["occurredAt"] = "2026-09-14T10:15:00.000Z"
    assert changed["id"] == golden_events()[0]["id"]
    with pytest.raises(ValueError, match="conflicting duplicate"):
        deliver(db, changed)
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before


def test_refund_before_its_sale_is_a_retryable_error_that_writes_nothing(tmp_path):
    t1, t3, t2 = golden_events()[:3]
    fresh = tmp_path / "fresh.sqlite3"
    with pytest.raises(api().UnknownSale) as error:
        deliver(fresh, t3)
    assert error.value.retryable is True and error.value.event_ids == [t3["id"]]
    assert not fresh.exists()
    db = tmp_path / "early-refund.sqlite3"
    deliver(db, t2)
    before_bytes = db.read_bytes()
    with pytest.raises(api().UnknownSale):
        deliver(db, t3)
    assert db.read_bytes() == before_bytes
    deliver(db, t1)
    assert deliver(db, t3)["outcome"] == "offset"


def test_refund_caps_are_cumulative_per_line_per_fee_and_per_amount(tmp_path):
    db = tmp_path / "caps.sqlite3"
    sold = sale("syn-sale-caps", "2026-09-10", [line("L1", "goods", 1000, 200), line("S1", "shipping", 300, 60)], [fee("F1", 100, 20)])
    deliver(db, sold)

    def attempt(number, items, credits=()):
        return deliver(db, refund(f"syn-refund-caps-{number}", sold, "2026-09-12", items, credits))

    assert attempt(1, [("L1", 600, 120)])["outcome"] == "offset"
    assert attempt(2, [("L1", 400, 81)])["reason"] == "refund_exceeds_sale"   # tax over by 1p
    assert attempt(3, [("L1", 401, 0)])["reason"] == "refund_exceeds_sale"    # net over by 1p
    assert attempt(4, [("S1", 0, 0)], [("F1", 101, 0)])["reason"] == "refund_exceeds_sale"
    # Refused refunds never count towards the cap: the exact remainder still offsets.
    assert attempt(5, [("L1", 400, 80), ("S1", 300, 60)], [("F1", 100, 20)])["outcome"] == "offset"
    assert attempt(6, [("S1", 0, 1)])["reason"] == "refund_exceeds_sale"
    report = api().replay(db)
    assert report["balances"]["syn-sales-refunds"] == "13.0000"
    assert report["balances"]["syn-tax-stated-on-sales"] == "0.0000"
    assert report["balances"][CLEARING] == "0.0000"
    assert report["balances"]["syn-selling-fees"] == report["balances"]["syn-tax-on-fees"] == "0.0000"


@pytest.mark.parametrize("make,message", [
    (lambda stored: refund("syn-refund-books", stored["T1"], "2026-09-20", [("L1", 10, 2)],
                           booksOf={"entityId": "00000000-0000-4000-8000-0000000000aa", "decisionRef": "synthetic-books-lab"}), "S7"),
    (lambda stored: refund("syn-refund-ref", stored["T1"], "2026-09-20", [("L9", 10, 2)]), "S7"),
    (lambda stored: refund("syn-refund-of-refund", stored["T3"], "2026-09-21", [("L1", 10, 2)]), "S7 .*not a sale"),
    (lambda _stored: sale("syn-sale-november", "2026-11-02", [line("L1", "goods", 100, 20)]), "fiscal period"),
    (lambda stored: refund("syn-refund-november", stored["T1"], "2026-11-02", [("L1", 10, 2)]), "fiscal period"),
])
def test_contract_and_state_errors_write_nothing(tmp_path, make, message):
    db = tmp_path / "errors.sqlite3"
    t1, t3 = golden_events()[:2]
    deliver_all(db, [t1, t3])
    before_bytes, before = db.read_bytes(), api().replay(db)
    with pytest.raises(ValueError, match=message):
        deliver(db, make({"T1": t1, "T3": t3}))
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before


LEDGER_STAGES = ["after_ledger_insert", "after_balance_update", "after_period_update"]
EVIDENCE_STAGES = ["before_evidence", "after_evidence", "before_commit"]


# A refusal writes no journal entry, balance or period, so it has only evidence stages.
@pytest.mark.parametrize("kind,stage", [(kind, stage) for kind in ("sale", "refund") for stage in LEDGER_STAGES + EVIDENCE_STAGES]
                         + [("refusal", stage) for stage in EVIDENCE_STAGES])
def test_injected_failure_rolls_back_the_whole_delivery(tmp_path, kind, stage):
    db = tmp_path / "atomic.sqlite3"
    t1, t3, _t2, t5 = golden_events()[:4]
    deliver(db, t1)
    event = {"sale": golden_events()[2], "refund": t3, "refusal": t5}[kind]
    before_bytes, before = db.read_bytes(), api().replay(db)

    def fail(point):
        if point == stage:
            raise RuntimeError("injected " + point)
    with pytest.raises(RuntimeError, match="injected"):
        deliver(db, event, _checkpoint=fail)
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before
    deliver(db, event)
    assert len(api().replay(db)["events"]) == 2


@pytest.mark.parametrize("stage", ["after_ledger_insert", "after_evidence", "after_commit"])
def test_process_death_recovers_and_retry_converges_on_the_uncrashed_ledger(tmp_path, stage):
    reference = tmp_path / "reference.sqlite3"
    deliver_all(reference, golden_events()[:2])
    db = tmp_path / "crash.sqlite3"
    t1, t3 = golden_events()[:2]
    deliver(db, t1)
    before = api().replay(db)
    process = subprocess.run([sys.executable, "-c", OFFLINE_PRELUDE + """
import asyncio, json, os, sys
from src.commerce_posting import deliver
def die(point):
    if point == sys.argv[3]:
        os._exit(73)
asyncio.run(deliver(sys.argv[1], json.loads(sys.argv[2]), _checkpoint=die))
""", str(db), json.dumps(t3), stage], capture_output=True, text=True)
    assert process.returncode == 73, process.stderr
    if stage != "after_commit":
        assert api().replay(db) == before
    assert deliver(db, t3)["outcome"] == "offset"
    # Deterministic ids: the recovered ledger is the ledger that never crashed.
    assert api().replay(db) == api().replay(reference)


@pytest.mark.parametrize("table", ["ledger_entries", "commerce_evidence"])
@pytest.mark.parametrize("operation", ["UPDATE", "DELETE"])
def test_journal_and_evidence_are_append_only(tmp_path, table, operation):
    db = tmp_path / "append-only.sqlite3"
    deliver_all(db, golden_events()[:2])
    before = api().replay(db)
    statement = f"DELETE FROM {table}" if operation == "DELETE" else f"UPDATE {table} SET event_id=event_id"
    with closing(sqlite3.connect(db)) as connection, connection, pytest.raises(sqlite3.IntegrityError, match="append-only"):
        connection.execute(statement)
    assert api().replay(db) == before


@pytest.mark.parametrize("damage", ["balance", "period", "reason", "event-amount", "outcome"])
def test_replay_rederives_every_decision_and_rejects_tampering(tmp_path, damage):
    db = tmp_path / "damaged.sqlite3"
    deliver_all(db, golden_events())
    with closing(sqlite3.connect(db)) as connection, connection:
        # A file owner can drop triggers; the integrity check must still notice.
        connection.execute("DROP TRIGGER commerce_evidence_update")
        if damage == "balance":
            connection.execute("UPDATE accounts SET balance='0.0000' WHERE id='syn-sales-goods'")
        elif damage == "period":
            row = json.loads(connection.execute("SELECT document FROM periods WHERE id='syn-commerce-2026-10'").fetchone()[0])
            row["entry_count"] = 9
            connection.execute("UPDATE periods SET document=? WHERE id='syn-commerce-2026-10'", (json.dumps(row),))
        elif damage == "reason":
            connection.execute("UPDATE commerce_evidence SET reason='zero_value' WHERE reason='refund_exceeds_sale'")
        elif damage == "event-amount":
            event = json.loads(connection.execute("SELECT event FROM commerce_evidence WHERE seq=1").fetchone()[0])
            event["payload"]["providerCollectedTax"] = 1
            connection.execute("UPDATE commerce_evidence SET event=? WHERE seq=1", (json.dumps(event),))
        else:
            connection.execute("UPDATE commerce_evidence SET outcome='refused', reason='not_our_books', entry_id=NULL, compensates_entry_id=NULL WHERE seq=6")
    with pytest.raises(ValueError, match="integrity"):
        api().replay(db)
    with pytest.raises(ValueError, match="integrity"):
        deliver(db, sale("syn-sale-after-damage", "2026-10-05", [line("L1", "goods", 100, 20)]))


@pytest.mark.parametrize("schema", ["unrelated-table", "view-only", "payment-evidence"])
def test_foreign_databases_are_refused_without_changing_bytes(tmp_path, schema):
    db = tmp_path / "foreign.sqlite3"
    if schema == "payment-evidence":
        from tests.test_payment_evidence import deliver as deliver_payment
        from tests.test_payment_evidence import proposal
        deliver_payment(db, proposal())
    else:
        with closing(sqlite3.connect(db)) as connection, connection:
            connection.execute("CREATE TABLE unrelated (id INTEGER)" if schema == "unrelated-table"
                               else "CREATE VIEW commerce_posting_meta AS SELECT 'synthetic-commerce-posting/1' AS version")
    before = db.read_bytes()
    for event in golden_events()[:2]:
        with pytest.raises(ValueError, match="not a commerce posting database"):
            deliver(db, event)
    with pytest.raises(ValueError, match="not a commerce posting database"):
        api().replay(db)
    assert db.read_bytes() == before


def test_concurrent_deliveries_post_once(tmp_path):
    db = tmp_path / "concurrent.sqlite3"
    event = json.dumps(golden_events()[0])
    code = OFFLINE_PRELUDE + """
import asyncio, json, sys
from src.commerce_posting import deliver
print(json.dumps(asyncio.run(deliver(sys.argv[1], json.loads(sys.argv[2])))))
"""
    workers = [subprocess.Popen([sys.executable, "-c", code, str(db), event], text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE) for _ in range(4)]
    outcomes = []
    for worker in workers:
        stdout, stderr = worker.communicate(timeout=60)
        assert worker.returncode == 0, stderr
        outcomes.append(json.loads(stdout))
    assert all(outcome == outcomes[0] for outcome in outcomes)
    report = api().replay(db)
    assert len(report["entries"]) == len(report["events"]) == 1


def test_consume_parks_an_early_refund_and_retries_it_after_its_sale(tmp_path):
    db = tmp_path / "consume.sqlite3"
    t1, t3, t2 = golden_events()[:3]
    summary = consume(db, [t3, t2, t1, t3, t1])
    assert summary == {"events": 5, "appended": 3, "duplicates": 2, "retried": 1,
                       "outcomes": {"posted": 3, "offset": 2, "refused": 0}}
    assert [item["event_id"] for item in api().replay(db)["events"]] == [t2["id"], t1["id"], t3["id"]]


@pytest.mark.parametrize("flaw,message", [("totals", "event 3: S4"), ("period", "event 3: no synthetic fiscal period")])
def test_consume_checks_the_whole_batch_before_any_write(tmp_path, flaw, message):
    db = tmp_path / "batch.sqlite3"
    if flaw == "totals":
        broken = copy.deepcopy(golden_events()[2])
        broken["payload"]["totals"]["gross"] += 1
    else:
        broken = sale("syn-sale-november", "2026-11-02", [line("L1", "goods", 100, 20)])
    with pytest.raises(ValueError, match=message):
        consume(db, golden_events()[:2] + [broken])
    assert not db.exists()


def test_consume_reports_refunds_whose_sale_never_arrives(tmp_path):
    db = tmp_path / "pending.sqlite3"
    t1, t3, t2, _t5, _t4, _t6, t7 = golden_events()
    with pytest.raises(api().UnknownSale) as error:
        consume(db, [t3, t7, t1])
    assert error.value.event_ids == [t7["id"]]
    assert [item["event_id"] for item in api().replay(db)["events"]] == [t1["id"], t3["id"]]
    consume(db, [t2, t7])
    assert api().replay(db)["events"][-1]["reason"] == "refund_exceeds_sale"
