"""Regressions at the actual committed PostingService boundary."""
import asyncio
from datetime import date

import pytest

from src.domain.general_ledger.services.posting_service import PostingService
from src.domain.shared.exceptions import InvariantViolationError
from src.payment_evidence.storage import AccountRepository, EntryRepository, PeriodRepository, connect
from tests.test_payment_evidence import deliver, proposal


def test_actual_service_rejects_entry_date_outside_open_period(tmp_path):
    db = tmp_path / "period.sqlite3"
    original = deliver(db, proposal())
    scope = "synthetic-entity-lab/synthetic-project-ledger"
    connection = connect(db)
    async def attempt():
        entries = EntryRepository(connection, scope, "synthetic-bad-period")
        entry = await entries.get_by_id(original["entry_id"])
        from src.domain.general_ledger.models.posting_status import PostingStatus
        entry.status = PostingStatus.DRAFT
        entry.id = "synthetic-outside-period"
        entry.entry_date = date(2026, 10, 1)
        service = PostingService(entries, PeriodRepository(connection, scope), AccountRepository(connection, scope))
        with pytest.raises(InvariantViolationError, match="date"):
            await service.post_entry(entry, "synthetic-reviewer")
    try:
        connection.execute("BEGIN IMMEDIATE")
        asyncio.run(attempt())
    finally:
        connection.rollback()
        connection.close()


def test_actual_service_rejects_reposting_posted_entry_before_repository_write(tmp_path):
    db = tmp_path / "repost.sqlite3"
    original = deliver(db, proposal())
    scope = "synthetic-entity-lab/synthetic-project-ledger"
    connection = connect(db)
    async def attempt():
        entries = EntryRepository(connection, scope, "synthetic-repost")
        entry = await entries.get_by_id(original["entry_id"])
        service = PostingService(entries, PeriodRepository(connection, scope), AccountRepository(connection, scope))
        result = await service.post_entry(entry, "synthetic-reviewer")
        assert result.success is False
        assert "status" in result.error_message
    try:
        connection.execute("BEGIN IMMEDIATE")
        asyncio.run(attempt())
    finally:
        connection.rollback()
        connection.close()
