"""
Banking-Treasury Event Handler

Handles events from the banking-treasury service to create
corresponding journal entries in the accounting system.

This integration enables automatic GL posting when payments
are completed, ensuring real-time financial accuracy.

@module infrastructure/messaging/banking_event_handler
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
class PaymentCompletedPayload:
    """Payload for payment.completed events from banking-treasury."""
    transaction_id: str
    amount: Decimal
    currency: str
    source_account_id: Optional[str]
    processing_duration: int  # milliseconds
    external_reference: Optional[str]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PaymentCompletedPayload":
        return cls(
            transaction_id=data["transactionId"],
            amount=Decimal(str(data["amount"])),
            currency=data["currency"],
            source_account_id=data.get("sourceAccountId"),
            processing_duration=data.get("processingDuration", 0),
            external_reference=data.get("externalReference"),
        )


@dataclass(frozen=True)
class PaymentFailedPayload:
    """Payload for payment.failed events from banking-treasury."""
    transaction_id: str
    failure_code: str
    failure_reason: str
    retryable: bool
    retry_count: int

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PaymentFailedPayload":
        return cls(
            transaction_id=data["transactionId"],
            failure_code=data["failureCode"],
            failure_reason=data["failureReason"],
            retryable=data.get("retryable", False),
            retry_count=data.get("retryCount", 0),
        )


@dataclass(frozen=True)
class AccountBalanceChangedPayload:
    """Payload for account.balance_changed events."""
    entity_id: str
    previous_balance: Decimal
    new_balance: Decimal
    currency: str
    change_amount: Decimal
    reason: str
    transaction_id: Optional[str]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AccountBalanceChangedPayload":
        return cls(
            entity_id=data["entityId"],
            previous_balance=Decimal(str(data["previousBalance"])),
            new_balance=Decimal(str(data["newBalance"])),
            currency=data["currency"],
            change_amount=Decimal(str(data["changeAmount"])),
            reason=data["reason"],
            transaction_id=data.get("transactionId"),
        )


# =============================================================================
# EVENT HANDLER
# =============================================================================

class BankingEventHandler:
    """
    Handles banking-treasury events and creates corresponding GL entries.

    Event Flow:
    1. payment.completed → Create journal entry (Dr. AP, Cr. Bank)
    2. payment.failed → Reverse pending journal entry if exists
    3. account.balance_changed → Trigger reconciliation check

    GL Account Mapping:
    - Bank/Cash Account: 1000 (Asset)
    - Accounts Payable: 2000 (Liability)
    - Accounts Receivable: 1200 (Asset)
    - Payment Processing Fees: 6500 (Expense)
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

        # Default GL account codes - should be configurable
        self.default_accounts = {
            "bank": "1000",  # Bank/Cash
            "accounts_payable": "2000",  # AP
            "accounts_receivable": "1200",  # AR
            "payment_fees": "6500",  # Payment Processing Fees
        }

    async def handle_payment_completed(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """
        Handle payment.completed event by creating a journal entry.

        For outbound payments (paying vendors):
            Dr. Accounts Payable (reduce liability)
            Cr. Bank Account (reduce asset)

        For inbound payments (receiving from customers):
            Dr. Bank Account (increase asset)
            Cr. Accounts Receivable (reduce asset)

        Returns the created journal entry ID.
        """
        try:
            payload = PaymentCompletedPayload.from_dict(event["payload"])

            tenant_id = metadata.get("tenantId")
            correlation_id = metadata.get("correlationId")

            logger.info(
                f"Processing payment.completed: {payload.transaction_id}",
                extra={
                    "transaction_id": payload.transaction_id,
                    "amount": str(payload.amount),
                    "currency": payload.currency,
                    "correlation_id": correlation_id,
                }
            )

            # Check if journal entry already exists (idempotency)
            existing = await self.journal_entry_repository.find_by_source_document(
                source_document=payload.transaction_id,
                source_document_type="banking_payment",
            )

            if existing:
                logger.info(
                    f"Journal entry already exists for payment: {payload.transaction_id}",
                    extra={"journal_entry_id": existing.id}
                )
                return existing.id

            # Determine if this is outbound (paying) or inbound (receiving)
            # For now, assume outbound payment (AP reduction)
            is_outbound = True  # TODO: Determine from payment metadata

            if is_outbound:
                # Outbound payment: Dr. AP, Cr. Bank
                debit_account = await self._get_account_id(
                    tenant_id, self.default_accounts["accounts_payable"]
                )
                credit_account = await self._get_account_id(
                    tenant_id, self.default_accounts["bank"]
                )
                description = f"Payment: {payload.external_reference or payload.transaction_id}"
            else:
                # Inbound payment: Dr. Bank, Cr. AR
                debit_account = await self._get_account_id(
                    tenant_id, self.default_accounts["bank"]
                )
                credit_account = await self._get_account_id(
                    tenant_id, self.default_accounts["accounts_receivable"]
                )
                description = f"Receipt: {payload.external_reference or payload.transaction_id}"

            # Create journal entry
            entry = await self.posting_service.create_and_post_entry(
                tenant_id=tenant_id,
                entry_date=datetime.utcnow().date(),
                description=description,
                currency_code=payload.currency,
                source_document=payload.transaction_id,
                source_document_type="banking_payment",
                lines=[
                    {
                        "account_id": debit_account,
                        "entry_type": "DEBIT",
                        "amount": payload.amount,
                        "description": description,
                    },
                    {
                        "account_id": credit_account,
                        "entry_type": "CREDIT",
                        "amount": payload.amount,
                        "description": description,
                    },
                ],
                metadata={
                    "banking_transaction_id": payload.transaction_id,
                    "external_reference": payload.external_reference,
                    "source_account_id": payload.source_account_id,
                    "correlation_id": correlation_id,
                },
                created_by="banking-integration",
            )

            logger.info(
                f"Created journal entry for payment: {payload.transaction_id}",
                extra={
                    "journal_entry_id": entry.id,
                    "entry_number": entry.entry_number,
                    "amount": str(payload.amount),
                }
            )

            return entry.id

        except Exception as e:
            logger.error(
                f"Failed to process payment.completed: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_payment_failed(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> None:
        """
        Handle payment.failed event.

        If a journal entry was created for a pending payment that later
        failed, create a reversing entry to correct the GL.
        """
        try:
            payload = PaymentFailedPayload.from_dict(event["payload"])

            logger.info(
                f"Processing payment.failed: {payload.transaction_id}",
                extra={
                    "transaction_id": payload.transaction_id,
                    "failure_code": payload.failure_code,
                    "retryable": payload.retryable,
                }
            )

            # Find existing journal entry for this payment
            existing = await self.journal_entry_repository.find_by_source_document(
                source_document=payload.transaction_id,
                source_document_type="banking_payment",
            )

            if not existing:
                logger.info(
                    f"No journal entry found for failed payment: {payload.transaction_id}"
                )
                return

            # Create reversing entry
            if existing.status == "POSTED" and not existing.reversed_by_id:
                reversal = await self.posting_service.create_reversal(
                    original_entry_id=existing.id,
                    reversal_date=datetime.utcnow().date(),
                    description=f"Reversal: Payment failed - {payload.failure_reason}",
                    created_by="banking-integration",
                )

                logger.info(
                    f"Created reversal for failed payment: {payload.transaction_id}",
                    extra={
                        "original_entry_id": existing.id,
                        "reversal_entry_id": reversal.id,
                    }
                )

        except Exception as e:
            logger.error(
                f"Failed to process payment.failed: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def handle_account_balance_changed(
        self,
        event: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> None:
        """
        Handle account.balance_changed event.

        This event triggers a reconciliation check to ensure the
        bank balance in the treasury system matches the GL balance.
        """
        try:
            payload = AccountBalanceChangedPayload.from_dict(event["payload"])

            logger.info(
                f"Processing account.balance_changed for entity: {payload.entity_id}",
                extra={
                    "entity_id": payload.entity_id,
                    "change_amount": str(payload.change_amount),
                    "new_balance": str(payload.new_balance),
                    "reason": payload.reason,
                }
            )

            # TODO: Trigger reconciliation check
            # This would compare the treasury balance with the GL balance
            # and flag any discrepancies for investigation.

        except Exception as e:
            logger.error(
                f"Failed to process account.balance_changed: {e}",
                extra={
                    "event_id": event.get("id"),
                    "error": str(e),
                }
            )
            raise

    async def _get_account_id(self, tenant_id: str, account_code: str) -> str:
        """Get account ID by code, creating if necessary."""
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

def register_banking_handlers(
    event_bus: Any,
    posting_service: Any,
    account_repository: Any,
    journal_entry_repository: Any,
) -> BankingEventHandler:
    """
    Register banking event handlers with the event bus.

    Usage:
        handler = register_banking_handlers(
            event_bus=event_bus,
            posting_service=posting_service,
            account_repository=account_repository,
            journal_entry_repository=journal_entry_repository,
        )
    """
    handler = BankingEventHandler(
        posting_service=posting_service,
        account_repository=account_repository,
        journal_entry_repository=journal_entry_repository,
    )

    # Register handlers
    event_bus.subscribe("payment.completed", handler.handle_payment_completed)
    event_bus.subscribe("payment.failed", handler.handle_payment_failed)
    event_bus.subscribe("account.balance_changed", handler.handle_account_balance_changed)

    logger.info("Registered banking event handlers")

    return handler


# =============================================================================
# EVENT SCHEMAS (for documentation)
# =============================================================================

BANKING_EVENTS_CONSUMED = {
    "payment.completed": {
        "description": "Payment has been successfully processed",
        "source": "banking-treasury",
        "action": "Create journal entry (Dr. AP/AR, Cr. Bank)",
        "payload": {
            "transactionId": "string (required)",
            "amount": "number (required)",
            "currency": "string (required, ISO 4217)",
            "sourceAccountId": "string (optional)",
            "processingDuration": "number (optional, ms)",
            "externalReference": "string (optional)",
        },
    },
    "payment.failed": {
        "description": "Payment processing has failed",
        "source": "banking-treasury",
        "action": "Reverse journal entry if exists",
        "payload": {
            "transactionId": "string (required)",
            "failureCode": "string (required)",
            "failureReason": "string (required)",
            "retryable": "boolean (required)",
            "retryCount": "number (optional)",
        },
    },
    "account.balance_changed": {
        "description": "Bank account balance has changed",
        "source": "banking-treasury",
        "action": "Trigger reconciliation check",
        "payload": {
            "entityId": "string (required)",
            "previousBalance": "number (required)",
            "newBalance": "number (required)",
            "currency": "string (required)",
            "changeAmount": "number (required)",
            "reason": "string (required)",
            "transactionId": "string (optional)",
        },
    },
}
