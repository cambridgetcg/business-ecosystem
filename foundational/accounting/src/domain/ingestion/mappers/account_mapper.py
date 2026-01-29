"""
Account Mapper - converts validated import rows to Account entities.

Maps chart of accounts import data to Account domain entities.

Design Principles:
1. Uses validated data - Expects input from BatchValidator
2. Resolves parents - Handles parent_code to parent_id resolution
3. Creates complete entities - Accounts ready for persistence
4. Reports mapping errors - Issues found during entity creation

Research Grounding: docs/gaps/data-ingestion-assessment.md
AI Knowledge Gap (doc 11): Mapping must be deterministic
"""

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from src.domain.ingestion.validators.batch_validator import (
    BatchValidationResult,
    RowValidationResult,
)
from src.domain.chart_of_accounts.models.account import Account, AccountType


@dataclass(frozen=True)
class AccountMappingError:
    """
    Error encountered during account mapping.

    Attributes:
        row_number: Source row number
        message: Human-readable error description
        error_code: Machine-readable error code
    """

    row_number: int
    message: str
    error_code: str = "MAPPING_ERROR"


@dataclass
class AccountMappingResult:
    """
    Result of mapping account import rows.

    Attributes:
        accounts: Successfully mapped accounts
        total_rows: Total rows processed
        successful: Number of accounts created
        failed: Number of rows that failed mapping
        errors: All errors encountered
    """

    accounts: list[Account] = field(default_factory=list)
    total_rows: int = 0
    successful: int = 0
    failed: int = 0
    errors: list[AccountMappingError] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        """Return True if all rows mapped successfully."""
        return self.failed == 0

    @property
    def has_errors(self) -> bool:
        """Return True if any rows failed mapping."""
        return self.failed > 0


@runtime_checkable
class IAccountCodeResolver(Protocol):
    """
    Protocol for checking account code existence and getting IDs.

    Used to resolve parent_code to parent_id and check for duplicates.
    """

    def account_exists(self, code: str) -> bool:
        """Check if an account code already exists."""
        ...

    def get_account_id_by_code(self, code: str) -> str | None:
        """Get account ID by code, or None if not found."""
        ...


