"""
Fixed Assets Domain - Asset lifecycle and depreciation management.

This bounded context provides:
- Fixed asset registration and tracking
- Multiple depreciation methods (straight-line, declining balance, etc.)
- Asset lifecycle management (acquire, depreciate, dispose)
- GL integration for depreciation entries

Mission Alignment: Enables complete financial tracking of long-term assets,
supporting "Authoritative Financial Truth" for balance sheet accuracy.

Research Grounding: docs/gaps/PATH_MATERIAL.md (Depreciation Methods)
"""

from src.domain.fixed_assets.entities.fixed_asset import (
    FixedAsset,
    AssetStatus,
    DepreciationMethod,
)
from src.domain.fixed_assets.entities.depreciation_schedule import DepreciationSchedule
from src.domain.fixed_assets.repositories.fixed_asset_repository import (
    FixedAssetRepository,
)
from src.domain.fixed_assets.services.depreciation_service import DepreciationService
from src.domain.fixed_assets.services.asset_lifecycle_service import (
    AssetLifecycleService,
)

__all__ = [
    "FixedAsset",
    "AssetStatus",
    "DepreciationMethod",
    "DepreciationSchedule",
    "FixedAssetRepository",
    "DepreciationService",
    "AssetLifecycleService",
]
