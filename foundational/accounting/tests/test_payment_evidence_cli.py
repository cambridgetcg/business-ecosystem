"""Executable contract for the standalone, offline CLI."""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from tests.test_payment_evidence import api, proposal

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "payment_evidence_demo.py"
OFFLINE_RUNNER = """
import runpy, sys
# Refuse all outbound networking and configuration-file access in the child.
def guard(event, args):
    if event in ('socket.connect', 'socket.getaddrinfo', 'socket.gethostbyname'):
        raise AssertionError('network access forbidden: ' + event)
    if event == 'open' and str(args[0]).endswith('.env'):
        raise AssertionError('provider environment access forbidden')
sys.addaudithook(guard)
sys.argv = sys.argv[1:]
try:
    runpy.run_path(sys.argv[0], run_name='__main__')
finally:
    assert 'src.config' not in sys.modules
    assert 'src.infrastructure.persistence.database' not in sys.modules
    assert 'src.api.rest.app' not in sys.modules
"""


def cli(*args, cwd):
    return subprocess.run([sys.executable, "-c", OFFLINE_RUNNER, str(SCRIPT), *map(str, args)], cwd=cwd, text=True, capture_output=True)


def test_offline_cli_demo_replays_identical_reports_in_a_new_process(tmp_path):
    output = tmp_path / "outputs"
    db = tmp_path / "demo.sqlite3"
    result = cli("demo", "--db", db, "--out", output, cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    paths = json.loads(result.stdout)
    machine = json.loads(Path(paths["report_json"]).read_text())
    human = Path(paths["report_markdown"]).read_text()
    assert len(machine["entries"]) == 2
    assert [item["outcome"] for item in machine["evidence"]] == ["posted", "refused", "reversed"]
    assert machine == api().replay(db)
    assert machine["record_digest"] in human
    assert set(machine["balances"].values()) == {"0.0000"}
    replay = cli("report", "--db", db, "--out", tmp_path / "reopened", cwd=tmp_path)
    assert replay.returncode == 0, replay.stderr
    replay_paths = json.loads(replay.stdout)
    assert Path(replay_paths["report_json"]).read_bytes() == Path(paths["report_json"]).read_bytes()
    assert Path(replay_paths["report_markdown"]).read_text() == human
    duplicate = cli("demo", "--db", db, "--out", output, cwd=tmp_path)
    assert duplicate.returncode == 0, duplicate.stderr
    assert api().replay(db) == machine


@pytest.mark.parametrize("payload", ['{"synthetic":true,"synthetic":false}', '{"amount":NaN}', '{', '[]'])
def test_cli_rejects_malformed_json_without_posting(tmp_path, payload):
    request = tmp_path / "input.json"
    request.write_text(payload)
    db = tmp_path / "rejected.sqlite3"
    result = cli("deliver", "--db", db, "--request", request, cwd=tmp_path)
    assert result.returncode == 2, result.stderr
    assert "error" in json.loads(result.stderr)
    assert not db.exists()


@pytest.mark.parametrize("action", ["approve", "refuse"])
def test_cli_rejects_escaped_surrogate_reason_without_changing_durable_state(tmp_path, action):
    from tests.test_payment_evidence import deliver

    db = tmp_path / "scalar.sqlite3"
    deliver(db, proposal())
    before_report, before_bytes = api().replay(db), db.read_bytes()
    request = proposal("synthetic-surrogate-reason")
    request["decision"].update(action=action, reason="Unpaired surrogate: \ud800")
    input_path = tmp_path / "input.json"
    input_path.write_text(json.dumps(request), encoding="utf-8")
    result = cli("deliver", "--db", db, "--request", input_path, cwd=tmp_path)
    assert result.returncode == 2, result.stderr
    assert not result.stdout
    assert "Unicode scalar" in json.loads(result.stderr)["error"]
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before_report


@pytest.mark.parametrize("action", ["approve", "refuse"])
def test_cli_preserves_valid_unicode_scalar_text_exactly(tmp_path, action):
    request = proposal("synthetic-unicode-roundtrip", description="SYNTHETIC café e\u0301 \U0001f4b7")
    request["decision"].update(action=action, reason="Review by 宇 — e\u0301 \U0001f642")
    input_path, db = tmp_path / "input.json", tmp_path / "unicode.sqlite3"
    input_path.write_text(json.dumps(request), encoding="utf-8")
    first = cli("deliver", "--db", db, "--request", input_path, cwd=tmp_path)
    assert first.returncode == 0, first.stderr
    before_report, before_bytes = api().replay(db), db.read_bytes()
    assert before_report["evidence"][0]["request"] == request
    repeated = cli("deliver", "--db", db, "--request", input_path, cwd=tmp_path)
    assert repeated.returncode == 0, repeated.stderr
    assert repeated.stdout == first.stdout
    output = tmp_path / "outputs"
    exported = cli("report", "--db", db, "--out", output, cwd=tmp_path)
    assert exported.returncode == 0, exported.stderr
    human = (output / "report.md").read_text(encoding="utf-8")
    assert request["decision"]["reason"] in human.split("```json\n", 1)[0]
    assert json.loads((output / "report.json").read_text()) == before_report
    assert db.read_bytes() == before_bytes


@pytest.mark.parametrize("filename", ["REPORT.JSON", "REPORT.MD", "APPROVED.JSON", "REFUSED.JSON", "REVERSAL.JSON"])
def test_cli_rejects_case_variant_output_names_before_creating_or_changing_a_database(tmp_path, filename):
    import sqlite3
    from contextlib import closing

    output = tmp_path / "outputs"
    output.mkdir()
    db = output / filename
    # Neither path exists yet: inode-only checks cannot detect this collision.
    result = cli("demo", "--db", db, "--out", output, cwd=tmp_path)
    assert result.returncode == 2, (result.stdout, result.stderr)
    assert not result.stdout
    assert "database cannot also be" in json.loads(result.stderr)["error"]
    assert not db.exists()
    assert list(output.iterdir()) == []

    # The same rejection must leave an already committed synthetic ledger intact.
    request = tmp_path / "input.json"
    request.write_text(json.dumps(proposal()), encoding="utf-8")
    delivered = cli("deliver", "--db", db, "--request", request, cwd=tmp_path)
    assert delivered.returncode == 0, delivered.stderr
    before_bytes, before_report = db.read_bytes(), api().replay(db)
    rejected = cli("demo", "--db", db, "--out", output, cwd=tmp_path)
    assert rejected.returncode == 2, (rejected.stdout, rejected.stderr)
    assert not rejected.stdout
    assert "database cannot also be" in json.loads(rejected.stderr)["error"]
    assert db.read_bytes() == before_bytes
    assert set(output.iterdir()) == {db}
    with closing(sqlite3.connect(db.as_uri() + "?mode=ro", uri=True)) as connection:
        assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert connection.execute("SELECT count(*) FROM ledger_entries").fetchone() == (1,)
        assert connection.execute("SELECT count(*) FROM evidence").fetchone() == (1,)
    assert api().replay(db) == before_report


@pytest.mark.parametrize("command", ["deliver", "demo", "report"])
@pytest.mark.parametrize("view_name,select", [
    ("unrelated", "SELECT 1 AS id"),
    ("payment_evidence_meta", "SELECT 'synthetic-payment-evidence/1' AS version"),
])
def test_cli_rejects_view_only_databases_without_changing_bytes_or_schema(tmp_path, command, view_name, select):
    import sqlite3
    from contextlib import closing

    db = tmp_path / "unrelated.sqlite3"
    with closing(sqlite3.connect(db)) as connection, connection:
        connection.execute(f"CREATE VIEW {view_name} AS {select}")
        connection.execute("PRAGMA user_version=42")
        before_schema = connection.execute("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name").fetchall()
        before_rows = connection.execute(f"SELECT * FROM {view_name}").fetchall()
    before_bytes = db.read_bytes()
    request, output = tmp_path / "input.json", tmp_path / "outputs"
    request.write_text(json.dumps(proposal()), encoding="utf-8")
    args = ("--request", request) if command == "deliver" else ("--out", output)
    result = cli(command, "--db", db, *args, cwd=tmp_path)
    assert result.returncode == 2, (result.stdout, result.stderr)
    assert not result.stdout
    assert "not a payment evidence database" in json.loads(result.stderr)["error"]
    assert db.read_bytes() == before_bytes
    assert set(tmp_path.iterdir()) == {db, request}
    with closing(sqlite3.connect(db.as_uri() + "?mode=ro", uri=True)) as connection:
        assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert connection.execute("PRAGMA user_version").fetchone() == (42,)
        assert connection.execute("SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name").fetchall() == before_schema
        assert connection.execute(f"SELECT * FROM {view_name}").fetchall() == before_rows
    assert db.read_bytes() == before_bytes


@pytest.mark.parametrize("initial_state", ["missing", "empty-file", "empty-sqlite"])
def test_cli_demo_keeps_sqlite_readable_after_all_fixture_exports(tmp_path, initial_state):
    import sqlite3
    from contextlib import closing

    output = tmp_path / "outputs"
    output.mkdir()
    db = output / "evidence.sqlite3"
    if initial_state == "empty-file":
        db.touch()
    elif initial_state == "empty-sqlite":
        with closing(sqlite3.connect(db)) as connection:
            connection.execute("VACUUM")
            assert connection.execute("SELECT * FROM sqlite_master").fetchall() == []
    result = cli("demo", "--db", db, "--out", output, cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    # Read SQLite only after every report and request file has been published.
    with closing(sqlite3.connect(db.as_uri() + "?mode=ro", uri=True)) as connection:
        assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert connection.execute("SELECT count(*) FROM ledger_entries").fetchone() == (2,)
        assert connection.execute("SELECT count(*) FROM evidence").fetchone() == (3,)
        requests = [json.loads(row[0]) for row in connection.execute("SELECT request FROM evidence ORDER BY seq")]
    for filename, request in zip(("approved.json", "refused.json", "reversal.json"), requests, strict=True):
        assert json.loads((output / filename).read_text()) == request
    report = api().replay(db)
    assert json.loads((output / "report.json").read_text()) == report
    assert [row["outcome"] for row in report["evidence"]] == ["posted", "refused", "reversed"]
    assert set(report["balances"].values()) == {"0.0000"}
    before_bytes = db.read_bytes()
    reopened = cli("report", "--db", db, "--out", tmp_path / "reopened", cwd=tmp_path)
    assert reopened.returncode == 0, reopened.stderr
    assert json.loads((tmp_path / "reopened" / "report.json").read_text()) == report
    assert db.read_bytes() == before_bytes


def test_cli_deliver_prints_persisted_result_and_conflict_is_error(tmp_path):
    db = tmp_path / "delivery.sqlite3"
    request = tmp_path / "input.json"
    request.write_text(json.dumps(proposal()))
    result = cli("deliver", "--db", db, "--request", request, cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["entry_id"] == api().replay(db)["entries"][0]["id"]
    before = api().replay(db)
    request.write_text(json.dumps(proposal(amount="1.0000")))
    conflict = cli("deliver", "--db", db, "--request", request, cwd=tmp_path)
    assert conflict.returncode == 2
    assert "conflicting duplicate" in conflict.stderr
    assert api().replay(db) == before


def test_concurrent_deliveries_post_once(tmp_path):
    db = tmp_path / "concurrent.sqlite3"
    request = tmp_path / "input.json"
    request.write_text(json.dumps(proposal()))
    workers = [subprocess.Popen([sys.executable, str(SCRIPT), "deliver", "--db", str(db), "--request", str(request)], cwd=tmp_path, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE) for _ in range(4)]
    outcomes = []
    for worker in workers:
        stdout, stderr = worker.communicate(timeout=20)
        assert worker.returncode == 0, stderr
        outcomes.append(json.loads(stdout))
    assert all(outcome == outcomes[0] for outcome in outcomes)
    report = api().replay(db)
    assert len(report["entries"]) == len(report["evidence"]) == 1



@pytest.mark.parametrize("kind", ["symlink", "hardlink"])
@pytest.mark.parametrize("filename", ["report.json", "report.md", "approved.json", "refused.json", "reversal.json"])
def test_cli_rejects_database_output_aliases_without_changing_ledger(tmp_path, kind, filename):
    from tests.test_payment_evidence import deliver

    db = tmp_path / "ledger.sqlite3"
    deliver(db, proposal())
    before_bytes = db.read_bytes()
    before_report = api().replay(db)
    output = tmp_path / "outputs"
    output.mkdir()
    alias = output / filename
    if kind == "symlink":
        alias.symlink_to(db)
    else:
        alias.hardlink_to(db)
    command = "report" if filename.startswith("report.") else "demo"
    result = cli(command, "--db", db, "--out", output, cwd=tmp_path)
    assert db.read_bytes() == before_bytes
    assert result.returncode == 2, result.stderr
    assert not result.stdout
    assert "database cannot also be" in json.loads(result.stderr)["error"]
    assert alias.samefile(db)
    assert set(output.iterdir()) == {alias}
    assert api().replay(db) == before_report


def load_cli_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location("payment_evidence_cli_test", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_demo_rechecks_fixture_paths_as_soon_as_the_database_exists(tmp_path, monkeypatch, capsys):
    module = load_cli_module()
    db, output = tmp_path / "ledger.sqlite3", tmp_path / "outputs"
    output.mkdir()
    real_deliver = module.deliver
    committed = []

    async def deliver_then_link(*args, **kwargs):
        result = await real_deliver(*args, **kwargs)
        if not committed:
            committed.append((db.read_bytes(), api().replay(db)))
            (output / "approved.json").symlink_to(db)
        return result

    monkeypatch.setattr(module, "deliver", deliver_then_link)
    assert module.main(["demo", "--db", str(db), "--out", str(output)]) == 2
    captured = capsys.readouterr()
    assert not captured.out
    assert "database cannot also be" in json.loads(captured.err)["error"]
    assert len(committed) == 1
    before_bytes, before_report = committed[0]
    assert len(before_report["entries"]) == len(before_report["evidence"]) == 1
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before_report
    assert set(output.iterdir()) == {output / "approved.json"}
    assert (output / "approved.json").samefile(db)


@pytest.mark.parametrize("kind", ["symlink", "hardlink"])
@pytest.mark.parametrize("filename", ["report.json", "report.md", "approved.json", "refused.json", "reversal.json"])
def test_output_publication_never_truncates_a_late_database_alias(tmp_path, monkeypatch, kind, filename):
    module = load_cli_module()
    db, output = tmp_path / "ledger.sqlite3", tmp_path / "outputs"
    module.run_demo(db, output)
    before_bytes, before_report = db.read_bytes(), api().replay(db)
    target = output / filename
    expected = target.read_bytes()
    injected = []

    def introduce_alias():
        target.unlink()
        if kind == "symlink":
            target.symlink_to(db)
        else:
            target.hardlink_to(db)
        injected.append(True)

    real_open, real_replace = Path.open, os.replace

    def racing_open(path, mode="r", *args, **kwargs):
        if path == target and "w" in mode:
            introduce_alias()
        return real_open(path, mode, *args, **kwargs)

    def racing_replace(source, destination, *args, **kwargs):
        if Path(destination) == target:
            introduce_alias()
        return real_replace(source, destination, *args, **kwargs)

    monkeypatch.setattr(Path, "open", racing_open)
    monkeypatch.setattr(os, "replace", racing_replace)
    module.run_demo(db, output)
    assert injected == [True]
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before_report
    assert not target.samefile(db)
    assert target.read_bytes() == expected


@pytest.mark.parametrize("filename", ["report.json", "report.md", "approved.json", "refused.json", "reversal.json"])
def test_cli_rechecks_each_destination_before_final_publication(tmp_path, monkeypatch, capsys, filename):
    module = load_cli_module()
    db, output = tmp_path / "ledger.sqlite3", tmp_path / "outputs"
    module.run_demo(db, output)
    before_bytes, before_report = db.read_bytes(), api().replay(db)
    names = {path.name for path in output.iterdir()}
    target = output / filename
    real_temporary_file = module.tempfile.NamedTemporaryFile
    injected = []

    def temporary_file_then_link(*args, **kwargs):
        handle = real_temporary_file(*args, **kwargs)
        if kwargs.get("prefix") == f".{filename}.":
            target.unlink()
            target.hardlink_to(db)
            injected.append(True)
        return handle

    monkeypatch.setattr(module.tempfile, "NamedTemporaryFile", temporary_file_then_link)
    assert module.main(["demo", "--db", str(db), "--out", str(output)]) == 2
    captured = capsys.readouterr()
    assert not captured.out
    assert "database cannot also be" in json.loads(captured.err)["error"]
    assert injected == [True]
    assert db.read_bytes() == before_bytes
    assert api().replay(db) == before_report
    assert target.samefile(db)
    assert {path.name for path in output.iterdir()} == names  # No temporary-file leak.


def test_failed_output_replacement_keeps_previous_reports_and_ledger(tmp_path, monkeypatch):
    module = load_cli_module()
    db, output = tmp_path / "ledger.sqlite3", tmp_path / "outputs"
    module.run_demo(db, output)
    before_bytes = db.read_bytes()
    before_outputs = {path.name: path.read_bytes() for path in output.iterdir()}

    def cannot_replace(*args, **kwargs):
        raise OSError("injected publication failure")

    monkeypatch.setattr(os, "replace", cannot_replace)
    with pytest.raises(OSError, match="injected publication failure"):
        module.export_reports(db, output)
    assert db.read_bytes() == before_bytes
    assert {path.name: path.read_bytes() for path in output.iterdir()} == before_outputs


def test_cli_refusal_readback_requires_the_exact_operation(tmp_path, monkeypatch, capsys):
    from tests.test_payment_evidence import deliver
    db = tmp_path / "readback.sqlite3"
    old = proposal("synthetic-old-refusal")
    old["decision"]["action"] = "refuse"
    previous = deliver(db, old)
    request = tmp_path / "new.json"
    request.write_text(json.dumps({**old, "operation_id": "synthetic-new-refusal"}))
    module = load_cli_module()
    async def false_acknowledgement(*_args):
        return previous  # Fault injection: acknowledgement without a committed new decision.
    monkeypatch.setattr(module, "deliver", false_acknowledgement)
    assert module.main(["deliver", "--db", str(db), "--request", str(request)]) == 2
    assert "committed result is missing" in capsys.readouterr().err
