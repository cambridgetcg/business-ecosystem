"""
EventRecorder - Bridge between domain events and the event store.

This service implements IEventPublisher and persists all published
domain events to the EventStore. It acts as an adapter between the
existing messaging infrastructure and the new audit infrastructure.

Usage:
    recorder = EventRecorder(event_store)
    publisher = CompositeEventPublisher([
        InMemoryEventPublisher(),  # For in-process handlers
        recorder,                   # For persistence
    ])

    # Now all published events are also persisted
    await publisher.publish(JournalEntryPosted(...))

Pattern follows: src/infrastructure/messaging/publisher.py

Research Grounding: docs/gaps/PATH_MATERIAL.md (Event Sourcing Pattern)
"""

from typing import Any

from src.domain.audit.entities.audit_event import AuditEventType
from src.domain.audit.repositories.event_store import EventStore
from src.domain.audit.value_objects.aggregate_reference import AggregateReference
from src.infrastructure.messaging.events import DomainEvent


# Mapping from domain event types to audit event types
EVENT_TYPE_MAPPING: dict[str, AuditEventType] = {
    "accounting.journal_entry.created": AuditEventType.JOURNAL_ENTRY_CREATED,
    "accounting.journal_entry.posted": AuditEventType.JOURNAL_ENTRY_POSTED,
    "accounting.journal_entry.reversed": AuditEventType.JOURNAL_ENTRY_REVERSED,
    "accounting.account.created": AuditEventType.ACCOUNT_CREATED,
    "accounting.account.updated": AuditEventType.ACCOUNT_UPDATED,
    "accounting.fiscal_period.opened": AuditEventType.FISCAL_PERIOD_OPENED,
    "accounting.fiscal_period.closed": AuditEventType.FISCAL_PERIOD_CLOSED,
    "accounting.invoice.created": AuditEventType.INVOICE_CREATED,
    "accounting.invoice.approved": AuditEventType.INVOICE_APPROVED,
    "accounting.invoice.paid": AuditEventType.INVOICE_PAID,
    "accounting.invoice.cancelled": AuditEventType.INVOICE_CANCELLED,
    "accounting.payment.received": AuditEventType.PAYMENT_RECEIVED,
    "accounting.payment.applied": AuditEventType.PAYMENT_APPLIED,
    "accounting.import.job_completed": AuditEventType.IMPORT_COMPLETED,
    "accounting.report.generated": AuditEventType.REPORT_GENERATED,
}


# Mapping from domain event types to aggregate type extraction
AGGREGATE_EXTRACTORS: dict[str, tuple[str, str]] = {
    # (aggregate_type, field_name_for_id)
    "accounting.journal_entry.created": ("JournalEntry", "entry_id"),
    "accounting.journal_entry.posted": ("JournalEntry", "entry_id"),
    "accounting.journal_entry.reversed": ("JournalEntry", "reversal_entry_id"),
    "accounting.account.created": ("Account", "account_id"),
    "accounting.account.updated": ("Account", "account_id"),
    "accounting.fiscal_period.opened": ("FiscalPeriod", "period_id"),
    "accounting.fiscal_period.closed": ("FiscalPeriod", "period_id"),
    "accounting.invoice.created": ("Invoice", "invoice_id"),
    "accounting.invoice.approved": ("Invoice", "invoice_id"),
    "accounting.invoice.paid": ("Invoice", "invoice_id"),
    "accounting.invoice.cancelled": ("Invoice", "invoice_id"),
    "accounting.payment.received": ("Payment", "payment_id"),
    "accounting.payment.applied": ("Payment", "payment_id"),
    "accounting.import.job_completed": ("ImportJob", "job_id"),
}


class EventRecorder:
    """
    Persists domain events to the EventStore.

    This service can be composed with other publishers. All domain events
    published through this recorder are persisted to the EventStore for
    audit and event sourcing purposes.

    Attributes:
        event_store: The underlying event store for persistence

    Example:
        recorder = EventRecorder(event_store)

        # Record a single event
        await recorder.publish(journal_entry_posted_event)

        # Record multiple events
        await recorder.publish_batch([event1, event2, event3])
    """

    def __init__(self, event_store: EventStore) -> None:
        """
        Initialize the recorder.

        Args:
            event_store: The event store for persistence
        """
        self.event_store = event_store

    async def publish(self, event: DomainEvent) -> None:
        """
        Record a domain event to the event store.

        This method converts a DomainEvent to an AuditEvent and
        persists it. Unknown event types are recorded as generic
        ENTITY_CREATED/UPDATED events.

        Args:
            event: The domain event to record
        """
        audit_event_type = self._get_audit_event_type(event)
        aggregate = self._extract_aggregate(event)

        await self.event_store.append(
            event_type=audit_event_type,
            event_name=event.event_type,
            aggregate=aggregate,
            event_data=self._extract_event_data(event),
            occurred_at=event.timestamp,
            user_id=event.metadata.user_id,
            correlation_id=event.metadata.correlation_id,
            causation_id=event.metadata.causation_id,
            source_service=event.metadata.source,
            schema_version=event.metadata.version,
        )

    async def publish_batch(self, events: list[DomainEvent]) -> None:
        """
        Record multiple domain events to the event store.

        Events are recorded in order, preserving causation chain.

        Args:
            events: List of domain events to record
        """
        for event in events:
            await self.publish(event)

    # -------------------------------------------------------------------------
    # Private Methods
    # -------------------------------------------------------------------------

    def _get_audit_event_type(self, event: DomainEvent) -> AuditEventType:
        """Map domain event type to audit event type."""
        return EVENT_TYPE_MAPPING.get(
            event.event_type,
            AuditEventType.ENTITY_UPDATED,  # Default for unknown types
        )

    def _extract_aggregate(self, event: DomainEvent) -> AggregateReference:
        """Extract aggregate reference from domain event."""
        extractor = AGGREGATE_EXTRACTORS.get(event.event_type)

        if extractor:
            aggregate_type, id_field = extractor
            event_data = event.to_dict()["data"]
            aggregate_id = event_data.get(id_field, "unknown")
            return AggregateReference(aggregate_type, aggregate_id)

        # Default: try to extract from common field patterns
        event_data = event.to_dict()["data"]
        for field_name in ["entry_id", "account_id", "invoice_id", "period_id", "job_id"]:
            if field_name in event_data:
                # Infer aggregate type from field name
                type_map = {
                    "entry_id": "JournalEntry",
                    "account_id": "Account",
                    "invoice_id": "Invoice",
                    "period_id": "FiscalPeriod",
                    "job_id": "ImportJob",
                }
                return AggregateReference(
                    type_map.get(field_name, "Unknown"),
                    event_data[field_name],
                )

        # Fallback
        return AggregateReference("Unknown", event.event_id)

    def _extract_event_data(self, event: DomainEvent) -> dict[str, Any]:
        """Extract the data payload from a domain event."""
        return event.to_dict().get("data", {})
