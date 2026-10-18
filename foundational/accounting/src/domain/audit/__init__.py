"""
Audit Domain - Event Sourcing and Audit Trail Infrastructure.

This bounded context provides:
- Event Store for persisting all domain events
- Audit trail for regulatory compliance (SOX, PCAOB)
- Temporal queries (state at any point in time)
- Event replay for state reconstruction

Mission Alignment: Enables "Authoritative Financial Truth" by providing
verifiable evidence of all state changes.

Research Grounding: docs/gaps/PATH_MATERIAL.md (Event Sourcing Pattern)
"""

from src.domain.audit.entities.audit_event import AuditEvent, AuditEventType
from src.domain.audit.value_objects.aggregate_reference import AggregateReference
from src.domain.audit.repositories.event_store import EventStore
from src.domain.audit.services.event_recorder import EventRecorder
from src.domain.audit.services.projection_service import ProjectionService

__all__ = [
    "AuditEvent",
    "AuditEventType",
    "AggregateReference",
    "EventStore",
    "EventRecorder",
    "ProjectionService",
]
