"""
Integration tests for journal entry flows.

Tests the complete lifecycle of journal entries including:
- Creation, validation, posting
- Event emission and handling
- Balance updates
- Period constraints
"""

import pytest
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine, EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.models.fiscal_period_entity import FiscalPeriodEntity, PeriodStatus
from src.domain.general_ledger.services.posting_service import PostingService, PostingResult
from src.domain.general_ledger.validators.balance_validator import BalanceValidator
from src.infrastructure.messaging.events import JournalEntryPosted
from src.infrastructure.messaging.publisher import InMemoryEventPublisher


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def event_publisher():
    """Create an in-memory event publisher for testing."""
    return InMemoryEventPublisher()


@pytest.fixture
def balance_validator():
    """Create a balance validator."""
    return BalanceValidator()


@pytest.fixture
def mock_journal_entry_repo():
    """Create a mock journal entry repository."""
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value=None)
    repo.save = AsyncMock(side_effect=lambda entry: entry)
    repo.get_next_entry_number = AsyncMock(return_value="JE-2026-00001")
    return repo


@pytest.fixture
def mock_fiscal_period_repo():
    """Create a mock fiscal period repository."""
    repo = AsyncMock()

    # Create an open period
    period = MagicMock(spec=FiscalPeriodEntity)
    period.id = str(uuid4())
    period.period_key = "2026-01"
    period.fiscal_year = 2026
    period.period_number = 1
    period.status = PeriodStatus.OPEN
    period.allows_posting = True
    period.total_debits = Decimal("0")
    period.total_credits = Decimal("0")
    period.entry_count = 0

    repo.get_by_id = AsyncMock(return_value=period)
    repo.get_for_date = AsyncMock(return_value=period)
    repo.save = AsyncMock(side_effect=lambda p: p)

    return repo


@pytest.fixture
def mock_account_repo():
    """Create a mock account repository."""
    repo = AsyncMock()

    # Create mock accounts
    cash_account = MagicMock()
    cash_account.id = str(uuid4())
    cash_account.code = "1000"
    cash_account.name = "Cash"
    cash_account.account_type = "ASSET"
    cash_account.current_balance = Decimal("10000.00")

    revenue_account = MagicMock()
    revenue_account.id = str(uuid4())
    revenue_account.code = "4000"
    revenue_account.name = "Revenue"
    revenue_account.account_type = "REVENUE"
    revenue_account.current_balance = Decimal("0")

    accounts = {
        cash_account.id: cash_account,
        revenue_account.id: revenue_account,
    }

    repo.get_by_id = AsyncMock(side_effect=lambda id: accounts.get(id))
    repo.update_balance = AsyncMock()

    return repo, cash_account, revenue_account


@pytest.fixture
def posting_service(
    mock_journal_entry_repo,
    mock_fiscal_period_repo,
    mock_account_repo,
    event_publisher,
    balance_validator,
):
    """Create a posting service with mocked dependencies."""
    repo, _, _ = mock_account_repo
    return PostingService(
        journal_entry_repository=mock_journal_entry_repo,
        fiscal_period_repository=mock_fiscal_period_repo,
        account_repository=repo,
        balance_validator=balance_validator,
        event_publisher=event_publisher,
    )


def create_balanced_entry(
    cash_account_id: str,
    revenue_account_id: str,
    amount: Decimal = Decimal("1000.00"),
    fiscal_period_id: str = None,
) -> JournalEntry:
    """Create a balanced journal entry for testing."""
    entry = JournalEntry(
        id=str(uuid4()),
        entry_number="JE-2026-00001",
        entry_date=date(2026, 1, 15),
        fiscal_period_id=fiscal_period_id or str(uuid4()),
        description="Test journal entry",
        source_document="INV-001",
        source_document_type="INVOICE",
        status=PostingStatus.DRAFT,
        currency_code="USD",
        created_by="test-user",
    )

    # Add balanced lines (debit cash, credit revenue)
    entry.lines = [
        JournalEntryLine(
            id=str(uuid4()),
            journal_entry_id=entry.id,
            account_id=cash_account_id,
            entry_type=EntryType.DEBIT,
            amount=amount,
            description="Cash received",
            line_number=0,
        ),
        JournalEntryLine(
            id=str(uuid4()),
            journal_entry_id=entry.id,
            account_id=revenue_account_id,
            entry_type=EntryType.CREDIT,
            amount=amount,
            description="Revenue recognized",
            line_number=1,
        ),
    ]

    entry.update_totals()
    return entry


