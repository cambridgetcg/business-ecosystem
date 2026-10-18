"""
ProjectionService - Rebuilds entity state from events.

This service enables temporal queries by replaying events to
reconstruct state at any point in time. It's the "read side"
of event sourcing.

Use Cases:
1. "What was the balance of Account X on Date Y?"
2. "Show me the state of JournalEntry X before it was posted"
3. Audit trail reconstruction for compliance
4. Debugging/forensics

Research Grounding: docs/gaps/PATH_MATERIAL.md (Event Sourcing Pattern)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Generic, TypeVar

from src.domain.audit.entities.audit_event import AuditEvent, AuditEventType
from src.domain.audit.repositories.event_store import EventStore
from src.domain.audit.value_objects.aggregate_reference import AggregateReference


T = TypeVar("T")


@dataclass
class ProjectedState(Generic[T]):
    """
    Result of a projection containing the reconstructed state.

    Attributes:
        state: The reconstructed state object
        version: The version (number of events applied)
        as_of: The timestamp of the last event applied
        event_count: Total number of events applied
    """

    state: T
    version: int
    as_of: datetime
    event_count: int


class StateProjector(ABC, Generic[T]):
    """
    Base class for projectors that reconstruct specific entity types.

    Each entity type that needs temporal queries should have a
    corresponding projector that knows how to:
    1. Create initial state
    2. Apply each event type to update state

    Example:
        class AccountProjector(StateProjector[AccountState]):
            def create_initial_state(self) -> AccountState:
                return AccountState(balance=Decimal("0"), ...)

            def apply_event(self, state: AccountState, event: AuditEvent) -> AccountState:
                if event.event_type == AuditEventType.ACCOUNT_BALANCE_ADJUSTED:
                    return AccountState(
                        balance=state.balance + event.event_data["amount"],
                        ...
                    )
                return state
    """

    @abstractmethod
    def create_initial_state(self) -> T:
        """Create the initial state before any events are applied."""
        ...

    @abstractmethod
    def apply_event(self, state: T, event: AuditEvent) -> T:
        """
        Apply an event to update the state.

        Args:
            state: Current state
            event: Event to apply

        Returns:
            New state after applying the event
        """
        ...


@dataclass
class JournalEntryState:
    """Projected state of a journal entry."""

    entry_id: str
    entry_number: str | None = None
    entry_date: str | None = None
    status: str = "DRAFT"
    total_debits: Decimal = Decimal("0")
    total_credits: Decimal = Decimal("0")
    description: str | None = None
    posted_at: datetime | None = None
    posted_by: str | None = None
    reversed_by_id: str | None = None
    lines: list[dict[str, Any]] = field(default_factory=list)


class JournalEntryProjector(StateProjector[JournalEntryState]):
    """Projector for journal entry state reconstruction."""

    def __init__(self, entry_id: str) -> None:
        self.entry_id = entry_id

    def create_initial_state(self) -> JournalEntryState:
        """Create initial empty state."""
        return JournalEntryState(entry_id=self.entry_id)

    def apply_event(
        self,
        state: JournalEntryState,
        event: AuditEvent,
    ) -> JournalEntryState:
        """Apply an event to update journal entry state."""
        data = event.event_data

        if event.event_type == AuditEventType.JOURNAL_ENTRY_CREATED:
            return JournalEntryState(
                entry_id=self.entry_id,
                entry_number=data.get("entry_number"),
                entry_date=data.get("entry_date"),
                status="DRAFT",
                description=data.get("description"),
                lines=data.get("lines", []),
            )

        elif event.event_type == AuditEventType.JOURNAL_ENTRY_UPDATED:
            # Merge updates
            return JournalEntryState(
                entry_id=self.entry_id,
                entry_number=data.get("entry_number", state.entry_number),
                entry_date=data.get("entry_date", state.entry_date),
                status=state.status,
                total_debits=Decimal(str(data.get("total_debits", state.total_debits))),
                total_credits=Decimal(str(data.get("total_credits", state.total_credits))),
                description=data.get("description", state.description),
                posted_at=state.posted_at,
                posted_by=state.posted_by,
                lines=data.get("lines", state.lines),
            )

        elif event.event_type == AuditEventType.JOURNAL_ENTRY_POSTED:
            return JournalEntryState(
                entry_id=self.entry_id,
                entry_number=data.get("entry_number", state.entry_number),
                entry_date=data.get("entry_date", state.entry_date),
                status="POSTED",
                total_debits=Decimal(str(data.get("total_debits", state.total_debits))),
                total_credits=Decimal(str(data.get("total_credits", state.total_credits))),
                description=data.get("description", state.description),
                posted_at=event.occurred_at,
                posted_by=data.get("posted_by"),
                lines=state.lines,
            )

        elif event.event_type == AuditEventType.JOURNAL_ENTRY_REVERSED:
            return JournalEntryState(
                entry_id=self.entry_id,
                entry_number=state.entry_number,
                entry_date=state.entry_date,
                status="REVERSED",
                total_debits=state.total_debits,
                total_credits=state.total_credits,
                description=state.description,
                posted_at=state.posted_at,
                posted_by=state.posted_by,
                reversed_by_id=data.get("reversal_entry_id"),
                lines=state.lines,
            )

        # Unknown event type - return state unchanged
        return state


@dataclass
class AccountState:
    """Projected state of an account."""

    account_id: str
    code: str | None = None
    name: str | None = None
    account_type: str | None = None
    balance: Decimal = Decimal("0")
    is_active: bool = True
    created_at: datetime | None = None


class AccountProjector(StateProjector[AccountState]):
    """Projector for account state reconstruction."""

    def __init__(self, account_id: str) -> None:
        self.account_id = account_id

    def create_initial_state(self) -> AccountState:
        """Create initial empty state."""
        return AccountState(account_id=self.account_id)

    def apply_event(
        self,
        state: AccountState,
        event: AuditEvent,
    ) -> AccountState:
        """Apply an event to update account state."""
        data = event.event_data

        if event.event_type == AuditEventType.ACCOUNT_CREATED:
            return AccountState(
                account_id=self.account_id,
                code=data.get("account_code"),
                name=data.get("account_name"),
                account_type=data.get("account_type"),
                balance=Decimal("0"),
                is_active=True,
                created_at=event.occurred_at,
            )

        elif event.event_type == AuditEventType.ACCOUNT_UPDATED:
            return AccountState(
                account_id=self.account_id,
                code=data.get("account_code", state.code),
                name=data.get("account_name", state.name),
                account_type=data.get("account_type", state.account_type),
                balance=state.balance,
                is_active=data.get("is_active", state.is_active),
                created_at=state.created_at,
            )

        elif event.event_type == AuditEventType.ACCOUNT_BALANCE_ADJUSTED:
            # Adjust balance by the delta
            delta = Decimal(str(data.get("amount", "0")))
            return AccountState(
                account_id=self.account_id,
                code=state.code,
                name=state.name,
                account_type=state.account_type,
                balance=state.balance + delta,
                is_active=state.is_active,
                created_at=state.created_at,
            )

        elif event.event_type == AuditEventType.ACCOUNT_DEACTIVATED:
            return AccountState(
                account_id=self.account_id,
                code=state.code,
                name=state.name,
                account_type=state.account_type,
                balance=state.balance,
                is_active=False,
                created_at=state.created_at,
            )

        return state


class ProjectionService:
    """
    Service for projecting entity state from events.

    This service enables temporal queries by:
    1. Loading events for an aggregate from the EventStore
    2. Applying events in order using a StateProjector
    3. Returning the projected state

    Usage:
        service = ProjectionService(event_store)

        # Get current state
        result = await service.project_journal_entry("entry-id")
        current_state = result.state

        # Get state at a specific point in time
        result = await service.project_journal_entry_at_time(
            "entry-id",
            datetime(2026, 1, 15),
        )
        historical_state = result.state
    """

    def __init__(self, event_store: EventStore) -> None:
        """
        Initialize the projection service.

        Args:
            event_store: The event store to read events from
        """
        self.event_store = event_store

    async def project(
        self,
        aggregate: AggregateReference,
        projector: StateProjector[T],
        as_of: datetime | None = None,
    ) -> ProjectedState[T] | None:
        """
        Project state for any aggregate using a custom projector.

        Args:
            aggregate: Reference to the entity
            projector: The projector to use for state reconstruction
            as_of: Optional point in time (None = current state)

        Returns:
            ProjectedState with reconstructed state, or None if no events
        """
        # Get events
        if as_of:
            events = await self.event_store.get_events_for_aggregate_at_time(
                aggregate, as_of
            )
        else:
            events = await self.event_store.get_events_for_aggregate(aggregate)

        if not events:
            return None

        # Apply events to build state
        state = projector.create_initial_state()
        for event in events:
            state = projector.apply_event(state, event)

        last_event = events[-1]
        return ProjectedState(
            state=state,
            version=last_event.aggregate_version,
            as_of=last_event.occurred_at,
            event_count=len(events),
        )

    async def project_journal_entry(
        self,
        entry_id: str,
    ) -> ProjectedState[JournalEntryState] | None:
        """
        Project current state of a journal entry.

        Args:
            entry_id: The journal entry ID

        Returns:
            ProjectedState with journal entry state, or None if not found
        """
        aggregate = AggregateReference.for_journal_entry(entry_id)
        projector = JournalEntryProjector(entry_id)
        return await self.project(aggregate, projector)

    async def project_journal_entry_at_time(
        self,
        entry_id: str,
        as_of: datetime,
    ) -> ProjectedState[JournalEntryState] | None:
        """
        Project journal entry state at a specific point in time.

        Args:
            entry_id: The journal entry ID
            as_of: Point in time to project state

        Returns:
            ProjectedState with journal entry state at that time
        """
        aggregate = AggregateReference.for_journal_entry(entry_id)
        projector = JournalEntryProjector(entry_id)
        return await self.project(aggregate, projector, as_of)

    async def project_account(
        self,
        account_id: str,
    ) -> ProjectedState[AccountState] | None:
        """
        Project current state of an account.

        Args:
            account_id: The account ID

        Returns:
            ProjectedState with account state, or None if not found
        """
        aggregate = AggregateReference.for_account(account_id)
        projector = AccountProjector(account_id)
        return await self.project(aggregate, projector)

    async def project_account_at_time(
        self,
        account_id: str,
        as_of: datetime,
    ) -> ProjectedState[AccountState] | None:
        """
        Project account state at a specific point in time.

        This is the answer to "What was the balance of Account X on Date Y?"

        Args:
            account_id: The account ID
            as_of: Point in time to project state

        Returns:
            ProjectedState with account state at that time
        """
        aggregate = AggregateReference.for_account(account_id)
        projector = AccountProjector(account_id)
        return await self.project(aggregate, projector, as_of)

    async def get_balance_at_date(
        self,
        account_id: str,
        as_of: datetime,
    ) -> Decimal | None:
        """
        Convenience method to get just the balance at a specific date.

        Args:
            account_id: The account ID
            as_of: The date to query

        Returns:
            The balance at that date, or None if account not found
        """
        result = await self.project_account_at_time(account_id, as_of)
        if result:
            return result.state.balance
        return None
