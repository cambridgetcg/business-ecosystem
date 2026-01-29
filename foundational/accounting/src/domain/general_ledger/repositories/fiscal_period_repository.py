"""
Fiscal Period Repository - data access for fiscal periods.

Follows the repository pattern from chart_of_accounts.
"""

from datetime import date
from typing import Sequence

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.general_ledger.models.fiscal_period_entity import (
    FiscalPeriodEntity,
    PeriodStatus,
)


class FiscalPeriodRepository:
    """
    Repository for FiscalPeriodEntity.

    Provides CRUD operations and queries for fiscal periods.
    """

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the repository.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    async def get_by_id(self, period_id: str) -> FiscalPeriodEntity | None:
        """
        Get a fiscal period by ID.

        Args:
            period_id: The period ID

        Returns:
            The period if found, None otherwise
        """
        stmt = select(FiscalPeriodEntity).where(FiscalPeriodEntity.id == period_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_year_and_period(
        self, year: int, period_number: int
    ) -> FiscalPeriodEntity | None:
        """
        Get a specific period by year and number.

        Args:
            year: Fiscal year
            period_number: Period number (1-15)

        Returns:
            The period if found, None otherwise
        """
        stmt = select(FiscalPeriodEntity).where(
            and_(
                FiscalPeriodEntity.year == year,
                FiscalPeriodEntity.period_number == period_number,
                FiscalPeriodEntity.is_deleted == False,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_for_date(self, entry_date: date) -> FiscalPeriodEntity | None:
        """
        Get the period containing the given date.

        Only returns non-adjusting periods (1-12).

        Args:
            entry_date: The date to look up

        Returns:
            The period if found, None otherwise
        """
        stmt = select(FiscalPeriodEntity).where(
            and_(
                FiscalPeriodEntity.start_date <= entry_date,
                FiscalPeriodEntity.end_date >= entry_date,
                FiscalPeriodEntity.is_adjusting == False,
                FiscalPeriodEntity.is_deleted == False,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def save(self, period: FiscalPeriodEntity) -> FiscalPeriodEntity:
        """
        Save a fiscal period.

        Args:
            period: The period to save

        Returns:
            The saved period
        """
        self.session.add(period)
        await self.session.flush()
        await self.session.refresh(period)
        return period

    async def get_open_periods(self) -> Sequence[FiscalPeriodEntity]:
        """
        Get all currently open periods.

        Returns:
            List of open periods
        """
        stmt = (
            select(FiscalPeriodEntity)
            .where(
                and_(
                    FiscalPeriodEntity.status == PeriodStatus.OPEN,
                    FiscalPeriodEntity.is_deleted == False,
                )
            )
            .order_by(FiscalPeriodEntity.year, FiscalPeriodEntity.period_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_periods_for_year(self, year: int) -> Sequence[FiscalPeriodEntity]:
        """
        Get all periods for a fiscal year.

        Args:
            year: Fiscal year

        Returns:
            List of periods for the year
        """
        stmt = (
            select(FiscalPeriodEntity)
            .where(
                and_(
                    FiscalPeriodEntity.year == year,
                    FiscalPeriodEntity.is_deleted == False,
                )
            )
            .order_by(FiscalPeriodEntity.period_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_prior_period(
        self, year: int, period_number: int
    ) -> FiscalPeriodEntity | None:
        """
        Get the period immediately before the given one.

        Args:
            year: Fiscal year
            period_number: Current period number

        Returns:
            The prior period if it exists
        """
        if period_number > 1:
            return await self.get_by_year_and_period(year, period_number - 1)
        else:
            # Prior period is last period of previous year
            return await self.get_by_year_and_period(year - 1, 12)

    async def get_latest_closed_period(self) -> FiscalPeriodEntity | None:
        """
        Get the most recently closed period.

        Returns:
            The most recent closed period
        """
        stmt = (
            select(FiscalPeriodEntity)
            .where(
                and_(
                    FiscalPeriodEntity.status == PeriodStatus.CLOSED,
                    FiscalPeriodEntity.is_deleted == False,
                )
            )
            .order_by(
                FiscalPeriodEntity.year.desc(),
                FiscalPeriodEntity.period_number.desc(),
            )
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_periods_by_status(
        self, status: PeriodStatus
    ) -> Sequence[FiscalPeriodEntity]:
        """
        Get all periods with a specific status.

        Args:
            status: The status to filter by

        Returns:
            List of periods with that status
        """
        stmt = (
            select(FiscalPeriodEntity)
            .where(
                and_(
                    FiscalPeriodEntity.status == status,
                    FiscalPeriodEntity.is_deleted == False,
                )
            )
            .order_by(FiscalPeriodEntity.year, FiscalPeriodEntity.period_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_adjusting_periods_for_year(
        self, year: int
    ) -> Sequence[FiscalPeriodEntity]:
        """
        Get adjusting periods (13-15) for a year.

        Args:
            year: Fiscal year

        Returns:
            List of adjusting periods
        """
        stmt = (
            select(FiscalPeriodEntity)
            .where(
                and_(
                    FiscalPeriodEntity.year == year,
                    FiscalPeriodEntity.is_adjusting == True,
                    FiscalPeriodEntity.is_deleted == False,
                )
            )
            .order_by(FiscalPeriodEntity.period_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