# =============================================================================
# Tests: Journal Entry Posting Flow
# =============================================================================


class TestJournalEntryPostingFlow:
    """Tests for the complete journal entry posting flow."""

    @pytest.mark.asyncio
    async def test_post_balanced_entry_succeeds(
        self,
        posting_service,
        mock_account_repo,
        mock_fiscal_period_repo,
    ):
        """A balanced journal entry should post successfully."""
        _, cash_account, revenue_account = mock_account_repo
        period = (await mock_fiscal_period_repo.get_by_id("any"))

        entry = create_balanced_entry(
            cash_account_id=cash_account.id,
            revenue_account_id=revenue_account.id,
            fiscal_period_id=period.id,
        )

        result = await posting_service.post_entry(entry, posted_by="test-user")

        assert result.success is True
        assert result.entry.status == PostingStatus.POSTED
        assert result.posted_at is not None

    @pytest.mark.asyncio
    async def test_post_entry_emits_event(
        self,
        posting_service,
        event_publisher,
        mock_account_repo,
        mock_fiscal_period_repo,
    ):
        """Posting a journal entry should emit a JournalEntryPosted event."""
        _, cash_account, revenue_account = mock_account_repo
        period = (await mock_fiscal_period_repo.get_by_id("any"))

        entry = create_balanced_entry(
            cash_account_id=cash_account.id,
            revenue_account_id=revenue_account.id,
            fiscal_period_id=period.id,
        )

        await posting_service.post_entry(entry, posted_by="test-user")

        # Verify event was published
        events = event_publisher.get_events_by_type("accounting.journal_entry.posted")
        assert len(events) == 1

        event = events[0].event
        assert event.entry_id == entry.id
        assert event.entry_number == entry.entry_number
        assert event.posted_by == "test-user"

    @pytest.mark.asyncio
    async def test_post_entry_updates_account_balances(
        self,
        posting_service,
        mock_account_repo,
        mock_fiscal_period_repo,
    ):
        """Posting should update account balances correctly."""
        repo, cash_account, revenue_account = mock_account_repo
        period = (await mock_fiscal_period_repo.get_by_id("any"))

        amount = Decimal("5000.00")
        entry = create_balanced_entry(
            cash_account_id=cash_account.id,
            revenue_account_id=revenue_account.id,
            amount=amount,
            fiscal_period_id=period.id,
        )

        await posting_service.post_entry(entry, posted_by="test-user")

        # Verify account balance updates were called
        assert repo.update_balance.call_count == 2

        # Cash account should be debited (positive for asset)
        cash_call = [c for c in repo.update_balance.call_args_list
                     if c.args[0] == cash_account.id][0]
        assert cash_call.args[1] == amount

        # Revenue account should be credited (negative signed amount)
        revenue_call = [c for c in repo.update_balance.call_args_list
                        if c.args[0] == revenue_account.id][0]
        assert revenue_call.args[1] == -amount

    @pytest.mark.asyncio
    async def test_post_entry_updates_period_statistics(
        self,
        posting_service,
        mock_account_repo,
        mock_fiscal_period_repo,
    ):
        """Posting should update fiscal period statistics."""
        _, cash_account, revenue_account = mock_account_repo
        period = (await mock_fiscal_period_repo.get_by_id("any"))

        amount = Decimal("1000.00")
        entry = create_balanced_entry(
            cash_account_id=cash_account.id,
            revenue_account_id=revenue_account.id,
            amount=amount,
            fiscal_period_id=period.id,
        )

        await posting_service.post_entry(entry, posted_by="test-user")

        # Verify period was saved with updated statistics
        mock_fiscal_period_repo.save.assert_called()
        assert period.entry_count == 1
        assert period.total_debits == amount
        assert period.total_credits == amount


