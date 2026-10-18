"""Payment Repository - data access for payments."""

from datetime import date
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_payable.models.payment import Payment, PaymentStatus


class PaymentRepository:
    """Repository for Payment entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, payment_id: str) -> Payment | None:
        """Get a payment by ID."""
        stmt = select(Payment).where(Payment.id == payment_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_number(self, payment_number: str) -> Payment | None:
        """Get a payment by number."""
        stmt = select(Payment).where(Payment.payment_number == payment_number)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, payment: Payment) -> Payment:
        """Add a new payment."""
        self.session.add(payment)
        await self.session.flush()
        await self.session.refresh(payment)
        return payment

    async def save(self, payment: Payment) -> Payment:
        """Save a payment."""
        self.session.add(payment)
        await self.session.flush()
        await self.session.refresh(payment)
        return payment

    async def delete(self, payment: Payment) -> None:
        """Delete a draft payment."""
        if payment.status != PaymentStatus.DRAFT:
            raise ValueError(f"Cannot delete payment with status {payment.status.value}")
        await self.session.delete(payment)
        await self.session.flush()

    async def get_next_payment_number(self, year: int) -> str:
        """Generate the next payment number."""
        prefix = f"PAY-{year}-"
        stmt = select(func.max(Payment.payment_number)).where(
            Payment.payment_number.like(f"{prefix}%")
        )
        result = await self.session.execute(stmt)
        max_number = result.scalar_one_or_none()

        if max_number:
            seq = int(max_number.split("-")[-1]) + 1
        else:
            seq = 1

        return f"{prefix}{seq:05d}"

    async def list_payments(
        self,
        vendor_id: str | None = None,
        invoice_id: str | None = None,
        status: PaymentStatus | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Payment]:
        """List payments with filtering."""
        stmt = select(Payment)

        if vendor_id is not None:
            stmt = stmt.where(Payment.vendor_id == vendor_id)
        if invoice_id is not None:
            stmt = stmt.where(Payment.invoice_id == invoice_id)
        if status is not None:
            stmt = stmt.where(Payment.status == status)
        if date_from is not None:
            stmt = stmt.where(Payment.payment_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(Payment.payment_date <= date_to)

        stmt = (
            stmt
            .order_by(Payment.payment_date.desc(), Payment.payment_number.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_payments(
        self,
        vendor_id: str | None = None,
        status: PaymentStatus | None = None,
    ) -> int:
        """Count payments with filtering."""
        stmt = select(func.count(Payment.id))

        if vendor_id is not None:
            stmt = stmt.where(Payment.vendor_id == vendor_id)
        if status is not None:
            stmt = stmt.where(Payment.status == status)

        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_payments_for_invoice(self, invoice_id: str) -> Sequence[Payment]:
        """Get all payments applied to an invoice."""
        stmt = (
            select(Payment)
            .where(Payment.invoice_id == invoice_id)
            .order_by(Payment.payment_date)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_pending_payments(self) -> Sequence[Payment]:
        """Get all payments pending approval."""
        return await self.list_payments(status=PaymentStatus.PENDING)

    async def get_approved_payments(self) -> Sequence[Payment]:
        """Get all approved payments ready to send."""
        return await self.list_payments(status=PaymentStatus.APPROVED)
