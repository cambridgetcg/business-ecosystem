"""
FixedAssetRepository - data access for fixed assets.

Follows the repository pattern from general_ledger.
"""

from datetime import date
from decimal import Decimal
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.fixed_assets.entities.fixed_asset import (
    AssetStatus,
    DepreciationMethod,
    FixedAsset,
)
from src.domain.fixed_assets.entities.depreciation_schedule import (
    DepreciationEntryStatus,
    DepreciationSchedule,
)


class FixedAssetRepository:
    """
    Repository for FixedAsset entities.

    Provides CRUD operations and queries for fixed assets
    and their depreciation schedules.
    """

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the repository.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    # -------------------------------------------------------------------------
    # Fixed Asset CRUD
    # -------------------------------------------------------------------------

    async def get_by_id(self, asset_id: str) -> FixedAsset | None:
        """
        Get a fixed asset by ID.

        Args:
            asset_id: The asset ID

        Returns:
            The asset if found, None otherwise
        """
        stmt = select(FixedAsset).where(FixedAsset.id == asset_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_asset_number(self, asset_number: str) -> FixedAsset | None:
        """
        Get a fixed asset by its asset number.

        Args:
            asset_number: The human-readable asset number

        Returns:
            The asset if found, None otherwise
        """
        stmt = select(FixedAsset).where(FixedAsset.asset_number == asset_number)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, asset: FixedAsset) -> FixedAsset:
        """
        Add a new fixed asset.

        Args:
            asset: The asset to add

        Returns:
            The added asset with generated ID
        """
        self.session.add(asset)
        await self.session.flush()
        return asset

    async def update(self, asset: FixedAsset) -> FixedAsset:
        """
        Update an existing fixed asset.

        Args:
            asset: The asset to update

        Returns:
            The updated asset
        """
        await self.session.flush()
        return asset

    async def delete(self, asset: FixedAsset) -> None:
        """
        Delete a fixed asset.

        Args:
            asset: The asset to delete

        Note:
            Consider soft-delete for audit purposes.
        """
        await self.session.delete(asset)
        await self.session.flush()

    # -------------------------------------------------------------------------
    # Queries
    # -------------------------------------------------------------------------

    async def get_by_status(
        self,
        status: AssetStatus,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[FixedAsset]:
        """
        Get assets by status.

        Args:
            status: The asset status to filter by
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of assets with the specified status
        """
        stmt = (
            select(FixedAsset)
            .where(FixedAsset.status == status)
            .order_by(FixedAsset.asset_number)
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_category(
        self,
        category: str,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[FixedAsset]:
        """
        Get assets by category.

        Args:
            category: The asset category
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of assets in the specified category
        """
        stmt = (
            select(FixedAsset)
            .where(FixedAsset.category == category)
            .order_by(FixedAsset.asset_number)
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_depreciating_assets(self) -> Sequence[FixedAsset]:
        """
        Get all assets currently subject to depreciation.

        Returns:
            List of assets with IN_SERVICE status that are not fully depreciated
        """
        stmt = (
            select(FixedAsset)
            .where(FixedAsset.status == AssetStatus.IN_SERVICE)
            .order_by(FixedAsset.asset_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_assets_needing_depreciation(
        self,
        as_of_date: date,
    ) -> Sequence[FixedAsset]:
        """
        Get assets that need depreciation entries as of a date.

        Args:
            as_of_date: The date to check

        Returns:
            List of assets needing depreciation
        """
        stmt = (
            select(FixedAsset)
            .where(FixedAsset.status == AssetStatus.IN_SERVICE)
            .where(FixedAsset.depreciation_start_date <= as_of_date)
            .where(
                (FixedAsset.last_depreciation_date.is_(None))
                | (FixedAsset.last_depreciation_date < as_of_date)
            )
            .order_by(FixedAsset.asset_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_total_book_value(self) -> Decimal:
        """
        Get total book value of all in-service assets.

        Returns:
            Sum of book values
        """
        stmt = select(
            func.sum(
                FixedAsset.acquisition_cost - FixedAsset.accumulated_depreciation
            )
        ).where(FixedAsset.status == AssetStatus.IN_SERVICE)
        result = await self.session.execute(stmt)
        return result.scalar_one() or Decimal("0")

    async def get_by_account(self, account_id: str) -> Sequence[FixedAsset]:
        """
        Get all assets linked to a specific GL account.

        Args:
            account_id: The GL account ID

        Returns:
            List of assets using this account
        """
        stmt = (
            select(FixedAsset)
            .where(
                (FixedAsset.asset_account_id == account_id)
                | (FixedAsset.depreciation_expense_account_id == account_id)
                | (FixedAsset.accumulated_depreciation_account_id == account_id)
            )
            .order_by(FixedAsset.asset_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def generate_asset_number(self, year: int) -> str:
        """
        Generate the next asset number for a year.

        Args:
            year: The year for the asset number

        Returns:
            Next available asset number (e.g., "FA-2026-00001")
        """
        prefix = f"FA-{year}-"
        stmt = (
            select(func.max(FixedAsset.asset_number))
            .where(FixedAsset.asset_number.like(f"{prefix}%"))
        )
        result = await self.session.execute(stmt)
        last_number = result.scalar_one()

        if last_number:
            # Extract the sequence number and increment
            seq = int(last_number.split("-")[-1]) + 1
        else:
            seq = 1

        return f"{prefix}{seq:05d}"

    # -------------------------------------------------------------------------
    # Depreciation Schedule
    # -------------------------------------------------------------------------

    async def add_depreciation_schedule(
        self,
        entry: DepreciationSchedule,
    ) -> DepreciationSchedule:
        """
        Add a depreciation schedule entry.

        Args:
            entry: The schedule entry to add

        Returns:
            The added entry
        """
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def add_depreciation_schedules(
        self,
        entries: list[DepreciationSchedule],
    ) -> list[DepreciationSchedule]:
        """
        Add multiple depreciation schedule entries.

        Args:
            entries: The schedule entries to add

        Returns:
            The added entries
        """
        self.session.add_all(entries)
        await self.session.flush()
        return entries

    async def get_depreciation_schedule(
        self,
        asset_id: str,
    ) -> Sequence[DepreciationSchedule]:
        """
        Get the full depreciation schedule for an asset.

        Args:
            asset_id: The asset ID

        Returns:
            List of schedule entries in period order
        """
        stmt = (
            select(DepreciationSchedule)
            .where(DepreciationSchedule.asset_id == asset_id)
            .order_by(DepreciationSchedule.period_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_pending_depreciation_entries(
        self,
        asset_id: str,
        as_of_date: date,
    ) -> Sequence[DepreciationSchedule]:
        """
        Get pending depreciation entries up to a date.

        Args:
            asset_id: The asset ID
            as_of_date: Get entries through this date

        Returns:
            List of pending entries
        """
        stmt = (
            select(DepreciationSchedule)
            .where(DepreciationSchedule.asset_id == asset_id)
            .where(DepreciationSchedule.status == DepreciationEntryStatus.SCHEDULED)
            .where(DepreciationSchedule.period_end_date <= as_of_date)
            .order_by(DepreciationSchedule.period_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_next_pending_entry(
        self,
        asset_id: str,
    ) -> DepreciationSchedule | None:
        """
        Get the next pending depreciation entry for an asset.

        Args:
            asset_id: The asset ID

        Returns:
            The next pending entry, or None
        """
        stmt = (
            select(DepreciationSchedule)
            .where(DepreciationSchedule.asset_id == asset_id)
            .where(DepreciationSchedule.status == DepreciationEntryStatus.SCHEDULED)
            .order_by(DepreciationSchedule.period_number)
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
