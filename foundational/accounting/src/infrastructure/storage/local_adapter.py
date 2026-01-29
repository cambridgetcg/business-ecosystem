"""
Local filesystem storage adapter implementation.

Provides file storage using the local filesystem for development and testing.
Implements the same IFileStorage protocol as S3StorageAdapter.

Configuration:
    Environment variables or settings:
    - LOCAL_STORAGE_PATH: Base directory for file storage
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator
from uuid import uuid4

from src.infrastructure.storage.base import (
    ContentType,
    FileMetadata,
    FileNotFoundError,
    StorageError,
    StoredFile,
    UploadRequest,
    compute_sha256,
)


class LocalStorageAdapter:
    """
    Local filesystem storage adapter.

    Implements IFileStorage protocol for local development and testing.
    Files are stored in a specified directory with metadata in sidecar files.

    Features:
    - Async-compatible (uses sync I/O wrapped for consistency)
    - SHA-256 integrity verification
    - Metadata stored in .meta files
    - Organized folder structure

    Usage:
        adapter = LocalStorageAdapter(
            base_path="/var/data/accounting/files",
        )
        stored = await adapter.upload(request)
    """

    def __init__(
        self,
        base_path: str | Path,
        create_if_missing: bool = True,
    ) -> None:
        """
        Initialize local storage adapter.

        Args:
            base_path: Root directory for file storage
            create_if_missing: Create base_path if it doesn't exist
        """
        self.base_path = Path(base_path).resolve()

        if create_if_missing:
            self.base_path.mkdir(parents=True, exist_ok=True)
        elif not self.base_path.exists():
            raise StorageError(
                message=f"Storage path does not exist: {base_path}",
                code="PATH_NOT_FOUND",
            )

    def _generate_key(self, filename: str, folder: str | None = None) -> str:
        """Generate a unique storage key for a file."""
        unique_id = uuid4().hex[:8]
        ext = Path(filename).suffix
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        safe_name = Path(filename).stem[:50]

        key_parts = []
        if folder:
            key_parts.append(folder)
        key_parts.append(f"{timestamp}_{unique_id}_{safe_name}{ext}")

        return "/".join(key_parts)

    def _get_full_path(self, key: str) -> Path:
        """Get the full filesystem path for a key."""
        return self.base_path / key

    def _get_meta_path(self, key: str) -> Path:
        """Get the metadata file path for a key."""
        return self.base_path / f"{key}.meta"

    async def upload(self, request: UploadRequest) -> StoredFile:
        """Upload a file to local storage."""
        # Read file content and compute hash
        content = request.file.read()
        request.file.seek(0)

        sha256_hash = compute_sha256(content)
        content_length = len(content)

        # Generate storage key
        key = self._generate_key(request.filename, request.folder)
        content_type = request.effective_content_type

        # Create directory structure
        full_path = self._get_full_path(key)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file
        try:
            with open(full_path, "wb") as f:
                f.write(content)
        except Exception as e:
            raise StorageError(
                message=f"Failed to write file: {str(e)}",
                code="WRITE_ERROR",
                file_key=key,
            )

        # Write metadata
        metadata = FileMetadata(
            content_type=content_type,
            content_length=content_length,
            sha256_hash=sha256_hash,
            uploaded_at=datetime.now(timezone.utc),
            uploaded_by=request.uploaded_by,
            original_filename=request.filename,
            custom_metadata=request.custom_metadata,
        )

        self._write_metadata(key, metadata)

        return StoredFile(
            key=key,
            metadata=metadata,
            url=f"file://{full_path}",
        )

    async def download(self, key: str) -> bytes:
        """Download a file from local storage."""
        full_path = self._get_full_path(key)

        if not full_path.exists():
            raise FileNotFoundError(key)

        try:
            with open(full_path, "rb") as f:
                return f.read()
        except Exception as e:
            raise StorageError(
                message=f"Failed to read file: {str(e)}",
                code="READ_ERROR",
                file_key=key,
            )

    async def download_stream(self, key: str) -> AsyncIterator[bytes]:
        """Download a file as a stream of chunks."""
        full_path = self._get_full_path(key)

        if not full_path.exists():
            raise FileNotFoundError(key)

        chunk_size = 8192
        try:
            with open(full_path, "rb") as f:
                while chunk := f.read(chunk_size):
                    yield chunk
        except Exception as e:
            raise StorageError(
                message=f"Failed to stream file: {str(e)}",
                code="STREAM_ERROR",
                file_key=key,
            )

    async def get_metadata(self, key: str) -> FileMetadata:
        """Get metadata for a stored file."""
        full_path = self._get_full_path(key)

        if not full_path.exists():
            raise FileNotFoundError(key)

        return self._read_metadata(key)

    async def exists(self, key: str) -> bool:
        """Check if a file exists in storage."""
        full_path = self._get_full_path(key)
        return full_path.exists()

    async def delete(self, key: str) -> None:
        """Delete a file from storage."""
        full_path = self._get_full_path(key)
        meta_path = self._get_meta_path(key)

        if not full_path.exists():
            raise FileNotFoundError(key)

        try:
            full_path.unlink()
            if meta_path.exists():
                meta_path.unlink()
        except Exception as e:
            raise StorageError(
                message=f"Failed to delete file: {str(e)}",
                code="DELETE_ERROR",
                file_key=key,
            )

    async def list_files(
        self,
        prefix: str | None = None,
        limit: int = 1000,
    ) -> list[StoredFile]:
        """List files in storage."""
        files: list[StoredFile] = []
        search_path = self.base_path

        if prefix:
            search_path = self.base_path / prefix

        if not search_path.exists():
            return files

        count = 0
        for path in search_path.rglob("*"):
            if path.is_file() and not path.suffix == ".meta":
                if count >= limit:
                    break

                key = str(path.relative_to(self.base_path))
                try:
                    metadata = self._read_metadata(key)
                except StorageError:
                    # Skip files without valid metadata
                    continue

                files.append(
                    StoredFile(
                        key=key,
                        metadata=metadata,
                        url=f"file://{path}",
                    )
                )
                count += 1

        return files

    async def get_presigned_url(
        self,
        key: str,
        expires_in_seconds: int = 3600,
    ) -> str:
        """
        Generate a URL for the file.

        Note: For local storage, this just returns the file:// URL.
        There's no pre-signing as files are accessed directly.
        """
        full_path = self._get_full_path(key)

        if not full_path.exists():
            raise FileNotFoundError(key)

        return f"file://{full_path}"

    def _write_metadata(self, key: str, metadata: FileMetadata) -> None:
        """Write metadata to sidecar file."""
        meta_path = self._get_meta_path(key)
        meta_path.parent.mkdir(parents=True, exist_ok=True)

        meta_dict = {
            "content_type": metadata.content_type,
            "content_length": metadata.content_length,
            "sha256_hash": metadata.sha256_hash,
            "uploaded_at": metadata.uploaded_at.isoformat(),
            "uploaded_by": metadata.uploaded_by,
            "original_filename": metadata.original_filename,
            "custom_metadata": metadata.custom_metadata,
        }

        with open(meta_path, "w") as f:
            json.dump(meta_dict, f, indent=2)

    def _read_metadata(self, key: str) -> FileMetadata:
        """Read metadata from sidecar file."""
        meta_path = self._get_meta_path(key)
        full_path = self._get_full_path(key)

        if meta_path.exists():
            try:
                with open(meta_path, "r") as f:
                    meta_dict = json.load(f)

                return FileMetadata(
                    content_type=meta_dict.get("content_type", "application/octet-stream"),
                    content_length=meta_dict.get("content_length", 0),
                    sha256_hash=meta_dict.get("sha256_hash", ""),
                    uploaded_at=datetime.fromisoformat(meta_dict["uploaded_at"]),
                    uploaded_by=meta_dict.get("uploaded_by"),
                    original_filename=meta_dict.get("original_filename"),
                    custom_metadata=meta_dict.get("custom_metadata", {}),
                )
            except Exception:
                pass

        # Fallback: generate metadata from file itself
        stat = full_path.stat()
        return FileMetadata(
            content_type=ContentType.from_extension(full_path.suffix).value,
            content_length=stat.st_size,
            sha256_hash="",
            uploaded_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
        )
