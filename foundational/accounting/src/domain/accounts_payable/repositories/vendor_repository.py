"""Vendor Repository - data access for vendors."""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_payable.models.vendor import Vendor, VendorStatus


class VendorRepository:
    """Repository for Vendor entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, vendor_id: str) -> Vendor | None:
        """Get a vendor by ID."""
        stmt = select(Vendor).where(
            Vendor.id == vendor_id,
            Vendor.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Vendor | None:
        """Get a vendor by code."""
        stmt = select(Vendor).where(
            Vendor.code == code,
            Vendor.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, vendor: Vendor) -> Vendor:
        """Add a new vendor."""
        self.session.add(vendor)
        await self.session.flush()
        await self.session.refresh(vendor)
        return vendor

    async def save(self, vendor: Vendor) -> Vendor:
        """Save a vendor."""
        self.session.add(vendor)
        await self.session.flush()
        await self.session.refresh(vendor)
        return vendor

    async def delete(self, vendor: Vendor) -> None:
        """Soft delete a vendor."""
        from datetime import datetime
        vendor.deleted_at = datetime.utcnow()
        await self.session.flush()

    async def get_next_code(self) -> str:
        """Generate the next vendor code."""
        stmt = select(func.max(Vendor.code)).where(
            Vendor.code.like("V-%")
        )
        result = await self.session.execute(stmt)
        max_code = result.scalar_one_or_none()

        if max_code:
            seq = int(max_code.split("-")[1]) + 1
        else:
            seq = 1

        return f"V-{seq:04d}"

    async def list_vendors(
        self,
        status: VendorStatus | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Vendor]:
        """List vendors with filtering."""
        stmt = select(Vendor).where(Vendor.deleted_at.is_(None))

        if status is not None:
            stmt = stmt.where(Vendor.status == status)

        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                (Vendor.name.ilike(search_pattern)) |
                (Vendor.code.ilike(search_pattern))
            )

        stmt = stmt.order_by(Vendor.name).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_vendors(
        self,
        status: VendorStatus | None = None,
    ) -> int:
        """Count vendors with filtering."""
        stmt = select(func.count(Vendor.id)).where(Vendor.deleted_at.is_(None))

        if status is not None:
            stmt = stmt.where(Vendor.status == status)

        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_vendors_with_balance(self) -> Sequence[Vendor]:
        """Get all vendors with outstanding balance."""
        from decimal import Decimal
        stmt = (
            select(Vendor)
            .where(Vendor.deleted_at.is_(None))
            .where(Vendor.current_balance > Decimal("0"))
            .order_by(Vendor.current_balance.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
