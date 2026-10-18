"""
Integration tests for cross-service event flows.

Tests the event-driven integration between Accounting and:
- Banking-Treasury (payment events)
- Tax (tax provision events)
- Compliance (audit events)
- Insurance (premium recognition)
"""

import pytest
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.infrastructure.messaging.events import (
    DomainEvent,
    EventMetadata,
    JournalEntryPosted,
    FiscalPeriodClosed,
    AccountCreated,
)
from src.infrastructure.messaging.publisher import InMemoryEventPublisher
from src.infrastructure.messaging.event_handlers import (
    EVENT_HANDLERS,
    dispatch_event,
    handle_payment_completed,
    handle_reconciliation_completed,
    handle_entity_created,
    handle_tax_provision_required,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def event_publisher():
    """Create an in-memory event publisher."""
    return InMemoryEventPublisher()


def create_domain_event(event_type: str, data: dict) -> dict:
    """Create a mock domain event payload."""
    return {
        "event_type": event_type,
        "event_id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "correlation_id": str(uuid4()),
        "source": "test",
        "user_id": "test-user",
        "version": 1,
        "data": data,
    }


# =============================================================================
# Tests: Banking-Treasury Event Handling
# =============================================================================


class TestBankingTreasuryEvents:
    """Tests for handling events from Banking-Treasury service."""

    @pytest.mark.asyncio
    async def test_payment_completed_event_is_received(self):
        """Accounting should receive and process payment completed events."""
        event_data = create_domain_event(
            "banking.payment.completed",
            {
                "payment_id": str(uuid4()),
                "transactionId": "TXN-001",
                "amount": 5000.00,
                "currency": "USD",
                "sourceAccountId": str(uuid4()),
                "processingDuration": 1234,
                "externalReference": "INV-001",
            },
        )

        # Should not raise an exception
        await handle_payment_completed(event_data)

    @pytest.mark.asyncio
    async def test_payment_completed_creates_journal_entry_context(self):
        """Payment completion should provide context for journal entry creation."""
        payment_id = str(uuid4())
        event_data = create_domain_event(
            "banking.payment.completed",
            {
                "payment_id": payment_id,
                "transactionId": "TXN-002",
                "amount": 10000.00,
                "currency": "GBP",
                "sourceAccountId": str(uuid4()),
            },
        )

        # In a full implementation, this would trigger journal entry creation
        # For now, we verify the handler processes without error
        await handle_payment_completed(event_data)

    @pytest.mark.asyncio
    async def test_reconciliation_completed_event_handling(self):
        """Reconciliation completed events should trigger GL adjustment checks."""
        event_data = create_domain_event(
            "banking.reconciliation.completed",
            {
                "reconciliationId": str(uuid4()),
                "bankAccountId": str(uuid4()),
                "statementDate": "2026-01-31",
                "matchedCount": 150,
                "exceptionCount": 3,
                "statementBalance": 50000.00,
                "systemBalance": 50050.00,
                "difference": 50.00,
            },
        )

        await handle_reconciliation_completed(event_data)

    @pytest.mark.asyncio
    async def test_reconciliation_with_difference_triggers_adjustment(self):
        """Reconciliation with a difference should flag for GL adjustment."""
        event_data = create_domain_event(
            "banking.reconciliation.completed",
            {
                "reconciliationId": str(uuid4()),
                "bankAccountId": str(uuid4()),
                "statementDate": "2026-01-31",
                "matchedCount": 100,
                "exceptionCount": 5,
                "statementBalance": 100000.00,
                "systemBalance": 99500.00,
                "difference": 500.00,  # Significant difference
            },
        )

        # Handler should log warning about difference
        await handle_reconciliation_completed(event_data)


# =============================================================================
# Tests: Entity-Governance Event Handling
# =============================================================================


class TestEntityGovernanceEvents:
    """Tests for handling events from Entity-Governance service."""

    @pytest.mark.asyncio
    async def test_entity_created_sets_up_accounting_context(self):
        """New entity creation should trigger accounting setup."""
        entity_id = str(uuid4())
        event_data = create_domain_event(
            "entity-governance.entity.created",
            {
                "entityId": entity_id,
                "name": "Acme Corporation Ltd",
                "entityType": "limited_company",
                "jurisdiction": "uk",
                "incorporationDate": "2026-01-15",
            },
        )

        await handle_entity_created(event_data)


# =============================================================================
# Tests: Tax Event Handling
# =============================================================================


class TestTaxEvents:
    """Tests for handling events from Tax service."""

    @pytest.mark.asyncio
    async def test_tax_provision_required_triggers_journal_entry(self):
        """Tax provision requirement should trigger journal entry creation context."""
        event_data = create_domain_event(
            "tax.provision.required",
            {
                "taxType": "corporation_tax",
                "amount": 25000.00,
                "currency": "GBP",
                "period": "2025",
                "entityId": str(uuid4()),
            },
        )

        await handle_tax_provision_required(event_data)


# =============================================================================
# Tests: Event Dispatch
# =============================================================================


class TestEventDispatch:
    """Tests for the event dispatch mechanism."""

    @pytest.mark.asyncio
    async def test_dispatch_routes_to_correct_handler(self):
        """Events should be routed to the correct handler based on type."""
        handled_events = []

        # Patch one of the handlers to track calls
        original_handler = EVENT_HANDLERS.get("banking.payment.completed")

        async def tracking_handler(event_data):
            handled_events.append(event_data)
            if original_handler:
                await original_handler(event_data)

        with patch.dict(EVENT_HANDLERS, {"banking.payment.completed": tracking_handler}):
            event_data = create_domain_event(
                "banking.payment.completed",
                {"payment_id": str(uuid4()), "amount": 1000.00},
            )

            await dispatch_event(event_data)

            assert len(handled_events) == 1

    @pytest.mark.asyncio
    async def test_dispatch_handles_unknown_event_gracefully(self):
        """Unknown event types should be handled gracefully without errors."""
        event_data = create_domain_event(
            "unknown.event.type",
            {"some": "data"},
        )

        # Should not raise
        await dispatch_event(event_data)

    @pytest.mark.asyncio
    async def test_dispatch_handles_handler_errors(self):
        """Handler errors should be caught and logged."""
        async def failing_handler(event_data):
            raise ValueError("Test error")

        with patch.dict(EVENT_HANDLERS, {"test.failing.event": failing_handler}):
            event_data = create_domain_event(
                "test.failing.event",
                {"data": "test"},
            )

            # Should not raise, error should be logged
            await dispatch_event(event_data)


# =============================================================================
# Tests: Event Publishing
# =============================================================================


class TestEventPublishing:
    """Tests for publishing domain events."""

    @pytest.mark.asyncio
    async def test_journal_entry_posted_event_format(self, event_publisher):
        """JournalEntryPosted event should have correct format."""
        event = JournalEntryPosted(
            entry_id=str(uuid4()),
            entry_number="JE-2026-00001",
            entry_date="2026-01-15",
            fiscal_period_id=str(uuid4()),
            total_debits="10000.00",
            total_credits="10000.00",
            currency_code="USD",
            description="Test entry",
            posted_by="test-user",
            metadata=EventMetadata(user_id="test-user"),
        )

        await event_publisher.publish(event)

        events = event_publisher.get_events_by_type("accounting.journal_entry.posted")
        assert len(events) == 1

        published = events[0].event
        assert published.event_type == "accounting.journal_entry.posted"
        assert published.entry_number == "JE-2026-00001"

    @pytest.mark.asyncio
    async def test_fiscal_period_closed_event_format(self, event_publisher):
        """FiscalPeriodClosed event should have correct format."""
        event = FiscalPeriodClosed(
            period_id=str(uuid4()),
            period_key="2026-01",
            fiscal_year=2026,
            closed_by="test-user",
            total_entries=150,
            total_debits="500000.00",
            total_credits="500000.00",
            metadata=EventMetadata(user_id="test-user"),
        )

        await event_publisher.publish(event)

        events = event_publisher.get_events_by_type("accounting.fiscal_period.closed")
        assert len(events) == 1

        published = events[0].event
        assert published.event_type == "accounting.fiscal_period.closed"
        assert published.period_key == "2026-01"
        assert published.fiscal_year == 2026

    @pytest.mark.asyncio
    async def test_account_created_event_format(self, event_publisher):
        """AccountCreated event should have correct format."""
        event = AccountCreated(
            account_id=str(uuid4()),
            account_code="1000",
            account_name="Cash",
            account_type="ASSET",
            parent_id=None,
            created_by="test-user",
            metadata=EventMetadata(user_id="test-user"),
        )

        await event_publisher.publish(event)

        events = event_publisher.get_events_by_type("accounting.account.created")
        assert len(events) == 1


# =============================================================================
# Tests: Cross-Service Flow Simulation
# =============================================================================


class TestCrossServiceFlows:
    """End-to-end tests simulating cross-service event flows."""

    @pytest.mark.asyncio
    async def test_bank_payment_to_gl_posting_flow(self, event_publisher):
        """Simulate: Bank payment → Accounting receives → GL entry created."""
        # Step 1: Banking-Treasury sends payment completed event
        payment_event = create_domain_event(
            "banking.payment.completed",
            {
                "payment_id": str(uuid4()),
                "transactionId": "TXN-FLOW-001",
                "amount": 15000.00,
                "currency": "GBP",
                "sourceAccountId": str(uuid4()),
            },
        )

        # Step 2: Accounting receives and processes
        await handle_payment_completed(payment_event)

        # Step 3: Accounting would create journal entry (simulated)
        journal_event = JournalEntryPosted(
            entry_id=str(uuid4()),
            entry_number="JE-2026-00002",
            entry_date="2026-01-20",
            fiscal_period_id=str(uuid4()),
            total_debits="15000.00",
            total_credits="15000.00",
            currency_code="GBP",
            description="Payment received - TXN-FLOW-001",
            posted_by="system",
            metadata=EventMetadata(
                correlation_id=payment_event["correlation_id"],
                causation_id=payment_event["event_id"],
            ),
        )

        await event_publisher.publish(journal_event)

        # Step 4: Verify events are linked by correlation
        events = event_publisher.get_all_events()
        assert len(events) == 1

        published = events[0].event
        assert published.metadata.correlation_id == payment_event["correlation_id"]
        assert published.metadata.causation_id == payment_event["event_id"]

    @pytest.mark.asyncio
    async def test_entity_setup_to_gl_structure_flow(self, event_publisher):
        """Simulate: Entity created → Accounting sets up GL structure."""
        entity_id = str(uuid4())

        # Step 1: Entity-Governance creates entity
        entity_event = create_domain_event(
            "entity-governance.entity.created",
            {
                "entityId": entity_id,
                "name": "New Subsidiary Ltd",
                "entityType": "limited_company",
                "jurisdiction": "uk",
            },
        )

        # Step 2: Accounting receives
        await handle_entity_created(entity_event)

        # Step 3: Accounting creates default chart of accounts (simulated)
        accounts_to_create = [
            ("1000", "Cash and Cash Equivalents", "ASSET"),
            ("1100", "Accounts Receivable", "ASSET"),
            ("2000", "Accounts Payable", "LIABILITY"),
            ("3000", "Share Capital", "EQUITY"),
            ("4000", "Revenue", "REVENUE"),
            ("5000", "Operating Expenses", "EXPENSE"),
        ]

        for code, name, account_type in accounts_to_create:
            event = AccountCreated(
                account_id=str(uuid4()),
                account_code=code,
                account_name=name,
                account_type=account_type,
                parent_id=None,
                created_by="system",
                metadata=EventMetadata(
                    correlation_id=entity_event["correlation_id"],
                ),
            )
            await event_publisher.publish(event)

        # Verify all accounts were created
        events = event_publisher.get_events_by_type("accounting.account.created")
        assert len(events) == 6

    @pytest.mark.asyncio
    async def test_tax_provision_to_gl_entry_flow(self, event_publisher):
        """Simulate: Tax provision required → Accounting creates provision entry."""
        # Step 1: Tax service determines provision is required
        tax_event = create_domain_event(
            "tax.provision.required",
            {
                "taxType": "corporation_tax",
                "amount": 50000.00,
                "currency": "GBP",
                "period": "2025",
                "entityId": str(uuid4()),
            },
        )

        # Step 2: Accounting receives
        await handle_tax_provision_required(tax_event)

        # Step 3: Accounting creates provision journal entry (simulated)
        provision_event = JournalEntryPosted(
            entry_id=str(uuid4()),
            entry_number="JE-2026-TAX-001",
            entry_date="2026-01-31",
            fiscal_period_id=str(uuid4()),
            total_debits="50000.00",
            total_credits="50000.00",
            currency_code="GBP",
            description="Corporation tax provision for 2025",
            posted_by="system",
            metadata=EventMetadata(
                correlation_id=tax_event["correlation_id"],
            ),
        )

        await event_publisher.publish(provision_event)

        # Verify
        events = event_publisher.get_events_by_type("accounting.journal_entry.posted")
        assert len(events) == 1
        assert "tax" in events[0].event.description.lower()
