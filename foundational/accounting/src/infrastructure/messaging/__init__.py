"""
Messaging infrastructure - domain events and event publishing.

Provides the foundation for event-driven communication:
- Domain event base class
- Event publisher interface
- In-memory publisher for testing
- AWS EventBridge/SNS publishers for production

Research Grounding: docs/gaps/data-ingestion-assessment.md
"""

from src.infrastructure.messaging.events import (
    DomainEvent,
    EventMetadata,
)
from src.infrastructure.messaging.publisher import (
    IEventPublisher,
    InMemoryEventPublisher,
)

__all__ = [
    "DomainEvent",
    "EventMetadata",
    "IEventPublisher",
    "InMemoryEventPublisher",
]
