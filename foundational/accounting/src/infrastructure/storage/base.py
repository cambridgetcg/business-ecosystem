"""
File storage interfaces and base types.

Defines the contract for storing and retrieving files in the accounting system.
Used for source documents that support journal entries (invoices, receipts, etc.).

Design Principles:
1. Storage-agnostic - Same interface for S3, local, or other backends
2. Audit-friendly - Every operation is traceable
3. Integrity-focused - SHA-256 hashes verify file integrity
4. SOX-compliant - Supports 7-year retention requirements

Research Grounding: docs/gaps/data-ingestion-assessment.md
"""

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import AsyncIterator, BinaryIO, Protocol, runtime_checkable


class StorageError(Exception):
    """Base exception for storage operations."""

    def __init__(
        self,
        message: str,
        code: str = "STORAGE_ERROR",
        file_key: str | None = None,
    ) -> None:
        self.message = message
        self.code = code
        self.file_key = file_key
        super().__init__(message)


class FileNotFoundError(StorageError):
    """Raised when a requested file does not exist."""

    def __init__(self, file_key: str) -> None:
        super().__init__(
            message=f"File not found: {file_key}",
            code="FILE_NOT_FOUND",
            file_key=file_key,
        )


class StorageConnectionError(StorageError):
    """Raised when storage backend is unavailable."""

    def __init__(self, message: str) -> None:
        super().__init__(
            message=f"Storage connection failed: {message}",
            code="STORAGE_CONNECTION_ERROR",
        )


class ContentType(str, Enum):
    """Common content types for stored files."""

    PDF = "application/pdf"
    PNG = "image/png"
    JPEG = "image/jpeg"
    TIFF = "image/tiff"
    CSV = "text/csv"
    JSON = "application/json"
    XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    XML = "application/xml"
    TEXT = "text/plain"
    BINARY = "application/octet-stream"

    @classmethod
    def from_extension(cls, extension: str) -> "ContentType":
        """Get content type from file extension."""
        ext_map = {
            ".pdf": cls.PDF,
            ".png": cls.PNG,
            ".jpg": cls.JPEG,
            ".jpeg": cls.JPEG,
            ".tiff": cls.TIFF,
            ".tif": cls.TIFF,
            ".csv": cls.CSV,
            ".json": cls.JSON,
            ".xlsx": cls.XLSX,
            ".xml": cls.XML,
            ".txt": cls.TEXT,
        }
        return ext_map.get(extension.lower(), cls.BINARY)


@dataclass(frozen=True)
class FileMetadata:
    """
    Metadata about a stored file.

    Attributes:
        content_type: MIME type of the file
        content_length: File size in bytes
        sha256_hash: SHA-256 hash of file contents for integrity verification
        uploaded_at: When file was uploaded
        uploaded_by: User ID who uploaded the file
        original_filename: Original name of the uploaded file
        custom_metadata: Additional key-value metadata
    """

    content_type: str
    content_length: int
    sha256_hash: str
    uploaded_at: datetime
    uploaded_by: str | None = None
    original_filename: str | None = None
    custom_metadata: dict[str, str] = field(default_factory=dict)

    @property
    def content_type_enum(self) -> ContentType:
        """Get ContentType enum value."""
        try:
            return ContentType(self.content_type)
        except ValueError:
            return ContentType.BINARY


@dataclass
class StoredFile:
    """
    A file stored in the storage backend.

    Attributes:
        key: Unique identifier/path for the file in storage
        metadata: File metadata
        bucket: Storage bucket/container name (if applicable)
        url: Direct URL to access the file (if public or pre-signed)
        version_id: Version identifier (for versioned storage)
    """

    key: str
    metadata: FileMetadata
    bucket: str | None = None
    url: str | None = None
    version_id: str | None = None

    @property
    def file_extension(self) -> str:
        """Get file extension from key."""
        return Path(self.key).suffix.lower()


