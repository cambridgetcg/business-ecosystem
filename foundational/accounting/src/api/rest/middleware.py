"""
Rate limiting middleware for REST API.

Provides request rate limiting per user/IP to prevent abuse.
Uses in-memory storage for development; can be extended to Redis for production.
"""

import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.config import get_settings


@dataclass
class RateLimitState:
    """Tracks request counts within a time window."""

    requests: int = 0
    window_start: float = 0.0


class RateLimiter:
    """
    In-memory rate limiter using sliding window algorithm.

    Tracks requests per client key within configurable time windows.
    Thread-safe for asyncio but not for multi-process deployment.
    For production multi-process deployment, use Redis-backed implementation.
    """

    def __init__(self) -> None:
        """Initialize the rate limiter with empty state."""
        # client_key -> RateLimitState
        self._state: dict[str, RateLimitState] = defaultdict(RateLimitState)
        # Separate tracking for import endpoints (stricter limits)
        self._import_state: dict[str, RateLimitState] = defaultdict(RateLimitState)

    def _check_rate_limit(
        self,
        state_dict: dict[str, RateLimitState],
        client_key: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int, int]:
        """
        Check if request is allowed under rate limit.

        Args:
            state_dict: The state dictionary to use
            client_key: Unique identifier for the client
            max_requests: Maximum allowed requests per window
            window_seconds: Window duration in seconds

        Returns:
            Tuple of (allowed, remaining_requests, reset_time_seconds)
        """
        now = time.time()
        state = state_dict[client_key]

        # Reset window if expired
        if now - state.window_start >= window_seconds:
            state.requests = 0
            state.window_start = now

        # Calculate remaining time in window
        reset_time = int(window_seconds - (now - state.window_start))

        # Check limit
        if state.requests >= max_requests:
            return False, 0, reset_time

        # Increment and allow
        state.requests += 1
        remaining = max_requests - state.requests

        return True, remaining, reset_time

    def check_general_limit(self, client_key: str) -> tuple[bool, int, int]:
        """
        Check general API rate limit.

        Args:
            client_key: Unique identifier for the client

        Returns:
            Tuple of (allowed, remaining_requests, reset_time_seconds)
        """
        settings = get_settings()
        return self._check_rate_limit(
            self._state,
            client_key,
            settings.rate_limit_requests,
            settings.rate_limit_window_seconds,
        )

    def check_import_limit(self, client_key: str) -> tuple[bool, int, int]:
        """
        Check import endpoint rate limit (stricter).

        Args:
            client_key: Unique identifier for the client

        Returns:
            Tuple of (allowed, remaining_requests, reset_time_seconds)
        """
        settings = get_settings()
        return self._check_rate_limit(
            self._import_state,
            client_key,
            settings.rate_limit_import_requests,
            settings.rate_limit_import_window_seconds,
        )

    def cleanup_expired(self, max_age_seconds: int = 3600) -> int:
        """
        Remove expired entries to prevent memory growth.

        Args:
            max_age_seconds: Remove entries older than this

        Returns:
            Number of entries removed
        """
        now = time.time()
        removed = 0

        for state_dict in [self._state, self._import_state]:
            expired_keys = [
                key
                for key, state in state_dict.items()
                if now - state.window_start > max_age_seconds
            ]
            for key in expired_keys:
                del state_dict[key]
                removed += 1

        return removed


# Global rate limiter instance
_rate_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    """Get the global rate limiter instance."""
    return _rate_limiter


def get_client_key(request: Request) -> str:
    """
    Extract a unique client key from the request.

    Uses authenticated user ID if available, otherwise falls back to IP.

    Args:
        request: The incoming request

    Returns:
        Unique client identifier string
    """
    # Check for authenticated user (set by auth middleware/dependency)
    user_id = request.headers.get("X-User-ID")
    api_key = request.headers.get("X-API-Key")

    if api_key:
        # Use API key prefix as identifier (don't expose full key)
        return f"apikey:{api_key[:8]}"
    elif user_id:
        return f"user:{user_id}"
    else:
        # Fall back to client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        return f"ip:{client_ip}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that enforces rate limits.

    Applies general rate limits to all endpoints and stricter limits
    to import endpoints.
    """

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        """Process request with rate limiting."""
        settings = get_settings()

        # Skip if rate limiting is disabled
        if not settings.rate_limit_enabled:
            return await call_next(request)

        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/"]:
            return await call_next(request)

        limiter = get_rate_limiter()
        client_key = get_client_key(request)

        # Check if this is an import endpoint (POST to /import/*)
        is_import = (
            request.method == "POST"
            and "/import/" in request.url.path
        )

        # Apply stricter limit for imports
        if is_import:
            allowed, remaining, reset_time = limiter.check_import_limit(client_key)
            limit_type = "import"
            limit_value = settings.rate_limit_import_requests
        else:
            allowed, remaining, reset_time = limiter.check_general_limit(client_key)
            limit_type = "general"
            limit_value = settings.rate_limit_requests

        # Add rate limit headers
        headers = {
            "X-RateLimit-Limit": str(limit_value),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_time),
            "X-RateLimit-Type": limit_type,
        }

        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded. Try again in {reset_time} seconds.",
                    "retry_after": reset_time,
                },
                headers={
                    **headers,
                    "Retry-After": str(reset_time),
                },
            )

        # Process request and add headers to response
        response = await call_next(request)

        for key, value in headers.items():
            response.headers[key] = value

        return response
