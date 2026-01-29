"""
Account entity - the fundamental unit of the Chart of Accounts.

An Account is a classification for recording financial transactions.
Accounts are organized hierarchically and follow the accounting equation:
Assets = Liabilities + Equity
"""

from decimal import Decimal
from enum import Enum

from sqlalchemy import Boolean, Enum as SQLEnum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    BaseEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
    SoftDeleteMixin,
)


class AccountType(str, Enum):
    """
    Standard account types following the accounting equation.

    Assets (1xxx) - Resources owned by the business
    Liabilities (2xxx) - Obligations owed by the business
    Equity (3xxx) - Owner's residual interest (Assets - Liabilities)
    Revenue (4xxx) - Income from business operations
    Expense (5xxx) - Costs incurred in business operations
    """

    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"

    @property
    def normal_balance(self) -> str:
        """Return the normal balance side for this account type."""
        if self in (AccountType.ASSET, AccountType.EXPENSE):
            return "DEBIT"
        return "CREDIT"

    @property
    def is_balance_sheet(self) -> bool:
        """Return True if this account appears on the Balance Sheet."""
        return self in (AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY)

    @property
    def is_income_statement(self) -> bool:
        """Return True if this account appears on the Income Statement."""
        return self in (AccountType.REVENUE, AccountType.EXPENSE)


class Account(BaseEntity, SoftDeleteMixin):
    """
    Account entity representing a single account in the Chart of Accounts.

    Accounts can be hierarchical (parent-child relationships) to support
    account grouping and sub-accounts. The code field uniquely identifies
    the account and typically follows a numeric pattern like:
    - 1000: Assets (parent)
    - 1100: Current Assets (child of 1000)
    - 1110: Cash (child of 1100)

    Attributes:
        code: Unique account identifier (e.g., "1000", "1100.001")
        name: Human-readable account name
        description: Optional detailed description
        account_type: Classification (Asset, Liability, Equity, Revenue, Expense)
        parent_id: Optional reference to parent account for hierarchy
        is_active: Whether the account accepts new transactions
        is_header: If True, this is a grouping account (no direct postings)
        currency_code: Default currency for this account (ISO 4217)
        current_balance: Current balance (denormalized for performance)
    """

    __tablename__ = "accounts"

    # Core identity
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique account code (e.g., 1000, 1100.001)",
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Account display name",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Detailed account description",
    )

    # Classification
    account_type: Mapped[AccountType] = mapped_column(
        SQLEnum(AccountType, native_enum=False),
        nullable=False,
        index=True,
        comment="Account classification",
    )

    # Hierarchy
    parent_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Parent account ID for hierarchy",
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether account accepts new transactions",
    )
    is_header: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="If True, account is for grouping only (no direct postings)",
    )

    # Currency
    currency_code: Mapped[str] = mapped_column(
        String(3),
        default="USD",
        nullable=False,
        comment="Default currency (ISO 4217)",
    )

    # Denormalized balance for query performance
    current_balance: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        default=0,
        nullable=False,
        comment="Current account balance (denormalized)",
    )

    # Relationships
    parent: Mapped["Account | None"] = relationship(
        "Account",
        remote_side="Account.id",
        back_populates="children",
        lazy="selectin",
    )
    children: Mapped[list["Account"]] = relationship(
        "Account",
        back_populates="parent",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Account(code={self.code}, name={self.name}, type={self.account_type.value})>"

    @property
    def is_debit_normal(self) -> bool:
        """Return True if this account has a normal debit balance."""
        return self.account_type.normal_balance == "DEBIT"

    @property
    def is_credit_normal(self) -> bool:
        """Return True if this account has a normal credit balance."""
        return self.account_type.normal_balance == "CREDIT"

    @property
    def full_path(self) -> str:
        """Return the full hierarchical path (e.g., 'Assets / Current Assets / Cash')."""
        if self.parent:
            return f"{self.parent.full_path} / {self.name}"
        return self.name
