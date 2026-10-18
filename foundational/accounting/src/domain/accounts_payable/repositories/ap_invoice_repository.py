"""AP Invoice Repository - data access for AP invoices."""

from datetime import date
from decimal import Decimal
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.accounts_payable.models.ap_invoice import APInvoice, APInvoiceStatus


class APInvoiceRepository:
    """Repository for APInvoice entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, invoice_id: str) -> APInvoice | None:
        """Get an invoice by ID with lines."""
        stmt = (
            select(APInvoice)
            .options(selectinload(APInvoice.lines))
            .where(APInvoice.id == invoice_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_number(self, invoice_number: str) -> APInvoice | None:
        """Get an invoice by number."""
        stmt = (
            select(APInvoice)
            .options(selectinload(APInvoice.lines))
            .where(APInvoice.invoice_number == invoice_number)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, invoice: APInvoice) -> APInvoice:
        """Add a new invoice."""
        self.session.add(invoice)
        await self.session.flush()
        await self.session.refresh(invoice)
        return invoice

    async def save(self, invoice: APInvoice) -> APInvoice:
        """Save an invoice."""
        self.session.add(invoice)
        await self.session.flush()
        await self.session.refresh(invoice)
        return invoice

    async def delete(self, invoice: APInvoice) -> None:
        """Delete a draft invoice."""
        if invoice.status != APInvoiceStatus.DRAFT:
            raise ValueError(f"Cannot delete invoice with status {invoice.status.value}")
        await self.session.delete(invoice)
        await self.session.flush()

    async def get_next_invoice_number(self, year: int) -> str:
        """Generate the next invoice number."""
        prefix = f"AP-{year}-"
        stmt = select(func.max(APInvoice.invoice_number)).where(
            APInvoice.invoice_number.like(f"{prefix}%")
        )
        result = await self.session.execute(stmt)
        max_number = result.scalar_one_or_none()

        if max_number:
            seq = int(max_number.split("-")[-1]) + 1
        else:
            seq = 1

        return f"{prefix}{seq:05d}"

    async def list_invoices(
        self,
        vendor_id: str | None = None,
        status: APInvoiceStatus | None = None,
        due_date_from: date | None = None,
        due_date_to: date | None = None,
        overdue_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[APInvoice]:
        """List invoices with filtering."""
        stmt = select(APInvoice).options(selectinload(APInvoice.lines))

        if vendor_id is not None:
            stmt = stmt.where(APInvoice.vendor_id == vendor_id)
        if status is not None:
            stmt = stmt.where(APInvoice.status == status)
        if due_date_from is not None:
            stmt = stmt.where(APInvoice.due_date >= due_date_from)
        if due_date_to is not None:
            stmt = stmt.where(APInvoice.due_date <= due_date_to)
        if overdue_only:
            stmt = stmt.where(
                APInvoice.due_date < date.today(),
                APInvoice.status.in_([
                    APInvoiceStatus.APPROVED,
                    APInvoiceStatus.PARTIALLY_PAID,
                ]),
            )

        stmt = (
            stmt
            .order_by(APInvoice.due_date, APInvoice.invoice_number)
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_invoices(
        self,
        vendor_id: str | None = None,
        status: APInvoiceStatus | None = None,
    ) -> int:
        """Count invoices with filtering."""
        stmt = select(func.count(APInvoice.id))

        if vendor_id is not None:
            stmt = stmt.where(APInvoice.vendor_id == vendor_id)
        if status is not None:
            stmt = stmt.where(APInvoice.status == status)

        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_pending_invoices(self, vendor_id: str | None = None) -> Sequence[APInvoice]:
        """Get all invoices pending approval."""
        return await self.list_invoices(
            vendor_id=vendor_id,
            status=APInvoiceStatus.PENDING,
        )

    async def get_payable_invoices(self, vendor_id: str | None = None) -> Sequence[APInvoice]:
        """Get all invoices ready for payment."""
        stmt = (
            select(APInvoice)
            .options(selectinload(APInvoice.lines))
            .where(APInvoice.status.in_([
                APInvoiceStatus.APPROVED,
                APInvoiceStatus.PARTIALLY_PAID,
            ]))
        )
        if vendor_id:
            stmt = stmt.where(APInvoice.vendor_id == vendor_id)

        stmt = stmt.order_by(APInvoice.due_date)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_total_outstanding(self, vendor_id: str | None = None) -> Decimal:
        """Get total outstanding AP amount."""
        stmt = select(
            func.coalesce(
                func.sum(APInvoice.total_amount - APInvoice.amount_paid),
                Decimal("0"),
            )
        ).where(APInvoice.status.in_([
            APInvoiceStatus.APPROVED,
            APInvoiceStatus.PARTIALLY_PAID,
        ]))

        if vendor_id:
            stmt = stmt.where(APInvoice.vendor_id == vendor_id)

        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_overdue_total(self) -> Decimal:
        """Get total overdue AP amount."""
        stmt = select(
            func.coalesce(
                func.sum(APInvoice.total_amount - APInvoice.amount_paid),
                Decimal("0"),
            )
        ).where(
            APInvoice.due_date < date.today(),
            APInvoice.status.in_([
                APInvoiceStatus.APPROVED,
                APInvoiceStatus.PARTIALLY_PAID,
            ]),
        )

        result = await self.session.execute(stmt)
        return result.scalar_one()
