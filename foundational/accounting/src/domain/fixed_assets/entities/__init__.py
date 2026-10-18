"""Fixed Assets domain entities."""

from src.domain.fixed_assets.entities.fixed_asset import (
    FixedAsset,
    AssetStatus,
    DepreciationMethod,
)
from src.domain.fixed_assets.entities.depreciation_schedule import DepreciationSchedule

__all__ = [
    "FixedAsset",
    "AssetStatus",
    "DepreciationMethod",
    "DepreciationSchedule",
]
