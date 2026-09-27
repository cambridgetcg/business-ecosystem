#!/usr/bin/env python3
"""Standalone synthetic evidence CLI: no app startup, network or provider settings."""
import argparse
import asyncio
import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

# Anchored to this source tree, never the current working directory or .env.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.domain.shared.exceptions import DomainError
from src.payment_evidence import deliver, human_report, replay
from src.payment_evidence.policy import CONTEXT


def load_request(path):
    def unique_pairs(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(f"duplicate JSON key: {key}")
            value[key] = item
        return value

    def no_constants(value):
        raise ValueError(f"nonfinite JSON value: {value}")

    with Path(path).open("rb") as handle:
        data = handle.read(16385)
    if len(data) > 16384:
        raise ValueError("request exceeds 16384 bytes")
    return json.loads(data.decode("utf-8"), object_pairs_hook=unique_pairs, parse_constant=no_constants)


def sample_payment(action="approve"):
    return {
        **CONTEXT, "schema": "synthetic-payment/1",
        "operation_id": "synthetic-payment-001" if action == "approve" else "synthetic-refusal-001",
        "synthetic": True, "direction": "outbound", "counterparty_id": "synthetic-supplier-paper",
        "currency": "GBP", "amount": "125.2500", "date": "2026-09-27",
        "description": "SYNTHETIC paper supplies for the ledger demonstration",
        "decision": {"action": action, "actor": "synthetic-reviewer", "simulated": True,
                     "reason": "Demonstration approval, not authentication" if action == "approve" else "Demonstration budget refusal"},
    }


def check_output_paths(db, output, names):
    database = Path(db).resolve()
    for name in names:
        target = Path(output).resolve() / name
        # Reserve emitted basenames regardless of directory/case, even before
        # either file exists. Do not guess the destination filesystem's rules.
        if database.name.casefold() == name.casefold() or target.resolve() == database or (database.exists() and target.exists() and target.samefile(database)):
            raise ValueError("database cannot also be a report or fixture file")


def replace_output(db, target, text):
    # Regenerable outputs are replaced, never opened through a destination link.
    # A link introduced after the final check is replaced, not truncated.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent,
                                         prefix=f".{target.name}.", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(text)
        check_output_paths(db, target.parent, (target.name,))
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def export_reports(db, output):
    check_output_paths(db, output, ("report.json", "report.md"))
    # The projection is read in a fresh read-only SQLite connection.
    report = replay(db)
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    machine, human = output / "report.json", output / "report.md"
    replace_output(db, machine, json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n")
    replace_output(db, human, human_report(report))
    return {"schema": "payment-evidence-cli/1", "database": str(Path(db).resolve()),
            "report_json": str(machine), "report_markdown": str(human), "record_digest": report["record_digest"]}


def run_demo(db, output):
    # Check every destination before even starting the demonstration transaction.
    names = ("report.json", "report.md", "approved.json", "refused.json", "reversal.json")
    check_output_paths(db, output, names)
    approved = sample_payment()
    original = asyncio.run(deliver(db, approved))
    # Inode comparisons are now available even when the database was new.
    check_output_paths(db, output, names)
    # Repeat across independent connections: no extra ledger or evidence record.
    assert asyncio.run(deliver(db, approved)) == original
    refused = sample_payment("refuse")
    asyncio.run(deliver(db, refused))
    reversal = {key: value for key, value in approved.items() if key in {"entity_id", "project_id", "owner_id", "synthetic", "date"}}
    reversal.update(schema="synthetic-reversal/1", operation_id="synthetic-reversal-001", original_entry_id=original["entry_id"],
                    description="SYNTHETIC cancellation of demonstrated supplies",
                    decision={"action": "approve", "actor": "synthetic-auditor", "simulated": True,
                              "reason": "Demonstration approval of compensation, not authentication"})
    result = asyncio.run(deliver(db, reversal))
    assert asyncio.run(deliver(db, reversal)) == result
    paths = export_reports(db, output)
    for name, request in (("approved", approved), ("refused", refused), ("reversal", reversal)):
        target = Path(output).resolve() / f"{name}.json"
        replace_output(db, target, json.dumps(request, indent=2, sort_keys=True) + "\n")
    return paths


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("demo", "deliver", "report"):
        child = sub.add_parser(command)
        child.add_argument("--db", required=True, type=Path, help="Explicit local synthetic SQLite path; no environment defaults")
        if command == "deliver":
            child.add_argument("--request", required=True, type=Path)
        else:
            child.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "demo":
            result = run_demo(args.db, args.out)
        elif args.command == "deliver":
            request = load_request(args.request)
            result = asyncio.run(deliver(args.db, request))
            # Read back the committed target before announcing success.
            report = replay(args.db)
            if not any(row["operation_id"] == request["operation_id"] and row["request"] == request and row["entry_id"] == result["entry_id"] and row["outcome"] == result["outcome"] for row in report["evidence"]):
                raise ValueError("committed result is missing")
        else:
            result = export_reports(args.db, args.out)
        print(json.dumps(result, sort_keys=True, allow_nan=False))
        return 0
    except (ValueError, OSError, sqlite3.Error, DomainError) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