class TestJournalEntryValidation:
    """Tests for journal entry validation during posting."""

    @pytest.mark.asyncio
    async def test_unbalanced_entry_fails_validation(
        self,
        posting_service,
        mock_account_repo,
        mock_fiscal_period_repo,
    ):
        """An unbalanced journal entry should fail validation."""
        _, cash_account, revenue_account = mock_account_repo
        period = (await mock_fiscal_period_repo.get_by_id("any"))

        entry = JournalEntry(
            id=str(uuid4()),
            entry_number="JE-2026-00001",
            entry_date=date(2026, 1, 15),
            fiscal_period_id=period.id,
            description="Unbalanced entry",
            status=PostingStatus.DRAFT,
            currency_code="USD",
            created_by="test-user",
        )

        # Add unbalanced lines (debits != credits)
        entry.lines = [
            JournalEntryLine(
                id=str(uuid4()),
                journal_entry_id=entry.id,
                account_id=cash_account.id,
                entry_type=EntryType.DEBIT,
                amount=Decimal("1000.00"),
                line_number=0,
            ),
            JournalEntryLine(
                id=str(uuid4()),
                journal_entry_id=entry.id,
                account_id=revenue_account.id,
                entry_type=EntryType.CREDIT,
                amount=Decimal("500.00"),  # Not balanced!
                line_number=1,
            ),
        ]
        entry.update_totals()

        result = await posting_service.post_entry(entry, posted_by="test-user")

        assert result.success is False
        assert result.error_message is not None
        assert "balance" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_entry_with_no_lines_fails_validation(
        self,
        posting_service,
        mock_fiscal_period_repo,
    ):
        """A journal entry with no lines should fail validation."""
        period = (await mock_fiscal_period_repo.get_by_id("any"))

        entry = JournalEntry(
            id=str(uuid4()),
            entry_number="JE-2026-00001",
            entry_date=date(2026, 1, 15),
            fiscal_period_id=period.id,
            description="Empty entry",
            status=PostingStatus.DRAFT,
            currency_code="USD",
            created_by="test-user",
        )
        entry.lines = []
        entry.update_totals()

        result = await posting_service.post_entry(entry, posted_by="test-user")

        assert result.success is False


class TestClosedPeriodConstraints:
    """Tests for fiscal period constraints on posting."""

    @pytest.mark.asyncio
    async def test_posting_to_closed_period_fails(
        self,
        mock_journal_entry_repo,
        mock_account_repo,
        event_publisher,
        balance_validator,
    ):
        """Posting to a closed fiscal period should fail."""
        repo, cash_account, revenue_account = mock_account_repo

        # Create a closed period
        closed_period = MagicMock(spec=FiscalPeriodEntity)
        closed_period.id = str(uuid4())
        closed_period.period_key = "2025-12"
        closed_period.status = PeriodStatus.CLOSED
        closed_period.allows_posting = False

        mock_fiscal_period_repo = AsyncMock()
        mock_fiscal_period_repo.get_by_id = AsyncMock(return_value=closed_period)
        mock_fiscal_period_repo.save = AsyncMock()

        service = PostingService(
            journal_entry_repository=mock_journal_entry_repo,
            fiscal_period_repository=mock_fiscal_period_repo,
            account_repository=repo,
            balance_validator=balance_validator,
            event_publisher=event_publisher,
        )

        entry = create_balanced_entry(
            cash_account_id=cash_account.id,
            revenue_account_id=revenue_account.id,
            fiscal_period_id=closed_period.id,
        )

        with pytest.raises(Exception) as exc_info:
            await service.post_entry(entry, posted_by="test-user")

        assert "closed" in str(exc_info.value).lower() or "period" in str(exc_info.value).lower()


# =============================================================================
# Tests: Event Integration
# =============================================================================


