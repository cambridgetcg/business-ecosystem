"""Persistence safety and replay integrity; all probes use synthetic local databases."""
import asyncio
import json
import sqlite3
from contextlib import closing
from datetime import date
from decimal import Decimal

import pytest

from src.payment_evidence.storage import AccountRepository, EntryRepository, PeriodRepository, connect
from tests.test_payment_evidence import api, deliver, proposal, reversal


def test_existing_unrelated_database_is_not_modified(tmp_path):
    db = tmp_path / "unrelated.sqlite3"
    with closing(sqlite3.connect(db)) as connection, connection:
        connection.execute("CREATE TABLE unrelated (id INTEGER)")
    before = db.read_bytes()
    with pytest.raises(ValueError, match="not a payment evidence"):
        deliver(db, proposal())
    assert db.read_bytes() == before


@pytest.mark.parametrize("damage", ["balance", "period"])
def test_replay_rejects_inconsistent_persisted_totals(tmp_path, damage):
    db = tmp_path / "damaged.sqlite3"
    deliver(db, proposal())
    with closing(sqlite3.connect(db)) as connection, connection:
        if damage == "balance":
            connection.execute("UPDATE accounts SET balance='0.0000'")
        else:
            row = json.loads(connection.execute("SELECT document FROM periods").fetchone()[0])
            row["entry_count"] = 999
            connection.execute("UPDATE periods SET document=?", (json.dumps(row),))
    with pytest.raises(ValueError, match="integrity"):
        api().replay(db)


def test_human_report_explains_the_same_persisted_projection(tmp_path):
    db = tmp_path / "report.sqlite3"
    original = deliver(db, proposal())
    deliver(db, reversal(original["entry_id"]))
    report = api().replay(db)
    human = api().human_report(report)
    assert report["record_digest"] in human
    assert "not authentication" in human
    for evidence in report["evidence"]:
        assert evidence["operation_id"] in human
        assert evidence["request"]["decision"]["reason"] in human
        assert evidence["request"]["owner_id"] in human
    for entry in report["entries"]:
        assert entry["id"] in human
    assert json.loads(human.split("```json\n", 1)[1].split("\n```", 1)[0]) == report


