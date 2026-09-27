"""SQLite repository ports for the real PostingService (no accounting clone).

Domain objects are hydrated from lossless JSON/Decimal TEXT, not SQLite REAL.
Each repository uses the caller's single transaction and never commits itself.
"""
import json
import sqlite3
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from src.domain.chart_of_accounts.models.account import Account, AccountType
from src.domain.general_ledger.models.fiscal_period_entity import FiscalPeriodEntity, PeriodStatus
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine, EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.infrastructure.persistence.base import generate_ulid


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def money(value):
    return format(value, ".4f")


def entry_document(entry):
    return {
        "id": entry.id, "entry_number": entry.entry_number,
        "entry_date": entry.entry_date.isoformat(), "fiscal_period_id": entry.fiscal_period_id,
        "description": entry.description, "source_document": entry.source_document,
        "source_document_type": entry.source_document_type,
        "status": entry.status.value, "posted_at": entry.posted_at.isoformat(),
        "posted_by": entry.posted_by, "created_by": entry.created_by,
        "currency_code": entry.currency_code, "reversal_of_id": entry.reversal_of_id,
        "total_debits": money(entry.total_debits), "total_credits": money(entry.total_credits),
        "lines": [{"id": line.id, "account_id": line.account_id,
                   "entry_type": line.entry_type.value, "amount": money(line.amount),
                   "description": line.description, "line_number": line.line_number}
                  for line in entry.lines],
    }


def hydrate_entry(document):
    data = dict(document)
    lines = data.pop("lines")
    data["entry_date"] = date.fromisoformat(data["entry_date"])
    data["posted_at"] = datetime.fromisoformat(data["posted_at"])
    data["status"] = PostingStatus(data["status"])
    for key in ("total_debits", "total_credits"):
        data[key] = Decimal(data[key])
    entry = JournalEntry(**data)
    for line in lines:
        entry.lines.append(JournalEntryLine(**{
            **line, "journal_entry_id": entry.id,
            "amount": Decimal(line["amount"]), "entry_type": EntryType(line["entry_type"]),
        }))
    return entry


def connect(path, *, readonly=False):
    path = Path(path).resolve()
    connection = sqlite3.connect(path.as_uri() + ("?mode=ro" if readonly else "?mode=rwc"), uri=True, isolation_level=None, timeout=20)
    connection.row_factory = sqlite3.Row
    # A database containing only views is not an empty database. In particular,
    # a view named like the marker must never authorize schema initialization.
    schema = {(row[0], row[1]) for row in connection.execute("SELECT type, name FROM sqlite_master")}
    if schema and ("table", "payment_evidence_meta") not in schema:
        connection.close()
        raise ValueError("not a payment evidence database")
    if schema:
        marker = connection.execute("SELECT version FROM payment_evidence_meta").fetchall()
        if [row[0] for row in marker] != ["synthetic-payment-evidence/1"]:
            connection.close()
            raise ValueError("not a payment evidence database: unsupported schema")
    connection.execute("PRAGMA foreign_keys=ON")
    if not readonly:
        connection.execute("PRAGMA synchronous=FULL")
        connection.executescript("""
        BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS payment_evidence_meta (version TEXT PRIMARY KEY);
        INSERT OR IGNORE INTO payment_evidence_meta VALUES ('synthetic-payment-evidence/1');
        CREATE TABLE IF NOT EXISTS context (scope TEXT PRIMARY KEY, document TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES context(scope), role TEXT NOT NULL, balance TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS periods (id TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES context(scope), document TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ledger_entries (
            id TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES context(scope),
            document TEXT NOT NULL, operation_id TEXT NOT NULL UNIQUE,
            reversal_of_id TEXT UNIQUE REFERENCES ledger_entries(id),
            UNIQUE(operation_id, id),
            FOREIGN KEY(operation_id, id) REFERENCES evidence(operation_id, entry_id) DEFERRABLE INITIALLY DEFERRED);
        CREATE TABLE IF NOT EXISTS evidence (
            seq INTEGER PRIMARY KEY, operation_id TEXT NOT NULL UNIQUE,
            scope TEXT NOT NULL REFERENCES context(scope), request TEXT NOT NULL,
            outcome TEXT NOT NULL CHECK(outcome IN ('posted','refused','reversed')),
            entry_id TEXT UNIQUE REFERENCES ledger_entries(id), recorded_at TEXT NOT NULL,
            UNIQUE(operation_id, entry_id),
            CHECK ((outcome='refused' AND entry_id IS NULL) OR (outcome IN ('posted','reversed') AND entry_id IS NOT NULL)),
            FOREIGN KEY(operation_id, entry_id) REFERENCES ledger_entries(operation_id, id) DEFERRABLE INITIALLY DEFERRED);
        COMMIT;
        """)
        for table in ("ledger_entries", "evidence"):
            for operation in ("UPDATE", "DELETE"):
                connection.execute(f"CREATE TRIGGER IF NOT EXISTS {table}_{operation.lower()} BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT, 'append-only record'); END")
    return connection


