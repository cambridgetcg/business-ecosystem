"""
Adapter classes for ingestion service dependencies.

These adapters wrap existing repositories to satisfy the protocol interfaces
required by the import mappers.
"""

from datetime import date

from src.domain.general_ledger.repositories.fiscal_period_repository import FiscalPeriodRepository
from src.domain.general_ledger.repositories.journal_entry_repository import JournalEntryRepository
from src.domain.chart_of_accounts.repositories.account_repository import AccountRepository


class FiscalPeriodResolverAdapter:
    """
    Adapts FiscalPeriodRepository to satisfy IFiscalPeriodResolver protocol.

    The import mappers need to resolve entry dates to fiscal period IDs.
    This adapter wraps the async repository methods for use in the mapper.
    """

    def __init__(self, repository: FiscalPeriodRepository) -> None:
        """
        Initialize the adapter.

        Args:
            repository: The fiscal period repository
        """
        self._repository = repository
        self._cache: dict[date, str | None] = {}

    async def resolve_fiscal_period_id(self, entry_date: date) -> str | None:
        """
        Resolve a date to its fiscal period ID.

        Args:
            entry_date: The date to find the period for

        Returns:
            Fiscal period ID if found, None if no period covers the date
        """
        # Check cache first
        if entry_date in self._cache:
            return self._cache[entry_date]

        period = await self._repository.get_for_date(entry_date)
        period_id = period.id if period else None

        # Cache the result
        self._cache[entry_date] = period_id
        return period_id

    def clear_cache(self) -> None:
        """Clear the resolution cache."""
        self._cache.clear()


class EntryNumberGeneratorAdapter:
    """
    Adapts JournalEntryRepository to satisfy IEntryNumberGenerator protocol.

    The import mappers need to generate unique entry numbers for new entries.
    This adapter wraps the async repository method.
    """

    def __init__(self, repository: JournalEntryRepository) -> None:
        """
        Initialize the adapter.

        Args:
            repository: The journal entry repository
        """
        self._repository = repository
        self._sequence_cache: dict[int, int] = {}  # year -> next sequence

    async def generate_entry_number(self, entry_date: date) -> str:
        """
        Generate a unique entry number.

        Args:
            entry_date: Date of the entry (for year-based numbering)

        Returns:
            Unique entry number (e.g., "JE-2026-00001")
        """
        year = entry_date.year

        # Use cached sequence if available to avoid DB round-trip
        if year in self._sequence_cache:
            seq = self._sequence_cache[year]
            self._sequence_cache[year] = seq + 1
            return f"JE-{year}-{seq:05d}"

        # Get next number from repository and initialize cache
        entry_number = await self._repository.get_next_entry_number(year)

        # Parse the sequence and cache the next value
        seq = int(entry_number.split("-")[-1])
        self._sequence_cache[year] = seq + 1

        return entry_number

    def clear_cache(self) -> None:
        """Clear the sequence cache."""
        self._sequence_cache.clear()


class AccountResolverAdapter:
    """
    Adapts AccountRepository to satisfy IAccountResolver protocol.

    The import mappers need to resolve account codes to account IDs.
    This adapter wraps the async repository methods.
    """

    def __init__(self, repository: AccountRepository) -> None:
        """
        Initialize the adapter.

        Args:
            repository: The account repository
        """
        self._repository = repository
        self._cache: dict[str, str | None] = {}

    async def resolve_account_id(self, account_code: str) -> str | None:
        """
        Resolve an account code to its ID.

        Args:
            account_code: The account code to resolve

        Returns:
            Account ID if found, None otherwise
        """
        # Check cache first
        if account_code in self._cache:
            return self._cache[account_code]

        account_id = await self._repository.get_account_id_by_code(account_code)

        # Cache the result
        self._cache[account_code] = account_id
        return account_id

    async def account_exists(self, code: str) -> bool:
        """
        Check if an account code exists.

        Args:
            code: The account code to check

        Returns:
            True if account exists, False otherwise
        """
        return await self._repository.account_exists(code)

    async def get_account_id_by_code(self, code: str) -> str | None:
        """
        Get account ID by code.

        Args:
            code: The account code

        Returns:
            Account ID if found, None otherwise
        """
        return await self.resolve_account_id(code)

    def clear_cache(self) -> None:
        """Clear the resolution cache."""
        self._cache.clear()
