"""
Period Service - manages fiscal period lifecycle.

Fiscal periods control when journal entries can be posted.
This service handles:
- Opening new periods
- Closing periods (irreversible)
- Validating period transitions

Research Grounding: docs/research/03-fiscal-period-management.md

AI Knowledge Gap (doc 09 - Temporal Knowledge Decay):
- Period dates and status are TIME-SENSITIVE
- System must use authoritative time source (database server time)
- AI should NOT determine "current period" - use system clock + configuration
"""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Protocol, Sequence
from calendar import monthrange

from src.domain.general_ledger.models.fiscal_period_entity import (
    FiscalPeriodEntity,
    PeriodStatus,
)
from src.domain.shared.exceptions import (
    InvariantViolationError,
    EntityNotFoundError,
    ValidationError,
)


class FiscalPeriodRepository(Protocol):
    """Protocol for fiscal period repository."""

    async def get_by_id(self, period_id: str) -> FiscalPeriodEntity | None:
        """Get a period by ID."""
        ...

    async def get_by_year_and_period(
        self, year: int, period_number: int
    ) -> FiscalPeriodEntity | None:
        """Get a specific period by year and number."""
        ...

    async def get_for_date(self, entry_date: date) -> FiscalPeriodEntity | None:
        """Get the period containing the given date."""
        ...

    async def get_open_periods(self) -> Sequence[FiscalPeriodEntity]:
        """Get all currently open periods."""
        ...

    async def get_periods_for_year(self, year: int) -> Sequence[FiscalPeriodEntity]:
        """Get all periods for a fiscal year."""
        ...

    async def save(self, period: FiscalPeriodEntity) -> FiscalPeriodEntity:
        """Save a period."""
        ...

    async def get_prior_period(
        self, year: int, period_number: int
    ) -> FiscalPeriodEntity | None:
        """Get the period immediately before the given one."""
        ...


@dataclass
class PeriodCreationResult:
    """Result of period creation."""

    success: bool
    period: FiscalPeriodEntity | None = None
    error_message: str | None = None


@dataclass
class PeriodClosingResult:
    """Result of period closing."""

    success: bool
    period: FiscalPeriodEntity | None = None
    closed_at: datetime | None = None
    validation_errors: list[str] | None = None
    error_message: str | None = None


