"""
Receipt Service - orchestrates receipt (payment) operations.

Handles receipt creation, deposit, and GL posting.
When a receipt is posted:
    Dr. Cash/Bank Account
    Cr. Accounts Receivable
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_receivable.models.ar_invoice import ARInvoice, ARInvoiceStatus
from src.domain.accounts_receivable.models.receipt import Receipt, PaymentType, ReceiptStatus
from src.domain.accounts_receivable.repositories.customer_repository import CustomerRepository
from src.domain.accounts_receivable.repositories.ar_invoice_repository import ARInvoiceRepository
from src.domain.accounts_receivable.repositories.receipt_repository import ReceiptRepository
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.repositories.journal_entry_repository import JournalEntryRepository
from src.domain.shared.exceptions import ValidationError, EntityNotFoundError


class ReceiptService:
    """
    Service for managing receipts (customer payments).

    Orchestrates receipt creation, deposit, and GL posting.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.customer_repo = CustomerRepository(session)
        self.invoice_repo = ARInvoiceRepository(session)
        self.receipt_repo = ReceiptRepository(session)
        self.je_repo = JournalEntryRepository(session)

    async def create_receipt(
        self,
        customer_id: str,
        amount: Decimal,
        receipt_date: date,
        payment_type: PaymentType,
        bank_account_id: str,
        invoice_id: Optional[str] = None,
        reference: Optional[str] = None,
        memo: Optional[str] = None,
        currency_code: str = "USD",
    ) -> Receipt:
        """
        Create a new receipt.

        Args:
            customer_id: Customer making the payment
            amount: Payment amount
            receipt_date: Date received
            payment_type: How the payment was received
            bank_account_id: Bank/cash account to credit
            invoice_id: Optional specific invoice to apply to
            reference: Check number, transaction ID, etc.
            memo: Receipt memo
            currency_code: Receipt currency

        Returns:
            Created Receipt
        """
        customer = await self.customer_repo.get_by_id(customer_id)
        if not customer:
            raise EntityNotFoundError(
                entity_type="Customer",
                entity_id=customer_id,
            )

        if invoice_id:
            invoice = await self.invoice_repo.get_by_id(invoice_id)
            if not invoice:
                raise EntityNotFoundError(
                    entity_type="ARInvoice",
                    entity_id=invoice_id,
                )

            if invoice.customer_id != customer_id:
                raise ValidationError(
                    field="invoice_id",
                    message="Invoice does not belong to the specified customer",
                )

            if invoice.status not in (ARInvoiceStatus.SENT, ARInvoiceStatus.PARTIALLY_PAID, ARInvoiceStatus.OVERDUE):
                raise ValidationError(
                    field="invoice_id",
                    message=f"Invoice {invoice.invoice_number} cannot receive payments (status: {invoice.status.value})",
                )

            if amount > invoice.amount_due:
                raise ValidationError(
                    field="amount",
                    message=f"Payment amount {amount} exceeds invoice balance {invoice.amount_due}",
                )

        receipt_number = await self.receipt_repo.get_next_receipt_number(receipt_date.year)

        receipt = Receipt(
            receipt_number=receipt_number,
            customer_id=customer_id,
            invoice_id=invoice_id,
            receipt_date=receipt_date,
            payment_type=payment_type,
            status=ReceiptStatus.DRAFT,
            amount=amount,
            currency_code=currency_code,
            reference=reference,
            bank_account_id=bank_account_id,
            memo=memo,
        )

        return await self.receipt_repo.add(receipt)

    async def deposit_receipt(
        self,
        receipt_id: str,
        deposited_by: str,
    ) -> Receipt:
        """
        Mark a receipt as pending deposit (awaiting bank processing).

        This does not yet create GL entries - those are created when cleared
        or when processed immediately for electronic payments.
        """
        receipt = await self.receipt_repo.get_by_id(receipt_id)
        if not receipt:
            raise EntityNotFoundError(
                entity_type="Receipt",
                entity_id=receipt_id,
            )

        if receipt.status != ReceiptStatus.DRAFT:
            raise ValidationError(
                field="status",
                message=f"Cannot deposit receipt with status {receipt.status.value}",
            )

        receipt.status = ReceiptStatus.PENDING
        return await self.receipt_repo.save(receipt)

    async def process_receipt(
        self,
        receipt_id: str,
        processed_by: str,
    ) -> Receipt:
        """
        Process a receipt and create the GL entry.

        Creates:
            Dr. Cash/Bank Account
            Cr. Accounts Receivable

        Also applies receipt to invoice and updates customer balance.
        """
        receipt = await self.receipt_repo.get_by_id(receipt_id)
        if not receipt:
            raise EntityNotFoundError(
                entity_type="Receipt",
                entity_id=receipt_id,
            )

        if receipt.status not in (ReceiptStatus.DRAFT, ReceiptStatus.PENDING):
            raise ValidationError(
                field="status",
                message=f"Cannot process receipt with status {receipt.status.value}",
            )

        ar_account_id = None
        if receipt.invoice_id:
            invoice = await self.invoice_repo.get_by_id(receipt.invoice_id)
            if invoice and invoice.ar_account_id:
                ar_account_id = invoice.ar_account_id

        if not ar_account_id:
            raise ValidationError(
                field="ar_account_id",
                message="Cannot determine AR account for this receipt",
            )

        je_number = await self.je_repo.get_next_entry_number(receipt.receipt_date.year)

        from src.domain.general_ledger.repositories.fiscal_period_repository import FiscalPeriodRepository
        period_repo = FiscalPeriodRepository(self.session)
        period = await period_repo.get_by_date(receipt.receipt_date)
        if not period:
            raise ValidationError(
                field="receipt_date",
                message=f"No fiscal period found for date {receipt.receipt_date}",
            )

        journal_entry = JournalEntry(
            entry_number=je_number,
            entry_date=receipt.receipt_date,
            fiscal_period_id=period.id,
            description=f"Receipt {receipt.receipt_number} - {receipt.customer.name}",
            source_document=receipt.receipt_number,
            source_document_type="RECEIPT",
            currency_code=receipt.currency_code,
            status=PostingStatus.DRAFT,
        )

        journal_entry.add_line(
            account_id=receipt.bank_account_id,
            entry_type=EntryType.DEBIT,
            amount=receipt.amount,
            description=f"Receipt from {receipt.customer.name}",
        )

        journal_entry.add_line(
            account_id=ar_account_id,
            entry_type=EntryType.CREDIT,
            amount=receipt.amount,
            description=f"Receipt {receipt.receipt_number}",
        )

        journal_entry.validate_for_posting()
        journal_entry = await self.je_repo.add(journal_entry)

        from src.domain.general_ledger.services.posting_service import PostingService
        posting_service = PostingService(self.session)
        journal_entry = await posting_service.post_entry(journal_entry.id, processed_by)

        receipt.journal_entry_id = journal_entry.id
        receipt.mark_deposited()

        if receipt.invoice_id:
            invoice = await self.invoice_repo.get_by_id(receipt.invoice_id)
            if invoice:
                invoice.apply_receipt(receipt.amount)
                await self.invoice_repo.save(invoice)

        customer = await self.customer_repo.get_by_id(receipt.customer_id)
        if customer:
            customer.current_balance -= receipt.amount
            await self.customer_repo.save(customer)

        return await self.receipt_repo.save(receipt)

    async def mark_cleared(self, receipt_id: str) -> Receipt:
        """Mark a receipt as cleared by the bank."""
        receipt = await self.receipt_repo.get_by_id(receipt_id)
        if not receipt:
            raise EntityNotFoundError(
                entity_type="Receipt",
                entity_id=receipt_id,
            )

        if receipt.status != ReceiptStatus.DEPOSITED:
            raise ValidationError(
                field="status",
                message=f"Cannot mark receipt as cleared with status {receipt.status.value}",
            )

        receipt.mark_cleared()
        return await self.receipt_repo.save(receipt)

    async def mark_bounced(
        self,
        receipt_id: str,
        bounced_by: str,
        reason: str,
    ) -> Receipt:
        """
        Mark a receipt as bounced/NSF.

        Creates a reversing GL entry and restores customer balance.
        """
        receipt = await self.receipt_repo.get_by_id(receipt_id)
        if not receipt:
            raise EntityNotFoundError(
                entity_type="Receipt",
                entity_id=receipt_id,
            )

        if receipt.status not in (ReceiptStatus.DEPOSITED, ReceiptStatus.PENDING):
            raise ValidationError(
                field="status",
                message=f"Cannot mark receipt as bounced with status {receipt.status.value}",
            )

        if receipt.journal_entry_id:
            from src.domain.general_ledger.services.posting_service import PostingService
            posting_service = PostingService(self.session)
            await posting_service.reverse_entry(
                receipt.journal_entry_id,
                bounced_by,
                f"NSF/Bounced: {reason}",
            )

            if receipt.invoice_id:
                invoice = await self.invoice_repo.get_by_id(receipt.invoice_id)
                if invoice:
                    invoice.amount_received -= receipt.amount
                    if invoice.amount_received > Decimal("0"):
                        invoice.status = ARInvoiceStatus.PARTIALLY_PAID
                    else:
                        invoice.status = ARInvoiceStatus.SENT
                    await self.invoice_repo.save(invoice)

            customer = await self.customer_repo.get_by_id(receipt.customer_id)
            if customer:
                customer.current_balance += receipt.amount
                await self.customer_repo.save(customer)

        receipt.mark_bounced()
        return await self.receipt_repo.save(receipt)

    async def cancel_receipt(
        self,
        receipt_id: str,
        cancelled_by: str,
        reason: str,
    ) -> Receipt:
        """
        Cancel a receipt.

        If already processed, creates a reversing GL entry.
        """
        receipt = await self.receipt_repo.get_by_id(receipt_id)
        if not receipt:
            raise EntityNotFoundError(
                entity_type="Receipt",
                entity_id=receipt_id,
            )

        if receipt.status == ReceiptStatus.CLEARED:
            raise ValidationError(
                field="status",
                message="Cannot cancel a cleared receipt",
            )

        if receipt.status == ReceiptStatus.DEPOSITED and receipt.journal_entry_id:
            from src.domain.general_ledger.services.posting_service import PostingService
            posting_service = PostingService(self.session)
            await posting_service.reverse_entry(
                receipt.journal_entry_id,
                cancelled_by,
                reason,
            )

            if receipt.invoice_id:
                invoice = await self.invoice_repo.get_by_id(receipt.invoice_id)
                if invoice:
                    invoice.amount_received -= receipt.amount
                    if invoice.amount_received > Decimal("0"):
                        invoice.status = ARInvoiceStatus.PARTIALLY_PAID
                    else:
                        invoice.status = ARInvoiceStatus.SENT
                    await self.invoice_repo.save(invoice)

            customer = await self.customer_repo.get_by_id(receipt.customer_id)
            if customer:
                customer.current_balance += receipt.amount
                await self.customer_repo.save(customer)

        receipt.status = ReceiptStatus.CANCELLED
        return await self.receipt_repo.save(receipt)

    async def get_unapplied_receipts(self, customer_id: str) -> list[Receipt]:
        """Get receipts not applied to any invoice (prepayments)."""
        receipts = await self.receipt_repo.list_receipts(customer_id=customer_id)
        return [r for r in receipts if r.invoice_id is None and r.status == ReceiptStatus.DEPOSITED]

    async def apply_receipt_to_invoice(
        self,
        receipt_id: str,
        invoice_id: str,
        applied_by: str,
    ) -> Receipt:
        """
        Apply an unapplied receipt to an invoice.

        Used for prepayments or when a general receipt needs to be applied.
        """
        receipt = await self.receipt_repo.get_by_id(receipt_id)
        if not receipt:
            raise EntityNotFoundError(
                entity_type="Receipt",
                entity_id=receipt_id,
            )

        if receipt.invoice_id:
            raise ValidationError(
                field="receipt_id",
                message="Receipt is already applied to an invoice",
            )

        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise EntityNotFoundError(
                entity_type="ARInvoice",
                entity_id=invoice_id,
            )

        if invoice.customer_id != receipt.customer_id:
            raise ValidationError(
                field="invoice_id",
                message="Invoice does not belong to the same customer as the receipt",
            )

        if invoice.status not in (ARInvoiceStatus.SENT, ARInvoiceStatus.PARTIALLY_PAID, ARInvoiceStatus.OVERDUE):
            raise ValidationError(
                field="invoice_id",
                message=f"Cannot apply receipt to invoice with status {invoice.status.value}",
            )

        receipt.invoice_id = invoice_id
        invoice.apply_receipt(receipt.amount)

        await self.invoice_repo.save(invoice)
        return await self.receipt_repo.save(receipt)
