"""
File storage infrastructure for source documents.

Provides interfaces and implementations for storing and retrieving
files (invoices, receipts, contracts) that support journal entries.

Storage adapters support:
- S3-compatible object storage (AWS, MinIO, etc.)
- Local filesystem (for development)
"""

from src.infrastructure.storage.base import (
    ContentType,
    FileMetadata,
    FileNotFoundError,
    IFileStorage,
    StorageConnectionError,
    StorageError,
    StoredFile,
    UploadRequest,
    compute_sha256,
)
from src.infrastructure.storage.s3_adapter import S3StorageAdapter
from src.infrastructure.storage.local_adapter import LocalStorageAdapter

__all__ = [
    # Interfaces and base types
    "ContentType",
    "FileMetadata",
    "FileNotFoundError",
    "IFileStorage",
    "StorageConnectionError",
    "StorageError",
    "StoredFile",
    "UploadRequest",
    "compute_sha256",
    # Implementations
    "S3StorageAdapter",
    "LocalStorageAdapter",
]
