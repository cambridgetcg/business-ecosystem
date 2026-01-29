"""
Compliance Control Registry and Testing Framework.

Provides continuous compliance monitoring through:
- Control registry (what controls exist)
- Control tests (automated verification)
- Exception management (when controls fail)

Research Grounding: docs/gaps/07-compliance-verification.md
Regulatory Basis: SOX Section 404, PCAOB standards
"""

from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Awaitable

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.persistence.base import BaseEntity


# =============================================================================
# Control Types and Enums
# =============================================================================


class ControlType(str, Enum):
    """Classification of control by when it acts."""

    PREVENTIVE = "PREVENTIVE"  # Stops violations before they occur
    DETECTIVE = "DETECTIVE"  # Identifies violations after they occur
    CORRECTIVE = "CORRECTIVE"  # Fixes violations that occurred


class ControlCategory(str, Enum):
    """Category of what the control protects."""

    FINANCIAL_INTEGRITY = "FINANCIAL_INTEGRITY"  # Balance, accuracy
    DATA_INTEGRITY = "DATA_INTEGRITY"  # Completeness, consistency
    ACCESS_CONTROL = "ACCESS_CONTROL"  # Authorization, segregation
    AUDIT_TRAIL = "AUDIT_TRAIL"  # Logging, traceability
    PERIOD_CONTROL = "PERIOD_CONTROL"  # Cutoff, timing


class TestFrequency(str, Enum):
    """How often control tests run."""

    CONTINUOUS = "CONTINUOUS"  # Every transaction
    HOURLY = "HOURLY"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"


class ExceptionSeverity(str, Enum):
    """Severity of a compliance exception."""

    CRITICAL = "CRITICAL"  # Material impact, immediate action required
    HIGH = "HIGH"  # Significant impact, action within 24 hours
    MEDIUM = "MEDIUM"  # Moderate impact, action within week
    LOW = "LOW"  # Minor impact, track and address


class ExceptionStatus(str, Enum):
    """Status of exception remediation."""

    OPEN = "OPEN"  # Newly detected
    INVESTIGATING = "INVESTIGATING"  # Being analyzed
    REMEDIATION = "REMEDIATION"  # Fix in progress
    RESOLVED = "RESOLVED"  # Fixed and verified
    ACCEPTED = "ACCEPTED"  # Risk accepted (documented)


# =============================================================================
# Control Registry
# =============================================================================


class ComplianceControl(BaseEntity):
    """
    A control that enforces a compliance requirement.

    Controls are the mechanisms (code, policies, procedures) that ensure
    the system meets regulatory and business requirements.

    Attributes:
        control_id: Unique identifier (e.g., CTL-001)
        name: Human-readable name
        description: Detailed description
        control_type: Preventive, Detective, or Corrective
        category: What the control protects
        requirement_refs: References to regulations (comma-separated)
        implementation_ref: Where in code this is implemented
        test_procedure: How to verify the control works
        owner: Responsible party
        is_active: Whether control is currently active
        effective_date: When control became effective
    """

    __tablename__ = "compliance_controls"

    control_id: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True,
        comment="Control identifier (e.g., CTL-001)",
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Human-readable control name",
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Detailed control description",
    )

    control_type: Mapped[ControlType] = mapped_column(
        SQLEnum(ControlType, native_enum=False),
        nullable=False,
        comment="Preventive, Detective, or Corrective",
    )

    category: Mapped[ControlCategory] = mapped_column(
        SQLEnum(ControlCategory, native_enum=False),
        nullable=False,
        index=True,
        comment="What the control protects",
    )

    requirement_refs: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="References to regulations (comma-separated)",
    )

    implementation_ref: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Code location where control is implemented",
    )

    test_procedure: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="How to verify control effectiveness",
    )

    owner: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Responsible party for this control",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Whether control is currently active",
    )

    effective_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When control became effective",
    )

    def __repr__(self) -> str:
        return f"<ComplianceControl({self.control_id}: {self.name})>"


# =============================================================================
# Control Test Results
# =============================================================================