class TestEventIntegration:
    """Tests for event-driven integration with other services."""

    @pytest.mark.asyncio
    async def test_event_contains_required_fields(
        self,
        posting_service,
        event_publisher,
        mock_account_repo,
        mock_fiscal_period_repo,
    ):
        """Published events should contain all required fields for consumers."""
        _, cash_account, revenue_account = mock_account_repo
        period = (await mock_fiscal_period_repo.get_by_id("any"))

        entry = create_balanced_entry(
            cash_account_id=cash_account.id,
            revenue_account_id=revenue_account.id,
            fiscal_period_id=period.id,
        )

        await posting_service.post_entry(entry, posted_by="test-user")

        events = event_publisher.get_events_by_type("accounting.journal_entry.posted")
        event = events[0].event

        # Required fields for Tax service
        assert event.entry_id is not None
        assert event.fiscal_period_id is not None
        assert event.total_debits is not None
        assert event.total_credits is not None

        # Required fields for Compliance service
        assert event.posted_by is not None
        assert event.metadata is not None
        assert event.metadata.timestamp is not None

    @pytest.mark.asyncio
    async def test_event_subscriber_receives_posted_event(
        self,
        posting_service,
        event_publisher,
        mock_account_repo,
        mock_fiscal_period_repo,
    ):
        """Subscribers should receive journal entry posted events."""
        _, cash_account, revenue_account = mock_account_repo
        period = (await mock_fiscal_period_repo.get_by_id("any"))

        received_events = []

        async def handler(event):
            received_events.append(event)

        event_publisher.subscribe("accounting.journal_entry.posted", handler)

        entry = create_balanced_entry(
            cash_account_id=cash_account.id,
            revenue_account_id=revenue_account.id,
            fiscal_period_id=period.id,
        )

        await posting_service.post_entry(entry, posted_by="test-user")

        assert len(received_events) == 1
        assert received_events[0].entry_id == entry.id


# =============================================================================
# Tests: Multi-Entity Scenarios
# =============================================================================


class TestMultiEntityScenarios:
    """Tests for intercompany and multi-entity transactions."""

    @pytest.mark.asyncio
    async def test_intercompany_transaction_creates_balanced_entries(
        self,
        mock_journal_entry_repo,
        mock_fiscal_period_repo,
        mock_account_repo,
        event_publisher,
        balance_validator,
    ):
        """Intercompany transactions should create balanced entries in both entities."""
        repo, cash_account, revenue_account = mock_account_repo

        # Create accounts for entity 2
        intercompany_receivable = MagicMock()
        intercompany_receivable.id = str(uuid4())
        intercompany_receivable.code = "1200"
        intercompany_receivable.name = "Intercompany Receivable"

        intercompany_payable = MagicMock()
        intercompany_payable.id = str(uuid4())
        intercompany_payable.code = "2200"
        intercompany_payable.name = "Intercompany Payable"

        # Extend mock to return intercompany accounts
        original_get = repo.get_by_id.side_effect

        async def extended_get(id):
            if id == intercompany_receivable.id:
                return intercompany_receivable
            if id == intercompany_payable.id:
                return intercompany_payable
            return await original_get(id) if original_get else None

        repo.get_by_id = AsyncMock(side_effect=extended_get)

        service = PostingService(
            journal_entry_repository=mock_journal_entry_repo,
            fiscal_period_repository=mock_fiscal_period_repo,
            account_repository=repo,
            balance_validator=balance_validator,
            event_publisher=event_publisher,
        )

        period = (await mock_fiscal_period_repo.get_by_id("any"))

        # Entity 1: Record intercompany receivable
        entry1 = create_balanced_entry(
            cash_account_id=intercompany_receivable.id,
            revenue_account_id=revenue_account.id,
            amount=Decimal("10000.00"),
            fiscal_period_id=period.id,
        )
        entry1.description = "Intercompany sale to Entity 2"

        result1 = await service.post_entry(entry1, posted_by="test-user")
        assert result1.success is True

        # Entity 2: Record intercompany payable
        entry2 = create_balanced_entry(
            cash_account_id=cash_account.id,  # Using cash for simplicity
            revenue_account_id=intercompany_payable.id,
            amount=Decimal("10000.00"),
            fiscal_period_id=period.id,
        )
        entry2.description = "Intercompany purchase from Entity 1"

        result2 = await service.post_entry(entry2, posted_by="test-user")
        assert result2.success is True

        # Verify both events were published
        events = event_publisher.get_events_by_type("accounting.journal_entry.posted")
        assert len(events) == 2
