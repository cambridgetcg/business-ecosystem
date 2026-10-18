"""AR Invoice Repository - data access for AR invoices."""

from datetime import date
from decimal import Decimal
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.domain.accounts_receivable.models.ar_invoice import ARInvoice, ARInvoiceStatus


class ARInvoiceRepository:
    """Repository for ARInvoice entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, invoice_id: str) -> ARInvoice | None:
        stmt = (
            select(ARInvoice)
            .options(selectinload(ARInvoice.lines))
            .where(ARInvoice.id == invoice_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_number(self, invoice_number: str) -> ARInvoice | None:
        stmt = (
            select(ARInvoice)
            .options(selectinload(ARInvoice.lines))
            .where(ARInvoice.invoice_number == invoice_number)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, invoice: ARInvoice) -> ARInvoice:
        self.session.add(invoice)
        await self.session.flush()
        await self.session.refresh(invoice)
        return invoice

    async def save(self, invoice: ARInvoice) -> ARInvoice:
        self.session.add(invoice)
        await self.session.flush()
        await self.session.refresh(invoice)
        return invoice

    async def get_next_invoice_number(self, year: int) -> str:
        prefix = f"INV-{year}-"
        stmt = select(func.max(ARInvoice.invoice_number)).where(
            ARInvoice.invoice_number.like(f"{prefix}%")
        )
        result = await self.session.execute(stmt)
        max_number = result.scalar_one_or_none()
        seq = int(max_number.split("-")[-1]) + 1 if max_number else 1
        return f"{prefix}{seq:05d}"

    async def list_invoices(
        self,
        customer_id: str | None = None,
        status: ARInvoiceStatus | None = None,
        overdue_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[ARInvoice]:
        stmt = select(ARInvoice).options(selectinload(ARInvoice.lines))
        if customer_id:
            stmt = stmt.where(ARInvoice.customer_id == customer_id)
        if status:
            stmt = stmt.where(ARInvoice.status == status)
        if overdue_only:
            stmt = stmt.where(
                ARInvoice.due_date < date.today(),
                ARInvoice.status.in_([ARInvoiceStatus.SENT, ARInvoiceStatus.PARTIALLY_PAID]),
            )
        stmt = stmt.order_by(ARInvoice.due_date).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_total_outstanding(self, customer_id: str | None = None) -> Decimal:
        stmt = select(
            func.coalesce(
                func.sum(ARInvoice.total_amount - ARInvoice.amount_received),
                Decimal("0"),
            )
        ).where(ARInvoice.status.in_([ARInvoiceStatus.SENT, ARInvoiceStatus.PARTIALLY_PAID]))
        if customer_id:
            stmt = stmt.where(ARInvoice.customer_id == customer_id)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_overdue_total(self) -> Decimal:
        stmt = select(
            func.coalesce(
                func.sum(ARInvoice.total_amount - ARInvoice.amount_received),
                Decimal("0"),
            )
        ).where(
            ARInvoice.due_date < date.today(),
            ARInvoice.status.in_([ARInvoiceStatus.SENT, ARInvoiceStatus.PARTIALLY_PAID]),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()
