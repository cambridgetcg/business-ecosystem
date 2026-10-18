"""
EventStore - persistence layer for audit events.

The EventStore is the core repository for the event sourcing pattern.
It provides:
- Append-only storage for events
- Queries by aggregate (entity)
- Queries by time range
- Queries by correlation ID
- Sequence number generation for ordering

Pattern follows: src/domain/general_ledger/repositories/journal_entry_repository.py

Research Grounding: docs/gaps/PATH_MATERIAL.md (Event Sourcing Pattern)
"""

from datetime import datetime
from typing import Sequence

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.audit.entities.audit_event import AuditEvent, AuditEventType
from src.domain.audit.value_objects.aggregate_reference import AggregateReference


class EventStore:
    """
    Repository for persisting and querying audit events.

    This is the write and read side of the event store. Events are
    appended with globally unique sequence numbers that enable
    deterministic replay and ordering.

    Usage:
        store = EventStore(session)

        # Append an event
        event = await store.append(
            event_type=AuditEventType.JOURNAL_ENTRY_POSTED,
            event_name="accounting.journal_entry.posted",
            aggregate=AggregateReference.for_journal_entry(entry.id),
            event_data={"entry_number": entry.entry_number, ...},
            user_id="user-123",
        )

        # Query events for an aggregate
        events = await store.get_events_for_aggregate(
            AggregateReference.for_journal_entry(entry.id)
        )

        # Query events by time range
        events = await store.get_events_in_range(start_date, end_date)
    """

    def __init__(self, session: AsyncSession) -> None:
        """
        Initialize the event store.

        Args:
            session: SQLAlchemy async session
        """
        self.session = session

    async def append(
        self,
        event_type: AuditEventType,
        event_name: str,
        aggregate: AggregateReference,
        event_data: dict,
        occurred_at: datetime,
        user_id: str | None = None,
        correlation_id: str | None = None,
        causation_id: str | None = None,
        source_service: str = "accounting",
        schema_version: int = 1,
    ) -> AuditEvent:
        """
        Append a new event to the store.

        This is the primary write operation. Events are immutable once
        written. The sequence number is automatically assigned.

        Args:
            event_type: Category of event
            event_name: Specific event name (e.g., "accounting.journal_entry.posted")
            aggregate: Reference to the entity affected
            event_data: Event-specific payload
            occurred_at: When the event occurred (business time)
            user_id: Who triggered the action
            correlation_id: For tracing related events
            causation_id: The event/command that caused this
            source_service: Service producing the event
            schema_version: Version of the event data schema

        Returns:
            The created AuditEvent with sequence number assigned
        """
        # Get next sequence number (atomic operation)
        sequence_number = await self._get_next_sequence_number()

        # Get current version for this aggregate
        aggregate_version = await self._get_next_aggregate_version(aggregate)

        # Create the event
        event = AuditEvent(
            event_type=event_type,
            event_name=event_name,
            aggregate_type=aggregate.aggregate_type,
            aggregate_id=aggregate.aggregate_id,
            sequence_number=sequence_number,
            aggregate_version=aggregate_version,
            event_data=event_data,
            occurred_at=occurred_at,
            user_id=user_id,
            correlation_id=correlation_id,
            causation_id=causation_id,
            source_service=source_service,
            schema_version=schema_version,
        )

        self.session.add(event)
        await self.session.flush()

        return event

    async def append_batch(
        self,
        events: list[tuple[AuditEventType, str, AggregateReference, dict, datetime]],
        user_id: str | None = None,
        correlation_id: str | None = None,
    ) -> list[AuditEvent]:
        """
        Append multiple events atomically.

        All events share the same correlation_id (if provided) and user_id.
        Each event gets its own sequence number and causation chain.

        Args:
            events: List of (event_type, event_name, aggregate, event_data, occurred_at)
            user_id: Who triggered the action
            correlation_id: For tracing related events

        Returns:
            List of created AuditEvents
        """
        if not events:
            return []

        created_events: list[AuditEvent] = []
        previous_event_id: str | None = None

        for event_type, event_name, aggregate, event_data, occurred_at in events:
            event = await self.append(
                event_type=event_type,
                event_name=event_name,
                aggregate=aggregate,
                event_data=event_data,
                occurred_at=occurred_at,
                user_id=user_id,
                correlation_id=correlation_id,
                causation_id=previous_event_id,
            )
            created_events.append(event)
            previous_event_id = event.id

        return created_events

    async def get_by_id(self, event_id: str) -> AuditEvent | None:
        """
        Get an event by its ID.

        Args:
            event_id: The event ID

        Returns:
            The event if found, None otherwise
        """
        stmt = select(AuditEvent).where(AuditEvent.id == event_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_events_for_aggregate(
        self,
        aggregate: AggregateReference,
        from_version: int | None = None,
        to_version: int | None = None,
    ) -> Sequence[AuditEvent]:
        """
        Get all events for a specific aggregate (entity).

        This is the primary query for rebuilding entity state.
        Events are returned in sequence order.

        Args:
            aggregate: Reference to the entity
            from_version: Optional starting version (inclusive)
            to_version: Optional ending version (inclusive)

        Returns:
            List of events in sequence order
        """
        stmt = (
            select(AuditEvent)
            .where(AuditEvent.aggregate_type == aggregate.aggregate_type)
            .where(AuditEvent.aggregate_id == aggregate.aggregate_id)
        )

        if from_version is not None:
            stmt = stmt.where(AuditEvent.aggregate_version >= from_version)
        if to_version is not None:
            stmt = stmt.where(AuditEvent.aggregate_version <= to_version)

        stmt = stmt.order_by(AuditEvent.sequence_number)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_events_for_aggregate_at_time(
        self,
        aggregate: AggregateReference,
        as_of: datetime,
    ) -> Sequence[AuditEvent]:
        """
        Get events for an aggregate up to a specific point in time.

        This enables temporal queries ("what was the state at time X?").

        Args:
            aggregate: Reference to the entity
            as_of: Point in time to query

        Returns:
            List of events up to and including as_of time
        """
        stmt = (
            select(AuditEvent)
            .where(AuditEvent.aggregate_type == aggregate.aggregate_type)
            .where(AuditEvent.aggregate_id == aggregate.aggregate_id)
            .where(AuditEvent.occurred_at <= as_of)
            .order_by(AuditEvent.sequence_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_events_in_range(
        self,
        start: datetime,
        end: datetime,
        event_types: list[AuditEventType] | None = None,
        aggregate_type: str | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> Sequence[AuditEvent]:
        """
        Get events within a time range.

        Args:
            start: Start of time range (inclusive)
            end: End of time range (inclusive)
            event_types: Optional filter by event types
            aggregate_type: Optional filter by aggregate type
            limit: Maximum events to return
            offset: Number of events to skip

        Returns:
            List of events in sequence order
        """
        stmt = (
            select(AuditEvent)
            .where(AuditEvent.occurred_at >= start)
            .where(AuditEvent.occurred_at <= end)
        )

        if event_types:
            stmt = stmt.where(AuditEvent.event_type.in_(event_types))
        if aggregate_type:
            stmt = stmt.where(AuditEvent.aggregate_type == aggregate_type)

        stmt = stmt.order_by(AuditEvent.sequence_number).limit(limit).offset(offset)

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_events_by_correlation(
        self,
        correlation_id: str,
    ) -> Sequence[AuditEvent]:
        """
        Get all events with a specific correlation ID.

        This enables tracing related events across operations.

        Args:
            correlation_id: The correlation ID to search for

        Returns:
            List of events with this correlation ID in sequence order
        """
        stmt = (
            select(AuditEvent)
            .where(AuditEvent.correlation_id == correlation_id)
            .order_by(AuditEvent.sequence_number)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_events_by_user(
        self,
        user_id: str,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 100,
    ) -> Sequence[AuditEvent]:
        """
        Get events triggered by a specific user.

        Useful for user activity auditing.

        Args:
            user_id: The user ID
            start: Optional start of time range
            end: Optional end of time range
            limit: Maximum events to return

        Returns:
            List of events in reverse chronological order
        """
        stmt = select(AuditEvent).where(AuditEvent.user_id == user_id)

        if start:
            stmt = stmt.where(AuditEvent.occurred_at >= start)
        if end:
            stmt = stmt.where(AuditEvent.occurred_at <= end)

        stmt = stmt.order_by(AuditEvent.occurred_at.desc()).limit(limit)

        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_latest_event_for_aggregate(
        self,
        aggregate: AggregateReference,
    ) -> AuditEvent | None:
        """
        Get the most recent event for an aggregate.

        Args:
            aggregate: Reference to the entity

        Returns:
            The latest event if any exist, None otherwise
        """
        stmt = (
            select(AuditEvent)
            .where(AuditEvent.aggregate_type == aggregate.aggregate_type)
            .where(AuditEvent.aggregate_id == aggregate.aggregate_id)
            .order_by(AuditEvent.sequence_number.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def count_events_for_aggregate(
        self,
        aggregate: AggregateReference,
    ) -> int:
        """
        Count events for an aggregate.

        Args:
            aggregate: Reference to the entity

        Returns:
            Number of events
        """
        stmt = (
            select(func.count(AuditEvent.id))
            .where(AuditEvent.aggregate_type == aggregate.aggregate_type)
            .where(AuditEvent.aggregate_id == aggregate.aggregate_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_global_sequence_position(self) -> int:
        """
        Get the current global sequence position.

        Returns:
            The highest sequence number, or 0 if no events exist
        """
        stmt = select(func.max(AuditEvent.sequence_number))
        result = await self.session.execute(stmt)
        return result.scalar_one() or 0

    # -------------------------------------------------------------------------
    # Private Methods
    # -------------------------------------------------------------------------

    async def _get_next_sequence_number(self) -> int:
        """
        Get the next global sequence number.

        Uses a database sequence for atomic increment.
        Falls back to MAX+1 if sequence doesn't exist.
        """
        # Try to use a database sequence (PostgreSQL)
        try:
            stmt = text("SELECT nextval('audit_event_sequence')")
            result = await self.session.execute(stmt)
            return result.scalar_one()
        except Exception:
            # Fallback: use MAX+1 (less efficient but works everywhere)
            current_max = await self.get_global_sequence_position()
            return current_max + 1

    async def _get_next_aggregate_version(
        self,
        aggregate: AggregateReference,
    ) -> int:
        """
        Get the next version number for an aggregate.

        Args:
            aggregate: Reference to the entity

        Returns:
            The next version number (current max + 1, or 1 if no events)
        """
        stmt = (
            select(func.max(AuditEvent.aggregate_version))
            .where(AuditEvent.aggregate_type == aggregate.aggregate_type)
            .where(AuditEvent.aggregate_id == aggregate.aggregate_id)
        )
        result = await self.session.execute(stmt)
        current_version = result.scalar_one()
        return (current_version or 0) + 1
