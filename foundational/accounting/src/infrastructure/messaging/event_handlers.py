"""
Event Handlers for incoming domain events from other services.

Handles events from:
- Banking-Treasury: Payment events for automatic GL posting
- Entity-Governance: Entity lifecycle events, cost center mapping
- Tax: Tax provision events, VAT/CT liability entries

This module provides:
1. Simple async handlers for basic event logging (original handlers)
2. Integration with full handler classes for actual GL posting

For production use, the full handler classes should be registered
via register_all_handlers() which injects the required repositories.

Research Grounding: MISSION.md (ecosystem integration)
"""

from decimal import Decimal
from typing import Any, Optional

import structlog

from src.infrastructure.messaging.events import (
    DomainEvent,
    EventMetadata,
    JournalEntryPosted,
)

# Import specialized handler modules
from src.infrastructure.messaging.banking_event_handler import (
    BankingEventHandler,
    register_banking_handlers,
)
from src.infrastructure.messaging.tax_event_handler import (
    TaxEventHandler,
    register_tax_handlers,
    TAX_EVENTS_CONSUMED,
)
from src.infrastructure.messaging.entity_event_handler import (
    EntityEventHandler,
    register_entity_handlers,
    ENTITY_EVENTS_CONSUMED,
)


logger = structlog.get_logger()

# Module-level handler instances (set during initialization)
_banking_handler: Optional[BankingEventHandler] = None
_tax_handler: Optional[TaxEventHandler] = None
_entity_handler: Optional[EntityEventHandler] = None


# =============================================================================
# Banking-Treasury Event Handlers
# =============================================================================


