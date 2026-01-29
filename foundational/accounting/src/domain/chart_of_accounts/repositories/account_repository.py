"""
Account repository - data access for Account entities.

Implements the Repository pattern for clean separation between
domain logic and data persistence.
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.chart_of_accounts.models.account import Account, AccountType


class AccountRepository:
    """Repository for Account entity persistence operations."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, account_id: str) -> Account | None:
        """Get an account by its ID."""
        result = await self._session.execute(
            select(Account).where(Account.id == account_id, Account.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Account | None:
        """Get an account by its unique code."""
        result = await self._session.execute(
            select(Account).where(Account.code == code, Account.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def list_all(
        self,
        *,
        account_type: AccountType | None = None,
        is_active: bool | None = None,
        parent_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[Account]:
        """
        List accounts with optional filtering.

        Args:
            account_type: Filter by account type
            is_active: Filter by active status
            parent_id: Filter by parent account (None = root accounts)
            limit: Maximum number of results
            offset: Number of results to skip
        """
        query = select(Account).where(Account.is_deleted == False)

        if account_type is not None:
            query = query.where(Account.account_type == account_type)
        if is_active is not None:
            query = query.where(Account.is_active == is_active)
        if parent_id is not None:
            query = query.where(Account.parent_id == parent_id)

        query = query.order_by(Account.code).limit(limit).offset(offset)

        result = await self._session.execute(query)
        return result.scalars().all()

    async def list_root_accounts(self) -> Sequence[Account]:
        """Get all top-level accounts (no parent)."""
        result = await self._session.execute(
            select(Account)
            .where(Account.parent_id.is_(None), Account.is_deleted == False)
            .order_by(Account.code)
        )
        return result.scalars().all()

    async def add(self, account: Account) -> Account:
        """Add a new account to the repository."""
        self._session.add(account)
        await self._session.flush()
        return account

    async def add_batch(self, accounts: list[Account]) -> list[Account]:
        """
        Add multiple accounts efficiently.

        Args:
            accounts: List of accounts to add

        Returns:
            List of added accounts
        """
        if not accounts:
            return []

        self._session.add_all(accounts)
        await self._session.flush()
        return accounts

    async def delete(self, account: Account) -> None:
        """Soft delete an account."""
        account.is_deleted = True
        await self._session.flush()

    async def exists_by_code(self, code: str) -> bool:
        """Check if an account with the given code exists."""
        result = await self._session.execute(
            select(Account.id).where(Account.code == code, Account.is_deleted == False)
        )
        return result.scalar_one_or_none() is not None

    async def count(
        self,
        *,
        account_type: AccountType | None = None,
        is_active: bool | None = None,
    ) -> int:
        """Count accounts matching the given filters."""
        from sqlalchemy import func

        query = select(func.count(Account.id)).where(Account.is_deleted == False)

        if account_type is not None:
            query = query.where(Account.account_type == account_type)
        if is_active is not None:
            query = query.where(Account.is_active == is_active)

        result = await self._session.execute(query)
        return result.scalar_one()

    # -------------------------------------------------------------------------
    # Protocol compliance methods for ingestion pipeline
    # -------------------------------------------------------------------------

    async def account_exists(self, code: str) -> bool:
        """
        Check if an account with the given code exists.

        Alias for exists_by_code() to satisfy IAccountCodeResolver protocol.
        """
        return await self.exists_by_code(code)

    async def get_account_id_by_code(self, code: str) -> str | None:
        """
        Get account ID by its code.

        Satisfies IAccountCodeResolver protocol.

        Args:
            code: The account code to look up

        Returns:
            The account ID if found, None otherwise
        """
        result = await self._session.execute(
            select(Account.id).where(Account.code == code, Account.is_deleted == False)
        )
        return result.scalar_one_or_none()

    async def resolve_account_id(self, code: str) -> str | None:
        """
        Resolve account code to account ID.

        Alias for get_account_id_by_code() to satisfy IAccountResolver protocol.

        Args:
            code: The account code to resolve

        Returns:
            The account ID if found, None otherwise
        """
        return await self.get_account_id_by_code(code)
