"""Fixed Assets domain services."""

from src.domain.fixed_assets.services.depreciation_service import DepreciationService
from src.domain.fixed_assets.services.asset_lifecycle_service import (
    AssetLifecycleService,
)

__all__ = ["DepreciationService", "AssetLifecycleService"]
