"""
S3-compatible storage adapter implementation.

Provides file storage using AWS S3 or S3-compatible services (MinIO, etc.).
Uses aioboto3 for async operations.

Configuration:
    Environment variables or settings:
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
    - AWS_REGION (default: us-east-1)
    - S3_ENDPOINT_URL (for non-AWS S3-compatible services)
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator
from uuid import uuid4

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


class S3StorageAdapter:
    """
    S3-compatible storage adapter.

    Implements IFileStorage protocol for AWS S3 or compatible services.

    Features:
    - Async operations using aioboto3
    - Automatic content type detection
    - SHA-256 integrity verification
    - Pre-signed URLs for temporary access
    - Support for custom S3-compatible endpoints

    Usage:
        adapter = S3StorageAdapter(
            bucket="source-documents",
            region="us-east-1",
        )
        stored = await adapter.upload(request)
    """

    def __init__(
        self,
        bucket: str,
        region: str = "us-east-1",
        endpoint_url: str | None = None,
        key_prefix: str = "",
    ) -> None:
        """
        Initialize S3 storage adapter.

        Args:
            bucket: S3 bucket name
            region: AWS region (default: us-east-1)
            endpoint_url: Custom endpoint URL for S3-compatible services
            key_prefix: Optional prefix for all keys (e.g., "accounting/")
        """
        self.bucket = bucket
        self.region = region
        self.endpoint_url = endpoint_url
        self.key_prefix = key_prefix.rstrip("/") + "/" if key_prefix else ""

    def _get_session(self):
        """Get aioboto3 session."""
        try:
            import aioboto3
        except ImportError:
            raise StorageError(
                "aioboto3 package required for S3 storage. "
                "Install with: pip install aioboto3",
                code="MISSING_DEPENDENCY",
            )
        return aioboto3.Session()

    def _generate_key(self, filename: str, folder: str | None = None) -> str:
        """Generate a unique storage key for a file."""
        # Generate unique ID to prevent collisions
        unique_id = uuid4().hex[:8]

        # Extract extension
        ext = Path(filename).suffix

        # Build key: prefix/folder/timestamp_uniqueid_filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        safe_name = Path(filename).stem[:50]  # Truncate long names

        key_parts = [self.key_prefix.rstrip("/")]

        if folder:
            key_parts.append(folder)

        key_parts.append(f"{timestamp}_{unique_id}_{safe_name}{ext}")

        return "/".join(filter(None, key_parts))

    async def upload(self, request: UploadRequest) -> StoredFile:
        """Upload a file to S3."""
        session = self._get_session()

        # Read file content and compute hash
        content = request.file.read()
        request.file.seek(0)

        sha256_hash = compute_sha256(content)
        content_length = len(content)

        # Generate storage key
        key = self._generate_key(request.filename, request.folder)
        content_type = request.effective_content_type

        # Prepare metadata for S3
        s3_metadata = {
            "original-filename": request.filename,
            "sha256-hash": sha256_hash,
        }
        if request.uploaded_by:
            s3_metadata["uploaded-by"] = request.uploaded_by
        s3_metadata.update(request.custom_metadata)

        try:
            async with session.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
            ) as s3:
                await s3.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=content,
                    ContentType=content_type,
                    Metadata=s3_metadata,
                )

                # Get the URL
                if self.endpoint_url:
                    url = f"{self.endpoint_url}/{self.bucket}/{key}"
                else:
                    url = f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{key}"

        except Exception as e:
            raise StorageError(
                message=f"Failed to upload file: {str(e)}",
                code="UPLOAD_ERROR",
                file_key=key,
            )

        metadata = FileMetadata(
            content_type=content_type,
            content_length=content_length,
            sha256_hash=sha256_hash,
            uploaded_at=datetime.now(timezone.utc),
            uploaded_by=request.uploaded_by,
            original_filename=request.filename,
            custom_metadata=request.custom_metadata,
        )

        return StoredFile(
            key=key,
            metadata=metadata,
            bucket=self.bucket,
            url=url,
        )

    async def download(self, key: str) -> bytes:
        """Download a file from S3."""
        session = self._get_session()

        try:
            async with session.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
            ) as s3:
                response = await s3.get_object(Bucket=self.bucket, Key=key)
                async with response["Body"] as stream:
                    return await stream.read()

        except session.client("s3").exceptions.NoSuchKey:
            raise FileNotFoundError(key)
        except Exception as e:
            if "NoSuchKey" in str(e) or "404" in str(e):
                raise FileNotFoundError(key)
            raise StorageError(
                message=f"Failed to download file: {str(e)}",
                code="DOWNLOAD_ERROR",
                file_key=key,
            )

    async def download_stream(self, key: str) -> AsyncIterator[bytes]:
        """Download a file as a stream."""
        session = self._get_session()

        try:
            async with session.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
            ) as s3:
                response = await s3.get_object(Bucket=self.bucket, Key=key)
                async with response["Body"] as stream:
                    async for chunk in stream.iter_chunks():
                        yield chunk

        except Exception as e:
            if "NoSuchKey" in str(e) or "404" in str(e):
                raise FileNotFoundError(key)
            raise StorageError(
                message=f"Failed to stream file: {str(e)}",
                code="STREAM_ERROR",
                file_key=key,
            )

    async def get_metadata(self, key: str) -> FileMetadata:
        """Get metadata for a stored file."""
        session = self._get_session()

        try:
            async with session.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
            ) as s3:
                response = await s3.head_object(Bucket=self.bucket, Key=key)

                s3_metadata = response.get("Metadata", {})

                return FileMetadata(
                    content_type=response.get("ContentType", "application/octet-stream"),
                    content_length=response.get("ContentLength", 0),
                    sha256_hash=s3_metadata.get("sha256-hash", ""),
                    uploaded_at=response.get("LastModified", datetime.now(timezone.utc)),
                    uploaded_by=s3_metadata.get("uploaded-by"),
                    original_filename=s3_metadata.get("original-filename"),
                    custom_metadata={
                        k: v
                        for k, v in s3_metadata.items()
                        if k not in ("sha256-hash", "uploaded-by", "original-filename")
                    },
                )

        except Exception as e:
            if "404" in str(e) or "NoSuchKey" in str(e):
                raise FileNotFoundError(key)
            raise StorageError(
                message=f"Failed to get metadata: {str(e)}",
                code="METADATA_ERROR",
                file_key=key,
            )

    async def exists(self, key: str) -> bool:
        """Check if a file exists in S3."""
        try:
            await self.get_metadata(key)
            return True
        except FileNotFoundError:
            return False

    async def delete(self, key: str) -> None:
        """Delete a file from S3."""
        session = self._get_session()

        # First check if file exists
        if not await self.exists(key):
            raise FileNotFoundError(key)

        try:
            async with session.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
            ) as s3:
                await s3.delete_object(Bucket=self.bucket, Key=key)

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
        """List files in S3."""
        session = self._get_session()

        full_prefix = self.key_prefix + (prefix or "")
        files: list[StoredFile] = []

        try:
            async with session.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
            ) as s3:
                paginator = s3.get_paginator("list_objects_v2")

                async for page in paginator.paginate(
                    Bucket=self.bucket,
                    Prefix=full_prefix,
                    MaxKeys=limit,
                ):
                    for obj in page.get("Contents", []):
                        files.append(
                            StoredFile(
                                key=obj["Key"],
                                metadata=FileMetadata(
                                    content_type="",  # Not available in list
                                    content_length=obj.get("Size", 0),
                                    sha256_hash="",  # Not available in list
                                    uploaded_at=obj.get(
                                        "LastModified", datetime.now(timezone.utc)
                                    ),
                                ),
                                bucket=self.bucket,
                            )
                        )

                        if len(files) >= limit:
                            return files

        except Exception as e:
            raise StorageError(
                message=f"Failed to list files: {str(e)}",
                code="LIST_ERROR",
            )

        return files

    async def get_presigned_url(
        self,
        key: str,
        expires_in_seconds: int = 3600,
    ) -> str:
        """Generate a pre-signed URL for temporary direct access."""
        session = self._get_session()

        # Verify file exists
        if not await self.exists(key):
            raise FileNotFoundError(key)

        try:
            async with session.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
            ) as s3:
                url = await s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket, "Key": key},
                    ExpiresIn=expires_in_seconds,
                )
                return url

        except Exception as e:
            raise StorageError(
                message=f"Failed to generate presigned URL: {str(e)}",
                code="PRESIGN_ERROR",
                file_key=key,
            )