def test_human_narrative_treats_decision_reason_as_text_not_markup(tmp_path):
    import html
    import string

    db = tmp_path / "untrusted-prose.sqlite3"
    request = proposal()
    reason = ('Review\n\n# Forged heading\r\n[claim](https://example.invalid/claim) '
              '<img src="https://example.invalid/pixel" onerror="alert(1)"> '
              '![pixel](https://example.invalid/pixel) <script>alert(2)</script> '
              '&lt;img src=x&gt; `code` **bold** _em_ | table | ~strike~ '
              '\\ escape \u2028# heading \u2029> quote ' + string.punctuation)
    request["decision"]["reason"] = reason
    deliver(db, request)
    before = db.read_bytes()
    report = api().replay(db)
    human = api().human_report(report)
    narrative, machine = human.split("```json\n", 1)
    reason_text = narrative.split("Reason: ", 1)[1].split(". Entry: ", 1)[0]
    assert len(reason_text.splitlines()) == 1
    assert "<" not in reason_text and ">" not in reason_text
    # Strip only character references: no active Markdown delimiter remains.
    import re
    without_entities = re.sub(r"&#(?:[0-9]+|x[0-9a-fA-F]+);|&(?:amp|lt|gt|quot);", "", reason_text)
    assert not any(character in without_entities for character in string.punctuation)
    assert html.unescape(reason_text) == reason.replace("\r", r"\r").replace("\n", r"\n").replace("\u2028", r"\u2028").replace("\u2029", r"\u2029")
    assert machine == json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n```\n"
    assert report["evidence"][0]["request"] == request
    assert db.read_bytes() == before


def test_repository_account_period_and_entry_reads_are_scope_isolated(tmp_path):
    db = tmp_path / "scoped.sqlite3"
    original = deliver(db, proposal())
    connection = connect(db)
    async def check():
        scope = "synthetic-other-scope"
        assert await AccountRepository(connection, scope).get_by_id("syn-cash-lab") is None
        assert await PeriodRepository(connection, scope).get_by_id("syn-period-lab-2026-09") is None
        assert await PeriodRepository(connection, scope).get_for_date(date(2026, 9, 27)) is None
        assert await EntryRepository(connection, scope, "synthetic-other").get_by_id(original["entry_id"]) is None
    try:
        asyncio.run(check())
    finally:
        connection.close()


@pytest.mark.parametrize("amount", ["0.0001", "0.1", "999999.9999", "1000000"])
def test_decimal_amounts_round_trip_exactly(tmp_path, amount):
    db = tmp_path / "decimals.sqlite3"
    deliver(db, proposal(amount=amount))
    report = api().replay(db)
    assert Decimal(report["entries"][0]["total_debits"]) == Decimal(amount)
    assert Decimal(report["balances"]["syn-expense-lab"]) == Decimal(amount)


@pytest.mark.parametrize("sql", [
    "INSERT INTO evidence(operation_id,scope,request,outcome,entry_id,recorded_at) VALUES ('synthetic-orphan','synthetic-entity-lab/synthetic-project-ledger','{}','posted',NULL,'demo')",
    "INSERT INTO ledger_entries(id,scope,document,operation_id) VALUES ('orphan','synthetic-entity-lab/synthetic-project-ledger','{}','synthetic-unrecorded')",
])
def test_database_cannot_commit_unpaired_success_records(tmp_path, sql):
    db = tmp_path / "paired.sqlite3"
    deliver(db, proposal())
    before = api().replay(db)
    connection = connect(db)
    try:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(sql)
            connection.commit()
    finally:
        connection.rollback()
        connection.close()
    assert api().replay(db) == before


@pytest.mark.parametrize("damage", ["NaN", "Infinity", "0.0000"])
def test_delivery_rejects_corrupt_starting_balance_before_financial_write(tmp_path, damage):
    db = tmp_path / "corrupt-start.sqlite3"
    deliver(db, proposal())
    with closing(sqlite3.connect(db)) as connection, connection:
        connection.execute("UPDATE accounts SET balance=? WHERE id='syn-expense-lab'", (damage,))
    with closing(sqlite3.connect(db)) as connection, connection:
        before = list(connection.iterdump())
    with pytest.raises(ValueError, match="integrity"):
        deliver(db, proposal("synthetic-next"))
    with closing(sqlite3.connect(db)) as connection, connection:
        assert list(connection.iterdump()) == before



def test_injected_bad_balance_write_is_detected_before_commit(tmp_path, monkeypatch):
    db = tmp_path / "inconsistent-write.sqlite3"
    deliver(db, proposal())
    before = api().replay(db)
    real_update = AccountRepository.update_balance
    async def faulty_update(self, account_id, amount):
        await real_update(self, account_id, amount)
        self.connection.execute("UPDATE accounts SET balance='0.0000' WHERE id=?", (account_id,))
    monkeypatch.setattr(AccountRepository, "update_balance", faulty_update)
    with pytest.raises(ValueError, match="integrity"):
        deliver(db, proposal("synthetic-inconsistent"))
    assert api().replay(db) == before


def test_sql_only_reversal_link_loss_rolls_back_before_commit(tmp_path, monkeypatch):
    from src.payment_evidence import flow

    db = tmp_path / "lost-reversal-link.sqlite3"
    original = deliver(db, proposal())
    before_report, before_bytes = api().replay(db), db.read_bytes()
    real_connect = flow.connect
    injected = []

    class FaultyConnection:
        def __init__(self, connection):
            self.connection = connection

        def __getattr__(self, name):
            return getattr(self.connection, name)

        def execute(self, statement, parameters=()):
            if statement.startswith("INSERT INTO ledger_entries"):
                assert parameters[-1] == original["entry_id"]
                parameters = (*parameters[:-1], None)  # Only the SQL link is lost.
                injected.append(True)
            return self.connection.execute(statement, parameters)

    with monkeypatch.context() as fault:
        fault.setattr(flow, "connect", lambda *args, **kwargs: FaultyConnection(real_connect(*args, **kwargs)))
        with pytest.raises(ValueError, match="integrity.*reversal link"):
            deliver(db, reversal(original["entry_id"]))
    assert injected == [True]
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before_report
    assert deliver(db, reversal(original["entry_id"]))["outcome"] == "reversed"
    after = api().replay(db)
    assert after["entries"][0] == before_report["entries"][0]
    with pytest.raises(ValueError, match="already reversed"):
        deliver(db, reversal(original["entry_id"], "synthetic-second-reversal"))
    assert api().replay(db) == after


def test_replay_rejects_sql_only_reversal_link_loss_without_repairing_records(tmp_path):
    db = tmp_path / "corrupt-reversal-link.sqlite3"
    original = deliver(db, proposal())
    compensation = deliver(db, reversal(original["entry_id"]))
    with closing(sqlite3.connect(db)) as connection, connection:
        trigger = connection.execute("SELECT sql FROM sqlite_master WHERE name='ledger_entries_update'").fetchone()[0]
        connection.execute("DROP TRIGGER ledger_entries_update")
        connection.execute("UPDATE ledger_entries SET reversal_of_id=NULL WHERE id=?", (compensation["entry_id"],))
        connection.execute(trigger)
        document = json.loads(connection.execute("SELECT document FROM ledger_entries WHERE id=?", (compensation["entry_id"],)).fetchone()[0])
        assert document["reversal_of_id"] == original["entry_id"]
    before = db.read_bytes()
    with pytest.raises(ValueError, match="integrity.*reversal link"):
        api().replay(db)
    with pytest.raises(ValueError, match="integrity.*reversal link"):
        deliver(db, reversal(original["entry_id"], "synthetic-second-reversal"))
    assert db.read_bytes() == before


def allow_duplicate_links_in_disposable_fixture(db):
    # Corrupt only the constraint in this fresh fixture. The independent
    # projection must not rely solely on SQLite's UNIQUE reversal link.
    with closing(sqlite3.connect(db)) as connection, connection:
        schema = connection.execute("SELECT sql FROM sqlite_master WHERE name='ledger_entries'").fetchone()[0]
        triggers = connection.execute("SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name='ledger_entries'").fetchall()
        damaged = schema.replace("CREATE TABLE ledger_entries", "CREATE TABLE duplicate_link_fixture").replace("reversal_of_id TEXT UNIQUE", "reversal_of_id TEXT")
        assert damaged != schema
        connection.execute("BEGIN")
        connection.execute(damaged)
        connection.execute("INSERT INTO duplicate_link_fixture SELECT * FROM ledger_entries")
        connection.execute("DROP TABLE ledger_entries")
        connection.execute("ALTER TABLE duplicate_link_fixture RENAME TO ledger_entries")
        for (trigger,) in triggers:
            connection.execute(trigger)


def redirect_reversal_in_disposable_fixture(connection, compensation_id, target_id):
    triggers = [connection.execute("SELECT sql FROM sqlite_master WHERE name=?", (name,)).fetchone()[0]
                for name in ("ledger_entries_update", "evidence_update")]
    connection.execute("DROP TRIGGER ledger_entries_update")
    connection.execute("DROP TRIGGER evidence_update")
    document = json.loads(connection.execute("SELECT document FROM ledger_entries WHERE id=?", (compensation_id,)).fetchone()[0])
    document["reversal_of_id"] = target_id
    request = json.loads(connection.execute("SELECT request FROM evidence WHERE entry_id=?", (compensation_id,)).fetchone()[0])
    request["original_entry_id"] = target_id
    connection.execute("UPDATE ledger_entries SET document=?, reversal_of_id=? WHERE id=?", (json.dumps(document), target_id, compensation_id))
    connection.execute("UPDATE evidence SET request=? WHERE entry_id=?", (json.dumps(request), compensation_id))
    for trigger in triggers:
        connection.execute(trigger)


@pytest.mark.parametrize("phase", ["before-commit", "replay"])
def test_integrity_projection_rejects_duplicate_reversals_even_with_matching_links(tmp_path, monkeypatch, phase):
    from src.payment_evidence import flow

    db = tmp_path / "duplicate-links.sqlite3"
    first = deliver(db, proposal())["entry_id"]
    second = deliver(db, proposal("synthetic-payment-second"))["entry_id"]
    deliver(db, reversal(first))
    compensation = deliver(db, reversal(second, "synthetic-reversal-second"))["entry_id"]
    allow_duplicate_links_in_disposable_fixture(db)
    before_report, before_bytes = api().replay(db), db.read_bytes()
    if phase == "before-commit":
        real_connect = flow.connect
        active = []

        def capture_connection(*args, **kwargs):
            connection = real_connect(*args, **kwargs)
            active.append(connection)
            return connection

        def corrupt(point):
            if point == "before_commit":
                redirect_reversal_in_disposable_fixture(active[0], compensation, first)

        with monkeypatch.context() as fault:
            fault.setattr(flow, "connect", capture_connection)
            with pytest.raises(ValueError, match="integrity.*duplicate reversal"):
                deliver(db, proposal("synthetic-next-payment"), _checkpoint=corrupt)
        assert db.read_bytes() == before_bytes
        assert api().replay(db) == before_report
    else:
        with closing(sqlite3.connect(db)) as connection, connection:
            redirect_reversal_in_disposable_fixture(connection, compensation, first)
        damaged_bytes = db.read_bytes()
        with pytest.raises(ValueError, match="integrity.*duplicate reversal"):
            api().replay(db)
        with pytest.raises(ValueError, match="integrity.*duplicate reversal"):
            deliver(db, proposal("synthetic-next-payment"))
        assert db.read_bytes() == damaged_bytes
