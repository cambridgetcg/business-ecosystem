"""
Vendor - a party from whom we purchase goods or services.

Vendors are external entities that we owe money to (accounts payable).
Each vendor has payment terms, contact information, and tax identifiers.
"""

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, Enum as SQLEnum, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    BaseEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
    SoftDeleteMixin,
)

if TYPE_CHECKING:
    from src.domain.accounts_payable.models.ap_invoice import APInvoice


class VendorStatus(str, Enum):
    """Vendor lifecycle status."""

    ACTIVE = "ACTIVE"          # Can receive new invoices
    ON_HOLD = "ON_HOLD"        # Temporarily suspended (payment issues, etc.)
    INACTIVE = "INACTIVE"      # No longer in use


class PaymentTerms(str, Enum):
    """Standard payment terms."""

    NET_15 = "NET_15"          # Due in 15 days
    NET_30 = "NET_30"          # Due in 30 days
    NET_45 = "NET_45"          # Due in 45 days
    NET_60 = "NET_60"          # Due in 60 days
    NET_90 = "NET_90"          # Due in 90 days
    DUE_ON_RECEIPT = "DUE_ON_RECEIPT"  # Due immediately
    CUSTOM = "CUSTOM"          # Custom terms (use payment_terms_days)


class Vendor(BaseEntity, SoftDeleteMixin):
    """
    Vendor entity - a supplier or service provider.

    Attributes:
        code: Unique vendor identifier (e.g., "V-001")
        name: Legal business name
        display_name: Short name for display
        status: Active, On Hold, or Inactive
        tax_id: Tax identification number (EIN, VAT, etc.)
        payment_terms: Standard payment terms
        payment_terms_days: Custom payment terms in days
        default_expense_account_id: Default account for expenses
        currency_code: Preferred currency
        credit_limit: Maximum outstanding balance allowed
        current_balance: Current outstanding balance (denormalized)
        contact_name: Primary contact person
        contact_email: Primary contact email
        contact_phone: Primary contact phone
        address_line1, address_line2, city, state, postal_code, country: Address
        notes: Internal notes
    """

    __tablename__ = "vendors"

    # Identity
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique vendor code (e.g., V-001)",
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Legal business name",
    )
    display_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Short display name",
    )

    # Status
    status: Mapped[VendorStatus] = mapped_column(
        SQLEnum(VendorStatus, native_enum=False),
        nullable=False,
        default=VendorStatus.ACTIVE,
        index=True,
    )

    # Tax Information
    tax_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Tax ID (EIN, VAT number, etc.)",
    )
    tax_id_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Type of tax ID (EIN, VAT, SSN, etc.)",
    )

    # Payment Terms
    payment_terms: Mapped[PaymentTerms] = mapped_column(
        SQLEnum(PaymentTerms, native_enum=False),
        nullable=False,
        default=PaymentTerms.NET_30,
    )
    payment_terms_days: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Custom payment terms in days (when payment_terms=CUSTOM)",
    )

    # Accounting
    default_expense_account_id: Mapped[str | None] = mapped_column(
        String(26),
        nullable=True,
        comment="Default expense account for this vendor",
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
        comment="Maximum outstanding balance allowed",
    )
    current_balance: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
        comment="Current outstanding AP balance (denormalized)",
    )

    # Contact Information
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Address
    address_line1: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(2), nullable=False, default="US")

    # Banking (for payments)
    bank_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    bank_account_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_routing_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    invoices: Mapped[list["APInvoice"]] = relationship(
        "APInvoice",
        back_populates="vendor",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<Vendor(code={self.code}, name={self.name}, status={self.status.value})>"

    @property
    def is_active(self) -> bool:
        """Return True if vendor can receive new invoices."""
        return self.status == VendorStatus.ACTIVE

    @property
    def is_over_credit_limit(self) -> bool:
        """Return True if vendor is over their credit limit."""
        if self.credit_limit is None:
            return False
        return self.current_balance > self.credit_limit

    @property
    def available_credit(self) -> Decimal | None:
        """Return available credit remaining."""
        if self.credit_limit is None:
            return None
        return max(Decimal("0"), self.credit_limit - self.current_balance)

    def get_payment_due_days(self) -> int:
        """Get the number of days until payment is due."""
        if self.payment_terms == PaymentTerms.CUSTOM:
            return self.payment_terms_days or 30
        elif self.payment_terms == PaymentTerms.DUE_ON_RECEIPT:
            return 0
        else:
            # Extract days from enum name (NET_30 -> 30)
            return int(self.payment_terms.value.split("_")[1])

    def calculate_due_date(self, invoice_date: date) -> date:
        """Calculate payment due date based on terms."""
        from datetime import timedelta
        days = self.get_payment_due_days()
        return invoice_date + timedelta(days=days)
