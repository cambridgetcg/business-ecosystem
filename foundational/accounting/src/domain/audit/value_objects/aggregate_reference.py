"""
AggregateReference - identifies an entity being audited.

This value object encapsulates the reference to any domain entity
that can have events recorded against it.

Pattern follows: src/domain/shared/value_objects.py (Currency, Money, etc.)
"""

from dataclasses import dataclass
from typing import Self


@dataclass(frozen=True, slots=True)
class AggregateReference:
    """
    Reference to an aggregate (entity) in the domain.

    Used to identify what entity an event pertains to without
    coupling to the specific entity type.

    Attributes:
        aggregate_type: The type of entity (e.g., "JournalEntry", "Account")
        aggregate_id: The unique identifier of the entity

    Example:
        ref = AggregateReference("JournalEntry", "01HN123...")
        ref = AggregateReference.for_journal_entry("01HN123...")
    """

    aggregate_type: str
    aggregate_id: str

    def __post_init__(self) -> None:
        if not self.aggregate_type or not self.aggregate_type.strip():
            raise ValueError("aggregate_type cannot be empty")
        if not self.aggregate_id or not self.aggregate_id.strip():
            raise ValueError("aggregate_id cannot be empty")

    def __str__(self) -> str:
        return f"{self.aggregate_type}:{self.aggregate_id}"

    @classmethod
    def for_journal_entry(cls, entry_id: str) -> Self:
        """Create reference for a journal entry."""
        return cls("JournalEntry", entry_id)

    @classmethod
    def for_account(cls, account_id: str) -> Self:
        """Create reference for an account."""
        return cls("Account", account_id)

    @classmethod
    def for_fiscal_period(cls, period_id: str) -> Self:
        """Create reference for a fiscal period."""
        return cls("FiscalPeriod", period_id)

    @classmethod
    def for_invoice(cls, invoice_id: str, invoice_type: str = "APInvoice") -> Self:
        """Create reference for an invoice."""
        return cls(invoice_type, invoice_id)

    @classmethod
    def for_vendor(cls, vendor_id: str) -> Self:
        """Create reference for a vendor."""
        return cls("Vendor", vendor_id)

    @classmethod
    def for_customer(cls, customer_id: str) -> Self:
        """Create reference for a customer."""
        return cls("Customer", customer_id)
