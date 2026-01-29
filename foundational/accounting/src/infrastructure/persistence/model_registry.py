"""
Model Registry - ensures all SQLAlchemy models are discovered for migrations.

This module imports all domain entities that inherit from Base, ensuring they
are registered with SQLAlchemy's metadata before Alembic runs migrations.

IMPORTANT: Any new SQLAlchemy model MUST be imported here to be included
in database migrations.

Usage:
    # In alembic/env.py:
    from src.infrastructure.persistence.model_registry import ensure_models_loaded
    ensure_models_loaded()
"""

# Import Base first
from src.infrastructure.persistence.base import Base

# ------------------------------------------------------------------------------
# Chart of Accounts Domain
# ------------------------------------------------------------------------------
from src.domain.chart_of_accounts.models.account import Account

# ------------------------------------------------------------------------------
# General Ledger Domain
# ------------------------------------------------------------------------------
from src.domain.general_ledger.models.journal_entry import JournalEntry
from src.domain.general_ledger.models.journal_entry_line import JournalEntryLine
from src.domain.general_ledger.models.fiscal_period_entity import FiscalPeriodEntity

# ------------------------------------------------------------------------------
# Ingestion Domain
# ------------------------------------------------------------------------------
from src.domain.ingestion.models.import_job import ImportJob
from src.domain.ingestion.models.import_error import ImportError
from src.domain.ingestion.models.job_sequence import ImportJobSequence


# All models that should be discovered for migrations
ALL_MODELS = [
    # Chart of Accounts
    Account,
    # General Ledger
    JournalEntry,
    JournalEntryLine,
    FiscalPeriodEntity,
    # Ingestion
    ImportJob,
    ImportError,
    ImportJobSequence,
]


def ensure_models_loaded() -> None:
    """
    Ensure all models are loaded and registered with SQLAlchemy.

    Call this function before running migrations to guarantee all
    tables are included in the migration scripts.
    """
    pass  # Imports above already register the models


def get_all_table_names() -> list[str]:
    """Get all registered table names from the metadata."""
    return list(Base.metadata.tables.keys())


def verify_model_registration() -> dict[str, bool]:
    """Verify that all expected models are properly registered."""
    results = {}
    for model in ALL_MODELS:
        model_name = model.__name__
        has_table = hasattr(model, '__table__')
        in_metadata = (
            has_table and
            model.__table__.name in Base.metadata.tables
        )
        results[model_name] = in_metadata
    return results
