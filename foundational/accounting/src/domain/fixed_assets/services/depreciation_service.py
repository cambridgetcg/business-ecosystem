"""
DepreciationService - Calculates and generates depreciation schedules.

Implements multiple depreciation methods as documented in PATH_MATERIAL.md:
- Straight-Line
- Declining Balance
- Double Declining Balance
- Sum-of-Years-Digits
- Units of Production

Research Grounding: docs/gaps/PATH_MATERIAL.md (Investopedia)
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Protocol

from dateutil.relativedelta import relativedelta

from src.domain.fixed_assets.entities.fixed_asset import (
    DepreciationMethod,
    FixedAsset,
)
from src.domain.fixed_assets.entities.depreciation_schedule import (
    DepreciationSchedule,
)


@dataclass(frozen=True)
class DepreciationCalculation:
    """Result of a depreciation calculation for a single period."""

    period_number: int
    period_start: date
    period_end: date
    depreciation_amount: Decimal
    cumulative_depreciation: Decimal
    remaining_book_value: Decimal


class DepreciationCalculator(Protocol):
    """Protocol for depreciation calculation strategies."""

    def calculate_period(
        self,
        asset: FixedAsset,
        period_number: int,
        period_start: date,
        period_end: date,
        prior_accumulated: Decimal,
    ) -> Decimal:
        """Calculate depreciation for a single period."""
        ...


class StraightLineCalculator:
    """
    Straight-line depreciation.

    Formula: (Cost - Salvage) / Useful Life

    Equal expense each period over the asset's useful life.
    """

    def calculate_period(
        self,
        asset: FixedAsset,
        period_number: int,
        period_start: date,
        period_end: date,
        prior_accumulated: Decimal,
    ) -> Decimal:
        """Calculate straight-line depreciation for a period."""
        if asset.useful_life_months == 0:
            return Decimal("0")

        monthly_depreciation = (
            asset.depreciable_base / asset.useful_life_months
        )

        # Cap at remaining depreciable amount
        remaining = asset.depreciable_base - prior_accumulated
        return min(
            monthly_depreciation.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            remaining,
        )


class DecliningBalanceCalculator:
    """
    Declining balance depreciation.

    Formula: Book Value × Rate

    Accelerated method with higher expense early, lower later.
    Default rate is 1.5x straight-line rate.
    """

    def __init__(self, rate_multiplier: Decimal = Decimal("1.5")) -> None:
        self.rate_multiplier = rate_multiplier

    def calculate_period(
        self,
        asset: FixedAsset,
        period_number: int,
        period_start: date,
        period_end: date,
        prior_accumulated: Decimal,
    ) -> Decimal:
        """Calculate declining balance depreciation for a period."""
        if asset.useful_life_months == 0:
            return Decimal("0")

        # Calculate annual rate
        annual_rate = (Decimal("1") / (asset.useful_life_months / 12)) * self.rate_multiplier
        monthly_rate = annual_rate / 12

        # Apply to current book value
        book_value = asset.acquisition_cost - prior_accumulated
        depreciation = book_value * monthly_rate

        # Don't depreciate below salvage value
        remaining = book_value - asset.salvage_value
        if remaining <= 0:
            return Decimal("0")

        return min(
            depreciation.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            remaining,
        )


class DoubleDecliningCalculator(DecliningBalanceCalculator):
    """
    Double declining balance depreciation.

    Formula: Book Value × (2 / Useful Life)

    More aggressive acceleration than standard declining balance.
    """

    def __init__(self) -> None:
        super().__init__(rate_multiplier=Decimal("2"))


class SumOfYearsCalculator:
    """
    Sum-of-years-digits depreciation.

    Formula: (Remaining Life / Sum of Years) × Depreciable Base

    Accelerated but smoother than declining balance methods.
    """

    def calculate_period(
        self,
        asset: FixedAsset,
        period_number: int,
        period_start: date,
        period_end: date,
        prior_accumulated: Decimal,
    ) -> Decimal:
        """Calculate sum-of-years depreciation for a period."""
        useful_years = asset.useful_life_months / 12

        # Sum of years digits: n + (n-1) + (n-2) + ... + 1 = n(n+1)/2
        sum_of_years = (useful_years * (useful_years + 1)) / 2

        # Calculate which year we're in (1-based)
        year_number = ((period_number - 1) // 12) + 1

        # Remaining years (counting down)
        remaining_years = useful_years - year_number + 1

        if remaining_years <= 0 or sum_of_years == 0:
            return Decimal("0")

        # Annual depreciation = (remaining_years / sum_of_years) × depreciable_base
        annual_depreciation = (
            Decimal(str(remaining_years)) / Decimal(str(sum_of_years))
        ) * asset.depreciable_base

        # Monthly amount
        monthly = annual_depreciation / 12

        # Cap at remaining
        remaining = asset.depreciable_base - prior_accumulated
        return min(
            monthly.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            remaining,
        )


class UnitsOfProductionCalculator:
    """
    Units of production depreciation.

    Formula: (Cost - Salvage) / Total Units × Units This Period

    Depreciation based on actual usage rather than time.
    """

    def __init__(self, units_this_period: int) -> None:
        self.units_this_period = units_this_period

    def calculate_period(
        self,
        asset: FixedAsset,
        period_number: int,
        period_start: date,
        period_end: date,
        prior_accumulated: Decimal,
    ) -> Decimal:
        """Calculate units of production depreciation."""
        if not asset.total_units or asset.total_units == 0:
            return Decimal("0")

        # Cost per unit
        cost_per_unit = asset.depreciable_base / asset.total_units

        # Depreciation = cost per unit × units this period
        depreciation = cost_per_unit * self.units_this_period

        # Cap at remaining
        remaining = asset.depreciable_base - prior_accumulated
        return min(
            depreciation.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            remaining,
        )


class DepreciationService:
    """
    Service for calculating depreciation and generating schedules.

    Usage:
        service = DepreciationService()

        # Generate full schedule for an asset
        schedule = service.generate_schedule(asset)

        # Calculate depreciation for a specific period
        amount = service.calculate_period_depreciation(
            asset,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 1, 31),
        )
    """

    def __init__(self) -> None:
        """Initialize the depreciation service."""
        self._calculators: dict[DepreciationMethod, DepreciationCalculator] = {
            DepreciationMethod.STRAIGHT_LINE: StraightLineCalculator(),
            DepreciationMethod.DECLINING_BALANCE: DecliningBalanceCalculator(),
            DepreciationMethod.DOUBLE_DECLINING: DoubleDecliningCalculator(),
            DepreciationMethod.SUM_OF_YEARS: SumOfYearsCalculator(),
            # Units of production is handled specially
        }

    def get_calculator(
        self,
        method: DepreciationMethod,
        units_this_period: int = 0,
    ) -> DepreciationCalculator:
        """
        Get the appropriate calculator for a depreciation method.

        Args:
            method: The depreciation method
            units_this_period: Units produced (for units of production method)

        Returns:
            The calculator instance
        """
        if method == DepreciationMethod.UNITS_OF_PRODUCTION:
            return UnitsOfProductionCalculator(units_this_period)
        return self._calculators[method]

    def calculate_period_depreciation(
        self,
        asset: FixedAsset,
        period_start: date,
        period_end: date,
        units_this_period: int = 0,
    ) -> Decimal:
        """
        Calculate depreciation for a specific period.

        Args:
            asset: The fixed asset
            period_start: Start of the period
            period_end: End of the period
            units_this_period: Units produced (for units of production)

        Returns:
            Depreciation amount for the period
        """
        if not asset.is_depreciating:
            return Decimal("0")

        calculator = self.get_calculator(
            asset.depreciation_method,
            units_this_period,
        )

        # Determine period number based on depreciation start date
        if asset.depreciation_start_date:
            months_elapsed = (
                (period_start.year - asset.depreciation_start_date.year) * 12
                + (period_start.month - asset.depreciation_start_date.month)
            )
            period_number = months_elapsed + 1
        else:
            period_number = 1

        return calculator.calculate_period(
            asset=asset,
            period_number=period_number,
            period_start=period_start,
            period_end=period_end,
            prior_accumulated=asset.accumulated_depreciation,
        )

    def generate_schedule(
        self,
        asset: FixedAsset,
    ) -> list[DepreciationCalculation]:
        """
        Generate a complete depreciation schedule for an asset.

        This calculates depreciation for each month of the asset's
        useful life, returning all planned entries.

        Args:
            asset: The fixed asset

        Returns:
            List of depreciation calculations for each period
        """
        if not asset.depreciation_start_date:
            return []

        calculator = self.get_calculator(asset.depreciation_method)
        schedule: list[DepreciationCalculation] = []
        cumulative = Decimal("0")
        current_date = asset.depreciation_start_date

        for period_num in range(1, asset.useful_life_months + 1):
            # Calculate period dates
            period_start = current_date
            period_end = (current_date + relativedelta(months=1)) - relativedelta(days=1)

            # Calculate depreciation
            depreciation = calculator.calculate_period(
                asset=asset,
                period_number=period_num,
                period_start=period_start,
                period_end=period_end,
                prior_accumulated=cumulative,
            )

            cumulative += depreciation
            book_value = asset.acquisition_cost - cumulative

            schedule.append(
                DepreciationCalculation(
                    period_number=period_num,
                    period_start=period_start,
                    period_end=period_end,
                    depreciation_amount=depreciation,
                    cumulative_depreciation=cumulative,
                    remaining_book_value=book_value,
                )
            )

            # Stop if fully depreciated
            if cumulative >= asset.depreciable_base:
                break

            # Move to next month
            current_date = current_date + relativedelta(months=1)

        return schedule

    def create_schedule_entries(
        self,
        asset: FixedAsset,
    ) -> list[DepreciationSchedule]:
        """
        Create DepreciationSchedule entities for an asset.

        Args:
            asset: The fixed asset

        Returns:
            List of DepreciationSchedule entities ready for persistence
        """
        calculations = self.generate_schedule(asset)

        return [
            DepreciationSchedule(
                asset_id=asset.id,
                period_number=calc.period_number,
                period_start_date=calc.period_start,
                period_end_date=calc.period_end,
                scheduled_amount=calc.depreciation_amount,
                cumulative_depreciation=calc.cumulative_depreciation,
                remaining_book_value=calc.remaining_book_value,
            )
            for calc in calculations
        ]

    def calculate_annual_depreciation(
        self,
        asset: FixedAsset,
        year: int,
    ) -> Decimal:
        """
        Calculate total depreciation for a calendar year.

        Args:
            asset: The fixed asset
            year: The calendar year

        Returns:
            Total depreciation for the year
        """
        schedule = self.generate_schedule(asset)
        return sum(
            (
                calc.depreciation_amount
                for calc in schedule
                if calc.period_start.year == year
            ),
            Decimal("0"),
        )
