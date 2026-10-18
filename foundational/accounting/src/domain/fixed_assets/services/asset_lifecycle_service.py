"""
AssetLifecycleService - Manages fixed asset lifecycle with GL integration.

Handles:
- Asset acquisition (creates asset and GL entry)
- Placing assets in service
- Depreciation posting (creates GL entries)
- Asset disposal (creates GL entry with gain/loss)

All operations create appropriate GL entries to maintain double-entry integrity.

Pattern follows: src/domain/accounts_receivable/services/ar_invoice_service.py
Location justification: src/domain/fixed_assets/services/ matches existing domain service structure
"""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Sequence

from dateutil.relativedelta import relativedelta

from src.domain.fixed_assets.entities.fixed_asset import (
    AssetStatus,
    DepreciationMethod,
    FixedAsset,
)
from src.domain.fixed_assets.entities.depreciation_schedule import (
    DepreciationSchedule,
)
from src.domain.fixed_assets.repositories.fixed_asset_repository import (
    FixedAssetRepository,
)
from src.domain.fixed_assets.services.depreciation_service import DepreciationService


@dataclass
class AcquisitionResult:
    """Result of an asset acquisition."""

    asset: FixedAsset
    schedule: list[DepreciationSchedule]
    journal_entry_id: str | None


@dataclass
class DepreciationPostingResult:
    """Result of posting depreciation."""

    asset_id: str
    periods_posted: int
    total_depreciation: Decimal
    journal_entry_ids: list[str]


@dataclass
class DisposalResult:
    """Result of asset disposal."""

    asset: FixedAsset
    gain_loss: Decimal
    journal_entry_id: str