@dataclass
class UploadRequest:
    """
    Request to upload a file.

    Attributes:
        file: File-like object containing the data
        filename: Original filename
        content_type: MIME type (auto-detected if None)
        uploaded_by: User ID performing upload
        folder: Folder/prefix for organizing files
        custom_metadata: Additional metadata to store
    """

    file: BinaryIO
    filename: str
    content_type: str | None = None
    uploaded_by: str | None = None
    folder: str | None = None
    custom_metadata: dict[str, str] = field(default_factory=dict)

    @property
    def effective_content_type(self) -> str:
        """Get content type, auto-detecting if not specified."""
        if self.content_type:
            return self.content_type
        ext = Path(self.filename).suffix
        return ContentType.from_extension(ext).value


@runtime_checkable
class IFileStorage(Protocol):
    """
    Protocol defining the interface for file storage adapters.

    All storage backends must implement this interface to ensure
    consistent behavior across the system.

    Usage:
        storage = S3StorageAdapter(bucket="source-documents")
        stored = await storage.upload(file, "invoices/INV-001.pdf")
        content = await storage.download(stored.key)
    """

    async def upload(
        self,
        request: UploadRequest,
    ) -> StoredFile:
        """
        Upload a file to storage.

        Args:
            request: Upload request with file data and metadata

        Returns:
            StoredFile with key and metadata

        Raises:
            StorageError: If upload fails
        """
        ...

    async def download(self, key: str) -> bytes:
        """
        Download a file's contents.

        Args:
            key: Storage key of the file

        Returns:
            File contents as bytes

        Raises:
            FileNotFoundError: If file does not exist
            StorageError: If download fails
        """
        ...

    async def download_stream(self, key: str) -> AsyncIterator[bytes]:
        """
        Download a file as a stream of chunks.

        Args:
            key: Storage key of the file

        Yields:
            Chunks of file data

        Raises:
            FileNotFoundError: If file does not exist
            StorageError: If download fails
        """
        ...

    async def get_metadata(self, key: str) -> FileMetadata:
        """
        Get metadata for a stored file.

        Args:
            key: Storage key of the file

        Returns:
            FileMetadata

        Raises:
            FileNotFoundError: If file does not exist
        """
        ...

    async def exists(self, key: str) -> bool:
        """
        Check if a file exists in storage.

        Args:
            key: Storage key to check

        Returns:
            True if file exists, False otherwise
        """
        ...

    async def delete(self, key: str) -> None:
        """
        Delete a file from storage.

        Note: For compliance, consider soft-delete or archival instead.

        Args:
            key: Storage key of the file to delete

        Raises:
            FileNotFoundError: If file does not exist
            StorageError: If deletion fails
        """
        ...

    async def list_files(
        self,
        prefix: str | None = None,
        limit: int = 1000,
    ) -> list[StoredFile]:
        """
        List files in storage.

        Args:
            prefix: Filter to files starting with this prefix
            limit: Maximum number of files to return

        Returns:
            List of StoredFile objects
        """
        ...

    async def get_presigned_url(
        self,
        key: str,
        expires_in_seconds: int = 3600,
    ) -> str:
        """
        Generate a pre-signed URL for temporary direct access.

        Args:
            key: Storage key of the file
            expires_in_seconds: URL validity duration (default 1 hour)

        Returns:
            Pre-signed URL string

        Raises:
            FileNotFoundError: If file does not exist
        """
        ...


def compute_sha256(data: bytes | BinaryIO) -> str:
    """
    Compute SHA-256 hash of file contents.

    Args:
        data: File contents as bytes or file-like object

    Returns:
        Hex-encoded SHA-256 hash string
    """
    hasher = hashlib.sha256()

    if isinstance(data, bytes):
        hasher.update(data)
    else:
        # Stream mode for file-like objects
        for chunk in iter(lambda: data.read(8192), b""):
            hasher.update(chunk)
        # Reset file position
        data.seek(0)

    return hasher.hexdigest()
