#!/usr/bin/env python3
"""Standalone synthetic commerce posting CLI: no app startup, network or provider settings."""
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

from src.commerce_posting import UnknownSale, consume, deliver, replay
from src.domain.shared.exceptions import DomainError

MAX_EVENT_BYTES = 262144


def parse_event(data, where):
    def unique_pairs(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError(f"duplicate JSON key: {key}")
            value[key] = item
        return value

    def no_constants(value):
        raise ValueError(f"nonfinite JSON value: {value}")

    def no_fractions(value):
        # The contract has integer minor units only; JSON 2000.0 is not 2000.
        raise ValueError(f"non-integer JSON number: {value}")

    if len(data) > MAX_EVENT_BYTES:
        raise ValueError(f"{where}: event exceeds {MAX_EVENT_BYTES} bytes")
    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=unique_pairs,
                          parse_constant=no_constants, parse_float=no_fractions)
    except ValueError as exc:
        raise ValueError(f"{where}: {exc}") from exc


def load_event(path):
    with Path(path).open("rb") as handle:
        return parse_event(handle.read(MAX_EVENT_BYTES + 1), "event")


def load_spool(path):
    """One event per line (NDJSON); a final newline is optional, blank lines are errors."""
    lines = Path(path).read_bytes().split(b"\n")
    if lines and lines[-1] == b"":
        lines.pop()
    if not lines:
        raise ValueError("spool holds no events")
    events = []
    for number, line in enumerate(lines, 1):
        if not line.strip():
            raise ValueError(f"line {number}: blank line")
        events.append(parse_event(line, f"line {number}"))
    return events


def check_output_path(db, target):
    database = Path(db).resolve()
    # Reserve the emitted basename regardless of directory or case, even
    # before either file exists, as the payment evidence CLI does.
    if database.name.casefold() == target.name.casefold() or target.resolve() == database or (
            database.exists() and target.exists() and target.samefile(database)):
        raise ValueError("database cannot also be the report file")


def export_report(db, output):
    target = Path(output).resolve() / "report.json"
    check_output_path(db, target)
    # The projection is read in a fresh read-only SQLite connection.
    report = replay(db)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        # Written to a new sibling and atomically replaced, never truncated
        # through an existing destination link.
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, prefix=".report.json.", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(json.dumps(report, indent=2, sort_keys=True, allow_nan=False) + "\n")
        check_output_path(db, target)
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {"schema": "commerce-posting-cli/1", "database": str(Path(db).resolve()),
            "report_json": str(target), "record_digest": report["record_digest"]}


def read_back(db, event_ids):
    # Read the committed records back before announcing success.
    recorded = {item["event_id"]: item for item in replay(db)["events"]}
    if not set(event_ids) <= set(recorded):
        raise ValueError("committed result is missing")
    return recorded


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for command, flag in (("deliver", "--event"), ("consume", "--spool"), ("report", "--out")):
        child = sub.add_parser(command)
        child.add_argument("--db", required=True, type=Path, help="Explicit local synthetic SQLite path; no environment defaults")
        child.add_argument(flag, required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "deliver":
            event = load_event(args.event)
            result = asyncio.run(deliver(args.db, event))
            stored = read_back(args.db, [event["id"]])[event["id"]]
            if any(stored[key] != value for key, value in result.items()):
                raise ValueError("committed result is missing")
        elif args.command == "consume":
            events = load_spool(args.spool)
            result = {"schema": "commerce-posting-consume/1", **asyncio.run(consume(args.db, events))}
            read_back(args.db, [event["id"] for event in events])
        else:
            result = export_report(args.db, args.out)
        print(json.dumps(result, sort_keys=True, allow_nan=False))
        return 0
    except UnknownSale as exc:
        # Retryable: the refund's sale has not been delivered yet; nothing was written for it.
        print(json.dumps({"error": "unknown_sale", "retryable": True, "event_ids": exc.event_ids}), file=sys.stderr)
        return 2
    except (ValueError, OSError, sqlite3.Error, DomainError) as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