class ControlTestResult(BaseEntity):
    """
    Result of a control test execution.

    Each time a control is tested (manually or automatically),
    the result is recorded here for audit purposes.

    Attributes:
        control_id: Reference to ComplianceControl
        test_name: Name of the test
        passed: Whether test passed
        executed_at: When test ran
        executed_by: User or 'SYSTEM'
        evidence: What was tested and found
        exceptions_found: Number of exceptions
        exception_details: Details of any exceptions
    """

    __tablename__ = "control_test_results"

    control_db_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("compliance_controls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Reference to ComplianceControl",
    )

    test_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Name of the test executed",
    )

    passed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        index=True,
        comment="Whether test passed",
    )

    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="When test was executed",
    )

    executed_by: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="User ID or 'SYSTEM'",
    )

    evidence: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON: what was tested and results",
    )

    exceptions_found: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of exceptions found",
    )

    exception_details: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON: details of exceptions found",
    )

    def __repr__(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        return f"<ControlTestResult({self.test_name}: {status})>"


# =============================================================================
# Compliance Exceptions
# =============================================================================


class ComplianceException(BaseEntity):
    """
    A compliance violation requiring attention.

    When a control test fails or a violation is detected,
    an exception is created to track remediation.

    Attributes:
        control_db_id: Reference to ComplianceControl
        test_result_id: Reference to test that found it (if applicable)
        severity: Impact level
        description: What went wrong
        evidence: Supporting data
        status: Remediation status
        assigned_to: Person responsible for fix
        due_date: When fix is due
        resolution: How it was resolved
        resolved_at: When resolved
        resolved_by: Who resolved it
    """

    __tablename__ = "compliance_exceptions"

    control_db_id: Mapped[str] = mapped_column(
        String(26),
        ForeignKey("compliance_controls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Reference to ComplianceControl",
    )

    test_result_id: Mapped[str | None] = mapped_column(
        String(26),
        ForeignKey("control_test_results.id", ondelete="SET NULL"),
        nullable=True,
        comment="Test that detected this exception",
    )

    severity: Mapped[ExceptionSeverity] = mapped_column(
        SQLEnum(ExceptionSeverity, native_enum=False),
        nullable=False,
        index=True,
        comment="Impact severity",
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="What went wrong",
    )

    evidence: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="JSON: supporting data",
    )

    status: Mapped[ExceptionStatus] = mapped_column(
        SQLEnum(ExceptionStatus, native_enum=False),
        nullable=False,
        default=ExceptionStatus.OPEN,
        index=True,
        comment="Remediation status",
    )

    assigned_to: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Person responsible for fix",
    )

    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When fix is due",
    )

    resolution: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="How exception was resolved",
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When resolved",
    )

    resolved_by: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Who resolved it",
    )

    def __repr__(self) -> str:
        return (
            f"<ComplianceException("
            f"severity={self.severity.value}, "
            f"status={self.status.value})>"
        )


# =============================================================================
# Control Test Framework (In-Memory)
# =============================================================================


class ControlTestSpec:
    """
    Specification for an automated control test.

    This is not persisted - it's used to define tests that can be run.
    """

    def __init__(
        self,
        control_id: str,
        test_name: str,
        test_function: Callable[[], Awaitable[dict[str, Any]]],
        frequency: TestFrequency = TestFrequency.DAILY,
        description: str | None = None,
    ):
        self.control_id = control_id
        self.test_name = test_name
        self.test_function = test_function
        self.frequency = frequency
        self.description = description


# =============================================================================
# Pre-defined Controls (Initial Registry)
# =============================================================================

INITIAL_CONTROLS: list[dict] = [
    {
        "control_id": "CTL-001",
        "name": "Balance Validation",
        "description": "Ensures all journal entries have debits equal to credits before posting",
        "control_type": ControlType.PREVENTIVE,
        "category": ControlCategory.FINANCIAL_INTEGRITY,
        "requirement_refs": "GAAP, SOX 404",
        "implementation_ref": "src/domain/general_ledger/validators/balance_validator.py",
        "test_procedure": "Attempt to post unbalanced entry; verify rejection",
    },
    {
        "control_id": "CTL-002",
        "name": "Period Closure Control",
        "description": "Prevents posting to closed fiscal periods",
        "control_type": ControlType.PREVENTIVE,
        "category": ControlCategory.PERIOD_CONTROL,
        "requirement_refs": "GAAP, SOX 404",
        "implementation_ref": "src/domain/general_ledger/services/posting_service.py",
        "test_procedure": "Attempt to post to closed period; verify rejection",
    },
    {
        "control_id": "CTL-003",
        "name": "Journal Entry Immutability",
        "description": "Posted journal entries cannot be modified or deleted",
        "control_type": ControlType.PREVENTIVE,
        "category": ControlCategory.AUDIT_TRAIL,
        "requirement_refs": "SOX 404, PCAOB AS 2201",
        "implementation_ref": "src/infrastructure/persistence/base.py:ImmutableEntity",
        "test_procedure": "Attempt to modify posted entry; verify rejection",
    },
    {
        "control_id": "CTL-004",
        "name": "Sequential Entry Numbering",
        "description": "Journal entries are numbered sequentially with no gaps",
        "control_type": ControlType.DETECTIVE,
        "category": ControlCategory.AUDIT_TRAIL,
        "requirement_refs": "SOX 404",
        "implementation_ref": "src/domain/general_ledger/repositories/journal_entry_repository.py",
        "test_procedure": "Verify no gaps in entry number sequence",
    },
    {
        "control_id": "CTL-005",
        "name": "Minimum Entry Lines",
        "description": "Journal entries must have at least 2 lines (debit and credit)",
        "control_type": ControlType.PREVENTIVE,
        "category": ControlCategory.DATA_INTEGRITY,
        "requirement_refs": "GAAP Double-Entry",
        "implementation_ref": "src/domain/general_ledger/models/journal_entry.py:validate_for_posting",
        "test_procedure": "Attempt to post single-line entry; verify rejection",
    },
    {
        "control_id": "CTL-006",
        "name": "Positive Amounts Only",
        "description": "All journal entry line amounts must be positive",
        "control_type": ControlType.PREVENTIVE,
        "category": ControlCategory.DATA_INTEGRITY,
        "requirement_refs": "Best Practice",
        "implementation_ref": "src/domain/general_ledger/models/journal_entry.py:validate_for_posting",
        "test_procedure": "Attempt to post entry with negative amount; verify rejection",
    },
]