class AccountMapper:
    """
    Maps validated import rows to Account entities.

    This mapper handles:
    1. Creating Account entities from validated data
    2. Resolving parent_code to parent_id
    3. Checking for duplicate codes
    4. Setting appropriate defaults

    Usage:
        mapper = AccountMapper(account_resolver=account_repo)

        result = mapper.map_batch(validation_result)

        for account in result.accounts:
            await repository.add(account)

    Two-Pass Import:
    When importing accounts with parent-child relationships, use two passes:
    1. First pass: Import parent accounts (parent_code=None)
    2. Second pass: Import child accounts (parent_code set)

    This ensures parent accounts exist when resolving parent_id.
    """

    def __init__(
        self,
        account_resolver: IAccountCodeResolver | None = None,
        *,
        check_duplicates: bool = True,
        allow_missing_parents: bool = False,
    ) -> None:
        """
        Initialize the mapper.

        Args:
            account_resolver: Optional resolver for checking existing accounts
            check_duplicates: Whether to check for duplicate codes
            allow_missing_parents: Whether to allow missing parent accounts
        """
        self._account_resolver = account_resolver
        self._check_duplicates = check_duplicates
        self._allow_missing_parents = allow_missing_parents

    def map_batch(
        self,
        validation_result: BatchValidationResult,
        *,
        default_currency: str = "USD",
    ) -> AccountMappingResult:
        """
        Map validated rows to Account entities.

        Args:
            validation_result: Result from BatchValidator
            default_currency: Currency for accounts without explicit currency

        Returns:
            AccountMappingResult with mapped accounts and any errors
        """
        result = AccountMappingResult(
            total_rows=len(validation_result.get_valid_rows()),
        )

        # Track codes being created in this batch (for duplicate detection)
        codes_in_batch: set[str] = set()

        for i, row in enumerate(validation_result.get_valid_rows()):
            account, error = self._map_single_account(
                row=row,
                row_number=row.row_number if hasattr(row, 'row_number') else i + 1,
                default_currency=default_currency,
                codes_in_batch=codes_in_batch,
            )

            if account:
                result.accounts.append(account)
                result.successful += 1
                codes_in_batch.add(account.code)
            else:
                result.failed += 1
                if error:
                    result.errors.append(error)

        return result

    def _map_single_account(
        self,
        row: RowValidationResult,
        row_number: int,
        default_currency: str,
        codes_in_batch: set[str],
    ) -> tuple[Account | None, AccountMappingError | None]:
        """
        Map a single row to an Account entity.

        Returns:
            Tuple of (Account, None) on success, or (None, AccountMappingError) on failure.
        """
        data = row.validated_data
        code: str = data.get("code", "")

        # Check for duplicate in existing data
        if self._check_duplicates and self._account_resolver:
            if self._account_resolver.account_exists(code):
                return None, AccountMappingError(
                    row_number=row_number,
                    message=f"Account code '{code}' already exists in the system",
                    error_code="DUPLICATE_ACCOUNT",
                )

        # Check for duplicate in current batch
        if code in codes_in_batch:
            return None, AccountMappingError(
                row_number=row_number,
                message=f"Duplicate account code '{code}' in import batch",
                error_code="DUPLICATE_IN_BATCH",
            )

        # Get required fields
        name: str = data.get("name", "")
        account_type: AccountType = data.get("account_type")

        # Get optional fields
        description: str | None = data.get("description")
        parent_code: str | None = data.get("parent_code")
        currency_code: str = data.get("currency_code", default_currency)
        is_header: bool = data.get("is_header", False)

        # Resolve parent ID if parent_code is provided
        parent_id: str | None = None
        if parent_code:
            if self._account_resolver:
                parent_id = self._account_resolver.get_account_id_by_code(parent_code)
                if not parent_id and not self._allow_missing_parents:
                    return None, AccountMappingError(
                        row_number=row_number,
                        message=f"Parent account '{parent_code}' not found for account '{code}'",
                        error_code="PARENT_NOT_FOUND",
                    )
            elif not self._allow_missing_parents:
                return None, AccountMappingError(
                    row_number=row_number,
                    message=f"Cannot resolve parent '{parent_code}' for account '{code}' - no resolver configured",
                    error_code="PARENT_RESOLUTION_FAILED",
                )

        # Create the account entity
        account = Account(
            code=code,
            name=name,
            description=description,
            account_type=account_type,
            parent_id=parent_id,
            is_active=True,
            is_header=is_header,
            currency_code=currency_code,
        )

        return account, None

    def map_single_row(
        self,
        row: RowValidationResult,
        *,
        default_currency: str = "USD",
        row_number: int = 1,
    ) -> tuple[Account | None, AccountMappingError | None]:
        """
        Map a single validated row to an Account entity.

        Convenience method for mapping single rows.

        Args:
            row: Single validated row
            default_currency: Currency if not specified
            row_number: Row number for error reporting

        Returns:
            Tuple of (Account, None) on success, or (None, AccountMappingError) on failure.
        """
        return self._map_single_account(
            row=row,
            row_number=row_number,
            default_currency=default_currency,
            codes_in_batch=set(),
        )

    def map_with_hierarchy(
        self,
        validation_result: BatchValidationResult,
        *,
        default_currency: str = "USD",
    ) -> AccountMappingResult:
        """
        Map accounts in hierarchical order (parents first).

        This method sorts rows so parent accounts are created before
        children, allowing parent_id resolution within a single import.

        Args:
            validation_result: Result from BatchValidator
            default_currency: Currency for accounts without explicit currency

        Returns:
            AccountMappingResult with mapped accounts in creation order
        """
        result = AccountMappingResult(
            total_rows=len(validation_result.get_valid_rows()),
        )

        valid_rows = validation_result.get_valid_rows()

        # Build code -> row mapping
        rows_by_code: dict[str, RowValidationResult] = {}
        for row in valid_rows:
            code = row.validated_data.get("code", "")
            rows_by_code[code] = row

        # Sort rows: parents before children
        sorted_rows = self._sort_by_hierarchy(list(valid_rows))

        # Track accounts created in this batch for parent resolution
        created_accounts: dict[str, Account] = {}

        for i, row in enumerate(sorted_rows):
            data = row.validated_data
            code: str = data.get("code", "")
            row_num = getattr(row, 'row_number', i + 1)

            # Check for duplicate
            if self._check_duplicates:
                if self._account_resolver and self._account_resolver.account_exists(code):
                    result.failed += 1
                    result.errors.append(AccountMappingError(
                        row_number=row_num,
                        message=f"Account code '{code}' already exists in the system",
                        error_code="DUPLICATE_ACCOUNT",
                    ))
                    continue
                if code in created_accounts:
                    result.failed += 1
                    result.errors.append(AccountMappingError(
                        row_number=row_num,
                        message=f"Duplicate account code '{code}' in import batch",
                        error_code="DUPLICATE_IN_BATCH",
                    ))
                    continue

            # Get fields
            name: str = data.get("name", "")
            account_type: AccountType = data.get("account_type")
            description: str | None = data.get("description")
            parent_code: str | None = data.get("parent_code")
            currency_code: str = data.get("currency_code", default_currency)
            is_header: bool = data.get("is_header", False)

            # Resolve parent ID
            parent_id: str | None = None
            if parent_code:
                # First check batch-created accounts
                if parent_code in created_accounts:
                    parent_id = created_accounts[parent_code].id
                # Then check existing accounts
                elif self._account_resolver:
                    parent_id = self._account_resolver.get_account_id_by_code(parent_code)

                if not parent_id and not self._allow_missing_parents:
                    result.failed += 1
                    result.errors.append(AccountMappingError(
                        row_number=row_num,
                        message=f"Parent account '{parent_code}' not found for account '{code}'",
                        error_code="PARENT_NOT_FOUND",
                    ))
                    continue

            # Create account
            account = Account(
                code=code,
                name=name,
                description=description,
                account_type=account_type,
                parent_id=parent_id,
                is_active=True,
                is_header=is_header,
                currency_code=currency_code,
            )

            result.accounts.append(account)
            result.successful += 1
            created_accounts[code] = account

        return result

    def _sort_by_hierarchy(
        self,
        rows: list[RowValidationResult],
    ) -> list[RowValidationResult]:
        """
        Sort rows so parent accounts come before children.

        Uses a simple topological sort based on parent_code dependencies.
        """
        # Build dependency graph
        code_to_row: dict[str, RowValidationResult] = {}
        parent_to_children: dict[str | None, list[str]] = {None: []}

        for row in rows:
            code = row.validated_data.get("code", "")
            parent_code = row.validated_data.get("parent_code")

            code_to_row[code] = row

            if parent_code not in parent_to_children:
                parent_to_children[parent_code] = []
            parent_to_children[parent_code].append(code)

        # Collect rows with no parent first, then their children
        sorted_rows: list[RowValidationResult] = []
        visited: set[str] = set()

        def visit(code: str) -> None:
            if code in visited:
                return
            visited.add(code)

            if code in code_to_row:
                sorted_rows.append(code_to_row[code])

            # Visit children
            for child in parent_to_children.get(code, []):
                visit(child)

        # Start with root accounts (no parent or parent not in batch)
        root_codes = parent_to_children.get(None, [])
        for row in rows:
            c = row.validated_data.get("code", "")
            parent = row.validated_data.get("parent_code")
            if parent is None or parent not in code_to_row:
                if c not in visited:
                    visit(c)

        # Handle any remaining (circular dependencies or orphans)
        for row in rows:
            code = row.validated_data.get("code", "")
            if code not in visited:
                visit(code)

        return sorted_rows
