"""Executable contract for the standalone, offline commerce posting CLI."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

from tests.test_commerce_posting import GOLDEN_BALANCES, GOLDEN_OUTCOMES, api
from tests.test_commerce_posting_contract import GOLDEN, contract, golden_events
from tests.test_payment_evidence_cli import OFFLINE_RUNNER

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "commerce_posting.py"


def cli(*args, cwd):
    # Every child refuses sockets and .env reads, and asserts src.config was never imported.
    return subprocess.run([sys.executable, "-c", OFFLINE_RUNNER, str(SCRIPT), *map(str, args)], cwd=cwd, text=True, capture_output=True)


def write_event(path, event):
    path.write_text(json.dumps(event), encoding="utf-8")
    return path


def test_two_independent_cli_runs_write_identical_report_bytes(tmp_path):
    reports = []
    for run in ("first", "second"):
        directory = tmp_path / run
        directory.mkdir()
        db = directory / "ledger.sqlite3"
        consumed = cli("consume", "--db", db, "--spool", GOLDEN, cwd=directory)
        assert consumed.returncode == 0, consumed.stderr
        assert json.loads(consumed.stdout) == {"schema": "commerce-posting-consume/1", "events": 7, "appended": 7, "duplicates": 0,
                                               "retried": 0, "outcomes": {"posted": 3, "offset": 2, "refused": 2}}
        exported = cli("report", "--db", db, "--out", directory / "out", cwd=directory)
        assert exported.returncode == 0, exported.stderr
        paths = json.loads(exported.stdout)
        machine = json.loads(Path(paths["report_json"]).read_text(encoding="utf-8"))
        assert machine == api().replay(db) and paths["record_digest"] == machine["record_digest"]
        assert [(item["outcome"], item["reason"]) for item in machine["events"]] == GOLDEN_OUTCOMES
        assert machine["balances"] == GOLDEN_BALANCES
        reports.append(Path(paths["report_json"]).read_bytes())
        # Replaying the whole spool again changes nothing, not even the file.
        before = db.read_bytes()
        again = cli("consume", "--db", db, "--spool", GOLDEN, cwd=directory)
        assert again.returncode == 0, again.stderr
        assert json.loads(again.stdout)["duplicates"] == 7
        assert db.read_bytes() == before
    assert reports[0] == reports[1]


def test_cli_never_imports_application_config_or_reads_provider_env(tmp_path):
    # accounting/.env holds secrets. A planted .env in the working directory
    # must stay unread; the runner fails the child on any .env open, socket
    # connection or src.config import.
    (tmp_path / ".env").write_text("SYNTHETIC_CANARY=never-read\n", encoding="utf-8")
    db = tmp_path / "ledger.sqlite3"
    event = write_event(tmp_path / "event.json", golden_events()[0])
    for args in (("deliver", "--db", db, "--event", event), ("consume", "--db", db, "--spool", GOLDEN),
                 ("report", "--db", db, "--out", tmp_path / "out")):
        result = cli(*args, cwd=tmp_path)
        assert result.returncode == 0, result.stderr
    loaded = subprocess.run([sys.executable, "-c", """
