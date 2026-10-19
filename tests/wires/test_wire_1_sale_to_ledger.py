"""Wire 1 end to end: synthetic sales and refunds from fixture to ledger, offline.

Each stage runs through its public command-line tool in a child process:

  1. node operational/commerce-intake/dist/cli.js import       (TypeScript producer)
  2. python foundational/accounting/scripts/commerce_posting.py consume, then report

Build the producer first (pnpm exec turbo run build --filter=@ecosystem/commerce-intake...)
and run with accounting's requirements-evidence.txt installed:

  env -u PYTHONPATH -u PYTHONHOME python -B -m unittest discover -s tests/wires -v

Nothing here contacts a network: this process and every Python child refuse
socket connections and name lookups (audit hooks), every Node child preloads
no_network.mjs, and the Python child also refuses to open any .env file. The
data is synthetic; this demonstrates the wire, it does not activate it.
"""
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INTAKE = ROOT / "operational" / "commerce-intake" / "dist" / "cli.js"
FIXTURE = ROOT / "operational" / "commerce-intake" / "fixtures" / "synthetic-sales-2026-09-10.json"
POSTING = ROOT / "foundational" / "accounting" / "scripts" / "commerce_posting.py"
GOLDEN_SPOOL = ROOT / "foundational" / "accounting" / "tests" / "fixtures" / "commerce_posting" / "golden-synthetic-2026-09-10.ndjson"
NODE_GUARD = Path(__file__).resolve().with_name("no_network.mjs")
SOURCE_DATE_EPOCH = "1792324800"  # 2026-10-18T12:00:00Z, the golden spool's intake time

NETWORK_EVENTS = frozenset({
    "socket.connect", "socket.sendto", "socket.sendmsg", "socket.getaddrinfo",
    "socket.gethostbyname", "socket.gethostbyname_ex", "socket.gethostbyaddr", "socket.getnameinfo",
})
PYTHON_RUNNER = """
import runpy, sys
NETWORK_EVENTS = %r
def guard(event, args):
    if event in NETWORK_EVENTS:
        raise AssertionError('network access forbidden in the wire tests: ' + event)
    if event == 'open' and str(args[0]).endswith('.env'):
        raise AssertionError('provider environment access forbidden')
sys.addaudithook(guard)
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
""" % (sorted(NETWORK_EVENTS),)

# The plan's golden outcomes and closing balances (debit-positive, GBP).
GOLDEN_OUTCOMES = [("posted", None), ("offset", None), ("posted", None), ("refused", "unsupported_treatment_v1"),
                   ("posted", None), ("offset", None), ("refused", "refund_exceeds_sale")]
GOLDEN_BALANCES = {
    "syn-clearing-synthetic-market": Decimal("55.90"), "syn-sales-goods": Decimal("-75.00"),
    "syn-sales-shipping": Decimal("-11.00"), "syn-sales-refunds": Decimal("23.00"),
    "syn-selling-fees": Decimal("6.75"), "syn-tax-stated-on-sales": Decimal("-1.00"),
    "syn-tax-on-fees": Decimal("1.35"),
}


def _refuse_network(event, _args):
    if event in NETWORK_EVENTS:
        raise AssertionError("network access forbidden in the wire tests: " + event)


sys.addaudithook(_refuse_network)


def child_env(**extra):
    env = {key: value for key, value in os.environ.items()
           if key not in {"NODE_OPTIONS", "PYTHONPATH", "PYTHONHOME", "SOURCE_DATE_EPOCH"}}
    return {**env, **extra}


def run(argv, cwd):
    result = subprocess.run(argv, cwd=cwd, env=child_env(SOURCE_DATE_EPOCH=SOURCE_DATE_EPOCH),
                            text=True, capture_output=True, timeout=120)
    return result.returncode, result.stdout, result.stderr


def intake(spool, cwd):
    node = shutil.which("node")
    assert node, "Node 20 must be on PATH"
    return run([node, "--import", NODE_GUARD.as_uri(), str(INTAKE), "import",
                "--fixture", str(FIXTURE), "--spool", str(spool)], cwd)


def posting(*args, cwd):
    # -I: no user site, no PYTHON* variables and no current directory on sys.path.
    return run([sys.executable, "-B", "-I", "-c", PYTHON_RUNNER, str(POSTING), *map(str, args)], cwd)


def ok(code, stdout, stderr):
    """A successful CLI call: exit 0, nothing on stderr, one JSON object on stdout."""
    if code != 0 or stderr:
        raise AssertionError(f"exit {code}: {stderr}")
    return json.loads(stdout)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class WireOne:
    """One independent run of the whole wire in its own directory."""

    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir()
        self.spool, self.db, self.out = self.directory / "events.ndjson", self.directory / "ledger.sqlite3", self.directory / "out"
        self.intake = ok(*intake(self.spool, self.directory))
        self.consume = ok(*posting("consume", "--db", self.db, "--spool", self.spool, cwd=self.directory))
        self.cli_report = ok(*posting("report", "--db", self.db, "--out", self.out, cwd=self.directory))
        self.report_path = Path(self.cli_report["report_json"])
        self.report = json.loads(self.report_path.read_text(encoding="utf-8"))
        self.events = [json.loads(line) for line in self.spool.read_text(encoding="utf-8").splitlines()]


class WireOneSaleToLedgerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # tempfile honours the caller's TMPDIR; CI gives it a private scratch directory.
        cls.temp = tempfile.TemporaryDirectory(prefix="wire-1-")
        cls.root = Path(cls.temp.name)
        cls.first = WireOne(cls.root / "first")
        cls.second = WireOne(cls.root / "second")

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def outcomes(self, wire):
        """Inclusion decisions are the consumer's, read from report.json, never re-derived here."""
        by_id = {item["event_id"]: item for item in wire.report["events"]}
        self.assertEqual(set(by_id), {event["id"] for event in wire.events})
        return [by_id[event["id"]] for event in wire.events]

    def test_the_producer_writes_the_golden_spool(self):
        self.assertEqual(self.first.intake["schema"], "commerce-intake-import/1")
        self.assertEqual((self.first.intake["appended"], self.first.intake["skipped"]), (7, 0))
        # The TypeScript producer and accounting's Python fixture builder agree byte for byte.
        self.assertEqual(self.first.spool.read_bytes(), GOLDEN_SPOOL.read_bytes())

    def test_the_consumer_takes_every_event_once(self):
        self.assertEqual(self.first.consume["schema"], "commerce-posting-consume/1")
        self.assertEqual((self.first.consume["events"], self.first.consume["appended"], self.first.consume["duplicates"]), (7, 7, 0))
        self.assertEqual(self.first.consume["outcomes"], {"posted": 3, "offset": 2, "refused": 2})

    def test_the_ledger_holds_the_golden_outcomes_and_balances(self):
        self.assertEqual([(item["outcome"], item["reason"]) for item in self.outcomes(self.first)], GOLDEN_OUTCOMES)
        balances = {account: Decimal(value) for account, value in self.first.report["balances"].items()}
        self.assertEqual(balances, GOLDEN_BALANCES)
        self.assertEqual(sum(balances.values()), 0)

    def test_ledger_movements_equal_the_event_totals(self):
        # Recompute every account's movement from the events' own amounts, in
        # minor units, counting exactly the events the consumer posted or offset.
        expected = Counter()
        for event, item in zip(self.first.events, self.outcomes(self.first)):
            if item["outcome"] == "refused":
                continue
            payload = event["payload"]
            clearing = "syn-clearing-" + payload["channel"]["name"]
            if event["type"] == "commerce.sale.recorded":
                expected[clearing] += payload["totals"]["net"]
                for line in payload["lines"]:
                    expected["syn-sales-" + line["revenueClass"]] -= line["net"]
                    expected["syn-tax-stated-on-sales"] -= line["tax"]
                for fee in payload["fees"]:
                    expected["syn-selling-fees"] += fee["net"]
                    expected["syn-tax-on-fees"] += fee["tax"]
            else:
                expected[clearing] -= payload["totals"]["net"]
                for line in payload["lines"]:
                    expected["syn-sales-refunds"] += line["net"]
                    expected["syn-tax-stated-on-sales"] += line["tax"]
                for credit in payload["feeCredits"]:
                    expected["syn-selling-fees"] -= credit["net"]
                    expected["syn-tax-on-fees"] -= credit["tax"]
        balances = self.first.report["balances"]
        accounts = set(balances) | set(expected)
        self.assertEqual({account: Decimal(balances.get(account, "0")) * 100 for account in accounts},
                         {account: expected[account] for account in accounts})

    def test_replaying_everything_changes_nothing(self):
        replay = self.root / "replay"
        shutil.copytree(self.first.directory, replay)
        spool, db = replay / "events.ndjson", replay / "ledger.sqlite3"
        before = (digest(spool), digest(db))
        again = ok(*intake(spool, replay))
        self.assertEqual((again["appended"], again["skipped"]), (0, 7))
        consumed = ok(*posting("consume", "--db", db, "--spool", spool, cwd=replay))
        self.assertEqual((consumed["appended"], consumed["duplicates"]), (0, 7))
        # A redelivered spool, every line twice, is still nothing new.
        doubled = replay / "doubled.ndjson"
        doubled.write_bytes(spool.read_bytes() * 2)
        consumed = ok(*posting("consume", "--db", db, "--spool", doubled, cwd=replay))
        self.assertEqual((consumed["appended"], consumed["duplicates"]), (0, 14))
        self.assertEqual((digest(spool), digest(db)), before)
        report = ok(*posting("report", "--db", db, "--out", replay / "again", cwd=replay))
        self.assertEqual(Path(report["report_json"]).read_bytes(), self.first.report_path.read_bytes())

    def test_two_independent_runs_write_identical_report_bytes(self):
        self.assertEqual(self.second.spool.read_bytes(), self.first.spool.read_bytes())
        self.assertEqual(self.second.report_path.read_bytes(), self.first.report_path.read_bytes())
        self.assertEqual(self.second.cli_report["record_digest"], self.first.cli_report["record_digest"])

    def test_every_child_runs_under_its_network_guard(self):
        node = shutil.which("node")
        code, _stdout, stderr = run([node, "--import", NODE_GUARD.as_uri(), "-e", "require('node:net').connect(9, '127.0.0.1')"], self.root)
        self.assertNotEqual(code, 0)
        self.assertIn("network access refused", stderr)
        probe = self.root / "probe.py"
        probe.write_text("import socket\nsocket.getaddrinfo('localhost', 9)\n", encoding="utf-8")
        code, _stdout, stderr = run([sys.executable, "-B", "-I", "-c", PYTHON_RUNNER, str(probe)], self.root)
        self.assertNotEqual(code, 0)
        self.assertIn("network access forbidden", stderr)
        with self.assertRaises(AssertionError):
            socket.getaddrinfo("localhost", 9)


if __name__ == "__main__":
    unittest.main()