class PeriodService:
    """
    Service for managing fiscal periods.

    Fiscal periods are the foundation of period-end reporting.
    Once closed, a period CANNOT be reopened (regulatory requirement).

    Key Operations:
    - Create periods for a fiscal year
    - Open a period for posting
    - Close a period (with validation)
    - Query period status
    """

    def __init__(self, period_repository: FiscalPeriodRepository) -> None:
        """
        Initialize the period service.

        Args:
            period_repository: Repository for fiscal periods
        """
        self.period_repo = period_repository

    async def create_year_periods(
        self,
        year: int,
        include_adjusting: bool = True,
        created_by: str | None = None,
    ) -> list[FiscalPeriodEntity]:
        """
        Create all periods for a fiscal year.

        Creates periods 1-12 (monthly) and optionally 13-15 (adjusting).
        All periods are created with FUTURE status.

        Args:
            year: The fiscal year to create periods for
            include_adjusting: Whether to create adjusting periods 13-15
            created_by: User creating the periods

        Returns:
            List of created periods

        Raises:
            InvariantViolationError: If periods already exist for this year
        """
        # Check if periods already exist
        existing = await self.period_repo.get_periods_for_year(year)
        if existing:
            raise InvariantViolationError(
                invariant="UNIQUE_YEAR_PERIODS",
                message=f"Periods already exist for year {year}",
            )

        periods = []

        # Create monthly periods (1-12)
        for month in range(1, 13):
            # Calculate start and end dates
            start_date = date(year, month, 1)
            _, last_day = monthrange(year, month)
            end_date = date(year, month, last_day)

            period = FiscalPeriodEntity(
                year=year,
                period_number=month,
                name=FiscalPeriodEntity.period_name_for(year, month),
                start_date=start_date,
                end_date=end_date,
                status=PeriodStatus.FUTURE,
                is_adjusting=False,
                created_by=created_by,
            )
            period = await self.period_repo.save(period)
            periods.append(period)

        # Create adjusting periods (13-15) if requested
        if include_adjusting:
            # Adjusting periods use the same date range as period 12
            dec_start = date(year, 12, 1)
            _, dec_last = monthrange(year, 12)
            dec_end = date(year, 12, dec_last)

            for adj_period in range(13, 16):
                period = FiscalPeriodEntity(
                    year=year,
                    period_number=adj_period,
                    name=FiscalPeriodEntity.period_name_for(year, adj_period),
                    start_date=dec_start,
                    end_date=dec_end,
                    status=PeriodStatus.FUTURE,
                    is_adjusting=True,
                    created_by=created_by,
                )
                period = await self.period_repo.save(period)
                periods.append(period)

        return periods

    async def open_period(
        self,
        year: int,
        period_number: int,
        opened_by: str,
    ) -> FiscalPeriodEntity:
        """
        Open a period for posting.

        Rules:
        - Period must be in FUTURE status
        - Prior period must be OPEN or CLOSED (not FUTURE)
        - First period of year can be opened if prior year's last period is closed

        Args:
            year: Fiscal year
            period_number: Period number to open
            opened_by: User opening the period

        Returns:
            The opened period

        Raises:
            EntityNotFoundError: If period doesn't exist
            InvariantViolationError: If period cannot be opened
        """
        period = await self.period_repo.get_by_year_and_period(year, period_number)
        if period is None:
            raise EntityNotFoundError("FiscalPeriod", f"{year}-P{period_number:02d}")

        # Must be in FUTURE status
        if period.status != PeriodStatus.FUTURE:
            raise InvariantViolationError(
                invariant="PERIOD_FUTURE_TO_OPEN",
                message=f"Period {period.period_key} is {period.status.value}, cannot open",
            )

        # Check prior period (unless this is period 1)
        if period_number > 1:
            prior = await self.period_repo.get_by_year_and_period(year, period_number - 1)
            if prior and prior.status == PeriodStatus.FUTURE:
                raise InvariantViolationError(
                    invariant="PRIOR_PERIOD_OPEN_OR_CLOSED",
                    message=f"Cannot open {period.period_key}: prior period {prior.period_key} is still FUTURE",
                )
        else:
            # Period 1: check prior year's last regular period
            prior_year_period = await self.period_repo.get_by_year_and_period(year - 1, 12)
            if prior_year_period and prior_year_period.status == PeriodStatus.FUTURE:
                raise InvariantViolationError(
                    invariant="PRIOR_YEAR_PERIOD_ACTIVE",
                    message=f"Cannot open {period.period_key}: prior year period {prior_year_period.period_key} is still FUTURE",
                )

        # Open the period
        period.status = PeriodStatus.OPEN
        period.updated_by = opened_by
        period = await self.period_repo.save(period)

        return period

    async def begin_closing(
        self,
        year: int,
        period_number: int,
        initiated_by: str,
    ) -> FiscalPeriodEntity:
        """
        Begin the closing process for a period.

        This puts the period in CLOSING status, which:
        - Blocks regular entries
        - Allows only adjustment entries
        - Signals that period-end procedures are in progress

        Args:
            year: Fiscal year
            period_number: Period number to begin closing
            initiated_by: User initiating closing

        Returns:
            The period in CLOSING status

        Raises:
            EntityNotFoundError: If period doesn't exist
            InvariantViolationError: If period cannot begin closing
        """
        period = await self.period_repo.get_by_year_and_period(year, period_number)
        if period is None:
            raise EntityNotFoundError("FiscalPeriod", f"{year}-P{period_number:02d}")

        if period.status != PeriodStatus.OPEN:
            raise InvariantViolationError(
                invariant="PERIOD_OPEN_TO_CLOSING",
                message=f"Period {period.period_key} is {period.status.value}, cannot begin closing",
            )

        period.status = PeriodStatus.CLOSING
        period.updated_by = initiated_by
        period = await self.period_repo.save(period)

        return period

    async def close_period(
        self,
        year: int,
        period_number: int,
        closed_by: str,
        closing_notes: str | None = None,
        force: bool = False,
    ) -> PeriodClosingResult:
        """
        Close a period permanently.

        WARNING: This is IRREVERSIBLE. Once closed, a period cannot be reopened.

        Validations:
        - Period must be OPEN or CLOSING
        - All prior periods must be CLOSED
        - Period totals must balance
        - Unless force=True, validation errors block closing

        Args:
            year: Fiscal year
            period_number: Period number to close
            closed_by: User closing the period
            closing_notes: Optional notes about the closing
            force: If True, close despite validation warnings

        Returns:
            PeriodClosingResult with success status

        Raises:
            EntityNotFoundError: If period doesn't exist
            InvariantViolationError: If period cannot be closed
        """
        period = await self.period_repo.get_by_year_and_period(year, period_number)
        if period is None:
            raise EntityNotFoundError("FiscalPeriod", f"{year}-P{period_number:02d}")

        # Must be OPEN or CLOSING
        if period.status not in (PeriodStatus.OPEN, PeriodStatus.CLOSING):
            raise InvariantViolationError(
                invariant="PERIOD_CLOSABLE_STATUS",
                message=f"Period {period.period_key} is {period.status.value}, cannot close",
            )

        # Check all prior periods are closed
        for prior_num in range(1, period_number):
            prior = await self.period_repo.get_by_year_and_period(year, prior_num)
            if prior and prior.status != PeriodStatus.CLOSED:
                raise InvariantViolationError(
                    invariant="PRIOR_PERIODS_CLOSED",
                    message=f"Cannot close {period.period_key}: prior period {prior.period_key} is not closed",
                )

        # Run validation checks
        validation_errors = period.validate_for_closing()

        if validation_errors and not force:
            return PeriodClosingResult(
                success=False,
                period=period,
                validation_errors=validation_errors,
                error_message="Period closing blocked by validation errors",
            )

        # Close the period
        now = datetime.now(timezone.utc)
        period.status = PeriodStatus.CLOSED
        period.closed_at = now
        period.closed_by = closed_by
        period.closing_notes = closing_notes
        period = await self.period_repo.save(period)

        return PeriodClosingResult(
            success=True,
            period=period,
            closed_at=now,
            validation_errors=validation_errors if validation_errors else None,
        )

    async def get_current_period(self) -> FiscalPeriodEntity | None:
        """
        Get the current open period based on system date.

        AI Knowledge Gap (doc 09): Uses system date, not AI inference.

        Returns:
            The currently open period, or None if no period is open
        """
        today = date.today()
        period = await self.period_repo.get_for_date(today)

        if period and period.is_open:
            return period

        # If the exact period isn't open, find any open period
        open_periods = await self.period_repo.get_open_periods()
        return open_periods[0] if open_periods else None

    async def get_posting_period_for_date(
        self, entry_date: date
    ) -> FiscalPeriodEntity | None:
        """
        Get the appropriate period for posting an entry with the given date.

        Returns the period only if it allows posting.

        Args:
            entry_date: The date of the journal entry

        Returns:
            The period if it allows posting, None otherwise
        """
        period = await self.period_repo.get_for_date(entry_date)

        if period and period.allows_posting:
            return period

        return None

    async def can_post_to_date(self, entry_date: date) -> bool:
        """
        Check if entries can be posted for the given date.

        Args:
            entry_date: The date to check

        Returns:
            True if posting is allowed for this date
        """
        period = await self.get_posting_period_for_date(entry_date)
        return period is not None