import json, runpy, sys
runpy.run_path(sys.argv[1], run_name='commerce_posting_cli')
print(json.dumps(sorted(sys.modules)))
""", str(SCRIPT)], cwd=tmp_path, text=True, capture_output=True)
    assert loaded.returncode == 0, loaded.stderr
    modules = set(json.loads(loaded.stdout))
    assert {"src.commerce_posting.flow", "src.domain.general_ledger.services.posting_service"} <= modules
    assert not {name for name in modules if name == "src.config" or name.startswith(("src.config.", "src.api", "pydantic_settings"))}


def test_cli_deliver_records_posting_and_refusal_and_conflict_is_an_error(tmp_path):
    db = tmp_path / "ledger.sqlite3"
    t1, _t3, _t2, t5 = golden_events()[:4]
    posted = cli("deliver", "--db", db, "--event", write_event(tmp_path / "t1.json", t1), cwd=tmp_path)
    assert posted.returncode == 0, posted.stderr
    assert json.loads(posted.stdout)["outcome"] == "posted"
    repeated = cli("deliver", "--db", db, "--event", tmp_path / "t1.json", cwd=tmp_path)
    assert repeated.returncode == 0 and repeated.stdout == posted.stdout
    refused = cli("deliver", "--db", db, "--event", write_event(tmp_path / "t5.json", t5), cwd=tmp_path)
    assert refused.returncode == 0, refused.stderr
    assert json.loads(refused.stdout) == {"compensates_entry_id": None, "entry_id": None, "event_id": t5["id"],
                                          "outcome": "refused", "reason": "unsupported_treatment_v1"}
    before = db.read_bytes()
    changed = json.loads((tmp_path / "t1.json").read_text())
    changed["occurredAt"] = "2026-09-14T10:15:00.000Z"
    conflict = cli("deliver", "--db", db, "--event", write_event(tmp_path / "t1-changed.json", changed), cwd=tmp_path)
    assert conflict.returncode == 2 and not conflict.stdout
    assert "conflicting duplicate" in json.loads(conflict.stderr)["error"]
    assert db.read_bytes() == before


def test_cli_refund_before_its_sale_is_retryable_and_writes_nothing(tmp_path):
    db = tmp_path / "ledger.sqlite3"
    t1, t3 = golden_events()[:2]
    early = cli("deliver", "--db", db, "--event", write_event(tmp_path / "t3.json", t3), cwd=tmp_path)
    assert early.returncode == 2 and not early.stdout
    assert json.loads(early.stderr) == {"error": "unknown_sale", "retryable": True, "event_ids": [t3["id"]]}
    assert not db.exists()
    assert cli("deliver", "--db", db, "--event", write_event(tmp_path / "t1.json", t1), cwd=tmp_path).returncode == 0
    retried = cli("deliver", "--db", db, "--event", tmp_path / "t3.json", cwd=tmp_path)
    assert retried.returncode == 0, retried.stderr
    assert json.loads(retried.stdout)["outcome"] == "offset"


@pytest.mark.parametrize("payload", [b'{"id":"a","id":"b"}', b'{"net":NaN}', b'{"net":2000.0}', b'{"net":1e3}',
                                     b"{", b"[]", b'"event"', b"\xff\xfe", b"",
                                     pytest.param(b"[" * 100000 + b"]" * 100000, id="deep-nesting")])
def test_cli_rejects_malformed_json_without_creating_a_database(tmp_path, payload):
    event = tmp_path / "event.json"
    event.write_bytes(payload)
    db = tmp_path / "rejected.sqlite3"
    result = cli("deliver", "--db", db, "--event", event, cwd=tmp_path)
    assert result.returncode == 2, result.stderr
    assert "error" in json.loads(result.stderr)
    assert not db.exists()


def test_cli_consume_retries_an_early_refund_and_rejects_bad_spools_before_writing(tmp_path):
    t1, t3, t2 = golden_events()[:3]
    canonical = contract().canonical_json
    spool = tmp_path / "spool.ndjson"
    spool.write_bytes(b"".join(canonical(event) + b"\n" for event in (t3, t1, t2)))
    db = tmp_path / "ledger.sqlite3"
    result = cli("consume", "--db", db, "--spool", spool, cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["retried"] == 1
    for name, data, message in (("blank", canonical(t1) + b"\n\n" + canonical(t2) + b"\n", "line 2: blank line"),
                                ("invalid", canonical(t1) + b"\n" + canonical(t2)[:-1] + b',"x":1}\n', "event 2: event: unknown field x"),
                                ("unparsable", canonical(t1) + b"\n" + b'{"id":1.5}\n', "line 2: non-integer JSON number"),
                                ("empty", b"", "no events")):
        bad, fresh = tmp_path / f"{name}.ndjson", tmp_path / f"{name}.sqlite3"
        bad.write_bytes(data)
        rejected = cli("consume", "--db", fresh, "--spool", bad, cwd=tmp_path)
        assert rejected.returncode == 2 and not rejected.stdout
        assert message in json.loads(rejected.stderr)["error"]
        assert not fresh.exists()


def test_cli_consume_reports_refunds_still_waiting_for_their_sale(tmp_path):
    t1, t3, _t2, _t5, _t4, _t6, t7 = golden_events()
    spool = tmp_path / "spool.ndjson"
    spool.write_bytes(b"".join(contract().canonical_json(event) + b"\n" for event in (t7, t1, t3)))
    db = tmp_path / "ledger.sqlite3"
    result = cli("consume", "--db", db, "--spool", spool, cwd=tmp_path)
    assert result.returncode == 2 and not result.stdout
    assert json.loads(result.stderr) == {"error": "unknown_sale", "retryable": True, "event_ids": [t7["id"]]}
    assert [item["event_id"] for item in api().replay(db)["events"]] == [t1["id"], t3["id"]]


@pytest.mark.parametrize("alias", ["same-name", "case-variant", "symlink", "hardlink"])
def test_cli_report_never_overwrites_the_database(tmp_path, alias):
    output = tmp_path / "out"
    output.mkdir()
    if alias in ("same-name", "case-variant"):
        db = output / ("report.json" if alias == "same-name" else "REPORT.JSON")
    else:
        db = tmp_path / "ledger.sqlite3"
    assert cli("consume", "--db", db, "--spool", GOLDEN, cwd=tmp_path).returncode == 0
    if alias == "symlink":
        (output / "report.json").symlink_to(db)
    elif alias == "hardlink":
        (output / "report.json").hardlink_to(db)
    before = db.read_bytes()
    result = cli("report", "--db", db, "--out", output, cwd=tmp_path)
    assert result.returncode == 2 and not result.stdout
    assert "database cannot also be" in json.loads(result.stderr)["error"]
    assert db.read_bytes() == before
    assert len(api().replay(db)["events"]) == 7


@pytest.mark.parametrize("state", ["missing", "empty-file"])
def test_cli_report_needs_an_existing_commerce_ledger(tmp_path, state):
    db = tmp_path / "ledger.sqlite3"
    if state == "empty-file":
        db.touch()
    result = cli("report", "--db", db, "--out", tmp_path / "out", cwd=tmp_path)
    assert result.returncode == 2 and not result.stdout
    assert "error" in json.loads(result.stderr)
    assert not (tmp_path / "out" / "report.json").exists()