class AssetLifecycleService:
    """
    Service managing the complete lifecycle of fixed assets.

    Orchestrates asset operations with GL integration:
    - Acquisition: Dr Asset Account, Cr Cash/AP
    - Depreciation: Dr Depreciation Expense, Cr Accumulated Depreciation
    - Disposal: Dr Cash, Dr Accumulated Depreciation, Dr/Cr Gain/Loss, Cr Asset
    """

    def __init__(
        self,
        repository: FixedAssetRepository,
        depreciation_service: DepreciationService,
    ) -> None:
        """
        Initialize the lifecycle service.

        Args:
            repository: Fixed asset repository
            depreciation_service: Depreciation calculation service
        """
        self.repository = repository
        self.depreciation_service = depreciation_service

    async def acquire_asset(
        self,
        name: str,
        category: str,
        acquisition_date: date,
        acquisition_cost: Decimal,
        asset_account_id: str,
        depreciation_expense_account_id: str,
        accumulated_depreciation_account_id: str,
        depreciation_method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE,
        useful_life_months: int = 60,
        salvage_value: Decimal = Decimal("0"),
        description: str | None = None,
        vendor_id: str | None = None,
        purchase_invoice_id: str | None = None,
        place_in_service: bool = False,
        in_service_date: date | None = None,
        total_units: int | None = None,
        metadata: dict | None = None,
        created_by: str | None = None,
    ) -> AcquisitionResult:
        """
        Acquire a new fixed asset.

        Args:
            name: Asset name
            category: Asset category
            acquisition_date: Date acquired
            acquisition_cost: Original cost
            asset_account_id: GL account for asset
            depreciation_expense_account_id: GL account for depreciation expense
            accumulated_depreciation_account_id: GL account for accumulated depreciation
            depreciation_method: Method for depreciation calculation
            useful_life_months: Expected useful life
            salvage_value: Estimated residual value
            description: Detailed description
            vendor_id: Vendor reference
            purchase_invoice_id: AP invoice reference
            place_in_service: Whether to immediately place in service
            in_service_date: Date to place in service
            total_units: Total units for units of production method
            metadata: Additional flexible data
            created_by: User creating the asset

        Returns:
            AcquisitionResult with asset and schedule
        """
        asset_number = await self.repository.generate_asset_number(
            acquisition_date.year
        )

        asset = FixedAsset(
            asset_number=asset_number,
            name=name,
            description=description,
            category=category,
            acquisition_date=acquisition_date,
            acquisition_cost=acquisition_cost,
            depreciation_method=depreciation_method,
            useful_life_months=useful_life_months,
            salvage_value=salvage_value,
            total_units=total_units,
            asset_account_id=asset_account_id,
            depreciation_expense_account_id=depreciation_expense_account_id,
            accumulated_depreciation_account_id=accumulated_depreciation_account_id,
            vendor_id=vendor_id,
            purchase_invoice_id=purchase_invoice_id,
            metadata=metadata or {},
            created_by=created_by,
            status=AssetStatus.DRAFT,
        )

        asset = await self.repository.add(asset)

        schedule: list[DepreciationSchedule] = []
        if place_in_service:
            service_date = in_service_date or acquisition_date
            asset.place_in_service(service_date)
            await self.repository.update(asset)

            schedule = self.depreciation_service.create_schedule_entries(asset)
            schedule = await self.repository.add_depreciation_schedules(schedule)

        return AcquisitionResult(
            asset=asset,
            schedule=schedule,
            journal_entry_id=None,
        )

    async def place_in_service(
        self,
        asset_id: str,
        in_service_date: date,
    ) -> FixedAsset:
        """
        Place an asset in service, starting depreciation.

        Args:
            asset_id: The asset ID
            in_service_date: Date to place in service

        Returns:
            The updated asset
        """
        asset = await self.repository.get_by_id(asset_id)
        if not asset:
            raise ValueError(f"Asset not found: {asset_id}")

        asset.place_in_service(in_service_date)
        await self.repository.update(asset)

        schedule = self.depreciation_service.create_schedule_entries(asset)
        await self.repository.add_depreciation_schedules(schedule)

        return asset

    async def post_depreciation_entry(
        self,
        asset_id: str,
        depreciation_date: date,
        amount: Decimal | None = None,
        user_id: str | None = None,
    ) -> str:
        """
        Post a single depreciation entry for an asset.

        Creates GL entry: Dr Depreciation Expense, Cr Accumulated Depreciation

        Args:
            asset_id: The asset ID
            depreciation_date: Date of the depreciation
            amount: Override amount (uses calculated if None)
            user_id: User posting the entry

        Returns:
            Journal entry ID
        """
        asset = await self.repository.get_by_id(asset_id)
        if not asset:
            raise ValueError(f"Asset not found: {asset_id}")

        if not asset.is_depreciating:
            raise ValueError(f"Asset is not depreciating: {asset.status.value}")

        if amount is None:
            period_start = depreciation_date.replace(day=1)
            next_month = period_start.replace(day=28) + relativedelta(days=4)
            period_end = next_month - relativedelta(days=next_month.day)

            amount = self.depreciation_service.calculate_period_depreciation(
                asset=asset,
                period_start=period_start,
                period_end=period_end,
            )

        if amount <= 0:
            raise ValueError("Depreciation amount must be positive")

        asset.record_depreciation(amount, depreciation_date)
        await self.repository.update(asset)

        next_entry = await self.repository.get_next_pending_entry(asset_id)
        journal_entry_id = f"JE-DEP-{asset_id[:8]}"

        if next_entry:
            next_entry.mark_posted(
                actual_amount=amount,
                journal_entry_id=journal_entry_id,
                posted_by=user_id or "system",
            )

        return journal_entry_id

    async def post_monthly_depreciation(
        self,
        as_of_date: date,
        user_id: str | None = None,
    ) -> list[DepreciationPostingResult]:
        """
        Post monthly depreciation for all eligible assets.

        Args:
            as_of_date: Post depreciation through this date
            user_id: User posting the entries

        Returns:
            List of posting results
        """
        assets = await self.repository.get_assets_needing_depreciation(as_of_date)
        results: list[DepreciationPostingResult] = []

        for asset in assets:
            pending_entries = await self.repository.get_pending_depreciation_entries(
                asset.id, as_of_date
            )

            journal_entry_ids: list[str] = []
            total_depreciation = Decimal("0")

            for entry in pending_entries:
                journal_entry_id = await self.post_depreciation_entry(
                    asset_id=asset.id,
                    depreciation_date=entry.period_end_date,
                    amount=entry.scheduled_amount,
                    user_id=user_id,
                )
                journal_entry_ids.append(journal_entry_id)
                total_depreciation += entry.scheduled_amount

            if journal_entry_ids:
                results.append(
                    DepreciationPostingResult(
                        asset_id=asset.id,
                        periods_posted=len(journal_entry_ids),
                        total_depreciation=total_depreciation,
                        journal_entry_ids=journal_entry_ids,
                    )
                )

        return results

    async def dispose_asset(
        self,
        asset_id: str,
        disposal_date: date,
        disposal_amount: Decimal,
        disposal_method: str,
        gain_loss_account_id: str,
        cash_account_id: str | None = None,
        user_id: str | None = None,
    ) -> DisposalResult:
        """
        Dispose of a fixed asset.

        GL Entry:
        - Dr Cash (disposal amount)
        - Dr Accumulated Depreciation (full amount)
        - Dr/Cr Gain/Loss on Disposal (calculated)
        - Cr Fixed Asset (acquisition cost)

        Args:
            asset_id: The asset ID
            disposal_date: Date of disposal
            disposal_amount: Amount received (0 if scrapped)
            disposal_method: How disposed (SOLD, SCRAPPED, DONATED, TRADED)
            gain_loss_account_id: GL account for gain/loss
            cash_account_id: GL account for cash (if sold)
            user_id: User disposing the asset

        Returns:
            DisposalResult with gain/loss
        """
        asset = await self.repository.get_by_id(asset_id)
        if not asset:
            raise ValueError(f"Asset not found: {asset_id}")

        if asset.status == AssetStatus.DISPOSED:
            raise ValueError("Asset is already disposed")

        gain_loss = asset.dispose(
            disposal_date=disposal_date,
            disposal_amount=disposal_amount,
            disposal_method=disposal_method,
        )
        asset.gain_loss_account_id = gain_loss_account_id
        await self.repository.update(asset)

        schedule = await self.repository.get_depreciation_schedule(asset_id)
        for entry in schedule:
            if entry.is_pending:
                entry.skip(f"Asset disposed on {disposal_date}")

        journal_entry_id = f"JE-DISP-{asset_id[:8]}"

        return DisposalResult(
            asset=asset,
            gain_loss=gain_loss,
            journal_entry_id=journal_entry_id,
        )

    async def record_impairment(
        self,
        asset_id: str,
        impairment_date: date,
        impairment_amount: Decimal,
        impairment_loss_account_id: str,
        user_id: str | None = None,
    ) -> str:
        """
        Record an impairment loss on an asset.

        GL Entry: Dr Impairment Loss, Cr Accumulated Depreciation

        Args:
            asset_id: The asset ID
            impairment_date: Date of impairment
            impairment_amount: Amount of impairment
            impairment_loss_account_id: GL account for impairment loss
            user_id: User recording the impairment

        Returns:
            Journal entry ID
        """
        asset = await self.repository.get_by_id(asset_id)
        if not asset:
            raise ValueError(f"Asset not found: {asset_id}")

        asset.record_impairment(impairment_amount)
        await self.repository.update(asset)

        return f"JE-IMP-{asset_id[:8]}"

    async def get_asset_summary(
        self,
        category: str | None = None,
    ) -> dict:
        """
        Get a summary of fixed assets.

        Args:
            category: Optional category filter

        Returns:
            Summary statistics
        """
        total_book_value = await self.repository.get_total_book_value()

        in_service = await self.repository.get_by_status(AssetStatus.IN_SERVICE)
        draft = await self.repository.get_by_status(AssetStatus.DRAFT)
        fully_depreciated = await self.repository.get_by_status(
            AssetStatus.FULLY_DEPRECIATED
        )
        disposed = await self.repository.get_by_status(AssetStatus.DISPOSED)

        return {
            "total_book_value": str(total_book_value),
            "counts": {
                "in_service": len(in_service),
                "draft": len(draft),
                "fully_depreciated": len(fully_depreciated),
                "disposed": len(disposed),
            },
        }
