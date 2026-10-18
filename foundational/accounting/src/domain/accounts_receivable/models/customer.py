"""
Customer - a party to whom we sell goods or services.

Customers are external entities that owe us money (accounts receivable).
Each customer has payment terms, contact information, and credit limits.
"""

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SQLEnum, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    BaseEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
    SoftDeleteMixin,
)

if TYPE_CHECKING:
    from src.domain.accounts_receivable.models.ar_invoice import ARInvoice


class CustomerStatus(str, Enum):
    """Customer lifecycle status."""

    ACTIVE = "ACTIVE"          # Can receive new invoices
    ON_HOLD = "ON_HOLD"        # Credit hold (payment issues)
    INACTIVE = "INACTIVE"      # No longer active


class CustomerType(str, Enum):
    """Customer classification."""

    INDIVIDUAL = "INDIVIDUAL"
    BUSINESS = "BUSINESS"
    GOVERNMENT = "GOVERNMENT"
    NON_PROFIT = "NON_PROFIT"


class Customer(BaseEntity, SoftDeleteMixin):
    """
    Customer entity - a buyer of goods/services.

    Attributes:
        code: Unique customer identifier (e.g., "C-001")
        name: Customer name (company or individual)
        display_name: Short name for display
        customer_type: Classification
        status: Active, On Hold, or Inactive
        tax_id: Tax identification number
        payment_terms_days: Days until payment is due
        default_revenue_account_id: Default revenue account
        currency_code: Preferred currency
        credit_limit: Maximum outstanding balance allowed
        current_balance: Current outstanding AR balance
        contact info, address, etc.
    """

    __tablename__ = "customers"

    # Identity
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique customer code (e.g., C-001)",
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Customer name",
    )
    display_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # Classification
    customer_type: Mapped[CustomerType] = mapped_column(
        SQLEnum(CustomerType, native_enum=False),
        nullable=False,
        default=CustomerType.BUSINESS,
    )
    status: Mapped[CustomerStatus] = mapped_column(
        SQLEnum(CustomerStatus, native_enum=False),
        nullable=False,
        default=CustomerStatus.ACTIVE,
        index=True,
    )

    # Tax Information
    tax_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    tax_exempt: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Payment Terms
    payment_terms_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=30,
    )

    # Accounting
    default_revenue_account_id: Mapped[str | None] = mapped_column(
        String(26),
        nullable=True,
    )
    currency_code: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
    )

    # Credit Management
    credit_limit: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=True,
    )
    current_balance: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Current outstanding AR balance",
    )

    # Contact Information
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Billing Address
    billing_address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    billing_address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    billing_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    billing_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    billing_postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    billing_country: Mapped[str] = mapped_column(String(2), nullable=False, default="US")

    # Shipping Address (if different)
    shipping_address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    shipping_address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    shipping_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    shipping_country: Mapped[str | None] = mapped_column(String(2), nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    invoices: Mapped[list["ARInvoice"]] = relationship(
        "ARInvoice",
        back_populates="customer",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<Customer(code={self.code}, name={self.name}, status={self.status.value})>"

    @property
    def is_active(self) -> bool:
        """Return True if customer can receive new invoices."""
        return self.status == CustomerStatus.ACTIVE

    @property
    def is_over_credit_limit(self) -> bool:
        """Return True if customer is over their credit limit."""
        if self.credit_limit is None:
            return False
        return self.current_balance > self.credit_limit

    @property
    def available_credit(self) -> Decimal | None:
        """Return available credit remaining."""
        if self.credit_limit is None:
            return None
        return max(Decimal("0"), self.credit_limit - self.current_balance)

    def calculate_due_date(self, invoice_date: date) -> date:
        """Calculate payment due date based on terms."""
        from datetime import timedelta
        return invoice_date + timedelta(days=self.payment_terms_days)
