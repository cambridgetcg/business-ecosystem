"""Persistence infrastructure - database connections, ORM base classes, repositories."""

from src.infrastructure.persistence.base import (
    Base,
    BaseEntity,
    ImmutableEntity,
    MONEY_PRECISION,
    MONEY_SCALE,
)
from src.infrastructure.persistence.database import Database, get_database, get_session
from src.infrastructure.persistence.unit_of_work import UnitOfWork, unit_of_work
from src.infrastructure.persistence.model_registry import (
    ensure_models_loaded,
    get_all_table_names,
    verify_model_registration,
)

__all__ = [
    # Base classes
    "Base",
    "BaseEntity",
    "ImmutableEntity",
    "MONEY_PRECISION",
    "MONEY_SCALE",
    # Database
    "Database",
    "get_database",
    "get_session",
    # Unit of Work
    "UnitOfWork",
    "unit_of_work",
    # Model Registry
    "ensure_models_loaded",
    "get_all_table_names",
    "verify_model_registration",
]
