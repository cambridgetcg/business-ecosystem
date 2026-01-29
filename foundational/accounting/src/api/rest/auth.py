"""
Authentication dependencies for REST API.

Provides authentication and authorization for API endpoints.

Currently supports:
- API Key authentication (via header)
- Placeholder for JWT authentication (can be extended)

Usage:
    from src.api.rest.auth import get_current_user, require_auth

    @router.get("/protected")
    async def protected_endpoint(
        current_user: str = Depends(get_current_user),
    ):
        return {"user": current_user}
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import APIKeyHeader

from src.config import get_settings


# API Key security scheme
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_user(
    api_key: Annotated[str | None, Depends(api_key_header)] = None,
    x_user_id: Annotated[str | None, Header(alias="X-User-ID")] = None,
) -> str:
    """
    Get the current authenticated user.

    Authentication methods (in order of precedence):
    1. API Key header (X-API-Key) - validates key and extracts user
    2. User ID header (X-User-ID) - development mode only

    Args:
        api_key: API key from X-API-Key header
        x_user_id: User ID from X-User-ID header (dev mode)

    Returns:
        User ID of the authenticated user

    Raises:
        HTTPException: If authentication fails
    """
    settings = get_settings()

    # In development mode, allow direct user ID header
    if not settings.is_production and x_user_id:
        return x_user_id

    # Validate API key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Validate the API key against configured keys
    # In a real implementation, this would look up the key in a database
    # For now, we support a simple static key from settings
    valid_api_keys = _get_valid_api_keys()

    if api_key not in valid_api_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Extract user ID from the API key mapping
    user_id = valid_api_keys.get(api_key, "unknown")
    return user_id


async def get_optional_user(
    api_key: Annotated[str | None, Depends(api_key_header)] = None,
    x_user_id: Annotated[str | None, Header(alias="X-User-ID")] = None,
) -> str | None:
    """
    Get the current user if authenticated, None otherwise.

    Use this for endpoints that have optional authentication.

    Args:
        api_key: API key from X-API-Key header
        x_user_id: User ID from X-User-ID header (dev mode)

    Returns:
        User ID if authenticated, None otherwise
    """
    try:
        return await get_current_user(api_key, x_user_id)
    except HTTPException:
        return None


def require_auth(current_user: str = Depends(get_current_user)) -> str:
    """
    Dependency that requires authentication.

    Simply a named alias for get_current_user to make intent clearer.

    Args:
        current_user: The authenticated user from get_current_user

    Returns:
        The authenticated user ID
    """
    return current_user


async def check_job_ownership(
    job_initiated_by: str,
    current_user: str,
    allow_admin: bool = True,
) -> None:
    """
    Check if the current user owns the job or is an admin.

    Args:
        job_initiated_by: User ID who initiated the job
        current_user: Current authenticated user
        allow_admin: Whether to allow admin users to bypass ownership check

    Raises:
        HTTPException: If user doesn't own the job and isn't admin
    """
    if job_initiated_by == current_user:
        return

    if allow_admin and await _is_admin(current_user):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have permission to access this job",
    )


def _get_valid_api_keys() -> dict[str, str]:
    """
    Get valid API keys and their associated user IDs.

    In production, this would query a database.
    For now, returns a simple mapping from settings.

    Returns:
        Dictionary mapping API key to user ID
    """
    settings = get_settings()

    # Default development key
    keys = {}

    # Add any configured API keys
    if hasattr(settings, 'api_keys') and settings.api_keys:
        # Expect format: "key1:user1,key2:user2"
        for pair in settings.api_keys.split(","):
            if ":" in pair:
                key, user = pair.split(":", 1)
                keys[key.strip()] = user.strip()

    # Add a default development key if in dev mode and no keys configured
    if not settings.is_production and not keys:
        keys["dev-api-key"] = "dev-user"

    return keys


async def _is_admin(user_id: str) -> bool:
    """
    Check if a user has admin privileges.

    In production, this would check a database or identity provider.
    For now, checks against a simple admin list.

    Args:
        user_id: The user ID to check

    Returns:
        True if user is admin, False otherwise
    """
    settings = get_settings()

    # Check if user is in admin list
    if hasattr(settings, 'admin_users') and settings.admin_users:
        admin_list = [u.strip() for u in settings.admin_users.split(",")]
        return user_id in admin_list

    return False
