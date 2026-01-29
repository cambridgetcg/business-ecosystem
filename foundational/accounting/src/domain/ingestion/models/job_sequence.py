"""
Job Sequence model for atomic job number generation.

Uses a dedicated table with row-level locking to ensure
unique, sequential job numbers even under concurrent load.
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.base import Base


class ImportJobSequence(Base):
    """
    Tracks the last used sequence number per year for import jobs.

    This table enables atomic job number generation using
    INSERT ... ON CONFLICT ... DO UPDATE.

    Each row tracks: year -> last_sequence_used
    """

    __tablename__ = "import_job_sequence"

    year: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        comment="The year for which this sequence applies",
    )
    last_sequence: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="The last sequence number used for this year",
    )

    def __repr__(self) -> str:
        return f"<ImportJobSequence(year={self.year}, last_sequence={self.last_sequence})>"
