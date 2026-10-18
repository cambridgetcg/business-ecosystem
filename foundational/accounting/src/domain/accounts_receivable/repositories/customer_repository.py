"""Customer Repository - data access for customers."""

from decimal import Decimal
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_receivable.models.customer import Customer, CustomerStatus


class CustomerRepository:
    """Repository for Customer entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, customer_id: str) -> Customer | None:
        stmt = select(Customer).where(
            Customer.id == customer_id,
            Customer.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Customer | None:
        stmt = select(Customer).where(
            Customer.code == code,
            Customer.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, customer: Customer) -> Customer:
        self.session.add(customer)
        await self.session.flush()
        await self.session.refresh(customer)
        return customer

    async def save(self, customer: Customer) -> Customer:
        self.session.add(customer)
        await self.session.flush()
        await self.session.refresh(customer)
        return customer

    async def get_next_code(self) -> str:
        stmt = select(func.max(Customer.code)).where(Customer.code.like("C-%"))
        result = await self.session.execute(stmt)
        max_code = result.scalar_one_or_none()
        seq = int(max_code.split("-")[1]) + 1 if max_code else 1
        return f"C-{seq:04d}"

    async def list_customers(
        self,
        status: CustomerStatus | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Customer]:
        stmt = select(Customer).where(Customer.deleted_at.is_(None))
        if status:
            stmt = stmt.where(Customer.status == status)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                (Customer.name.ilike(pattern)) | (Customer.code.ilike(pattern))
            )
        stmt = stmt.order_by(Customer.name).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_customers(self, status: CustomerStatus | None = None) -> int:
        stmt = select(func.count(Customer.id)).where(Customer.deleted_at.is_(None))
        if status:
            stmt = stmt.where(Customer.status == status)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_customers_with_balance(self) -> Sequence[Customer]:
        stmt = (
            select(Customer)
            .where(Customer.deleted_at.is_(None))
            .where(Customer.current_balance > Decimal("0"))
            .order_by(Customer.current_balance.desc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
