"""
Import command handlers - execute import write operations.

Handlers are the bridge between the API layer and domain services.
They receive commands, call domain services, and return DTOs.

Design Principles:
1. Single responsibility - one handler per command
2. Protocol dependencies - injectable for testing
3. DTO returns - never expose domain entities directly
4. Error handling - catch domain exceptions, return appropriate DTOs

Research Grounding: docs/architecture/ingestion-pipeline-phase1.md
Follows pattern from: src/domain/general_ledger/services/posting_service.py
"""

from io import BytesIO
from typing import Protocol

from src.application.commands.import_commands import (
    ImportJournalEntriesCommand,
    ImportAccountsCommand,
    CancelImportJobCommand,
)
from src.application.dtos.import_dtos import ImportResultDTO, ImportJobDTO
from src.domain.ingestion.services.import_service import (
    ImportService,
    ImportOptions,
    ImportResult,
)


class IImportService(Protocol):
    """Protocol for import service dependency."""

    async def import_journal_entries(
        self,
        file,
        file_name: str,
        initiated_by: str,
        *,
        options: ImportOptions | None = None,
    ) -> ImportResult:
        """Import journal entries from a file."""
        ...

    async def import_accounts(
        self,
        file,
        file_name: str,
        initiated_by: str,
        *,
        options: ImportOptions | None = None,
    ) -> ImportResult:
        """Import accounts from a file."""
        ...


class IImportJobRepository(Protocol):
    """Protocol for import job repository."""

    async def get_by_id(self, job_id: str):
        """Get job by ID."""
        ...

    async def save(self, job):
        """Save job."""
        ...


class ImportJournalEntriesHandler:
    """
    Handler for ImportJournalEntriesCommand.

    Executes the import of journal entries from a file.

    Usage:
        handler = ImportJournalEntriesHandler(import_service)
        result = await handler.execute(command)
    """

    def __init__(self, import_service: IImportService) -> None:
        """
        Initialize the handler.

        Args:
            import_service: Service that performs the actual import
        """
        self._import_service = import_service

    async def execute(self, command: ImportJournalEntriesCommand) -> ImportResultDTO:
        """
        Execute the import journal entries command.

        Args:
            command: The import command with file and options

        Returns:
            ImportResultDTO with the import result
        """
        # Convert command to service parameters
        options = ImportOptions(
            column_mapping=command.get_column_mapping_dict(),
            skip_rows=command.skip_rows,
            stop_on_error=command.stop_on_error,
            validate_only=command.validate_only,
            default_currency=command.default_currency,
        )

        # Create file-like object from bytes
        file = BytesIO(command.file_content)

        try:
            # Execute the import
            result = await self._import_service.import_journal_entries(
                file=file,
                file_name=command.file_name,
                initiated_by=command.initiated_by,
                options=options,
            )

            # Convert to DTO
            return ImportResultDTO.from_result(
                success=result.success,
                job=result.job,
            )

        except Exception as e:
            # Handle unexpected errors
            # In production, log the error and possibly create a failed job record
            raise


class ImportAccountsHandler:
    """
    Handler for ImportAccountsCommand.

    Executes the import of chart of accounts from a file.

    Usage:
        handler = ImportAccountsHandler(import_service)
        result = await handler.execute(command)
    """

    def __init__(self, import_service: IImportService) -> None:
        """
        Initialize the handler.

        Args:
            import_service: Service that performs the actual import
        """
        self._import_service = import_service

    async def execute(self, command: ImportAccountsCommand) -> ImportResultDTO:
        """
        Execute the import accounts command.

        Args:
            command: The import command with file and options

        Returns:
            ImportResultDTO with the import result
        """
        # Convert command to service parameters
        options = ImportOptions(
            column_mapping=command.get_column_mapping_dict(),
            skip_rows=command.skip_rows,
            stop_on_error=command.stop_on_error,
            validate_only=command.validate_only,
            default_currency=command.default_currency,
        )

        # Create file-like object from bytes
        file = BytesIO(command.file_content)

        try:
            # Execute the import
            result = await self._import_service.import_accounts(
                file=file,
                file_name=command.file_name,
                initiated_by=command.initiated_by,
                options=options,
            )

            # Convert to DTO
            return ImportResultDTO.from_result(
                success=result.success,
                job=result.job,
            )

        except Exception as e:
            # Handle unexpected errors
            raise


class CancelImportJobHandler:
    """
    Handler for CancelImportJobCommand.

    Cancels a running import job.

    Usage:
        handler = CancelImportJobHandler(job_repository)
        result = await handler.execute(command)
    """

    def __init__(self, job_repository: IImportJobRepository) -> None:
        """
        Initialize the handler.

        Args:
            job_repository: Repository for import jobs
        """
        self._job_repo = job_repository

    async def execute(self, command: CancelImportJobCommand) -> ImportJobDTO:
        """
        Execute the cancel import job command.

        Args:
            command: The cancel command with job ID and reason

        Returns:
            ImportJobDTO with the updated job

        Raises:
            ValueError: If job not found or cannot be cancelled
        """
        # Get the job
        job = await self._job_repo.get_by_id(command.job_id)
        if job is None:
            raise ValueError(f"Import job not found: {command.job_id}")

        # Cancel the job
        try:
            job.cancel(command.reason)
        except ValueError as e:
            raise ValueError(f"Cannot cancel job: {e}")

        # Save the updated job
        job = await self._job_repo.save(job)

        # Return DTO
        return ImportJobDTO.from_entity(job)
