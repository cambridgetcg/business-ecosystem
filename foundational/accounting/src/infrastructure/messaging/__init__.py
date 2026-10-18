"""
Messaging infrastructure - domain events and event publishing.

Provides the foundation for event-driven communication:
- Domain event base class and accounting domain events
- Event publisher interface with multiple implementations
- AWS SNS publisher for production
- Event handlers for consuming events from other services
- Specialized handlers for Banking, Tax, and Entity Governance integration
- Factory function for publisher creation

Research Grounding: docs/gaps/data-ingestion-assessment.md
"""

from src.infrastructure.messaging.events import (
    DomainEvent,
    EventMetadata,
    JournalEntryPosted,
    JournalEntryReversed,
    FiscalPeriodClosed,
    AccountCreated,
    ImportJobCreated,
    ImportJobCompleted,
    ImportJobFailed,
)
from src.infrastructure.messaging.publisher import (
    IEventPublisher,
    InMemoryEventPublisher,
    LoggingEventPublisher,
    CompositeEventPublisher,
    create_event_publisher,
)
from src.infrastructure.messaging.event_handlers import (
    EVENT_HANDLERS,
    dispatch_event,
    register_all_handlers,
    ALL_EVENTS_CONSUMED,
)
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

__all__ = [
    # Base classes
    "DomainEvent",
    "EventMetadata",
    # Accounting domain events
    "JournalEntryPosted",
    "JournalEntryReversed",
    "FiscalPeriodClosed",
    "AccountCreated",
    "ImportJobCreated",
    "ImportJobCompleted",
    "ImportJobFailed",
    # Publisher interface and implementations
    "IEventPublisher",
    "InMemoryEventPublisher",
    "LoggingEventPublisher",
    "CompositeEventPublisher",
    "create_event_publisher",
    # Event handling - dispatch and registry
    "EVENT_HANDLERS",
    "dispatch_event",
    "register_all_handlers",
    "ALL_EVENTS_CONSUMED",
    # Specialized handlers
    "BankingEventHandler",
    "register_banking_handlers",
    "TaxEventHandler",
    "register_tax_handlers",
    "TAX_EVENTS_CONSUMED",
    "EntityEventHandler",
    "register_entity_handlers",
    "ENTITY_EVENTS_CONSUMED",
]
