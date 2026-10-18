"""
AR Invoice - a bill sent to a customer.

AR Invoices represent amounts owed to us by customers.
When posted, they create:
    Dr. Accounts Receivable
    Cr. Revenue Account
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    BaseEntity,
    Base,
    MONEY_PRECISION,
    MONEY_SCALE,
    generate_ulid,
)

if TYPE_CHECKING:
    from src.domain.accounts_receivable.models.customer import Customer
    from src.domain.accounts_receivable.models.receipt import Receipt


class ARInvoiceStatus(str, Enum):
    """AR Invoice lifecycle status."""

    DRAFT = "DRAFT"            # Being created
    SENT = "SENT"              # Sent to customer
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"              # Fully paid
    OVERDUE = "OVERDUE"        # Past due date
    CANCELLED = "CANCELLED"    # Voided
    WRITTEN_OFF = "WRITTEN_OFF"  # Bad debt write-off


class ARInvoice(BaseEntity):
    """
    AR Invoice - a bill to a customer.

    Attributes:
        invoice_number: Unique invoice number (e.g., INV-2026-00001)
        customer_id: Reference to the customer
        invoice_date: Date of the invoice
        due_date: Payment due date
        status: Invoice lifecycle status
        subtotal, tax_amount, total_amount: Amounts
        amount_received: Payments received
        description: Invoice description
        journal_entry_id: GL entry when posted
    """

    __tablename__ = "ar_invoices"

    # Identity
    invoice_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    # Customer Reference
    customer_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Dates
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    sent_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Status
    status: Mapped[ARInvoiceStatus] = mapped_column(
        SQLEnum(ARInvoiceStatus, native_enum=False),
        nullable=False,
        default=ARInvoiceStatus.DRAFT,
        index=True,
    )

    # Amounts
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
    )
    amount_received: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
        default=Decimal("0"),
    )

    # Description
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # GL Integration
    journal_entry_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("journal_entries.id", ondelete="SET NULL"),
        nullable=True,
    )
    ar_account_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=True,
    )

    # Reference
    po_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String(26), nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship(
        "Customer",
        back_populates="invoices",
        lazy="joined",
    )
    lines: Mapped[list["ARInvoiceLine"]] = relationship(
        "ARInvoiceLine",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="ARInvoiceLine.line_number",
        lazy="selectin",
    )
    receipts: Mapped[list["Receipt"]] = relationship(
        "Receipt",
        back_populates="invoice",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<ARInvoice(number={self.invoice_number}, total={self.total_amount}, status={self.status.value})>"

    @property
    def amount_due(self) -> Decimal:
        """Calculate remaining amount due."""
        return self.total_amount - self.amount_received

    @property
    def is_paid(self) -> bool:
        """Return True if fully paid."""
        return self.amount_due <= Decimal("0.01")

    @property
    def is_overdue(self) -> bool:
        """Return True if past due date and not paid."""
        if self.status in (ARInvoiceStatus.PAID, ARInvoiceStatus.CANCELLED, ARInvoiceStatus.WRITTEN_OFF):
            return False
        return date.today() > self.due_date

    @property
    def days_overdue(self) -> int:
        """Return number of days past due."""
        if not self.is_overdue:
            return 0
        return (date.today() - self.due_date).days

    @property
    def is_editable(self) -> bool:
        """Return True if invoice can be modified."""
        return self.status == ARInvoiceStatus.DRAFT

    def calculate_totals(self) -> None:
        """Recalculate totals from lines."""
        self.subtotal = sum((line.amount for line in self.lines), Decimal("0"))
        self.total_amount = self.subtotal + self.tax_amount

    def apply_receipt(self, amount: Decimal) -> None:
        """Apply a receipt amount."""
        self.amount_received += amount
        if self.is_paid:
            self.status = ARInvoiceStatus.PAID
        elif self.amount_received > Decimal("0"):
            self.status = ARInvoiceStatus.PARTIALLY_PAID


class ARInvoiceLine(Base):
    """A line item on an AR Invoice."""

    __tablename__ = "ar_invoice_lines"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=generate_ulid)

    invoice_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("ar_invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    line_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=4),
        nullable=False,
        default=Decimal("1"),
    )
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
    )

    # Accounting
    revenue_account_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    invoice: Mapped[ARInvoice] = relationship("ARInvoice", back_populates="lines")

    def calculate_amount(self) -> None:
        """Calculate amount from quantity and unit price."""
        self.amount = self.quantity * self.unit_price
