"""
FixedAsset - Long-term tangible assets subject to depreciation.

This entity represents property, plant, and equipment (PP&E) that:
- Has a useful life > 1 year
- Is used in operations (not held for sale)
- Is subject to depreciation over its useful life

Design follows: src/domain/general_ledger/models/journal_entry.py

Research Grounding: docs/gaps/PATH_MATERIAL.md (Depreciation Methods)
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import Base, generate_ulid


class AssetStatus(str, Enum):
    """
    Lifecycle status of a fixed asset.
    """

    DRAFT = "DRAFT"  # Asset created but not yet in service
    IN_SERVICE = "IN_SERVICE"  # Active, depreciating
    FULLY_DEPRECIATED = "FULLY_DEPRECIATED"  # Reached end of useful life
    DISPOSED = "DISPOSED"  # Sold, scrapped, or otherwise removed
    IMPAIRED = "IMPAIRED"  # Value written down due to impairment


class DepreciationMethod(str, Enum):
    """
    Available depreciation calculation methods.

    Research: docs/gaps/PATH_MATERIAL.md (Investopedia)
    """

    STRAIGHT_LINE = "STRAIGHT_LINE"
    DECLINING_BALANCE = "DECLINING_BALANCE"
    DOUBLE_DECLINING = "DOUBLE_DECLINING"
    SUM_OF_YEARS = "SUM_OF_YEARS"
    UNITS_OF_PRODUCTION = "UNITS_OF_PRODUCTION"


class FixedAsset(Base):
    """
    A long-term tangible asset subject to depreciation.

    Represents PP&E (Property, Plant, and Equipment) items tracked
    for financial reporting. Each asset has:
    - Acquisition details (cost, date, vendor)
    - Depreciation parameters (method, useful life, salvage value)
    - Current state (accumulated depreciation, book value)
    - GL account references for proper posting

    Attributes:
        id: Unique identifier (ULID)
        asset_number: Human-readable identifier (e.g., "FA-2026-00001")
        name: Descriptive name of the asset
        description: Detailed description
        category: Asset category (e.g., "Equipment", "Vehicles", "Buildings")

        acquisition_date: Date the asset was acquired
        in_service_date: Date the asset was placed in service
        acquisition_cost: Original cost of the asset
        vendor_id: Reference to vendor if purchased
        purchase_invoice_id: Reference to AP invoice if applicable

        depreciation_method: Method used for depreciation calculation
        useful_life_months: Expected useful life in months
        salvage_value: Estimated value at end of useful life
        depreciation_start_date: When depreciation begins

        accumulated_depreciation: Total depreciation recorded to date
        book_value: Current book value (cost - accumulated depreciation)
        last_depreciation_date: Date of most recent depreciation entry

        asset_account_id: GL account for the asset (debit on acquisition)
        depreciation_expense_account_id: GL account for depreciation expense
        accumulated_depreciation_account_id: GL account for accumulated depreciation

        disposal_date: Date disposed (if applicable)
        disposal_amount: Amount received on disposal
        disposal_method: How disposed (SOLD, SCRAPPED, DONATED, etc.)

        status: Current lifecycle status
        metadata: Additional flexible data

        created_at: When record was created
        updated_at: When record was last updated
        created_by: User who created the record
    """

    __tablename__ = "fixed_assets"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=generate_ulid,
    )

    # Identification
    asset_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        comment="Human-readable identifier (e.g., FA-2026-00001)",
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Descriptive name of the asset",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed description",
    )
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Asset category (Equipment, Vehicles, Buildings, etc.)",
    )

    # Acquisition details
    acquisition_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date the asset was acquired",
    )
    in_service_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Date placed in service (depreciation may start here)",
    )
    acquisition_cost: Mapped[Decimal] = mapped_column(
        Numeric(19, 4),
        nullable=False,
        comment="Original cost of the asset",
    )
    vendor_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("vendors.id"),
        nullable=True,
        comment="Reference to vendor if purchased",
    )
    purchase_invoice_id: Mapped[str | None] = mapped_column(
        String(26),
        nullable=True,
        comment="Reference to AP invoice if applicable",
    )

    # Depreciation parameters
    depreciation_method: Mapped[DepreciationMethod] = mapped_column(
        SQLEnum(DepreciationMethod, native_enum=False),
        nullable=False,
        default=DepreciationMethod.STRAIGHT_LINE,
        comment="Method used for depreciation calculation",
    )
    useful_life_months: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Expected useful life in months",
    )
    salvage_value: Mapped[Decimal] = mapped_column(
        Numeric(19, 4),
        nullable=False,
        default=Decimal("0"),
        comment="Estimated value at end of useful life",
    )
    depreciation_start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="When depreciation begins",
    )

    # For units of production method
    total_units: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Total expected units (for units of production method)",
    )
    units_produced: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Units produced to date",
    )

    # Current depreciation state
    accumulated_depreciation: Mapped[Decimal] = mapped_column(
        Numeric(19, 4),
        nullable=False,
        default=Decimal("0"),
        comment="Total depreciation recorded to date",
    )
    last_depreciation_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Date of most recent depreciation entry",
    )

    # GL account references
    asset_account_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("accounts.id"),
        nullable=False,
        comment="GL account for the asset (e.g., 1500 Fixed Assets)",
    )
    depreciation_expense_account_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("accounts.id"),
        nullable=False,
        comment="GL account for depreciation expense",
    )
    accumulated_depreciation_account_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("accounts.id"),
        nullable=False,
        comment="GL account for accumulated depreciation (contra-asset)",
    )

    # Disposal details
    disposal_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Date disposed (if applicable)",
    )
    disposal_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(19, 4),
        nullable=True,
        comment="Amount received on disposal",
    )
    disposal_method: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="How disposed (SOLD, SCRAPPED, DONATED, TRADED)",
    )
    gain_loss_account_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("accounts.id"),
        nullable=True,
        comment="GL account for gain/loss on disposal",
    )

    # Status
    status: Mapped[AssetStatus] = mapped_column(
        SQLEnum(AssetStatus, native_enum=False),
        nullable=False,
        default=AssetStatus.DRAFT,
        comment="Current lifecycle status",
    )

    # Flexible metadata
    metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Additional flexible data (location, serial number, etc.)",
    )

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="User who created the record",
    )

    def __repr__(self) -> str:
        return (
            f"<FixedAsset("
            f"id={self.id}, "
            f"number={self.asset_number}, "
            f"name={self.name}, "
            f"status={self.status.value})>"
        )

    @property
    def book_value(self) -> Decimal:
        """Calculate current book value (cost - accumulated depreciation)."""
        return self.acquisition_cost - self.accumulated_depreciation

    @property
    def depreciable_base(self) -> Decimal:
        """Calculate the depreciable base (cost - salvage value)."""
        return self.acquisition_cost - self.salvage_value

    @property
    def is_fully_depreciated(self) -> bool:
        """Check if the asset has been fully depreciated."""
        return self.accumulated_depreciation >= self.depreciable_base

    @property
    def remaining_life_months(self) -> int:
        """Calculate remaining useful life in months."""
        if not self.depreciation_start_date or not self.last_depreciation_date:
            return self.useful_life_months

        from dateutil.relativedelta import relativedelta

        elapsed = relativedelta(self.last_depreciation_date, self.depreciation_start_date)
        elapsed_months = elapsed.years * 12 + elapsed.months
        return max(0, self.useful_life_months - elapsed_months)

    @property
    def is_depreciating(self) -> bool:
        """Check if the asset is currently subject to depreciation."""
        return (
            self.status == AssetStatus.IN_SERVICE
            and not self.is_fully_depreciated
        )

    def place_in_service(self, service_date: date) -> None:
        """
        Place the asset in service, starting depreciation.

        Args:
            service_date: Date the asset is placed in service
        """
        if self.status != AssetStatus.DRAFT:
            raise ValueError(
                f"Cannot place in service: asset is {self.status.value}"
            )

        self.in_service_date = service_date
        self.depreciation_start_date = service_date
        self.status = AssetStatus.IN_SERVICE

    def record_depreciation(
        self,
        amount: Decimal,
        depreciation_date: date,
    ) -> None:
        """
        Record a depreciation entry.

        Args:
            amount: Depreciation amount
            depreciation_date: Date of the depreciation
        """
        if not self.is_depreciating:
            raise ValueError("Asset is not currently depreciating")

        # Cap depreciation at remaining depreciable amount
        remaining = self.depreciable_base - self.accumulated_depreciation
        actual_amount = min(amount, remaining)

        self.accumulated_depreciation += actual_amount
        self.last_depreciation_date = depreciation_date

        if self.is_fully_depreciated:
            self.status = AssetStatus.FULLY_DEPRECIATED

    def dispose(
        self,
        disposal_date: date,
        disposal_amount: Decimal,
        disposal_method: str,
    ) -> Decimal:
        """
        Dispose of the asset.

        Args:
            disposal_date: Date of disposal
            disposal_amount: Amount received
            disposal_method: How disposed (SOLD, SCRAPPED, etc.)

        Returns:
            Gain or loss on disposal (positive = gain, negative = loss)
        """
        if self.status == AssetStatus.DISPOSED:
            raise ValueError("Asset is already disposed")

        self.disposal_date = disposal_date
        self.disposal_amount = disposal_amount
        self.disposal_method = disposal_method
        self.status = AssetStatus.DISPOSED

        # Calculate gain/loss
        gain_loss = disposal_amount - self.book_value
        return gain_loss

    def record_impairment(self, impairment_amount: Decimal) -> None:
        """
        Record an impairment loss.

        Args:
            impairment_amount: Amount of impairment
        """
        if impairment_amount > self.book_value:
            raise ValueError("Impairment cannot exceed book value")

        self.accumulated_depreciation += impairment_amount
        self.status = AssetStatus.IMPAIRED
