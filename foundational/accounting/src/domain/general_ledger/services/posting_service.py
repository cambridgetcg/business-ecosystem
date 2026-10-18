"""
Posting Service - coordinates journal entry posting.

This service handles the critical operation of posting journal entries,
which makes them permanent (immutable) financial records.

Responsibilities:
1. Validate entry is complete and balanced
2. Verify fiscal period is open
3. Update entry status to POSTED
4. Update account balances (denormalized)
5. Emit domain events for audit trail and ecosystem integration

Research Grounding:
- docs/research/02-journal-entry-immutability.md (immutability rules)
- docs/research/04-audit-trail-requirements.md (audit requirements)

AI Knowledge Gap:
- doc 11: Validation must be deterministic
- doc 15: Audit trail must be external to AI layer
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Protocol

import structlog

from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine, EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.models.fiscal_period_entity import FiscalPeriodEntity, PeriodStatus
from src.domain.general_ledger.validators.balance_validator import BalanceValidator
from src.domain.shared.exceptions import (
    PeriodClosedError,
    InvariantViolationError,
    EntityNotFoundError,
)
from src.infrastructure.messaging.events import (
    JournalEntryPosted,
    JournalEntryReversed,
    EventMetadata,
)
from src.infrastructure.messaging.publisher import IEventPublisher, InMemoryEventPublisher


logger = structlog.get_logger()


class JournalEntryRepository(Protocol):
    """Protocol for journal entry repository."""

    async def get_by_id(self, entry_id: str) -> JournalEntry | None:
        """Get an entry by ID."""
        ...

    async def save(self, entry: JournalEntry) -> JournalEntry:
        """Save an entry."""
        ...

    async def get_next_entry_number(self, year: int) -> str:
        """Generate the next entry number for the year."""
        ...


class FiscalPeriodRepository(Protocol):
    """Protocol for fiscal period repository."""

    async def get_by_id(self, period_id: str) -> FiscalPeriodEntity | None:
        """Get a period by ID."""
        ...

    async def get_for_date(self, entry_date) -> FiscalPeriodEntity | None:
        """Get the period containing the given date."""
        ...

    async def save(self, period: FiscalPeriodEntity) -> FiscalPeriodEntity:
        """Save a period."""
        ...


class AccountRepository(Protocol):
    """Protocol for account repository."""

    async def get_by_id(self, account_id: str) -> "Account | None":
        """Get an account by ID."""
        ...

    async def update_balance(self, account_id: str, amount: Decimal) -> None:
        """Update account balance by the given amount."""
        ...


@dataclass
class PostingResult:
    """Result of a posting operation."""

    success: bool
    entry: JournalEntry
    posted_at: datetime | None = None
    error_message: str | None = None


class PostingService:
    """
    Service for posting journal entries.

    The posting operation is the most critical in accounting:
    - It makes entries permanent and immutable
    - It updates account balances
    - It creates audit trail records
    - It emits domain events for ecosystem integration

    Once posted, entries CANNOT be modified.
    Corrections are made via reversing entries only.
    """

    def __init__(
        self,
        journal_entry_repository: JournalEntryRepository,
        fiscal_period_repository: FiscalPeriodRepository,
        account_repository: AccountRepository,
        balance_validator: BalanceValidator | None = None,
        event_publisher: IEventPublisher | None = None,
    ) -> None:
        """
        Initialize the posting service.

        Args:
            journal_entry_repository: Repository for journal entries
            fiscal_period_repository: Repository for fiscal periods
            account_repository: Repository for accounts
            balance_validator: Optional custom validator (defaults to standard)
            event_publisher: Optional event publisher for domain events
        """
        self.journal_entry_repo = journal_entry_repository
        self.fiscal_period_repo = fiscal_period_repository
        self.account_repo = account_repository
        self.balance_validator = balance_validator or BalanceValidator()
        self.event_publisher = event_publisher or InMemoryEventPublisher()

    async def post_entry(
        self,
        entry: JournalEntry,
        posted_by: str,
    ) -> PostingResult:
        """
        Post a journal entry, making it permanent.

        This operation:
        1. Validates the entry is complete and balanced
        2. Verifies the fiscal period allows posting
        3. Updates entry status to POSTED
        4. Updates affected account balances
        5. Returns the posted entry

        Args:
            entry: The journal entry to post
            posted_by: User ID of the person posting

        Returns:
            PostingResult with success status and posted entry

        Raises:
            InvariantViolationError: If entry is invalid
            PeriodClosedError: If fiscal period is closed
            EntityNotFoundError: If period or accounts not found
        """
        # Step 1: Validate the entry
        try:
            self.balance_validator.validate_entry_complete(entry)
        except Exception as e:
            return PostingResult(
                success=False,
                entry=entry,
                error_message=str(e),
            )

        # Step 2: Verify fiscal period
        period = await self.fiscal_period_repo.get_by_id(entry.fiscal_period_id)
        if period is None:
            raise EntityNotFoundError("FiscalPeriod", entry.fiscal_period_id)

        if not period.allows_posting:
            raise PeriodClosedError(period.period_key)

        # Step 3: Verify all accounts exist
        for line in entry.lines:
            account = await self.account_repo.get_by_id(line.account_id)
            if account is None:
                raise EntityNotFoundError("Account", line.account_id)

        # Step 4: Update entry status
        now = datetime.now(timezone.utc)
        entry.status = PostingStatus.POSTED
        entry.posted_at = now
        entry.posted_by = posted_by
        entry.update_totals()

        # Step 5: Save the entry
        entry = await self.journal_entry_repo.save(entry)

        # Step 6: Update account balances
        await self._update_account_balances(entry)

        # Step 7: Update period statistics
        await self._update_period_statistics(period, entry)

        # Step 8: Emit domain event for ecosystem integration
        await self._emit_journal_entry_posted(entry, posted_by)

        return PostingResult(
            success=True,
            entry=entry,
            posted_at=now,
        )

    async def create_reversal(
        self,
        original_entry_id: str,
        reversal_date,
        description: str,
        created_by: str,
    ) -> JournalEntry:
        """
        Create a reversing entry for a posted journal entry.

        A reversing entry has:
        - Opposite debits and credits
        - Reference to the original entry
        - New entry number

        Args:
            original_entry_id: ID of the entry to reverse
            reversal_date: Date for the reversing entry
            description: Description of why the reversal is being made
            created_by: User creating the reversal

        Returns:
            The new reversing entry (in DRAFT status)

        Raises:
            EntityNotFoundError: If original entry not found
            InvariantViolationError: If entry cannot be reversed
        """
        # Get original entry
        original = await self.journal_entry_repo.get_by_id(original_entry_id)
        if original is None:
            raise EntityNotFoundError("JournalEntry", original_entry_id)

        # Verify it can be reversed
        if not original.is_reversible:
            raise InvariantViolationError(
                invariant="ENTRY_REVERSIBLE",
                message=(
                    f"Entry {original.entry_number} cannot be reversed. "
                    f"Status: {original.status.value}, "
                    f"Already reversed: {original.reversed_by_id is not None}"
                ),
            )

        # Get fiscal period for reversal date
        period = await self.fiscal_period_repo.get_for_date(reversal_date)
        if period is None:
            raise EntityNotFoundError("FiscalPeriod", f"for date {reversal_date}")

        # Generate entry number
        entry_number = await self.journal_entry_repo.get_next_entry_number(
            reversal_date.year
        )

        # Create reversing entry with opposite lines
        reversal = JournalEntry(
            entry_number=entry_number,
            entry_date=reversal_date,
            fiscal_period_id=period.id,
            description=f"REVERSAL: {description}\nOriginal: {original.entry_number}",
            source_document=original.source_document,
            source_document_type="REVERSAL",
            status=PostingStatus.DRAFT,
            reversal_of_id=original.id,
            currency_code=original.currency_code,
            created_by=created_by,
        )

        # Create opposite lines
        for i, orig_line in enumerate(original.lines):
            reversal_line = JournalEntryLine(
                journal_entry_id=reversal.id,
                account_id=orig_line.account_id,
                entry_type=orig_line.entry_type.opposite,  # DEBIT becomes CREDIT
                amount=orig_line.amount,
                description=f"Reversal of: {orig_line.description or ''}",
                line_number=i,
            )
            reversal.lines.append(reversal_line)

        reversal.update_totals()

        return reversal

    # -------------------------------------------------------------------------
    # Private Methods
    # -------------------------------------------------------------------------

    async def _update_account_balances(self, entry: JournalEntry) -> None:
        """
        Update account balances based on entry lines.

        For each line:
        - DEBIT: Add to assets/expenses, subtract from liabilities/equity/revenue
        - CREDIT: Subtract from assets/expenses, add to liabilities/equity/revenue

        This is simplified to just add the signed amount since account.current_balance
        tracks the balance in natural form (positive for normal, negative for contra).
        """
        for line in entry.lines:
            # Signed amount: positive for debit, negative for credit
            signed_amount = line.signed_amount
            await self.account_repo.update_balance(line.account_id, signed_amount)

    async def _update_period_statistics(
        self, period: FiscalPeriodEntity, entry: JournalEntry
    ) -> None:
        """Update period's denormalized statistics."""
        period.total_debits += entry.total_debits
        period.total_credits += entry.total_credits
        period.entry_count += 1
        await self.fiscal_period_repo.save(period)

    async def _emit_journal_entry_posted(
        self, entry: JournalEntry, posted_by: str
    ) -> None:
        """
        Emit JournalEntryPosted domain event.

        This event notifies other services (Tax, Compliance, Banking)
        that a journal entry has been permanently recorded.
        """
        try:
            event = JournalEntryPosted(
                entry_id=entry.id,
                entry_number=entry.entry_number,
                entry_date=entry.entry_date.isoformat() if entry.entry_date else "",
                fiscal_period_id=entry.fiscal_period_id,
                total_debits=str(entry.total_debits),
                total_credits=str(entry.total_credits),
                currency_code=entry.currency_code,
                description=entry.description or "",
                posted_by=posted_by,
                metadata=EventMetadata(user_id=posted_by),
            )
            await self.event_publisher.publish(event)
            logger.info(
                "journal_entry_posted_event_emitted",
                entry_id=entry.id,
                entry_number=entry.entry_number,
                event_id=event.event_id,
            )
        except Exception as e:
            # Log but don't fail the posting - event publishing is best-effort
            logger.error(
                "journal_entry_posted_event_failed",
                entry_id=entry.id,
                error=str(e),
            )

    async def _emit_journal_entry_reversed(
        self,
        original: JournalEntry,
        reversal: JournalEntry,
        reversed_by: str,
        reason: str,
    ) -> None:
        """
        Emit JournalEntryReversed domain event.

        This event notifies other services that a reversal has occurred.
        """
        try:
            event = JournalEntryReversed(
                original_entry_id=original.id,
                original_entry_number=original.entry_number,
                reversal_entry_id=reversal.id,
                reversal_entry_number=reversal.entry_number,
                reversed_by=reversed_by,
                reason=reason,
                metadata=EventMetadata(user_id=reversed_by),
            )
            await self.event_publisher.publish(event)
            logger.info(
                "journal_entry_reversed_event_emitted",
                original_id=original.id,
                reversal_id=reversal.id,
                event_id=event.event_id,
            )
        except Exception as e:
            logger.error(
                "journal_entry_reversed_event_failed",
                original_id=original.id,
                error=str(e),
            )


# Import at bottom for type hints
from src.domain.chart_of_accounts.models.account import Account
