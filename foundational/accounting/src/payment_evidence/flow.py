"""Offline application orchestration; all posting/reversal arithmetic is domain-owned."""
from datetime import date, datetime, timezone
from decimal import Decimal

from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.services.posting_service import PostingService

from .reporting import build_report
from .storage import (AccountRepository, EntryRepository, PeriodRepository, canonical,
                      connect, seed)


async def deliver(path, request, *, _checkpoint=lambda _: None):
    from .policy import CONTEXT, validate_request
    validate_request(request)
    scope = request["entity_id"] + "/" + request["project_id"]
    connection = connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        build_report(connection)  # Reject inconsistent prior state before any financial write.
        existing = connection.execute("SELECT * FROM evidence WHERE operation_id=?", (request["operation_id"],)).fetchone()
        if existing:
            if existing["request"] != canonical(request):
                raise ValueError("conflicting duplicate operation_id")
            connection.commit()
            return {"outcome": existing["outcome"], "entry_id": existing["entry_id"]}
        seed(connection, scope, {**CONTEXT, **request})
        if request["decision"]["action"] == "refuse":
            return _record_outcome(connection, request, scope, "refused", None, _checkpoint)
        entries = EntryRepository(connection, scope, request["operation_id"], _checkpoint)
        service = PostingService(entries, PeriodRepository(connection, scope, _checkpoint), AccountRepository(connection, scope, _checkpoint))
        actor = request["decision"]["actor"]
        if request["schema"] == "synthetic-reversal/1":
            original = await entries.get_by_id(request["original_entry_id"])
            if original is None or original.is_reversal:
                raise ValueError("reversal requires a posted original in this scope")
            if not original.is_reversible:
                raise ValueError("original already reversed")
            entry = await service.create_reversal(original.id, date.fromisoformat(request["date"]), request["description"], actor)
            outcome = "reversed"
        else:
            entry = JournalEntry(entry_number=await entries.get_next_entry_number(2026),
                                 entry_date=date.fromisoformat(request["date"]), fiscal_period_id=request["period_id"],
                                 description=request["description"], source_document=request["operation_id"],
                                 source_document_type="SYNTHETIC_PAYMENT", status=PostingStatus.DRAFT,
                                 currency_code=request["currency"], created_by=actor)
            entry.add_line(request["debit_account_id"], EntryType.DEBIT, Decimal(request["amount"]))
            entry.add_line(request["credit_account_id"], EntryType.CREDIT, Decimal(request["amount"]))
            outcome = "posted"
        result = await service.post_entry(entry, actor)
        if not result.success:
            raise ValueError(result.error_message)
        return _record_outcome(connection, request, scope, outcome, entry.id, _checkpoint)
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


def _record_outcome(connection, request, scope, outcome, entry_id, checkpoint):
    checkpoint("before_evidence")
    connection.execute("INSERT INTO evidence(operation_id, scope, request, outcome, entry_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?)", (
        request["operation_id"], scope, canonical(request), outcome, entry_id, datetime.now(timezone.utc).isoformat()))
    checkpoint("after_evidence")
    checkpoint("before_commit")
    build_report(connection)  # Check the entire uncommitted effect before making it durable.
    connection.commit()
    checkpoint("after_commit")
    return {"outcome": outcome, "entry_id": entry_id}


def replay(path):
    connection = connect(path, readonly=True)
    try:
        connection.execute("BEGIN")
        return build_report(connection)
    finally:
        connection.close()