def seed(connection, scope, request):
    connection.execute("INSERT OR IGNORE INTO context VALUES (?, ?)", (scope, canonical({
        key: request[key] for key in ("entity_id", "project_id", "owner_id", "synthetic")
    })))
    for role, key in (("expense", "debit_account_id"), ("cash", "credit_account_id")):
        connection.execute("INSERT OR IGNORE INTO accounts VALUES (?, ?, ?, ?)", (request[key], scope, role, "0.0000"))
    connection.execute("INSERT OR IGNORE INTO periods VALUES (?, ?, ?)", (request["period_id"], scope, canonical({
        "year": 2026, "period_number": 9, "name": "SYNTHETIC September 2026",
        "start_date": "2026-09-01", "end_date": "2026-09-30", "status": "OPEN",
        "total_debits": "0.0000", "total_credits": "0.0000", "entry_count": 0,
    })))


class EntryRepository:
    def __init__(self, connection, scope, operation_id, checkpoint=lambda _: None):
        self.connection, self.scope, self.operation_id = connection, scope, operation_id
        self.checkpoint = checkpoint

    async def save(self, entry):
        entry.id = entry.id or generate_ulid()
        for line in entry.lines:
            line.id = line.id or generate_ulid()
            line.journal_entry_id = entry.id
        self.connection.execute("INSERT INTO ledger_entries VALUES (?, ?, ?, ?, ?)", (
            entry.id, self.scope, canonical(entry_document(entry)), self.operation_id, entry.reversal_of_id))
        self.checkpoint("after_ledger_insert")
        return entry

    async def get_by_id(self, entry_id):
        row = self.connection.execute("SELECT document FROM ledger_entries WHERE id=? AND scope=?", (entry_id, self.scope)).fetchone()
        if row is None:
            return None
        entry = hydrate_entry(json.loads(row["document"]))
        reverse = self.connection.execute("SELECT id FROM ledger_entries WHERE reversal_of_id=? AND scope=?", (entry_id, self.scope)).fetchone()
        entry.reversed_by_id = reverse[0] if reverse else None
        return entry

    async def get_next_entry_number(self, year):
        count = self.connection.execute("SELECT count(*) FROM ledger_entries").fetchone()[0]
        return f"SYN-JE-{year}-{count + 1:06d}"


class AccountRepository:
    def __init__(self, connection, scope, checkpoint=lambda _: None):
        self.connection, self.scope = connection, scope
        self.checkpoint = checkpoint

    async def get_by_id(self, account_id):
        row = self.connection.execute("SELECT * FROM accounts WHERE id=? AND scope=?", (account_id, self.scope)).fetchone()
        if row is None:
            return None
        return Account(id=row["id"], code=row["id"], name=f"SYNTHETIC {row['role']}",
                       account_type=AccountType.ASSET if row["role"] == "cash" else AccountType.EXPENSE,
                       currency_code="GBP", is_active=True, is_header=False, is_deleted=False,
                       current_balance=Decimal(row["balance"]))

    async def update_balance(self, account_id, amount):
        account = await self.get_by_id(account_id)
        self.connection.execute("UPDATE accounts SET balance=? WHERE id=? AND scope=?", (
            money(account.current_balance + amount), account_id, self.scope))
        self.checkpoint("after_balance_update")


class PeriodRepository:
    def __init__(self, connection, scope, checkpoint=lambda _: None):
        self.connection, self.scope = connection, scope
        self.checkpoint = checkpoint

    async def get_by_id(self, period_id):
        row = self.connection.execute("SELECT * FROM periods WHERE id=? AND scope=?", (period_id, self.scope)).fetchone()
        if row is None:
            return None
        data = json.loads(row["document"])
        for key in ("start_date", "end_date"):
            data[key] = date.fromisoformat(data[key])
        for key in ("total_debits", "total_credits"):
            data[key] = Decimal(data[key])
        data["status"] = PeriodStatus(data["status"])
        return FiscalPeriodEntity(id=row["id"], **data)

    async def get_for_date(self, entry_date):
        for row in self.connection.execute("SELECT id FROM periods WHERE scope=?", (self.scope,)):
            period = await self.get_by_id(row["id"])
            if period.start_date <= entry_date <= period.end_date:
                return period
        return None

    async def save(self, period):
        document = {key: getattr(period, key) for key in ("year", "period_number", "name", "entry_count")}
        document.update(start_date=period.start_date.isoformat(), end_date=period.end_date.isoformat(),
                        status=period.status.value, total_debits=money(period.total_debits), total_credits=money(period.total_credits))
        self.connection.execute("UPDATE periods SET document=? WHERE id=? AND scope=?", (canonical(document), period.id, self.scope))
        self.checkpoint("after_period_update")
        return period
