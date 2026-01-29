"""
Posting status enum for journal entries.

Journal entries follow a strict lifecycle:
    DRAFT → PENDING → POSTED

Once POSTED, an entry becomes immutable.
Corrections are made via reversing entries, not modifications.

Research Grounding: docs/research/02-journal-entry-immutability.md
"""

from enum import Enum


class PostingStatus(str, Enum):
    """
    Lifecycle status for journal entries.

    State transitions:
        DRAFT   → Can be edited, deleted, or submitted for approval
        PENDING → Awaiting approval, cannot be edited
        POSTED  → Permanent record, IMMUTABLE, no modifications allowed
        VOID    → Entry has been voided (via reversing entry), kept for audit

    The VOID status is only set by the system when a reversing entry is posted.
    It preserves the original entry for audit trail while indicating it has
    been reversed.
    """

    DRAFT = "DRAFT"
    PENDING = "PENDING"
    POSTED = "POSTED"
    VOID = "VOID"

    @property
    def is_editable(self) -> bool:
        """Return True if entries with this status can be modified."""
        return self == PostingStatus.DRAFT

    @property
    def is_deletable(self) -> bool:
        """Return True if entries with this status can be deleted."""
        return self == PostingStatus.DRAFT

    @property
    def is_immutable(self) -> bool:
        """Return True if entries with this status cannot be modified."""
        return self in (PostingStatus.POSTED, PostingStatus.VOID)

    @property
    def can_transition_to_posted(self) -> bool:
        """Return True if entries can transition from this status to POSTED."""
        return self in (PostingStatus.DRAFT, PostingStatus.PENDING)

    @classmethod
    def initial(cls) -> "PostingStatus":
        """Return the initial status for new entries."""
        return cls.DRAFT
