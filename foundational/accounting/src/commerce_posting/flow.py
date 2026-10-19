"""Offline consumer orchestration: one SQLite transaction per delivered event.

All posting arithmetic and validation of the journal entry are domain-owned
(PostingService); this module decides only whether an event posts, offsets a
sale, is refused (an evidence row, no journal entry) or is an error (nothing
written).
"""
from datetime import UTC, date, datetime
from pathlib import Path

from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.services.posting_service import PostingService

from .contract import (
    SALE_RECORDED,
    check_refund_against_sale,
    replay_digest,
    sale_key_of,
    validate,
)
from .policy import ACTOR, CURRENCY, clearing_account, period_for, refusal
from .reporting import build_report
from .rules import amount, posting_lines
from .storage import (
    AccountRepository,
    EntryRepository,
    PeriodRepository,
    canonical,
    connect,
    ensure_account,
    evidence_result,
    initialize,
    ledger_id,
    sale_state,
)


class UnknownSale(ValueError):
    """A refund whose sale has not been delivered yet: retry it later."""
    retryable = True

    def __init__(self, event_ids):
        super().__init__("unknown_sale")
        self.event_ids = list(event_ids)


async def deliver(path, event, *, _checkpoint=lambda _: None):
    """Deliver one event; an exact replay returns the stored result unchanged."""
    result, _appended = await _deliver(path, event, _checkpoint)
    return result


def _precheck(event):
    # Pure checks: these errors fail before any file is opened.
    validate(event)
    if period_for(event["payload"]["taxPointDate"]) is None:
        raise ValueError("no synthetic fiscal period holds this taxPointDate")


async def _deliver(path, event, checkpoint=lambda _: None):
    _precheck(event)
    payload, refund = event["payload"], event["type"] != SALE_RECORDED
    if refund and not Path(path).exists():
        raise UnknownSale([event["id"]])  # A ledger that does not exist holds no sale.
    digest = replay_digest(event)
    connection = connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        initialize(connection)
        build_report(connection)  # Reject inconsistent prior state before any financial write.
        existing = connection.execute("SELECT * FROM commerce_evidence WHERE event_id=?", (event["id"],)).fetchone()
        if existing:
            if existing["replay_digest"] != digest:
                raise ValueError("conflicting duplicate event_id")
            connection.rollback()
            return evidence_result(existing), False
        sale = None
        if refund:
            sale = sale_state(connection, payload["saleIdempotencyKey"])
            if sale is None:
                raise UnknownSale([event["id"]])
            check_refund_against_sale(event, sale.event)
        reason = refusal(event, sale)
        if reason:
            return _record(connection, event, digest, "refused", reason, None, None, checkpoint), True
        books = payload["booksOf"]["entityId"]
        ensure_account(connection, books, clearing_account(payload["channel"]), "ASSET")
        entries = EntryRepository(connection, books, event["id"], checkpoint)
        service = PostingService(entries, PeriodRepository(connection, books, checkpoint), AccountRepository(connection, books, checkpoint))
        entry_date = date.fromisoformat(payload["taxPointDate"])
        entry = JournalEntry(id=ledger_id("entry", event["id"]), entry_number=await entries.get_next_entry_number(entry_date.year),
                             entry_date=entry_date, fiscal_period_id=period_for(payload["taxPointDate"]),
                             description=f"{payload['evidenceClass'].upper()} {event['type']} {payload['provider']['transactionId']}",
                             source_document=payload["idempotencyKey"],
                             source_document_type="CREDIT_MEMO" if refund else "RECEIPT",
                             # Journal entries default to USD in the domain model; never rely on it.
                             status=PostingStatus.DRAFT, currency_code=CURRENCY, created_by=ACTOR)
        for account_id, side, minor_units in posting_lines(event):
            entry.add_line(account_id, side, amount(minor_units))
        result = await service.post_entry(entry, ACTOR)
        if not result.success:
            raise ValueError(result.error_message)
        return _record(connection, event, digest, "offset" if refund else "posted", None, entry.id,
                       sale.entry_id if refund else None, checkpoint), True
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


def _record(connection, event, digest, outcome, reason, entry_id, compensates_entry_id, checkpoint):
    checkpoint("before_evidence")
    connection.execute("""INSERT INTO commerce_evidence(event_id, idempotency_key, event_type, sale_idempotency_key,
        replay_digest, event, outcome, reason, entry_id, compensates_entry_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
        event["id"], event["payload"]["idempotencyKey"], event["type"], sale_key_of(event), digest,
        canonical(event), outcome, reason, entry_id, compensates_entry_id, datetime.now(UTC).isoformat()))
    checkpoint("after_evidence")
    checkpoint("before_commit")
    build_report(connection)  # Check the entire uncommitted effect before making it durable.
    connection.commit()
    checkpoint("after_commit")
    return {"event_id": event["id"], "outcome": outcome, "reason": reason,
            "entry_id": entry_id, "compensates_entry_id": compensates_entry_id}


async def consume(path, events):
    """Deliver events in order, each in its own transaction.

    A refund that arrives before its sale is parked and retried after the
    rest; retries repeat while they make progress. Any other error stops the
    run: deliveries already committed stay, and re-running is safe because
    exact replays append nothing.
    """
    for number, event in enumerate(events, 1):
        try:
            _precheck(event)  # The whole batch must pass the pure checks before any write.
        except ValueError as exc:
            raise type(exc)(f"event {number}: {exc}") from exc
    summary = {"events": len(events), "appended": 0, "duplicates": 0, "retried": 0,
               "outcomes": {"posted": 0, "offset": 0, "refused": 0}}

    def count(result, appended):
        summary["appended" if appended else "duplicates"] += 1
        summary["outcomes"][result["outcome"]] += 1

    parked = []
    for event in events:
        try:
            count(*await _deliver(path, event))
        except UnknownSale:
            parked.append(event)
    while parked:
        waiting = []
        for event in parked:
            try:
                count(*await _deliver(path, event))
                summary["retried"] += 1
            except UnknownSale:
                waiting.append(event)
        if len(waiting) == len(parked):
            raise UnknownSale(event["id"] for event in waiting)
        parked = waiting
    return summary


def replay(path):
    connection = connect(path, readonly=True)
    try:
        connection.execute("BEGIN")
        return build_report(connection)
    finally:
        connection.close()
