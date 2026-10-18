"""Audit domain repositories."""

from src.domain.audit.repositories.event_store import EventStore

__all__ = ["EventStore"]
