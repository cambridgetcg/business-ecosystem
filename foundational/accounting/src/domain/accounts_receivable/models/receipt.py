"""
Receipt - a payment received from a customer.

Receipts record cash inflows from customers. When posted:
    Dr. Cash/Bank Account
    Cr. Accounts Receivable
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
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.persistence.base import (
    BaseEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
)

if TYPE_CHECKING:
    from src.domain.accounts_receivable.models.customer import Customer
    from src.domain.accounts_receivable.models.ar_invoice import ARInvoice


class ReceiptStatus(str, Enum):
    """Receipt lifecycle status."""

    DRAFT = "DRAFT"
    PENDING = "PENDING"        # Awaiting deposit
    DEPOSITED = "DEPOSITED"    # Deposited to bank
    CLEARED = "CLEARED"        # Cleared by bank
    BOUNCED = "BOUNCED"        # Returned NSF
    CANCELLED = "CANCELLED"


class PaymentType(str, Enum):
    """Type of payment received."""

    CHECK = "CHECK"
    ACH = "ACH"
    WIRE = "WIRE"
    CREDIT_CARD = "CREDIT_CARD"
    CASH = "CASH"
    OTHER = "OTHER"


class Receipt(BaseEntity):
    """
    Receipt - a payment received from a customer.

    Attributes:
        receipt_number: Unique receipt number
        customer_id: Customer making the payment
        invoice_id: Invoice being paid (optional for prepayment)
        receipt_date: Date received
        payment_type: Method of payment
        status: Receipt lifecycle
        amount: Amount received
        bank_account_id: Bank account credited
        reference: Check number, transaction ID, etc.
    """

    __tablename__ = "receipts"

    # Identity
    receipt_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    # References
    customer_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("ar_invoices.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Details
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_type: Mapped[PaymentType] = mapped_column(
        SQLEnum(PaymentType, native_enum=False),
        nullable=False,
        default=PaymentType.CHECK,
    )
    status: Mapped[ReceiptStatus] = mapped_column(
        SQLEnum(ReceiptStatus, native_enum=False),
        nullable=False,
        default=ReceiptStatus.DRAFT,
        index=True,
    )

    # Amount
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=MONEY_PRECISION, scale=MONEY_SCALE),
        nullable=False,
    )
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Reference
    reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Check number, transaction ID, etc.",
    )

    # Accounting
    bank_account_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=True,
    )
    journal_entry_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("journal_entries.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Memo
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    deposited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", lazy="joined")
    invoice: Mapped["ARInvoice | None"] = relationship(
        "ARInvoice",
        back_populates="receipts",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<Receipt(number={self.receipt_number}, amount={self.amount}, status={self.status.value})>"

    @property
    def is_editable(self) -> bool:
        """Return True if receipt can be modified."""
        return self.status in (ReceiptStatus.DRAFT, ReceiptStatus.PENDING)

    def mark_deposited(self) -> None:
        """Mark receipt as deposited."""
        self.status = ReceiptStatus.DEPOSITED
        self.deposited_at = datetime.utcnow()

    def mark_cleared(self) -> None:
        """Mark receipt as cleared."""
        self.status = ReceiptStatus.CLEARED
        self.cleared_at = datetime.utcnow()

    def mark_bounced(self) -> None:
        """Mark receipt as bounced/NSF."""
        self.status = ReceiptStatus.BOUNCED
