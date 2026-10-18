"""
Event publisher interfaces and implementations.

Provides the infrastructure for publishing domain events to
interested consumers (other services, audit systems, etc.).

Implementations:
- InMemoryEventPublisher: For testing and local development
- (Future) SNSEventPublisher: For AWS SNS topics
- (Future) EventBridgePublisher: For AWS EventBridge

Research Grounding: MISSION.md (ecosystem integration)
"""

import json
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Protocol, runtime_checkable

from src.infrastructure.messaging.events import DomainEvent


# Type alias for event handlers
EventHandler = Callable[[DomainEvent], Awaitable[None]]


@runtime_checkable
class IEventPublisher(Protocol):
    """
    Protocol defining the interface for event publishers.

    All event publisher implementations must implement this interface
    to ensure consistent behavior across the system.

    Usage:
        publisher = InMemoryEventPublisher()
        await publisher.publish(JournalEntryPosted(...))
    """

    async def publish(self, event: DomainEvent) -> None:
        """
        Publish a single domain event.

        Args:
            event: The domain event to publish

        Raises:
            PublishError: If publishing fails
        """
        ...

    async def publish_batch(self, events: list[DomainEvent]) -> None:
        """
        Publish multiple events in a batch.

        Args:
            events: List of domain events to publish

        Raises:
            PublishError: If publishing fails
        """
        ...


class PublishError(Exception):
    """Raised when event publishing fails."""

    def __init__(
        self,
        message: str,
        event_type: str | None = None,
        original_error: Exception | None = None,
    ) -> None:
        self.message = message
        self.event_type = event_type
        self.original_error = original_error
        super().__init__(message)


@dataclass
class PublishedEvent:
    """Record of a published event (for testing/debugging)."""

    event: DomainEvent
    published_at: datetime
    topic: str | None = None


class InMemoryEventPublisher:
    """
    In-memory event publisher for testing and local development.

    Features:
    - Stores all published events for inspection
    - Supports subscribing handlers for specific event types
    - Useful for integration testing

    Usage:
        publisher = InMemoryEventPublisher()

        # Subscribe to events
        publisher.subscribe("accounting.journal_entry.posted", my_handler)

        # Publish events
        await publisher.publish(event)

        # Inspect published events
        events = publisher.get_events_by_type("accounting.journal_entry.posted")
    """

    def __init__(self) -> None:
        """Initialize the publisher."""
        self._events: list[PublishedEvent] = []
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)

    async def publish(self, event: DomainEvent) -> None:
        """Publish a single event."""
        published = PublishedEvent(
            event=event,
            published_at=datetime.now(timezone.utc),
        )
        self._events.append(published)

        # Notify handlers
        for handler in self._handlers.get(event.event_type, []):
            await handler(event)

        # Notify wildcard handlers
        for handler in self._handlers.get("*", []):
            await handler(event)

    async def publish_batch(self, events: list[DomainEvent]) -> None:
        """Publish multiple events."""
        for event in events:
            await self.publish(event)

    def subscribe(
        self,
        event_type: str,
        handler: EventHandler,
    ) -> None:
        """
        Subscribe a handler to an event type.

        Args:
            event_type: The event type to subscribe to, or "*" for all events
            handler: Async function to call when event is published
        """
        self._handlers[event_type].append(handler)

    def unsubscribe(
        self,
        event_type: str,
        handler: EventHandler,
    ) -> None:
        """
        Unsubscribe a handler from an event type.

        Args:
            event_type: The event type
            handler: The handler to remove
        """
        if handler in self._handlers[event_type]:
            self._handlers[event_type].remove(handler)

    def get_all_events(self) -> list[PublishedEvent]:
        """Get all published events."""
        return list(self._events)

    def get_events_by_type(self, event_type: str) -> list[PublishedEvent]:
        """Get events by type."""
        return [e for e in self._events if e.event.event_type == event_type]

    def get_events_since(self, timestamp: datetime) -> list[PublishedEvent]:
        """Get events published since a timestamp."""
        return [e for e in self._events if e.published_at >= timestamp]

    def clear(self) -> None:
        """Clear all stored events (useful between tests)."""
        self._events.clear()

    @property
    def event_count(self) -> int:
        """Return total number of published events."""
        return len(self._events)


