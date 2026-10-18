"""SQLite ports for the real PostingService, scoped to the books v1 keeps.

The lossless document helpers come from the payment evidence slice. This file
owns the commerce schema, its deterministic ledger identifiers and the stored
sale state that refunds are checked against. Each repository uses the caller's
single transaction and never commits itself.
"""
import json
import sqlite3
import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path

from ulid import ULID

from src.domain.chart_of_accounts.models.account import Account, AccountType
from src.domain.general_ledger.models.fiscal_period_entity import FiscalPeriodEntity, PeriodStatus
from src.payment_evidence.storage import canonical, entry_document, hydrate_entry, money

from .contract import COMMERCE_EVENT_NAMESPACE, SALE_RECORDED
from .policy import BOOKS, CHART, PERIODS, SaleState

META_VERSION = "synthetic-commerce-posting/1"
SCHEMA = """
CREATE TABLE IF NOT EXISTS commerce_posting_meta (version TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS books (entity_id TEXT PRIMARY KEY, document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, books TEXT NOT NULL REFERENCES books(entity_id),
    account_type TEXT NOT NULL, balance TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS periods (id TEXT PRIMARY KEY, books TEXT NOT NULL REFERENCES books(entity_id), document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY, books TEXT NOT NULL REFERENCES books(entity_id),
    document TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE,
    UNIQUE(event_id, id),
    FOREIGN KEY(event_id, id) REFERENCES commerce_evidence(event_id, entry_id) DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE IF NOT EXISTS commerce_evidence (
    seq INTEGER PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL CHECK(event_type IN ('commerce.sale.recorded','commerce.sale.refunded')),
    sale_idempotency_key TEXT NOT NULL, replay_digest TEXT NOT NULL, event TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK(outcome IN ('posted','offset','refused')),
    reason TEXT, entry_id TEXT UNIQUE REFERENCES ledger_entries(id),
    compensates_entry_id TEXT REFERENCES ledger_entries(id),
    recorded_at TEXT NOT NULL,
    UNIQUE(event_id, entry_id),
    CHECK ((outcome='refused') = (entry_id IS NULL) AND (outcome='refused') = (reason IS NOT NULL)),
    CHECK ((outcome='offset') = (compensates_entry_id IS NOT NULL)),
    CHECK (outcome='refused' OR (outcome='posted') = (event_type='commerce.sale.recorded')),
    FOREIGN KEY(event_id, entry_id) REFERENCES ledger_entries(event_id, id) DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX IF NOT EXISTS commerce_evidence_sale ON commerce_evidence(sale_idempotency_key);
"""


def ledger_id(*parts):
    """Deterministic 26-character id (the domain's ULID width) for ledger rows.

    Derived from the event id, so two independent runs over the same events
    produce the same entries; the "ledger|" prefix keeps these names apart from
    contract keys ("v1|...") and aggregates ("sale|...").
    """
    return str(ULID.from_uuid(uuid.uuid5(COMMERCE_EVENT_NAMESPACE, "|".join(("ledger",) + parts))))


def _check_identity(connection):
    # A database containing only views is not an empty database: the marker
    # must be an actual table holding the recognized version.
    schema = {(row[0], row[1]) for row in connection.execute("SELECT type, name FROM sqlite_master")}
    if schema and ("table", "commerce_posting_meta") not in schema:
        raise ValueError("not a commerce posting database")
    if schema and [row[0] for row in connection.execute("SELECT version FROM commerce_posting_meta")] != [META_VERSION]:
        raise ValueError("not a commerce posting database: unsupported schema")
    return bool(schema)


def connect(path, *, readonly=False):
    path = Path(path).resolve()
    connection = sqlite3.connect(path.as_uri() + ("?mode=ro" if readonly else "?mode=rwc"), uri=True, isolation_level=None, timeout=20)
    connection.row_factory = sqlite3.Row
    try:
        if not _check_identity(connection) and readonly:
            raise ValueError("not a commerce posting database: empty")
    except BaseException:
        connection.close()
        raise
    connection.execute("PRAGMA foreign_keys=ON")
    if not readonly:
        connection.execute("PRAGMA synchronous=FULL")
    return connection


def initialize(connection):
    """Create and seed the schema inside the caller's open transaction.

    Initialization rolls back with a failed delivery, so an error never leaves
    a schema behind in a database that had none.
    """
    _check_identity(connection)  # Recheck under the write lock.
    for statement in SCHEMA.split(";"):
        if statement.strip():
            connection.execute(statement)
    for table in ("ledger_entries", "commerce_evidence"):
        for operation in ("UPDATE", "DELETE"):
            connection.execute(f"CREATE TRIGGER IF NOT EXISTS {table}_{operation.lower()} BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT, 'append-only record'); END")
    connection.execute("INSERT OR IGNORE INTO commerce_posting_meta VALUES (?)", (META_VERSION,))
    for entity_id, decision_ref in BOOKS.items():
        connection.execute("INSERT OR IGNORE INTO books VALUES (?, ?)", (entity_id, canonical({"entityId": entity_id, "decisionRef": decision_ref})))
        for account_id, account_type in CHART.items():
            connection.execute("INSERT OR IGNORE INTO accounts VALUES (?, ?, ?, ?)", (account_id, entity_id, account_type, "0.0000"))
        for period_id, period in PERIODS.items():
            connection.execute("INSERT OR IGNORE INTO periods VALUES (?, ?, ?)", (period_id, entity_id, canonical({
                **period, "status": "OPEN", "total_debits": "0.0000", "total_credits": "0.0000", "entry_count": 0})))


