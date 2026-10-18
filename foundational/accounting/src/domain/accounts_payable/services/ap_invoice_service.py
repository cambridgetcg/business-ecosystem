"""
AP Invoice Service - orchestrates AP invoice operations.

Handles the AP invoice lifecycle:
1. Create invoice from vendor bill
2. Submit for approval
3. Approve invoice (creates GL entry)
4. Track payments
5. Close when fully paid
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.accounts_payable.models.vendor import Vendor
from src.domain.accounts_payable.models.ap_invoice import (
    APInvoice,
    APInvoiceLine,
    APInvoiceStatus,
)
from src.domain.accounts_payable.repositories.vendor_repository import VendorRepository
from src.domain.accounts_payable.repositories.ap_invoice_repository import APInvoiceRepository
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import EntryType
from src.domain.general_ledger.models.posting_status import PostingStatus
from src.domain.general_ledger.repositories.journal_entry_repository import JournalEntryRepository
from src.domain.shared.exceptions import ValidationError, EntityNotFoundError


class APInvoiceService:
    """
    Service for managing AP invoices.

    Orchestrates invoice creation, approval, and GL posting.
    """

    # Default AP account code (should be configurable)
    DEFAULT_AP_ACCOUNT_CODE = "2000"

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.vendor_repo = VendorRepository(session)
        self.invoice_repo = APInvoiceRepository(session)
        self.je_repo = JournalEntryRepository(session)

    async def create_invoice(
        self,
        vendor_id: str,
        invoice_date: date,
        lines: list[dict],
        vendor_invoice_number: Optional[str] = None,
        description: Optional[str] = None,
        tax_amount: Decimal = Decimal("0"),
        currency_code: str = "USD",
        created_by: Optional[str] = None,
    ) -> APInvoice:
        """
        Create a new AP invoice.

        Args:
            vendor_id: Vendor this invoice is from
            invoice_date: Date on the invoice
            lines: List of line items with account_id, description, quantity, unit_price
            vendor_invoice_number: Vendor's invoice number
            description: Invoice description
            tax_amount: Total tax amount
            currency_code: Invoice currency
            created_by: User creating the invoice

        Returns:
            Created APInvoice
        """
        # Validate vendor
        vendor = await self.vendor_repo.get_by_id(vendor_id)
        if not vendor:
            raise EntityNotFoundError(
                entity_type="Vendor",
                entity_id=vendor_id,
            )

        if not vendor.is_active:
            raise ValidationError(
                field="vendor_id",
                message=f"Vendor {vendor.code} is not active",
            )

        # Generate invoice number
        year = invoice_date.year
        invoice_number = await self.invoice_repo.get_next_invoice_number(year)

        # Calculate due date from vendor terms
        due_date = vendor.calculate_due_date(invoice_date)

        # Create invoice
        invoice = APInvoice(
            invoice_number=invoice_number,
            vendor_invoice_number=vendor_invoice_number,
            vendor_id=vendor_id,
            invoice_date=invoice_date,
            due_date=due_date,
            received_date=date.today(),
            status=APInvoiceStatus.DRAFT,
            currency_code=currency_code,
            tax_amount=tax_amount,
            description=description,
            created_by=created_by,
        )

        # Add lines
        subtotal = Decimal("0")
        for idx, line_data in enumerate(lines):
            quantity = Decimal(str(line_data.get("quantity", 1)))
            unit_price = Decimal(str(line_data["unit_price"]))
            amount = quantity * unit_price
            subtotal += amount

            line = APInvoiceLine(
                line_number=idx,
                description=line_data["description"],
                quantity=quantity,
                unit_price=unit_price,
                amount=amount,
                expense_account_id=line_data["expense_account_id"],
                category=line_data.get("category"),
                project_id=line_data.get("project_id"),
            )
            invoice.lines.append(line)

        # Set totals
        invoice.subtotal = subtotal
        invoice.total_amount = subtotal + tax_amount

        # Save
        return await self.invoice_repo.add(invoice)

    async def submit_for_approval(self, invoice_id: str) -> APInvoice:
        """
        Submit an invoice for approval.

        Transitions from DRAFT to PENDING.
        """
        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise EntityNotFoundError(
                entity_type="APInvoice",
                entity_id=invoice_id,
            )

        if invoice.status != APInvoiceStatus.DRAFT:
            raise ValidationError(
                field="status",
                message=f"Cannot submit invoice with status {invoice.status.value}",
            )

        if not invoice.lines:
            raise ValidationError(
                field="lines",
                message="Invoice must have at least one line",
            )

        invoice.status = APInvoiceStatus.PENDING
        return await self.invoice_repo.save(invoice)

    async def approve_invoice(
        self,
        invoice_id: str,
        ap_account_id: str,
        approved_by: str,
    ) -> APInvoice:
        """
        Approve an invoice and create the GL entry.

        Creates:
            Dr. Expense accounts (from lines)
            Cr. Accounts Payable

        Args:
            invoice_id: Invoice to approve
            ap_account_id: AP account to credit
            approved_by: User approving

        Returns:
            Approved invoice with journal entry
        """
        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise EntityNotFoundError(
                entity_type="APInvoice",
                entity_id=invoice_id,
            )

        if not invoice.can_be_approved:
            raise ValidationError(
                field="status",
                message=f"Cannot approve invoice with status {invoice.status.value}",
            )

        # Create journal entry
        je_number = await self.je_repo.get_next_entry_number(invoice.invoice_date.year)

        # Get fiscal period (simplified - should look up actual period)
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
            description=f"AP Invoice {invoice.invoice_number} - {invoice.vendor.name}",
            source_document=invoice.invoice_number,
            source_document_type="AP_INVOICE",
            currency_code=invoice.currency_code,
            status=PostingStatus.DRAFT,
        )

        # Debit expense accounts (from invoice lines)
        line_num = 0
        for inv_line in invoice.lines:
            journal_entry.add_line(
                account_id=inv_line.expense_account_id,
                entry_type=EntryType.DEBIT,
                amount=inv_line.amount,
                description=inv_line.description,
            )
            line_num += 1

        # Credit AP account for total
        journal_entry.add_line(
            account_id=ap_account_id,
            entry_type=EntryType.CREDIT,
            amount=invoice.total_amount,
            description=f"AP - {invoice.vendor.name}",
        )

        # Validate and save journal entry
        journal_entry.validate_for_posting()
        journal_entry = await self.je_repo.add(journal_entry)

        # Post the journal entry
        from src.domain.general_ledger.services.posting_service import PostingService
        posting_service = PostingService(self.session)
        journal_entry = await posting_service.post_entry(journal_entry.id, approved_by)

        # Update invoice
        invoice.status = APInvoiceStatus.APPROVED
        invoice.approved_at = datetime.utcnow()
        invoice.approved_by = approved_by
        invoice.journal_entry_id = journal_entry.id
        invoice.ap_account_id = ap_account_id

        # Update vendor balance
        vendor = await self.vendor_repo.get_by_id(invoice.vendor_id)
        if vendor:
            vendor.current_balance += invoice.total_amount
            await self.vendor_repo.save(vendor)

        return await self.invoice_repo.save(invoice)

    async def cancel_invoice(
        self,
        invoice_id: str,
        cancelled_by: str,
        reason: str,
    ) -> APInvoice:
        """Cancel an invoice (if not yet paid)."""
        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise EntityNotFoundError(
                entity_type="APInvoice",
                entity_id=invoice_id,
            )

        if invoice.status in (APInvoiceStatus.PAID, APInvoiceStatus.PARTIALLY_PAID):
            raise ValidationError(
                field="status",
                message="Cannot cancel an invoice with payments",
            )

        # If approved, need to reverse the GL entry
        if invoice.status == APInvoiceStatus.APPROVED and invoice.journal_entry_id:
            # Create reversing entry
            from src.domain.general_ledger.services.posting_service import PostingService
            posting_service = PostingService(self.session)
            await posting_service.reverse_entry(
                invoice.journal_entry_id,
                cancelled_by,
                reason,
            )

            # Update vendor balance
            vendor = await self.vendor_repo.get_by_id(invoice.vendor_id)
            if vendor:
                vendor.current_balance -= invoice.total_amount
                await self.vendor_repo.save(vendor)

        invoice.status = APInvoiceStatus.CANCELLED
        return await self.invoice_repo.save(invoice)

    async def get_aging_report(self) -> dict:
        """
        Generate AP aging report.

        Returns breakdown by aging bucket:
        - Current (not yet due)
        - 1-30 days overdue
        - 31-60 days overdue
        - 61-90 days overdue
        - Over 90 days overdue
        """
        invoices = await self.invoice_repo.get_payable_invoices()
        today = date.today()

        aging = {
            "current": Decimal("0"),
            "1_30_days": Decimal("0"),
            "31_60_days": Decimal("0"),
            "61_90_days": Decimal("0"),
            "over_90_days": Decimal("0"),
            "total": Decimal("0"),
        }

        for invoice in invoices:
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
