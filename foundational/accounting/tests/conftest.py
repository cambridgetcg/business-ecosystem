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
# Offline Guard
# =============================================================================

# These tests run without network access (offline-evidence.yml has no
# services or secrets). The pytest process refuses outbound connections and
# name lookups; child processes install their own audit hook (see
# test_payment_evidence_cli.OFFLINE_RUNNER). Local socket pairs, which asyncio
# event loops use internally, raise none of these events.
NETWORK_EVENTS = frozenset({
    "socket.connect", "socket.sendto", "socket.sendmsg", "socket.getaddrinfo",
    "socket.gethostbyname", "socket.gethostbyname_ex", "socket.gethostbyaddr", "socket.getnameinfo",
})
network_attempts = []


def _refuse_network(event, _args):
    if event in NETWORK_EVENTS:
        network_attempts.append(event)
        raise AssertionError("network access forbidden in accounting tests: " + event)


sys.addaudithook(_refuse_network)


def pytest_sessionfinish(session):
    # Fail the run even when code under test swallowed the refusal.
    if network_attempts:
        print("\nnetwork access attempted: " + ", ".join(sorted(set(network_attempts))), file=sys.stderr)
        session.exitstatus = pytest.ExitCode.TESTS_FAILED


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
