"""
AuditEvent - The persisted record of a domain event.

This is the cornerstone of the audit infrastructure. Every significant
change in the accounting system is recorded as an immutable AuditEvent.

Design Principles:
1. Immutable - Events are facts about the past, they never change
2. Self-describing - Contains all context needed for reconstruction
3. Ordered - Sequence numbers enable deterministic replay
4. Traceable - Correlation/causation IDs for distributed tracing

Research Grounding: docs/gaps/PATH_MATERIAL.md (Event Sourcing Pattern)
"""

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum as SQLEnum,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.base import Base, generate_ulid


class AuditEventType(str, Enum):
    """
    Categories of audit events.

    These map to the major domain operations that must be audited.
    """

    # Journal Entry lifecycle
    JOURNAL_ENTRY_CREATED = "JOURNAL_ENTRY_CREATED"
    JOURNAL_ENTRY_UPDATED = "JOURNAL_ENTRY_UPDATED"
    JOURNAL_ENTRY_POSTED = "JOURNAL_ENTRY_POSTED"
    JOURNAL_ENTRY_REVERSED = "JOURNAL_ENTRY_REVERSED"

    # Account lifecycle
    ACCOUNT_CREATED = "ACCOUNT_CREATED"
    ACCOUNT_UPDATED = "ACCOUNT_UPDATED"
    ACCOUNT_DEACTIVATED = "ACCOUNT_DEACTIVATED"
    ACCOUNT_BALANCE_ADJUSTED = "ACCOUNT_BALANCE_ADJUSTED"

    # Fiscal period lifecycle
    FISCAL_PERIOD_OPENED = "FISCAL_PERIOD_OPENED"
    FISCAL_PERIOD_CLOSED = "FISCAL_PERIOD_CLOSED"

    # AP/AR operations
    INVOICE_CREATED = "INVOICE_CREATED"
    INVOICE_APPROVED = "INVOICE_APPROVED"
    INVOICE_PAID = "INVOICE_PAID"
    INVOICE_CANCELLED = "INVOICE_CANCELLED"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    PAYMENT_APPLIED = "PAYMENT_APPLIED"

    # System operations
    IMPORT_COMPLETED = "IMPORT_COMPLETED"
    REPORT_GENERATED = "REPORT_GENERATED"

    # Generic for extensibility
    ENTITY_CREATED = "ENTITY_CREATED"
    ENTITY_UPDATED = "ENTITY_UPDATED"
    ENTITY_DELETED = "ENTITY_DELETED"


class AuditEvent(Base):
    """
    Immutable record of a domain event for audit purposes.

    This entity is the foundation of the event store. It captures:
    - What happened (event_type, event_data)
    - When it happened (occurred_at, recorded_at)
    - Who did it (user_id)
    - What it affected (aggregate_type, aggregate_id)
    - How it relates to other events (correlation_id, causation_id)
    - Its position in the stream (sequence_number)

    Events are NEVER modified or deleted. They are append-only.

    Attributes:
        id: Unique event identifier (ULID)
        event_type: Classification of the event
        event_name: Specific event name (e.g., "accounting.journal_entry.posted")
        aggregate_type: Type of entity affected (e.g., "JournalEntry", "Account")
        aggregate_id: ID of the specific entity affected
        sequence_number: Global sequence for ordering
        aggregate_version: Version of the aggregate after this event
        event_data: JSON payload with event-specific data
        occurred_at: When the event actually occurred (business time)
        recorded_at: When the event was recorded (system time)
        user_id: Who triggered the action
        correlation_id: Traces related events across operations
        causation_id: The event/command that directly caused this
        source_service: The service that produced this event
        schema_version: Version of the event data schema
    """

    __tablename__ = "audit_events"

    __table_args__ = (
        # Query by aggregate (most common query pattern)
        Index(
            "ix_audit_events_aggregate",
            "aggregate_type",
            "aggregate_id",
            "sequence_number",
        ),
        # Query by time range
        Index(
            "ix_audit_events_occurred_at",
            "occurred_at",
        ),
        # Query by correlation (distributed tracing)
        Index(
            "ix_audit_events_correlation",
            "correlation_id",
        ),
        # Query by user (who did what)
        Index(
            "ix_audit_events_user",
            "user_id",
            "occurred_at",
        ),
        # Query by event type
        Index(
            "ix_audit_events_type",
            "event_type",
            "occurred_at",
        ),
    )

    # Primary key - ULID for sortability
    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=generate_ulid,
    )

    # Event classification
    event_type: Mapped[AuditEventType] = mapped_column(
        SQLEnum(AuditEventType, native_enum=False),
        nullable=False,
        comment="Category of event",
    )
    event_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Specific event name (e.g., accounting.journal_entry.posted)",
    )

    # Aggregate reference - what entity was affected
    aggregate_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Type of entity affected (e.g., JournalEntry, Account)",
    )
    aggregate_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="ID of the specific entity affected",
    )

    # Ordering and versioning
    sequence_number: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        unique=True,
        comment="Global sequence number for event ordering",
    )
    aggregate_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Version of aggregate after this event",
    )

    # Event payload
    event_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="Event-specific data as JSON",
    )

    # Timestamps
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="When the event occurred (business time)",
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When the event was recorded (system time)",
    )

    # Actor
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="User who triggered this action",
    )

    # Tracing
    correlation_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="Correlation ID for tracing related events",
    )
    causation_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="ID of the event/command that caused this",
    )

    # Source identification
    source_service: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="accounting",
        comment="Service that produced this event",
    )

    # Schema versioning for event evolution
    schema_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        comment="Version of the event data schema",
    )

    def __repr__(self) -> str:
        return (
            f"<AuditEvent("
            f"id={self.id}, "
            f"type={self.event_type.value}, "
            f"aggregate={self.aggregate_type}:{self.aggregate_id}, "
            f"seq={self.sequence_number})>"
        )

    @property
    def is_entity_creation(self) -> bool:
        """Return True if this event represents entity creation."""
        return self.event_type in (
            AuditEventType.JOURNAL_ENTRY_CREATED,
            AuditEventType.ACCOUNT_CREATED,
            AuditEventType.INVOICE_CREATED,
            AuditEventType.ENTITY_CREATED,
        )

    @property
    def is_state_transition(self) -> bool:
        """Return True if this event represents a significant state transition."""
        return self.event_type in (
            AuditEventType.JOURNAL_ENTRY_POSTED,
            AuditEventType.JOURNAL_ENTRY_REVERSED,
            AuditEventType.FISCAL_PERIOD_CLOSED,
            AuditEventType.INVOICE_APPROVED,
            AuditEventType.INVOICE_PAID,
        )
