"""
Domain events base classes and types.

Domain events represent things that have happened in the system that
other parts of the system or external systems might be interested in.

Design Principles:
1. Immutable - Events are facts about the past, they cannot change
2. Self-describing - Events carry all context needed to understand them
3. Versioned - Event schemas can evolve with explicit versioning
4. Traceable - Events include correlation and causation IDs

Research Grounding: MISSION.md (event publishing requirements)
"""

from abc import ABC
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, ClassVar
from uuid import uuid4


@dataclass(frozen=True)
class EventMetadata:
    """
    Metadata attached to every domain event.

    Attributes:
        event_id: Unique identifier for this event instance
        correlation_id: ID to trace related events across operations
        causation_id: ID of the event/command that caused this event
        timestamp: When the event occurred
        source: Service/module that produced the event
        user_id: User who triggered the action (if applicable)
        version: Schema version of this event type
    """

    event_id: str = field(default_factory=lambda: str(uuid4()))
    correlation_id: str | None = None
    causation_id: str | None = None
    timestamp: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    source: str = "accounting"
    user_id: str | None = None
    version: int = 1

    def with_correlation(self, correlation_id: str) -> "EventMetadata":
        """Create a copy with the specified correlation ID."""
        return EventMetadata(
            event_id=self.event_id,
            correlation_id=correlation_id,
            causation_id=self.causation_id,
            timestamp=self.timestamp,
            source=self.source,
            user_id=self.user_id,
            version=self.version,
        )


@dataclass(frozen=True)
class DomainEvent(ABC):
    """
    Base class for all domain events.

    Domain events represent facts about something that has happened
    in the accounting domain. They are immutable and self-describing.

    Subclasses should:
    1. Define EVENT_TYPE class variable with the event type name
    2. Add domain-specific attributes as dataclass fields
    3. Keep events focused - one event per significant occurrence

    Example:
        @dataclass(frozen=True)
        class JournalEntryPosted(DomainEvent):
            EVENT_TYPE: ClassVar[str] = "accounting.journal_entry.posted"

            entry_id: str
            entry_number: str
            total_amount: str
            posted_by: str

    Usage:
        event = JournalEntryPosted(
            entry_id="01HN...",
            entry_number="JE-2026-00001",
            total_amount="1000.00",
            posted_by="user-123",
        )
        await publisher.publish(event)
    """

    # Subclasses must define this
    EVENT_TYPE: ClassVar[str] = "domain_event"

    # Metadata is automatically populated
    metadata: EventMetadata = field(default_factory=EventMetadata)

    @property
    def event_type(self) -> str:
        """Return the event type identifier."""
        return self.EVENT_TYPE

    @property
    def event_id(self) -> str:
        """Return the unique event ID."""
        return self.metadata.event_id

    @property
    def timestamp(self) -> datetime:
        """Return when the event occurred."""
        return self.metadata.timestamp

    def to_dict(self) -> dict[str, Any]:
        """
        Convert event to dictionary for serialization.

        Returns a dictionary suitable for JSON serialization.
        """
        # Get all fields except metadata
        data = {}
        for field_name in self.__dataclass_fields__:
            if field_name == "metadata":
                continue
            value = getattr(self, field_name)
            # Handle datetime serialization
            if isinstance(value, datetime):
                value = value.isoformat()
            data[field_name] = value

        return {
            "event_type": self.event_type,
            "event_id": self.metadata.event_id,
            "timestamp": self.metadata.timestamp.isoformat(),
            "correlation_id": self.metadata.correlation_id,
            "causation_id": self.metadata.causation_id,
            "source": self.metadata.source,
            "user_id": self.metadata.user_id,
            "version": self.metadata.version,
            "data": data,
        }


# -------------------------------------------------------------------------
# Accounting Domain Events
# -------------------------------------------------------------------------


@dataclass(frozen=True)
class JournalEntryPosted(DomainEvent):
    """Published when a journal entry is posted (becomes immutable)."""

    EVENT_TYPE: ClassVar[str] = "accounting.journal_entry.posted"

    entry_id: str
    entry_number: str
    entry_date: str
    fiscal_period_id: str
    total_debits: str
    total_credits: str
    currency_code: str
    description: str
    posted_by: str


@dataclass(frozen=True)
class JournalEntryReversed(DomainEvent):
    """Published when a journal entry is reversed."""

    EVENT_TYPE: ClassVar[str] = "accounting.journal_entry.reversed"

    original_entry_id: str
    original_entry_number: str
    reversal_entry_id: str
    reversal_entry_number: str
    reversed_by: str
    reason: str


@dataclass(frozen=True)
class FiscalPeriodClosed(DomainEvent):
    """Published when a fiscal period is closed."""

    EVENT_TYPE: ClassVar[str] = "accounting.fiscal_period.closed"

    period_id: str
    period_key: str
    fiscal_year: int
    closed_by: str
    total_entries: int
    total_debits: str
    total_credits: str


@dataclass(frozen=True)
class AccountCreated(DomainEvent):
    """Published when a new account is created."""

    EVENT_TYPE: ClassVar[str] = "accounting.account.created"

    account_id: str
    account_code: str
    account_name: str
    account_type: str
    parent_id: str | None
    created_by: str


# -------------------------------------------------------------------------
# Import Domain Events
# -------------------------------------------------------------------------


@dataclass(frozen=True)
class ImportJobCreated(DomainEvent):
    """Published when a new import job is created."""

    EVENT_TYPE: ClassVar[str] = "accounting.import.job_created"

    job_id: str
    job_number: str
    target: str
    file_name: str
    initiated_by: str


@dataclass(frozen=True)
class ImportJobCompleted(DomainEvent):
    """Published when an import job completes (success or with errors)."""

    EVENT_TYPE: ClassVar[str] = "accounting.import.job_completed"

    job_id: str
    job_number: str
    target: str
    status: str
    total_rows: int
    successful_rows: int
    failed_rows: int
    duration_seconds: float | None


@dataclass(frozen=True)
class ImportJobFailed(DomainEvent):
    """Published when an import job fails entirely."""

    EVENT_TYPE: ClassVar[str] = "accounting.import.job_failed"

    job_id: str
    job_number: str
    target: str
    error_message: str
    initiated_by: str