class LoggingEventPublisher:
    """
    Event publisher that logs events to structured logging.

    Useful for development and debugging. Can be composed with
    other publishers.

    Usage:
        import structlog
        logger = structlog.get_logger()
        publisher = LoggingEventPublisher(logger)
        await publisher.publish(event)
    """

    def __init__(self, logger: Any) -> None:
        """
        Initialize the logging publisher.

        Args:
            logger: Structured logger instance (e.g., structlog)
        """
        self.logger = logger

    async def publish(self, event: DomainEvent) -> None:
        """Publish event by logging it."""
        self.logger.info(
            "domain_event_published",
            event_type=event.event_type,
            event_id=event.event_id,
            timestamp=event.timestamp.isoformat(),
            correlation_id=event.metadata.correlation_id,
            user_id=event.metadata.user_id,
            **{
                k: v
                for k, v in event.to_dict()["data"].items()
            },
        )

    async def publish_batch(self, events: list[DomainEvent]) -> None:
        """Publish multiple events."""
        for event in events:
            await self.publish(event)


class CompositeEventPublisher:
    """
    Event publisher that delegates to multiple publishers.

    Useful for sending events to multiple destinations
    (e.g., logging + SNS + metrics).

    Usage:
        publisher = CompositeEventPublisher([
            InMemoryEventPublisher(),
            LoggingEventPublisher(logger),
        ])
        await publisher.publish(event)
    """

    def __init__(self, publishers: list[IEventPublisher]) -> None:
        """
        Initialize with list of publishers.

        Args:
            publishers: List of publishers to delegate to
        """
        self.publishers = publishers

    async def publish(self, event: DomainEvent) -> None:
        """Publish to all registered publishers."""
        errors: list[tuple[IEventPublisher, Exception]] = []

        for publisher in self.publishers:
            try:
                await publisher.publish(event)
            except Exception as e:
                errors.append((publisher, e))

        if errors:
            raise PublishError(
                message=f"Failed to publish to {len(errors)} publisher(s)",
                event_type=event.event_type,
            )

    async def publish_batch(self, events: list[DomainEvent]) -> None:
        """Publish batch to all registered publishers."""
        for event in events:
            await self.publish(event)


def create_event_publisher(settings=None) -> IEventPublisher:
    """
    Factory function to create the appropriate event publisher.

    Based on configuration, returns:
    - InMemoryEventPublisher for testing/development
    - SNSEventPublisher for AWS production
    - CompositeEventPublisher for logging + production

    Args:
        settings: Optional settings (uses get_settings() if not provided)

    Returns:
        Configured event publisher instance
    """
    from src.config import get_settings
    import structlog

    settings = settings or get_settings()
    logger = structlog.get_logger()

    if not settings.messaging.enabled:
        logger.info("Event publishing disabled, using no-op publisher")
        return InMemoryEventPublisher()

    publishers: list[IEventPublisher] = []

    # Always add logging in non-production
    if not settings.is_production:
        publishers.append(LoggingEventPublisher(logger))

    # Add the primary publisher based on provider
    if settings.messaging.provider == "sns":
        from src.infrastructure.messaging.sns_publisher import SNSEventPublisher
        publishers.append(SNSEventPublisher(settings))
        logger.info("Using SNS event publisher", topic_arn=settings.messaging.sns_topic_arn)

    elif settings.messaging.provider == "rabbitmq":
        # Future: Add RabbitMQ publisher
        logger.warning("RabbitMQ publisher not yet implemented, using in-memory")
        publishers.append(InMemoryEventPublisher())

    else:  # in_memory
        publishers.append(InMemoryEventPublisher())
        logger.info("Using in-memory event publisher")

    if len(publishers) == 1:
        return publishers[0]

    return CompositeEventPublisher(publishers)
