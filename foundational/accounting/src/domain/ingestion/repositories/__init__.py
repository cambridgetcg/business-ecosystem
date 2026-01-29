"""
Ingestion domain repositories.
"""

from src.domain.ingestion.repositories.import_job_repository import ImportJobRepository
from src.domain.ingestion.repositories.import_error_repository import ImportErrorRepository

__all__ = [
    "ImportJobRepository",
    "ImportErrorRepository",
]
