"""
SQLAlchemy base model with audit fields and common functionality.

All domain models inherit from this base, ensuring:
- Consistent primary key strategy (ULID)
- Automatic audit trail (created_at, updated_at, created_by, updated_by)
- Soft delete support
- Optimistic locking via version field
"""

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column
from ulid import ULID


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


class AuditMixin:
    """Mixin providing audit fields for all entities."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="User ID who created this record",
    )
    updated_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        comment="User ID who last updated this record",
    )


class SoftDeleteMixin:
    """Mixin for soft delete functionality."""

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    deleted_by: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
    )


class VersionMixin:
    """Mixin for optimistic locking."""

    version: Mapped[int] = mapped_column(
        BigInteger,
        default=1,
        nullable=False,
    )


def generate_ulid() -> str:
    """Generate a new ULID string."""
    return str(ULID())


class BaseEntity(Base, AuditMixin, VersionMixin):
    """
    Base entity with ULID primary key and full audit support.

    Use this as the base class for all domain entities.
    Provides:
    - ULID-based ID (sortable, unique, URL-safe)
    - Automatic timestamps (created_at, updated_at)
    - User tracking (created_by, updated_by)
    - Optimistic locking (version)
    """

    __abstract__ = True

    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=generate_ulid,
    )

    @declared_attr.directive
    @classmethod
    def __tablename__(cls) -> str:
        """Generate table name from class name (snake_case)."""
        name = cls.__name__
        result = [name[0].lower()]
        for char in name[1:]:
            if char.isupper():
                result.extend(["_", char.lower()])
            else:
                result.append(char)
        return "".join(result)

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"


class ImmutableEntity(Base, AuditMixin):
    """
    Base entity for immutable records (e.g., journal entries).

    Once created, these records cannot be modified (no updated_at, no version).
    This is critical for accounting audit trails.
    """

    __abstract__ = True

    id: Mapped[str] = mapped_column(
        String(26),
        primary_key=True,
        default=generate_ulid,
    )

    @declared_attr.directive
    @classmethod
    def __tablename__(cls) -> str:
        """Generate table name from class name (snake_case)."""
        name = cls.__name__
        result = [name[0].lower()]
        for char in name[1:]:
            if char.isupper():
                result.extend(["_", char.lower()])
            else:
                result.append(char)
        return "".join(result)

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"


# Type alias for money amounts - use Numeric(19, 4) in actual columns
# This provides up to 15 digits before decimal and 4 after
# Range: -9,999,999,999,999,999.9999 to 9,999,999,999,999,999.9999
MONEY_PRECISION = 19
MONEY_SCALE = 4
