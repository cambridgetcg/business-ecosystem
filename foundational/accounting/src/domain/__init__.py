"""
Domain layer - business logic, entities, value objects, and domain services.

Bounded Contexts:
- chart_of_accounts: Account hierarchy and classification
- general_ledger: Journal entries, fiscal periods, balance validation
- accounts_payable: Vendor management and AP invoices (future)
- accounts_receivable: Customer management and AR invoices (future)
- fixed_assets: Asset tracking and depreciation (future)
- inventory_accounting: Inventory valuation (future)
- financial_reporting: Statements and reports (future)
- management_reporting: Internal reports (future)
"""

# Re-export key domain components for convenience
from src.domain.shared.exceptions import (
    DomainError,
    ValidationError,
    InvariantViolationError,
    EntityNotFoundError,
    PeriodClosedError,
    UnbalancedEntryError,
)

from src.domain.shared.value_objects import (
    Currency,
    Money,
    AccountCode,
    FiscalPeriod,
)

__all__ = [
    # Exceptions
    "DomainError",
    "ValidationError",
    "InvariantViolationError",
    "EntityNotFoundError",
    "PeriodClosedError",
    "UnbalancedEntryError",
    # Value Objects
    "Currency",
    "Money",
    "AccountCode",
    "FiscalPeriod",
]
