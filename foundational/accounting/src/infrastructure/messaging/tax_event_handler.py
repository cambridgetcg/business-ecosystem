"""
Tax Service Event Handler

Handles events from the Tax service to create corresponding journal entries
in the accounting system for tax liabilities and payments.

This integration enables automatic GL posting when:
- Corporation tax is calculated (creates tax liability provision)
- VAT returns are submitted (creates VAT liability/receivable entries)
- Tax payments are processed (clears tax liability accounts)

@module infrastructure/messaging/tax_event_handler
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# EVENT PAYLOADS
# =============================================================================

@dataclass(frozen=True)
class CorporationTaxCalculatedPayload:
    """Payload for tax.corporation_tax.calculated events."""
    period_id: str
    tenant_id: str
    entity_id: str
    profits_chargeable: Decimal
    corporation_tax_liability: Decimal
    effective_rate: Decimal
    rate_applied: str  # 'small_profits' | 'marginal' | 'main'
    marginal_relief: Decimal

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CorporationTaxCalculatedPayload":
        return cls(
            period_id=data["periodId"],
            tenant_id=data["tenantId"],
            entity_id=data["entityId"],
            profits_chargeable=Decimal(str(data["profitsChargeableToCT"])),
            corporation_tax_liability=Decimal(str(data["corporationTaxLiability"])),
            effective_rate=Decimal(str(data.get("effectiveRate", "0"))),
            rate_applied=data.get("rateApplied", "main"),
            marginal_relief=Decimal(str(data.get("marginalRelief", "0"))),
        )


@dataclass(frozen=True)
class VATReturnSubmittedPayload:
    """Payload for tax.vat_return.submitted events."""
    return_id: str
    tenant_id: str
    entity_id: str
    period_key: str
    submitted_at: str
    mtd_receipt_id: str
    net_vat: Decimal
    # Detailed VAT boxes from the return
    box1: Optional[Decimal] = None  # VAT due on sales
    box2: Optional[Decimal] = None  # VAT due on acquisitions
    box3: Optional[Decimal] = None  # Total VAT due (box1 + box2)
    box4: Optional[Decimal] = None  # VAT reclaimed on purchases
    box5: Optional[Decimal] = None  # Net VAT (box3 - box4)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VATReturnSubmittedPayload":
        return cls(
            return_id=data["returnId"],
            tenant_id=data["tenantId"],
            entity_id=data["entityId"],
            period_key=data["periodKey"],
            submitted_at=data["submittedAt"],
            mtd_receipt_id=data.get("mtdReceiptId", ""),
            net_vat=Decimal(str(data["netVAT"])),
            box1=Decimal(str(data.get("box1", "0"))) if "box1" in data else None,
            box2=Decimal(str(data.get("box2", "0"))) if "box2" in data else None,
            box3=Decimal(str(data.get("box3", "0"))) if "box3" in data else None,
            box4=Decimal(str(data.get("box4", "0"))) if "box4" in data else None,
            box5=Decimal(str(data.get("box5", "0"))) if "box5" in data else None,
        )


@dataclass(frozen=True)
class CorporationTaxPaidPayload:
    """Payload for tax.corporation_tax.paid events."""
    period_id: str
    tenant_id: str
    entity_id: str
    tax_due: Decimal
    tax_paid: Decimal
    paid_at: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CorporationTaxPaidPayload":
        return cls(
            period_id=data["periodId"],
            tenant_id=data["tenantId"],
            entity_id=data["entityId"],
            tax_due=Decimal(str(data["taxDue"])),
            tax_paid=Decimal(str(data["taxPaid"])),
            paid_at=data["paidAt"],
        )


@dataclass(frozen=True)
class PAYESubmissionCreatedPayload:
    """Payload for tax.paye.fps_created and tax.paye.eps_created events."""
    submission_id: str
    tenant_id: str
    entity_id: str
    submission_type: str  # 'fps' | 'eps'
    tax_year: str
    tax_month: int
    employee_count: int
    total_pay: Decimal
    total_tax: Decimal
    total_ni: Decimal

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PAYESubmissionCreatedPayload":
        return cls(
            submission_id=data["submissionId"],
            tenant_id=data["tenantId"],
            entity_id=data["entityId"],
            submission_type=data["submissionType"],
            tax_year=data["taxYear"],
            tax_month=data.get("taxMonth", 0),
            employee_count=data.get("employeeCount", 0),
            total_pay=Decimal(str(data.get("totalPay", "0"))),
            total_tax=Decimal(str(data.get("totalTax", "0"))),
            total_ni=Decimal(str(data.get("totalNI", "0"))),
        )


# =============================================================================
# EVENT HANDLER
# =============================================================================

class TaxEventHandler:
    """
    Handles Tax service events and creates corresponding GL entries.

    Event Flow:
    1. tax.corporation_tax.calculated -> Create CT liability journal entry
    2. tax.vat_return.submitted -> Create VAT liability/receivable entry
    3. tax.corporation_tax.paid -> Clear CT liability account
    4. tax.paye.fps_created -> Create PAYE/NI liability entries

    GL Account Mapping (UK Standard):
    - Corporation Tax Liability: 2210 (Current Liability)
    - Corporation Tax Expense: 8100 (Tax Expense)
    - VAT Output (Liability): 2205 (Current Liability)
    - VAT Input (Asset): 1210 (Current Asset)
    - VAT Control: 2206 (Net VAT position)
    - PAYE Liability: 2220 (Current Liability)
    - NI Liability: 2221 (Current Liability)
    - Bank/Cash: 1000 (Current Asset)
    """

    def __init__(
        self,
        posting_service: Any,  # PostingService
        account_repository: Any,  # AccountRepository
        journal_entry_repository: Any,  # JournalEntryRepository
    ):
        self.posting_service = posting_service
        self.account_repository = account_repository
        self.journal_entry_repository = journal_entry_repository

        # UK-standard GL account codes - should be configurable per entity
        self.default_accounts = {
            # Assets
            "bank": "1000",
            "vat_input": "1210",  # VAT recoverable
            # Liabilities
            "corporation_tax": "2210",
            "vat_output": "2205",
            "vat_control": "2206",  # Net VAT position
            "paye_liability": "2220",
            "ni_liability": "2221",
            # Expenses
            "corporation_tax_expense": "8100",
            "employer_ni_expense": "7110",  # Employer NI contribution
        }

    async def handle_corporation_tax_calculated(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """
        Handle tax.corporation_tax.calculated event by creating a provision entry.

        Creates journal entry:
            Dr. Corporation Tax Expense (8100)
            Cr. Corporation Tax Liability (2210)

        This records the tax provision when corporation tax is calculated.
        Returns the created journal entry ID.
        """
        try:
            payload = CorporationTaxCalculatedPayload.from_dict(event["payload"])

            tenant_id = payload.tenant_id
            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing corporation_tax.calculated: period={payload.period_id}",
                extra={
                    "period_id": payload.period_id,
                    "entity_id": payload.entity_id,
                    "liability": str(payload.corporation_tax_liability),
                    "correlation_id": correlation_id,
                }
            )

            # Skip if no tax liability
            if payload.corporation_tax_liability <= 0:
                logger.info(
                    f"No tax liability for period: {payload.period_id}",
                    extra={"period_id": payload.period_id}
                )
                return None

            # Check for idempotency
            existing = await self.journal_entry_repository.find_by_source_document(
                source_document=payload.period_id,
                source_document_type="corporation_tax_provision",
            )

            if existing:
                logger.info(
                    f"CT provision entry already exists for period: {payload.period_id}",
                    extra={"journal_entry_id": existing.id}
                )
                return existing.id

            # Get account IDs
            expense_account = await self._get_account_id(
                tenant_id, self.default_accounts["corporation_tax_expense"]
            )
            liability_account = await self._get_account_id(
                tenant_id, self.default_accounts["corporation_tax"]
            )

            description = (
                f"Corporation Tax provision: {payload.rate_applied} rate @ "
                f"{payload.effective_rate}%"
            )

            # Create the provision journal entry
            entry = await self.posting_service.create_and_post_entry(
                tenant_id=tenant_id,
                entry_date=datetime.utcnow().date(),
                description=description,
                currency_code="GBP",
                source_document=payload.period_id,
                source_document_type="corporation_tax_provision",
                lines=[
                    {
                        "account_id": expense_account,
                        "entry_type": "DEBIT",
                        "amount": payload.corporation_tax_liability,
                        "description": f"CT Expense - Period {payload.period_id}",
                    },
                    {
                        "account_id": liability_account,
                        "entry_type": "CREDIT",
                        "amount": payload.corporation_tax_liability,
                        "description": f"CT Liability - Period {payload.period_id}",
                    },
                ],
                metadata={
                    "tax_period_id": payload.period_id,
                    "entity_id": payload.entity_id,
                    "profits_chargeable": str(payload.profits_chargeable),
                    "effective_rate": str(payload.effective_rate),
                    "rate_applied": payload.rate_applied,
                    "marginal_relief": str(payload.marginal_relief),
                    "correlation_id": correlation_id,
                },
                created_by="tax-integration",
            )

            logger.info(
                f"Created CT provision entry for period: {payload.period_id}",
                extra={
                    "journal_entry_id": entry.id,
                    "entry_number": entry.entry_number,
                    "amount": str(payload.corporation_tax_liability),
                }
            )

            return entry.id

        except Exception as e:
            logger.error(
                f"Failed to process corporation_tax.calculated: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_vat_return_submitted(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """
        Handle tax.vat_return.submitted event by creating VAT settlement entry.

        For VAT payable (box5 positive - more output than input):
            Dr. VAT Output Account (2205) - clear output VAT
            Cr. VAT Input Account (1210) - clear input VAT
            Cr. VAT Control/Payable (2206) - net amount due to HMRC

        For VAT reclaimable (box5 negative - more input than output):
            Dr. VAT Output Account (2205) - clear output VAT
            Dr. VAT Control/Receivable (2206) - net amount due from HMRC
            Cr. VAT Input Account (1210) - clear input VAT

        Returns the created journal entry ID.
        """
        try:
            payload = VATReturnSubmittedPayload.from_dict(event["payload"])

            tenant_id = payload.tenant_id
            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing vat_return.submitted: {payload.return_id}",
                extra={
                    "return_id": payload.return_id,
                    "period_key": payload.period_key,
                    "net_vat": str(payload.net_vat),
                    "correlation_id": correlation_id,
                }
            )

            # Check for idempotency
            existing = await self.journal_entry_repository.find_by_source_document(
                source_document=payload.return_id,
                source_document_type="vat_return_settlement",
            )

            if existing:
                logger.info(
                    f"VAT settlement entry already exists for return: {payload.return_id}",
                    extra={"journal_entry_id": existing.id}
                )
                return existing.id

            # Get account IDs
            vat_output_account = await self._get_account_id(
                tenant_id, self.default_accounts["vat_output"]
            )
            vat_input_account = await self._get_account_id(
                tenant_id, self.default_accounts["vat_input"]
            )
            vat_control_account = await self._get_account_id(
                tenant_id, self.default_accounts["vat_control"]
            )

            # Build journal lines based on VAT direction
            lines = []
            net_vat = abs(payload.net_vat)

            # Get box values, defaulting to calculated from net_vat if not provided
            box3 = payload.box3 or (payload.net_vat if payload.net_vat > 0 else Decimal("0"))
            box4 = payload.box4 or (abs(payload.net_vat) if payload.net_vat < 0 else Decimal("0"))

            if payload.net_vat > 0:
                # VAT payable to HMRC
                description = f"VAT Return settlement {payload.period_key}: Payable"

                # Clear output VAT (debit to reduce liability)
                if box3 > 0:
                    lines.append({
                        "account_id": vat_output_account,
                        "entry_type": "DEBIT",
                        "amount": box3,
                        "description": f"Clear VAT Output - {payload.period_key}",
                    })

                # Clear input VAT (credit to reduce asset)
                if box4 > 0:
                    lines.append({
                        "account_id": vat_input_account,
                        "entry_type": "CREDIT",
                        "amount": box4,
                        "description": f"Clear VAT Input - {payload.period_key}",
                    })

                # Net amount payable to control account
                lines.append({
                    "account_id": vat_control_account,
                    "entry_type": "CREDIT",
                    "amount": net_vat,
                    "description": f"VAT Payable to HMRC - {payload.period_key}",
                })

            elif payload.net_vat < 0:
                # VAT reclaimable from HMRC
                description = f"VAT Return settlement {payload.period_key}: Reclaimable"

                # Clear output VAT
                if box3 > 0:
                    lines.append({
                        "account_id": vat_output_account,
                        "entry_type": "DEBIT",
                        "amount": box3,
                        "description": f"Clear VAT Output - {payload.period_key}",
                    })

                # Net amount receivable from control account
                lines.append({
                    "account_id": vat_control_account,
                    "entry_type": "DEBIT",
                    "amount": net_vat,
                    "description": f"VAT Receivable from HMRC - {payload.period_key}",
                })

                # Clear input VAT
                if box4 > 0:
                    lines.append({
                        "account_id": vat_input_account,
                        "entry_type": "CREDIT",
                        "amount": box4,
                        "description": f"Clear VAT Input - {payload.period_key}",
                    })

            else:
                # Nil return - no entries needed
                logger.info(
                    f"Nil VAT return, no entries needed: {payload.return_id}",
                    extra={"return_id": payload.return_id}
                )
                return None

            # Create the settlement journal entry
            entry = await self.posting_service.create_and_post_entry(
                tenant_id=tenant_id,
                entry_date=datetime.utcnow().date(),
                description=description,
                currency_code="GBP",
                source_document=payload.return_id,
                source_document_type="vat_return_settlement",
                lines=lines,
                metadata={
                    "vat_return_id": payload.return_id,
                    "period_key": payload.period_key,
                    "entity_id": payload.entity_id,
                    "mtd_receipt_id": payload.mtd_receipt_id,
                    "submitted_at": payload.submitted_at,
                    "correlation_id": correlation_id,
                },
                created_by="tax-integration",
            )

            logger.info(
                f"Created VAT settlement entry for return: {payload.return_id}",
                extra={
                    "journal_entry_id": entry.id,
                    "entry_number": entry.entry_number,
                    "net_vat": str(payload.net_vat),
                }
            )

            return entry.id

        except Exception as e:
            logger.error(
                f"Failed to process vat_return.submitted: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_corporation_tax_paid(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """
        Handle tax.corporation_tax.paid event by clearing the liability.

        Creates journal entry:
            Dr. Corporation Tax Liability (2210)
            Cr. Bank Account (1000)

        Returns the created journal entry ID.
        """
        try:
            payload = CorporationTaxPaidPayload.from_dict(event["payload"])

            tenant_id = payload.tenant_id
            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing corporation_tax.paid: period={payload.period_id}",
                extra={
                    "period_id": payload.period_id,
                    "tax_paid": str(payload.tax_paid),
                    "correlation_id": correlation_id,
                }
            )

            # Check for idempotency
            existing = await self.journal_entry_repository.find_by_source_document(
                source_document=f"{payload.period_id}_payment",
                source_document_type="corporation_tax_payment",
            )

            if existing:
                logger.info(
                    f"CT payment entry already exists for period: {payload.period_id}",
                    extra={"journal_entry_id": existing.id}
                )
                return existing.id

            # Get account IDs
            liability_account = await self._get_account_id(
                tenant_id, self.default_accounts["corporation_tax"]
            )
            bank_account = await self._get_account_id(
                tenant_id, self.default_accounts["bank"]
            )

            description = f"Corporation Tax payment - Period {payload.period_id}"

            # Create the payment journal entry
            entry = await self.posting_service.create_and_post_entry(
                tenant_id=tenant_id,
                entry_date=datetime.utcnow().date(),
                description=description,
                currency_code="GBP",
                source_document=f"{payload.period_id}_payment",
                source_document_type="corporation_tax_payment",
                lines=[
                    {
                        "account_id": liability_account,
                        "entry_type": "DEBIT",
                        "amount": payload.tax_paid,
                        "description": f"Clear CT Liability - Period {payload.period_id}",
                    },
                    {
                        "account_id": bank_account,
                        "entry_type": "CREDIT",
                        "amount": payload.tax_paid,
                        "description": f"CT Payment - Period {payload.period_id}",
                    },
                ],
                metadata={
                    "tax_period_id": payload.period_id,
                    "entity_id": payload.entity_id,
                    "tax_due": str(payload.tax_due),
                    "paid_at": payload.paid_at,
                    "correlation_id": correlation_id,
                },
                created_by="tax-integration",
            )

            logger.info(
                f"Created CT payment entry for period: {payload.period_id}",
                extra={
                    "journal_entry_id": entry.id,
                    "entry_number": entry.entry_number,
                    "amount": str(payload.tax_paid),
                }
            )

            return entry.id

        except Exception as e:
            logger.error(
                f"Failed to process corporation_tax.paid: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_paye_submission_created(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """
        Handle tax.paye.fps_created event by creating PAYE/NI liability entries.

        Creates journal entries for:
        - PAYE tax withheld from employees
        - Employee NI contributions
        - Employer NI contributions (expense)

        Journal entries:
            For PAYE/Employee NI (already recorded as liabilities in payroll):
                No entry needed here - payroll creates these

            For Employer NI (needs to be expensed):
                Dr. Employer NI Expense (7110)
                Cr. NI Liability (2221)

        Returns the created journal entry ID.
        """
        try:
            payload = PAYESubmissionCreatedPayload.from_dict(event["payload"])

            tenant_id = payload.tenant_id
            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing paye.fps_created: {payload.submission_id}",
                extra={
                    "submission_id": payload.submission_id,
                    "submission_type": payload.submission_type,
                    "tax_month": payload.tax_month,
                    "total_tax": str(payload.total_tax),
                    "total_ni": str(payload.total_ni),
                    "correlation_id": correlation_id,
                }
            )

            # Only process FPS submissions (not EPS)
            if payload.submission_type != "fps":
                logger.info(
                    f"Skipping non-FPS submission: {payload.submission_id}",
                    extra={"submission_type": payload.submission_type}
                )
                return None

            # Check for idempotency
            existing = await self.journal_entry_repository.find_by_source_document(
                source_document=payload.submission_id,
                source_document_type="paye_submission",
            )

            if existing:
                logger.info(
                    f"PAYE entry already exists for submission: {payload.submission_id}",
                    extra={"journal_entry_id": existing.id}
                )
                return existing.id

            # Calculate employer NI (approximately 13.8% of NI-able earnings)
            # Note: Actual employer NI should come from the PAYE system
            # This is a simplified example - real implementation would get this from payload
            employer_ni = payload.total_ni  # Placeholder - should be separate field

            if employer_ni <= 0:
                logger.info(
                    f"No employer NI to record for submission: {payload.submission_id}",
                    extra={"submission_id": payload.submission_id}
                )
                return None

            # Get account IDs
            employer_ni_expense = await self._get_account_id(
                tenant_id, self.default_accounts["employer_ni_expense"]
            )
            ni_liability = await self._get_account_id(
                tenant_id, self.default_accounts["ni_liability"]
            )

            description = (
                f"Employer NI - Tax Year {payload.tax_year} Month {payload.tax_month}"
            )

            # Create employer NI journal entry
            entry = await self.posting_service.create_and_post_entry(
                tenant_id=tenant_id,
                entry_date=datetime.utcnow().date(),
                description=description,
                currency_code="GBP",
                source_document=payload.submission_id,
                source_document_type="paye_submission",
                lines=[
                    {
                        "account_id": employer_ni_expense,
                        "entry_type": "DEBIT",
                        "amount": employer_ni,
                        "description": f"Employer NI - Month {payload.tax_month}",
                    },
                    {
                        "account_id": ni_liability,
                        "entry_type": "CREDIT",
                        "amount": employer_ni,
                        "description": f"NI Liability - Month {payload.tax_month}",
                    },
                ],
                metadata={
                    "paye_submission_id": payload.submission_id,
                    "entity_id": payload.entity_id,
                    "tax_year": payload.tax_year,
                    "tax_month": payload.tax_month,
                    "employee_count": payload.employee_count,
                    "total_pay": str(payload.total_pay),
                    "total_tax": str(payload.total_tax),
                    "correlation_id": correlation_id,
                },
                created_by="tax-integration",
            )

            logger.info(
                f"Created PAYE entry for submission: {payload.submission_id}",
                extra={
                    "journal_entry_id": entry.id,
                    "entry_number": entry.entry_number,
                    "employer_ni": str(employer_ni),
                }
            )

            return entry.id

        except Exception as e:
            logger.error(
                f"Failed to process paye.fps_created: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def _get_account_id(self, tenant_id: str, account_code: str) -> str:
        """Get account ID by code, raising error if not found."""
        account = await self.account_repository.find_by_code(
            tenant_id=tenant_id,
            account_code=account_code,
        )

        if not account:
            raise ValueError(f"Account not found: {account_code}")

        return account.id


# =============================================================================
# HANDLER REGISTRATION
# =============================================================================

def register_tax_handlers(
    event_bus: Any,
    posting_service: Any,
    account_repository: Any,
    journal_entry_repository: Any,
) -> TaxEventHandler:
    """
    Register tax event handlers with the event bus.

    Usage:
        handler = register_tax_handlers(
            event_bus=event_bus,
            posting_service=posting_service,
            account_repository=account_repository,
            journal_entry_repository=journal_entry_repository,
        )
    """
    handler = TaxEventHandler(
        posting_service=posting_service,
        account_repository=account_repository,
        journal_entry_repository=journal_entry_repository,
    )

    # Register handlers for Tax service events
    event_bus.subscribe(
        "tax.corporation_tax.calculated",
        handler.handle_corporation_tax_calculated
    )
    event_bus.subscribe(
        "tax.vat_return.submitted",
        handler.handle_vat_return_submitted
    )
    event_bus.subscribe(
        "tax.corporation_tax.paid",
        handler.handle_corporation_tax_paid
    )
    event_bus.subscribe(
        "tax.paye.fps_created",
        handler.handle_paye_submission_created
    )

    logger.info("Registered tax event handlers")

    return handler


# =============================================================================
# EVENT SCHEMAS (for documentation)
# =============================================================================

TAX_EVENTS_CONSUMED = {
    "tax.corporation_tax.calculated": {
        "description": "Corporation tax has been calculated for a period",
        "source": "tax",
        "action": "Create CT provision journal entry (Dr. CT Expense, Cr. CT Liability)",
        "payload": {
            "periodId": "string (required)",
            "tenantId": "string (required)",
            "entityId": "string (required)",
            "profitsChargeableToCT": "string (required, decimal)",
            "corporationTaxLiability": "string (required, decimal)",
            "effectiveRate": "string (optional, decimal)",
            "rateApplied": "string (optional, 'small_profits'|'marginal'|'main')",
            "marginalRelief": "string (optional, decimal)",
        },
    },
    "tax.vat_return.submitted": {
        "description": "VAT return has been submitted to HMRC",
        "source": "tax",
        "action": "Create VAT settlement entry (clear VAT accounts, record payable/receivable)",
        "payload": {
            "returnId": "string (required)",
            "tenantId": "string (required)",
            "entityId": "string (required)",
            "periodKey": "string (required)",
            "submittedAt": "string (required, ISO 8601)",
            "mtdReceiptId": "string (optional)",
            "netVAT": "string (required, decimal - positive=payable, negative=reclaimable)",
            "box1": "string (optional, decimal - VAT due on sales)",
            "box2": "string (optional, decimal - VAT due on acquisitions)",
            "box3": "string (optional, decimal - Total VAT due)",
            "box4": "string (optional, decimal - VAT reclaimed on purchases)",
            "box5": "string (optional, decimal - Net VAT)",
        },
    },
    "tax.corporation_tax.paid": {
        "description": "Corporation tax payment has been made",
        "source": "tax",
        "action": "Clear CT liability (Dr. CT Liability, Cr. Bank)",
        "payload": {
            "periodId": "string (required)",
            "tenantId": "string (required)",
            "entityId": "string (required)",
            "taxDue": "string (required, decimal)",
            "taxPaid": "string (required, decimal)",
            "paidAt": "string (required, ISO 8601)",
        },
    },
    "tax.paye.fps_created": {
        "description": "PAYE Full Payment Submission created",
        "source": "tax",
        "action": "Create employer NI liability entry",
        "payload": {
            "submissionId": "string (required)",
            "tenantId": "string (required)",
            "entityId": "string (required)",
            "submissionType": "string (required, 'fps'|'eps')",
            "taxYear": "string (required)",
            "taxMonth": "number (required)",
            "employeeCount": "number (optional)",
            "totalPay": "string (optional, decimal)",
            "totalTax": "string (optional, decimal)",
            "totalNI": "string (optional, decimal)",
        },
    },
}
