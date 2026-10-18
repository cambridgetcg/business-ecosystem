"""Receipt Repository - data access for receipts."""

from datetime import date
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_receivable.models.receipt import Receipt, ReceiptStatus


class ReceiptRepository:
    """Repository for Receipt entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, receipt_id: str) -> Receipt | None:
        stmt = select(Receipt).where(Receipt.id == receipt_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_number(self, receipt_number: str) -> Receipt | None:
        stmt = select(Receipt).where(Receipt.receipt_number == receipt_number)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, receipt: Receipt) -> Receipt:
        self.session.add(receipt)
        await self.session.flush()
        await self.session.refresh(receipt)
        return receipt

    async def save(self, receipt: Receipt) -> Receipt:
        self.session.add(receipt)
        await self.session.flush()
        await self.session.refresh(receipt)
        return receipt

    async def get_next_receipt_number(self, year: int) -> str:
        prefix = f"RCT-{year}-"
        stmt = select(func.max(Receipt.receipt_number)).where(
            Receipt.receipt_number.like(f"{prefix}%")
        )
        result = await self.session.execute(stmt)
        max_number = result.scalar_one_or_none()
        seq = int(max_number.split("-")[-1]) + 1 if max_number else 1
        return f"{prefix}{seq:05d}"

    async def list_receipts(
        self,
        customer_id: str | None = None,
        invoice_id: str | None = None,
        status: ReceiptStatus | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Receipt]:
        stmt = select(Receipt)
        if customer_id:
            stmt = stmt.where(Receipt.customer_id == customer_id)
        if invoice_id:
            stmt = stmt.where(Receipt.invoice_id == invoice_id)
        if status:
            stmt = stmt.where(Receipt.status == status)
        if date_from:
            stmt = stmt.where(Receipt.receipt_date >= date_from)
        if date_to:
            stmt = stmt.where(Receipt.receipt_date <= date_to)
        stmt = stmt.order_by(Receipt.receipt_date.desc()).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_receipts_for_invoice(self, invoice_id: str) -> Sequence[Receipt]:
        stmt = select(Receipt).where(Receipt.invoice_id == invoice_id).order_by(Receipt.receipt_date)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_pending_deposits(self) -> Sequence[Receipt]:
        return await self.list_receipts(status=ReceiptStatus.PENDING)
