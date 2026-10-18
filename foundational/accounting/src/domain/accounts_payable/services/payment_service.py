"""
Payment Service - orchestrates payment operations.

Handles payment creation, approval, and GL posting.
When a payment is posted:
    Dr. Accounts Payable
    Cr. Cash/Bank Account
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_payable.models.ap_invoice import APInvoice, APInvoiceStatus
from src.domain.accounts_payable.models.payment import Payment, PaymentMethod, PaymentStatus
from src.domain.accounts_payable.repositories.vendor_repository import VendorRepository
from src.domain.accounts_payable.repositories.ap_invoice_repository import APInvoiceRepository
from src.domain.accounts_payable.repositories.payment_repository import PaymentRepository
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.repositories.journal_entry_repository import JournalEntryRepository
from src.domain.shared.exceptions import ValidationError, EntityNotFoundError


class PaymentService:
    """
    Service for managing payments.

    Orchestrates payment creation, approval, and GL posting.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.vendor_repo = VendorRepository(session)
        self.invoice_repo = APInvoiceRepository(session)
        self.payment_repo = PaymentRepository(session)
        self.je_repo = JournalEntryRepository(session)

    async def create_payment(
        self,
        vendor_id: str,
        amount: Decimal,
        payment_date: date,
        payment_method: PaymentMethod,
        bank_account_id: str,
        invoice_id: Optional[str] = None,
        check_number: Optional[str] = None,
        reference: Optional[str] = None,
        memo: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> Payment:
        """
        Create a new payment.

        Args:
            vendor_id: Vendor receiving the payment
            amount: Payment amount
            payment_date: Date of payment
            payment_method: How the payment is made
            bank_account_id: Bank/cash account to debit
            invoice_id: Optional specific invoice to pay
            check_number: Check number if applicable
            reference: External reference
            memo: Payment memo
            created_by: User creating the payment

        Returns:
            Created Payment
        """
        # Validate vendor
        vendor = await self.vendor_repo.get_by_id(vendor_id)
        if not vendor:
            raise EntityNotFoundError(
                entity_type="Vendor",
                entity_id=vendor_id,
            )

        # Validate invoice if specified
        if invoice_id:
            invoice = await self.invoice_repo.get_by_id(invoice_id)
            if not invoice:
                raise EntityNotFoundError(
                    entity_type="APInvoice",
                    entity_id=invoice_id,
                )

            if not invoice.can_be_paid:
                raise ValidationError(
                    field="invoice_id",
                    message=f"Invoice {invoice.invoice_number} cannot be paid (status: {invoice.status.value})",
                )

            if invoice.vendor_id != vendor_id:
                raise ValidationError(
                    field="invoice_id",
                    message="Invoice does not belong to the specified vendor",
                )

            # Warn if overpaying
            if amount > invoice.amount_due:
                raise ValidationError(
                    field="amount",
                    message=f"Payment amount {amount} exceeds invoice balance {invoice.amount_due}",
                )

        # Generate payment number
        payment_number = await self.payment_repo.get_next_payment_number(payment_date.year)

        # Create payment
        payment = Payment(
            payment_number=payment_number,
            vendor_id=vendor_id,
            invoice_id=invoice_id,
            payment_date=payment_date,
            payment_method=payment_method,
            status=PaymentStatus.DRAFT,
            amount=amount,
            currency_code=vendor.currency_code,
            check_number=check_number,
            reference=reference,
            bank_account_id=bank_account_id,
            memo=memo,
            created_by=created_by,
        )

        return await self.payment_repo.add(payment)

    async def submit_for_approval(self, payment_id: str) -> Payment:
        """Submit a payment for approval."""
        payment = await self.payment_repo.get_by_id(payment_id)
        if not payment:
            raise EntityNotFoundError(
                entity_type="Payment",
                entity_id=payment_id,
            )

        if payment.status != PaymentStatus.DRAFT:
            raise ValidationError(
                field="status",
                message=f"Cannot submit payment with status {payment.status.value}",
            )

        payment.status = PaymentStatus.PENDING
        return await self.payment_repo.save(payment)

    async def approve_payment(
        self,
        payment_id: str,
        approved_by: str,
    ) -> Payment:
        """
        Approve a payment.

        Does not yet process the payment or create GL entries.
        """
        payment = await self.payment_repo.get_by_id(payment_id)
        if not payment:
            raise EntityNotFoundError(
                entity_type="Payment",
                entity_id=payment_id,
            )

        if payment.status != PaymentStatus.PENDING:
            raise ValidationError(
                field="status",
                message=f"Cannot approve payment with status {payment.status.value}",
            )

        payment.approve(approved_by)
        return await self.payment_repo.save(payment)

    async def process_payment(
        self,
        payment_id: str,
        processed_by: str,
    ) -> Payment:
        """
        Process an approved payment.

        Creates the GL entry:
            Dr. Accounts Payable
            Cr. Cash/Bank Account

        Also applies payment to invoice and updates vendor balance.
        """
        payment = await self.payment_repo.get_by_id(payment_id)
        if not payment:
            raise EntityNotFoundError(
                entity_type="Payment",
                entity_id=payment_id,
            )

        if not payment.can_be_sent:
            raise ValidationError(
                field="status",
                message=f"Cannot process payment with status {payment.status.value}",
            )

        # Get the invoice's AP account
        ap_account_id = None
        if payment.invoice_id:
            invoice = await self.invoice_repo.get_by_id(payment.invoice_id)
            if invoice and invoice.ap_account_id:
                ap_account_id = invoice.ap_account_id

        if not ap_account_id:
            raise ValidationError(
                field="ap_account_id",
                message="Cannot determine AP account for this payment",
            )

        # Create journal entry
        je_number = await self.je_repo.get_next_entry_number(payment.payment_date.year)

        # Get fiscal period
        from src.domain.general_ledger.repositories.fiscal_period_repository import FiscalPeriodRepository
        period_repo = FiscalPeriodRepository(self.session)
        period = await period_repo.get_by_date(payment.payment_date)
        if not period:
            raise ValidationError(
                field="payment_date",
                message=f"No fiscal period found for date {payment.payment_date}",
            )

        journal_entry = JournalEntry(
            entry_number=je_number,
            entry_date=payment.payment_date,
            fiscal_period_id=period.id,
            description=f"Payment {payment.payment_number} - {payment.vendor.name}",
            source_document=payment.payment_number,
            source_document_type="PAYMENT",
            currency_code=payment.currency_code,
            status=PostingStatus.DRAFT,
        )

        # Debit AP (reduce liability)
        journal_entry.add_line(
            account_id=ap_account_id,
            entry_type=EntryType.DEBIT,
            amount=payment.amount,
            description=f"Payment to {payment.vendor.name}",
        )

        # Credit Bank/Cash
        journal_entry.add_line(
            account_id=payment.bank_account_id,
            entry_type=EntryType.CREDIT,
            amount=payment.amount,
            description=f"Payment {payment.payment_number}",
        )

        # Validate and save journal entry
        journal_entry.validate_for_posting()
        journal_entry = await self.je_repo.add(journal_entry)

        # Post the journal entry
        from src.domain.general_ledger.services.posting_service import PostingService
        posting_service = PostingService(self.session)
        journal_entry = await posting_service.post_entry(journal_entry.id, processed_by)

        # Update payment
        payment.journal_entry_id = journal_entry.id
        payment.mark_sent()

        # Apply payment to invoice
        if payment.invoice_id:
            invoice = await self.invoice_repo.get_by_id(payment.invoice_id)
            if invoice:
                invoice.apply_payment(payment.amount)
                await self.invoice_repo.save(invoice)

        # Update vendor balance
        vendor = await self.vendor_repo.get_by_id(payment.vendor_id)
        if vendor:
            vendor.current_balance -= payment.amount
            await self.vendor_repo.save(vendor)

        return await self.payment_repo.save(payment)

    async def mark_cleared(self, payment_id: str) -> Payment:
        """Mark a payment as cleared by the bank."""
        payment = await self.payment_repo.get_by_id(payment_id)
        if not payment:
            raise EntityNotFoundError(
                entity_type="Payment",
                entity_id=payment_id,
            )

        payment.mark_cleared()
        return await self.payment_repo.save(payment)

    async def cancel_payment(
        self,
        payment_id: str,
        cancelled_by: str,
        reason: str,
    ) -> Payment:
        """
        Cancel a payment.

        If already processed, creates a reversing GL entry.
        """
        payment = await self.payment_repo.get_by_id(payment_id)
        if not payment:
            raise EntityNotFoundError(
                entity_type="Payment",
                entity_id=payment_id,
            )

        if payment.status == PaymentStatus.CLEARED:
            raise ValidationError(
                field="status",
                message="Cannot cancel a cleared payment",
            )

        # If processed, reverse the GL entry
        if payment.status == PaymentStatus.SENT and payment.journal_entry_id:
            from src.domain.general_ledger.services.posting_service import PostingService
            posting_service = PostingService(self.session)
            await posting_service.reverse_entry(
                payment.journal_entry_id,
                cancelled_by,
                reason,
            )

            # Reverse invoice payment
            if payment.invoice_id:
                invoice = await self.invoice_repo.get_by_id(payment.invoice_id)
                if invoice:
                    invoice.amount_paid -= payment.amount
                    if invoice.amount_paid > Decimal("0"):
                        invoice.status = APInvoiceStatus.PARTIALLY_PAID
                    else:
                        invoice.status = APInvoiceStatus.APPROVED
                    await self.invoice_repo.save(invoice)

            # Restore vendor balance
            vendor = await self.vendor_repo.get_by_id(payment.vendor_id)
            if vendor:
                vendor.current_balance += payment.amount
                await self.vendor_repo.save(vendor)

        payment.cancel()
        return await self.payment_repo.save(payment)

    async def create_batch_payment(
        self,
        vendor_id: str,
        invoice_ids: list[str],
        payment_date: date,
        payment_method: PaymentMethod,
        bank_account_id: str,
        created_by: str,
    ) -> Payment:
        """
        Create a single payment for multiple invoices.

        Calculates total amount from all invoices.
        """
        vendor = await self.vendor_repo.get_by_id(vendor_id)
        if not vendor:
            raise EntityNotFoundError(
                entity_type="Vendor",
                entity_id=vendor_id,
            )

        total_amount = Decimal("0")
        for invoice_id in invoice_ids:
            invoice = await self.invoice_repo.get_by_id(invoice_id)
            if not invoice:
                raise EntityNotFoundError(
                    entity_type="APInvoice",
                    entity_id=invoice_id,
                )
            if invoice.vendor_id != vendor_id:
                raise ValidationError(
                    field="invoice_ids",
                    message=f"Invoice {invoice.invoice_number} does not belong to vendor",
                )
            if not invoice.can_be_paid:
                raise ValidationError(
                    field="invoice_ids",
                    message=f"Invoice {invoice.invoice_number} cannot be paid",
                )
            total_amount += invoice.amount_due

        # For batch payments, we don't link to a single invoice
        # Instead, the memo will list all invoices
        invoice_numbers = []
        for invoice_id in invoice_ids:
            invoice = await self.invoice_repo.get_by_id(invoice_id)
            if invoice:
                invoice_numbers.append(invoice.invoice_number)

        return await self.create_payment(
            vendor_id=vendor_id,
            amount=total_amount,
            payment_date=payment_date,
            payment_method=payment_method,
            bank_account_id=bank_account_id,
            memo=f"Payment for invoices: {', '.join(invoice_numbers)}",
            created_by=created_by,
        )