def ensure_account(connection, books, account_id, account_type):
    connection.execute("INSERT OR IGNORE INTO accounts VALUES (?, ?, ?, ?)", (account_id, books, account_type, "0.0000"))


def evidence_result(row):
    return {"event_id": row["event_id"], "outcome": row["outcome"], "reason": row["reason"],
            "entry_id": row["entry_id"], "compensates_entry_id": row["compensates_entry_id"]}


def sale_state(connection, sale_key):
    """The stored sale for a key with its offset refunds applied, or None."""
    row = connection.execute("SELECT * FROM commerce_evidence WHERE idempotency_key=?", (sale_key,)).fetchone()
    if row is None:
        return None
    state = SaleState(json.loads(row["event"]), row["outcome"], row["reason"], row["entry_id"])
    if row["event_type"] == SALE_RECORDED:
        for refund in connection.execute("SELECT event FROM commerce_evidence WHERE sale_idempotency_key=? AND outcome='offset' ORDER BY seq", (sale_key,)):
            state.apply(json.loads(refund["event"]))
    return state


class EntryRepository:
    def __init__(self, connection, books, event_id, checkpoint=lambda _: None):
        self.connection, self.books, self.event_id = connection, books, event_id
        self.checkpoint = checkpoint

    async def save(self, entry):
        if not entry.id:
            raise ValueError("commerce entries carry an id derived from their event")
        for line in entry.lines:
            line.id = ledger_id("line", entry.id, str(line.line_number))
            line.journal_entry_id = entry.id
        self.connection.execute("INSERT INTO ledger_entries VALUES (?, ?, ?, ?)", (
            entry.id, self.books, canonical(entry_document(entry)), self.event_id))
        self.checkpoint("after_ledger_insert")
        return entry

    async def get_by_id(self, entry_id):
        row = self.connection.execute("SELECT document FROM ledger_entries WHERE id=? AND books=?", (entry_id, self.books)).fetchone()
        return None if row is None else hydrate_entry(json.loads(row["document"]))

    async def get_next_entry_number(self, year):
        count = self.connection.execute("SELECT count(*) FROM ledger_entries").fetchone()[0]
        return f"SYN-CP-{year}-{count + 1:06d}"


class AccountRepository:
    def __init__(self, connection, books, checkpoint=lambda _: None):
        self.connection, self.books = connection, books
        self.checkpoint = checkpoint

    async def get_by_id(self, account_id):
        row = self.connection.execute("SELECT * FROM accounts WHERE id=? AND books=?", (account_id, self.books)).fetchone()
        if row is None:
            return None
        # Accounts default to USD in the domain model; these books are GBP.
        return Account(id=row["id"], code=row["id"], name=f"SYNTHETIC {row['id']}",
                       account_type=AccountType(row["account_type"]), currency_code="GBP",
                       is_active=True, is_header=False, is_deleted=False,
                       current_balance=Decimal(row["balance"]))

    async def update_balance(self, account_id, amount):
        account = await self.get_by_id(account_id)
        self.connection.execute("UPDATE accounts SET balance=? WHERE id=? AND books=?", (
            money(account.current_balance + amount), account_id, self.books))
        self.checkpoint("after_balance_update")


class PeriodRepository:
    def __init__(self, connection, books, checkpoint=lambda _: None):
        self.connection, self.books = connection, books
        self.checkpoint = checkpoint

    async def get_by_id(self, period_id):
        row = self.connection.execute("SELECT * FROM periods WHERE id=? AND books=?", (period_id, self.books)).fetchone()
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
        for row in self.connection.execute("SELECT id FROM periods WHERE books=? ORDER BY id", (self.books,)).fetchall():
            period = await self.get_by_id(row["id"])
            if period.start_date <= entry_date <= period.end_date:
                return period
        return None

    async def save(self, period):
        document = {key: getattr(period, key) for key in ("year", "period_number", "name", "entry_count")}
        document.update(start_date=period.start_date.isoformat(), end_date=period.end_date.isoformat(),
                        status=period.status.value, total_debits=money(period.total_debits), total_credits=money(period.total_credits))
        self.connection.execute("UPDATE periods SET document=? WHERE id=? AND books=?", (canonical(document), period.id, self.books))
        self.checkpoint("after_period_update")
        return period
