"""
Pytest configuration and shared fixtures.

Property-based tests use Hypothesis which requires specific configuration
to work well with pytest-asyncio and the test database.
"""

import sys
from pathlib import Path

import pytest
from hypothesis import settings, Verbosity

# Add src to path for imports
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


# =============================================================================
# Hypothesis Configuration
# =============================================================================

# Register a hypothesis profile for CI (more examples, stricter)
settings.register_profile(
    "ci",
    max_examples=500,
    deadline=None,  # No time limits in CI
    verbosity=Verbosity.normal,
)

# Register a profile for local development (fewer examples, faster)
settings.register_profile(
    "dev",
    max_examples=50,
    deadline=1000,  # 1 second deadline
    verbosity=Verbosity.verbose,
)

# Use dev profile by default, CI profile in CI environment
settings.load_profile("dev")


# =============================================================================
# Pytest Markers
# =============================================================================


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "property: marks property-based tests"
    )
    config.addinivalue_line(
        "markers", "invariant: marks accounting invariant tests"
    )
