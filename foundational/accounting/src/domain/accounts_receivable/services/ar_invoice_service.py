"""
AR Invoice Service - orchestrates AR invoice operations.

Handles the AR invoice lifecycle:
1. Create invoice for customer
2. Send invoice (creates GL entry)
3. Track receipts
4. Close when fully paid or write off
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_receivable.models.customer import Customer
from src.domain.accounts_receivable.models.ar_invoice import (
    ARInvoice,
    ARInvoiceLine,
    ARInvoiceStatus,
)
from src.domain.accounts_receivable.repositories.customer_repository import CustomerRepository
from src.domain.accounts_receivable.repositories.ar_invoice_repository import ARInvoiceRepository
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.repositories.journal_entry_repository import JournalEntryRepository
from src.domain.shared.exceptions import ValidationError, EntityNotFoundError


class ARInvoiceService:
    """
    Service for managing AR invoices.

    Orchestrates invoice creation, sending, and GL posting.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.customer_repo = CustomerRepository(session)
        self.invoice_repo = ARInvoiceRepository(session)
        self.je_repo = JournalEntryRepository(session)

    async def create_invoice(
        self,
        customer_id: str,
        invoice_date: date,
        lines: list[dict],
        description: Optional[str] = None,
        tax_amount: Decimal = Decimal("0"),
        po_number: Optional[str] = None,
        terms: Optional[str] = None,
        notes: Optional[str] = None,
        currency_code: str = "USD",
    ) -> ARInvoice:
        """
        Create a new AR invoice.

        Args:
            customer_id: Customer being billed
            invoice_date: Invoice date
            lines: List of line items with revenue_account_id, description, quantity, unit_price
            description: Invoice description
            tax_amount: Total tax amount
            po_number: Customer's PO number
            terms: Payment terms text
            notes: Invoice notes
            currency_code: Invoice currency

        Returns:
            Created ARInvoice
        """
        customer = await self.customer_repo.get_by_id(customer_id)
        if not customer:
            raise EntityNotFoundError(
                entity_type="Customer",
                entity_id=customer_id,
            )

        if not customer.is_active:
            raise ValidationError(
                field="customer_id",
                message=f"Customer {customer.code} is not active",
            )

        year = invoice_date.year
        invoice_number = await self.invoice_repo.get_next_invoice_number(year)
        due_date = customer.calculate_due_date(invoice_date)

        invoice = ARInvoice(
            invoice_number=invoice_number,
            customer_id=customer_id,
            invoice_date=invoice_date,
            due_date=due_date,
            status=ARInvoiceStatus.DRAFT,
            currency_code=currency_code,
            tax_amount=tax_amount,
            description=description,
            po_number=po_number,
            terms=terms,
            notes=notes,
        )

        subtotal = Decimal("0")
        for idx, line_data in enumerate(lines):
            quantity = Decimal(str(line_data.get("quantity", 1)))
            unit_price = Decimal(str(line_data["unit_price"]))
            amount = quantity * unit_price
            subtotal += amount

            line = ARInvoiceLine(
                line_number=idx,
                description=line_data["description"],
                quantity=quantity,
                unit_price=unit_price,
                amount=amount,
                revenue_account_id=line_data["revenue_account_id"],
            )
            invoice.lines.append(line)

        invoice.subtotal = subtotal
        invoice.total_amount = subtotal + tax_amount

        if customer.credit_limit is not None:
            new_balance = customer.current_balance + invoice.total_amount
            if new_balance > customer.credit_limit:
                raise ValidationError(
                    field="total_amount",
                    message=f"Invoice would exceed customer credit limit. Available: {customer.available_credit}",
                )

        return await self.invoice_repo.add(invoice)

    async def send_invoice(
        self,
        invoice_id: str,
        ar_account_id: str,
        sent_by: str,
    ) -> ARInvoice:
        """
        Send an invoice and create the GL entry.

        Creates:
            Dr. Accounts Receivable
            Cr. Revenue accounts (from lines)

        Args:
            invoice_id: Invoice to send
            ar_account_id: AR account to debit
            sent_by: User sending the invoice

        Returns:
            Sent invoice with journal entry
        """
        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise EntityNotFoundError(
                entity_type="ARInvoice",
                entity_id=invoice_id,
            )

        if invoice.status != ARInvoiceStatus.DRAFT:
            raise ValidationError(
                field="status",
                message=f"Cannot send invoice with status {invoice.status.value}",
            )

        if not invoice.lines:
            raise ValidationError(
                field="lines",
                message="Invoice must have at least one line",
            )

        je_number = await self.je_repo.get_next_entry_number(invoice.invoice_date.year)

        from src.domain.general_ledger.repositories.fiscal_period_repository import FiscalPeriodRepository
        period_repo = FiscalPeriodRepository(self.session)
        period = await period_repo.get_by_date(invoice.invoice_date)
        if not period:
            raise ValidationError(
                field="invoice_date",
                message=f"No fiscal period found for date {invoice.invoice_date}",
            )

        journal_entry = JournalEntry(
            entry_number=je_number,
            entry_date=invoice.invoice_date,
            fiscal_period_id=period.id,
            description=f"AR Invoice {invoice.invoice_number} - {invoice.customer.name}",
            source_document=invoice.invoice_number,
            source_document_type="AR_INVOICE",
            currency_code=invoice.currency_code,
            status=PostingStatus.DRAFT,
        )

        journal_entry.add_line(
            account_id=ar_account_id,
            entry_type=EntryType.DEBIT,
            amount=invoice.total_amount,
            description=f"AR - {invoice.customer.name}",
        )

        for inv_line in invoice.lines:
            journal_entry.add_line(
                account_id=inv_line.revenue_account_id,
                entry_type=EntryType.CREDIT,
                amount=inv_line.amount,
                description=inv_line.description,
            )

        if invoice.tax_amount > Decimal("0"):
            pass

        journal_entry.validate_for_posting()
        journal_entry = await self.je_repo.add(journal_entry)

        from src.domain.general_ledger.services.posting_service import PostingService
        posting_service = PostingService(self.session)
        journal_entry = await posting_service.post_entry(journal_entry.id, sent_by)

        invoice.status = ARInvoiceStatus.SENT
        invoice.sent_date = date.today()
        invoice.journal_entry_id = journal_entry.id
        invoice.ar_account_id = ar_account_id

        customer = await self.customer_repo.get_by_id(invoice.customer_id)
        if customer:
            customer.current_balance += invoice.total_amount
            await self.customer_repo.save(customer)

        return await self.invoice_repo.save(invoice)

    async def cancel_invoice(
        self,
        invoice_id: str,
        cancelled_by: str,
        reason: str,
    ) -> ARInvoice:
        """Cancel an invoice (if not yet paid)."""
        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise EntityNotFoundError(
                entity_type="ARInvoice",
                entity_id=invoice_id,
            )

        if invoice.status in (ARInvoiceStatus.PAID, ARInvoiceStatus.PARTIALLY_PAID):
            raise ValidationError(
                field="status",
                message="Cannot cancel an invoice with receipts applied",
            )

        if invoice.status == ARInvoiceStatus.SENT and invoice.journal_entry_id:
            from src.domain.general_ledger.services.posting_service import PostingService
            posting_service = PostingService(self.session)
            await posting_service.reverse_entry(
                invoice.journal_entry_id,
                cancelled_by,
                reason,
            )

            customer = await self.customer_repo.get_by_id(invoice.customer_id)
            if customer:
                customer.current_balance -= invoice.total_amount
                await self.customer_repo.save(customer)

        invoice.status = ARInvoiceStatus.CANCELLED
        return await self.invoice_repo.save(invoice)

    async def write_off_invoice(
        self,
        invoice_id: str,
        bad_debt_account_id: str,
        written_off_by: str,
        reason: str,
    ) -> ARInvoice:
        """
        Write off an unpaid invoice as bad debt.

        Creates:
            Dr. Bad Debt Expense
            Cr. Accounts Receivable
        """
        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise EntityNotFoundError(
                entity_type="ARInvoice",
                entity_id=invoice_id,
            )

        if invoice.status not in (ARInvoiceStatus.SENT, ARInvoiceStatus.PARTIALLY_PAID, ARInvoiceStatus.OVERDUE):
            raise ValidationError(
                field="status",
                message=f"Cannot write off invoice with status {invoice.status.value}",
            )

        amount_to_write_off = invoice.amount_due
        if amount_to_write_off <= Decimal("0"):
            raise ValidationError(
                field="amount_due",
                message="No balance to write off",
            )

        je_number = await self.je_repo.get_next_entry_number(date.today().year)

        from src.domain.general_ledger.repositories.fiscal_period_repository import FiscalPeriodRepository
        period_repo = FiscalPeriodRepository(self.session)
        period = await period_repo.get_by_date(date.today())
        if not period:
            raise ValidationError(
                field="date",
                message=f"No fiscal period found for today",
            )

        journal_entry = JournalEntry(
            entry_number=je_number,
            entry_date=date.today(),
            fiscal_period_id=period.id,
            description=f"Write-off AR Invoice {invoice.invoice_number} - {reason}",
            source_document=invoice.invoice_number,
            source_document_type="AR_WRITEOFF",
            currency_code=invoice.currency_code,
            status=PostingStatus.DRAFT,
        )

        journal_entry.add_line(
            account_id=bad_debt_account_id,
            entry_type=EntryType.DEBIT,
            amount=amount_to_write_off,
            description=f"Bad debt write-off - {invoice.customer.name}",
        )

        journal_entry.add_line(
            account_id=invoice.ar_account_id,
            entry_type=EntryType.CREDIT,
            amount=amount_to_write_off,
            description=f"Write-off {invoice.invoice_number}",
        )

        journal_entry.validate_for_posting()
        journal_entry = await self.je_repo.add(journal_entry)

        from src.domain.general_ledger.services.posting_service import PostingService
        posting_service = PostingService(self.session)
        await posting_service.post_entry(journal_entry.id, written_off_by)

        customer = await self.customer_repo.get_by_id(invoice.customer_id)
        if customer:
            customer.current_balance -= amount_to_write_off
            await self.customer_repo.save(customer)

        invoice.status = ARInvoiceStatus.WRITTEN_OFF
        return await self.invoice_repo.save(invoice)

    async def get_aging_report(self, customer_id: Optional[str] = None) -> dict:
        """
        Generate AR aging report.

        Returns breakdown by aging bucket:
        - Current (not yet due)
        - 1-30 days overdue
        - 31-60 days overdue
        - 61-90 days overdue
        - Over 90 days overdue
        """
        invoices = await self.invoice_repo.list_invoices(
            customer_id=customer_id,
            status=None,
        )

        active_invoices = [
            inv for inv in invoices
            if inv.status in (ARInvoiceStatus.SENT, ARInvoiceStatus.PARTIALLY_PAID, ARInvoiceStatus.OVERDUE)
        ]

        today = date.today()
        aging = {
            "current": Decimal("0"),
            "1_30_days": Decimal("0"),
            "31_60_days": Decimal("0"),
            "61_90_days": Decimal("0"),
            "over_90_days": Decimal("0"),
            "total": Decimal("0"),
        }

        for invoice in active_invoices:
            amount_due = invoice.amount_due
            days_overdue = invoice.days_overdue

            if days_overdue == 0:
                aging["current"] += amount_due
            elif days_overdue <= 30:
                aging["1_30_days"] += amount_due
            elif days_overdue <= 60:
                aging["31_60_days"] += amount_due
            elif days_overdue <= 90:
                aging["61_90_days"] += amount_due
            else:
                aging["over_90_days"] += amount_due

            aging["total"] += amount_due

        return aging