async def handle_payment_completed(event_data: dict[str, Any]) -> None:
    """
    Handle payment.completed event from Banking-Treasury.

    When a payment is completed, we may need to create a journal entry
    to record the cash movement.

    Event payload:
        - payment_id: str
        - transaction_id: str
        - amount: number
        - currency: str
        - source_account_id: str (optional)
        - processing_duration: number
        - external_reference: str (optional)
    """
    logger.info(
        "handling_payment_completed",
        payment_id=event_data.get("data", {}).get("payment_id"),
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    payment_id = payload.get("transactionId") or payload.get("payment_id")
    amount = payload.get("amount")
    currency = payload.get("currency", "USD")
    source_account_id = payload.get("sourceAccountId")

    if not payment_id or amount is None:
        logger.warning("payment_completed_missing_data", event_data=event_data)
        return

    # In a full implementation, this would:
    # 1. Look up the payment details
    # 2. Determine the GL accounts to debit/credit
    # 3. Create a journal entry
    # 4. Post the entry if auto-posting is enabled

    logger.info(
        "payment_completed_processed",
        payment_id=payment_id,
        amount=amount,
        currency=currency,
        action="journal_entry_creation_pending",
    )


async def handle_account_balance_changed(event_data: dict[str, Any]) -> None:
    """
    Handle account.balance_changed event from Banking-Treasury.

    This event indicates a bank account balance has changed,
    which may trigger reconciliation workflows.
    """
    logger.info(
        "handling_account_balance_changed",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    account_id = payload.get("accountId")
    previous_balance = payload.get("previousBalance")
    new_balance = payload.get("newBalance")
    change_amount = payload.get("changeAmount")

    logger.info(
        "account_balance_changed_processed",
        account_id=account_id,
        change_amount=change_amount,
        action="reconciliation_check_pending",
    )


async def handle_reconciliation_completed(event_data: dict[str, Any]) -> None:
    """
    Handle reconciliation.completed event from Banking-Treasury.

    When a reconciliation is completed, we record any adjustments
    and update the GL accordingly.
    """
    logger.info(
        "handling_reconciliation_completed",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    reconciliation_id = payload.get("reconciliationId")
    matched_count = payload.get("matchedCount", 0)
    exception_count = payload.get("exceptionCount", 0)
    difference = payload.get("difference", 0)

    if exception_count > 0 or difference != 0:
        logger.warning(
            "reconciliation_has_exceptions",
            reconciliation_id=reconciliation_id,
            exception_count=exception_count,
            difference=difference,
        )

    logger.info(
        "reconciliation_completed_processed",
        reconciliation_id=reconciliation_id,
        matched_count=matched_count,
        action="gl_adjustment_pending" if difference != 0 else "no_action_required",
    )


# =============================================================================
# Entity-Governance Event Handlers
# =============================================================================


async def handle_entity_created(event_data: dict[str, Any]) -> None:
    """
    Handle entity.created event from Entity-Governance.

    When a new legal entity is created, we may need to set up
    its chart of accounts and initial GL structure.
    """
    logger.info(
        "handling_entity_created",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    entity_id = payload.get("entityId")
    entity_name = payload.get("name")
    entity_type = payload.get("entityType")

    logger.info(
        "entity_created_processed",
        entity_id=entity_id,
        entity_name=entity_name,
        entity_type=entity_type,
        action="chart_of_accounts_setup_pending",
    )


# =============================================================================
# Tax Event Handlers
# =============================================================================


async def handle_tax_provision_required(event_data: dict[str, Any]) -> None:
    """
    Handle tax.provision.required event from Tax service.

    When a tax provision is required, we create a journal entry
    to record the tax liability.
    """
    logger.info(
        "handling_tax_provision_required",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    tax_type = payload.get("taxType")
    amount = payload.get("amount")
    period = payload.get("period")

    logger.info(
        "tax_provision_required_processed",
        tax_type=tax_type,
        amount=amount,
        period=period,
        action="tax_provision_journal_entry_pending",
    )


async def handle_corporation_tax_calculated(event_data: dict[str, Any]) -> None:
    """
    Handle tax.corporation_tax.calculated event from Tax service.

    Creates a journal entry for the corporation tax liability:
        Dr. Corporation Tax Expense
        Cr. Corporation Tax Liability

    If full handler is available, delegates to TaxEventHandler.
    """
    logger.info(
        "handling_corporation_tax_calculated",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    period_id = payload.get("periodId")
    liability = payload.get("corporationTaxLiability")
    rate = payload.get("rateApplied")

    if _tax_handler:
        # Delegate to full handler with repository access
        await _tax_handler.handle_corporation_tax_calculated(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        logger.info(
            "corporation_tax_calculated_processed",
            period_id=period_id,
            liability=liability,
            rate=rate,
            action="ct_provision_journal_entry_pending",
        )


async def handle_vat_return_submitted(event_data: dict[str, Any]) -> None:
    """
    Handle tax.vat_return.submitted event from Tax service.

    Creates VAT settlement journal entries:
        For payable: Dr. VAT Output, Cr. VAT Input, Cr. VAT Control
        For reclaimable: Dr. VAT Output, Dr. VAT Control, Cr. VAT Input

    If full handler is available, delegates to TaxEventHandler.
    """
    logger.info(
        "handling_vat_return_submitted",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    return_id = payload.get("returnId")
    period_key = payload.get("periodKey")
    net_vat = payload.get("netVAT")

    if _tax_handler:
        await _tax_handler.handle_vat_return_submitted(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        direction = "payable" if float(net_vat or 0) > 0 else "reclaimable"
        logger.info(
            "vat_return_submitted_processed",
            return_id=return_id,
            period_key=period_key,
            net_vat=net_vat,
            direction=direction,
            action="vat_settlement_journal_entry_pending",
        )


async def handle_corporation_tax_paid(event_data: dict[str, Any]) -> None:
    """
    Handle tax.corporation_tax.paid event from Tax service.

    Creates journal entry to clear CT liability:
        Dr. Corporation Tax Liability
        Cr. Bank Account
    """
    logger.info(
        "handling_corporation_tax_paid",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    period_id = payload.get("periodId")
    tax_paid = payload.get("taxPaid")

    if _tax_handler:
        await _tax_handler.handle_corporation_tax_paid(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        logger.info(
            "corporation_tax_paid_processed",
            period_id=period_id,
            tax_paid=tax_paid,
            action="ct_payment_journal_entry_pending",
        )


async def handle_paye_fps_created(event_data: dict[str, Any]) -> None:
    """
    Handle tax.paye.fps_created event from Tax service.

    Creates journal entry for employer NI liability:
        Dr. Employer NI Expense
        Cr. NI Liability
    """
    logger.info(
        "handling_paye_fps_created",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    submission_id = payload.get("submissionId")
    tax_month = payload.get("taxMonth")
    total_ni = payload.get("totalNI")

    if _tax_handler:
        await _tax_handler.handle_paye_submission_created(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        logger.info(
            "paye_fps_created_processed",
            submission_id=submission_id,
            tax_month=tax_month,
            total_ni=total_ni,
            action="paye_journal_entry_pending",
        )


# =============================================================================
# Entity-Governance Extended Handlers
# =============================================================================


async def handle_entity_updated(event_data: dict[str, Any]) -> None:
    """
    Handle entity-governance.entity.updated event.

    Updates cost center and segment attributes when entity changes.
    """
    logger.info(
        "handling_entity_updated",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    entity_id = payload.get("entityId")
    changes = payload.get("changes", {})

    if _entity_handler:
        await _entity_handler.handle_entity_updated(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        logger.info(
            "entity_updated_processed",
            entity_id=entity_id,
            changed_fields=list(changes.keys()),
            action="cost_center_update_pending",
        )


async def handle_entity_dissolved(event_data: dict[str, Any]) -> None:
    """
    Handle entity-governance.entity.dissolved event.

    Deactivates cost center and segment for the dissolved entity.
    """
    logger.info(
        "handling_entity_dissolved",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    entity_id = payload.get("entityId")
    dissolution_date = payload.get("dissolutionDate")

    if _entity_handler:
        await _entity_handler.handle_entity_dissolved(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        logger.info(
            "entity_dissolved_processed",
            entity_id=entity_id,
            dissolution_date=dissolution_date,
            action="cost_center_deactivation_pending",
        )


async def handle_subsidiary_added(event_data: dict[str, Any]) -> None:
    """
    Handle entity-governance.structure.subsidiary-added event.

    Updates cost center hierarchy for consolidation.
    """
    logger.info(
        "handling_subsidiary_added",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    parent_id = payload.get("parentEntityId")
    subsidiary_id = payload.get("subsidiaryEntityId")
    ownership = payload.get("ownershipPercentage")

    if _entity_handler:
        await _entity_handler.handle_subsidiary_added(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        logger.info(
            "subsidiary_added_processed",
            parent_entity_id=parent_id,
            subsidiary_entity_id=subsidiary_id,
            ownership_percentage=ownership,
            action="consolidation_mapping_pending",
        )


async def handle_ownership_changed(event_data: dict[str, Any]) -> None:
    """
    Handle entity-governance.structure.ownership-changed event.

    Updates consolidation percentages.
    """
    logger.info(
        "handling_ownership_changed",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    subsidiary_id = payload.get("subsidiaryEntityId")
    new_percentage = payload.get("newPercentage")

    if _entity_handler:
        await _entity_handler.handle_ownership_changed(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        logger.info(
            "ownership_changed_processed",
            subsidiary_entity_id=subsidiary_id,
            new_percentage=new_percentage,
            action="consolidation_update_pending",
        )


async def handle_shares_issued(event_data: dict[str, Any]) -> None:
    """
    Handle entity-governance.shareholders.shares-issued event.

    Creates share capital journal entry:
        Dr. Bank Account
        Cr. Share Capital
        Cr. Share Premium (if applicable)
    """
    logger.info(
        "handling_shares_issued",
        event_id=event_data.get("event_id"),
    )

    payload = event_data.get("data", {})
    entity_id = payload.get("entityId")
    shares_issued = payload.get("sharesIssued")
    issue_price = payload.get("issuePrice")

    if _entity_handler:
        await _entity_handler.handle_shares_issued(
            {"payload": payload},
            {"correlationId": event_data.get("correlation_id")},
        )
    else:
        logger.info(
            "shares_issued_processed",
            entity_id=entity_id,
            shares_issued=shares_issued,
            issue_price=issue_price,
            action="share_capital_journal_entry_pending",
        )


# =============================================================================
# Event Handler Registry
# =============================================================================


EVENT_HANDLERS = {
    # Banking-Treasury events
    "payment.completed": handle_payment_completed,
    "banking.payment.completed": handle_payment_completed,
    "account.balance_changed": handle_account_balance_changed,
    "banking.account.balance_changed": handle_account_balance_changed,
    "reconciliation.completed": handle_reconciliation_completed,
    "banking.reconciliation.completed": handle_reconciliation_completed,

    # Entity-Governance events - lifecycle
    "entity.created": handle_entity_created,
    "entity-governance.entity.created": handle_entity_created,
    "entity.updated": handle_entity_updated,
    "entity-governance.entity.updated": handle_entity_updated,
    "entity-governance.entity.dissolved": handle_entity_dissolved,

    # Entity-Governance events - corporate structure
    "entity-governance.structure.subsidiary-added": handle_subsidiary_added,
    "entity-governance.structure.ownership-changed": handle_ownership_changed,

    # Entity-Governance events - shareholders
    "entity-governance.shareholders.shares-issued": handle_shares_issued,

    # Tax events - legacy
    "tax.provision.required": handle_tax_provision_required,

    # Tax events - Corporation Tax
    "tax.corporation_tax.calculated": handle_corporation_tax_calculated,
    "tax.corporation_tax.paid": handle_corporation_tax_paid,

    # Tax events - VAT
    "tax.vat_return.submitted": handle_vat_return_submitted,

    # Tax events - PAYE
    "tax.paye.fps_created": handle_paye_fps_created,
}


async def dispatch_event(event_data: dict[str, Any]) -> None:
    """
    Dispatch an incoming event to the appropriate handler.

    Args:
        event_data: The event payload from the message queue
    """
    event_type = event_data.get("event_type") or event_data.get("type")

    if not event_type:
        logger.warning("event_missing_type", event_data=event_data)
        return

    handler = EVENT_HANDLERS.get(event_type)

    if handler:
        try:
            await handler(event_data)
        except Exception as e:
            logger.error(
                "event_handler_error",
                event_type=event_type,
                error=str(e),
            )
    else:
        logger.debug(
            "no_handler_for_event",
            event_type=event_type,
        )


# =============================================================================
# Full Handler Registration
# =============================================================================


def register_all_handlers(
    event_bus: Any,
    posting_service: Any,
    account_repository: Any,
    journal_entry_repository: Any,
    cost_center_repository: Optional[Any] = None,
    segment_repository: Optional[Any] = None,
) -> dict[str, Any]:
    """
    Register all event handlers with their required dependencies.

    This should be called during application startup after repositories
    are initialized. It enables the full handler implementations that
    create actual journal entries.

    Args:
        event_bus: The event bus for subscribing to events
        posting_service: Service for creating and posting journal entries
        account_repository: Repository for account lookups
        journal_entry_repository: Repository for journal entry operations
        cost_center_repository: Optional repository for cost centers
        segment_repository: Optional repository for segments

    Returns:
        Dictionary of handler instances keyed by type
    """
    global _banking_handler, _tax_handler, _entity_handler

    handlers = {}

    # Register banking handlers
    _banking_handler = register_banking_handlers(
        event_bus=event_bus,
        posting_service=posting_service,
        account_repository=account_repository,
        journal_entry_repository=journal_entry_repository,
    )
    handlers["banking"] = _banking_handler

    # Register tax handlers
    _tax_handler = register_tax_handlers(
        event_bus=event_bus,
        posting_service=posting_service,
        account_repository=account_repository,
        journal_entry_repository=journal_entry_repository,
    )
    handlers["tax"] = _tax_handler

    # Register entity handlers if repositories provided
    if cost_center_repository and segment_repository:
        _entity_handler = register_entity_handlers(
            event_bus=event_bus,
            posting_service=posting_service,
            account_repository=account_repository,
            cost_center_repository=cost_center_repository,
            segment_repository=segment_repository,
            journal_entry_repository=journal_entry_repository,
        )
        handlers["entity"] = _entity_handler
    else:
        logger.warning(
            "entity_handlers_not_registered",
            reason="cost_center_repository or segment_repository not provided",
        )

    logger.info(
        "all_event_handlers_registered",
        handler_types=list(handlers.keys()),
    )

    return handlers


# =============================================================================
# Event Schema Documentation
# =============================================================================


ALL_EVENTS_CONSUMED = {
    # Banking events
    "banking": {
        "payment.completed": {
            "description": "Payment has been successfully processed",
            "source": "banking-treasury",
            "action": "Create journal entry (Dr. AP/AR, Cr. Bank)",
        },
        "account.balance_changed": {
            "description": "Bank account balance has changed",
            "source": "banking-treasury",
            "action": "Trigger reconciliation check",
        },
        "reconciliation.completed": {
            "description": "Bank reconciliation completed",
            "source": "banking-treasury",
            "action": "Record adjustments to GL",
        },
    },
    # Tax events
    "tax": TAX_EVENTS_CONSUMED,
    # Entity events
    "entity": ENTITY_EVENTS_CONSUMED,
}
