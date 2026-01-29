"""
Property-based tests for the AccountingInvariant classes.

Tests the actual invariant checker implementations from
src/domain/general_ledger/validators/accounting_invariants.py

Research Grounding: docs/gaps/11-understanding-validation.md
"""

from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from src.domain.general_ledger.validators.accounting_invariants import (
    InvariantStatus,
    InvariantResult,
    DebitsEqualCreditsInvariant,
    TrialBalanceInvariant,
    TrialBalanceData,
    AccountingEquationInvariant,
    BalanceSheetData,
    PeriodContinuityInvariant,
    PeriodContinuityData,
    InvariantRegistry,
    BALANCE_TOLERANCE,
)


# =============================================================================
# Strategies
# =============================================================================

money_amount = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("999999999.99"),
    places=4,
    allow_nan=False,
    allow_infinity=False,
)

signed_amount = st.decimals(
    min_value=Decimal("-999999999.99"),
    max_value=Decimal("999999999.99"),
    places=4,
    allow_nan=False,
    allow_infinity=False,
)


# =============================================================================
# InvariantResult Tests
# =============================================================================


class TestInvariantResult:
    """Test the InvariantResult dataclass."""

    def test_holds_property(self):
        """Result with HOLDS status should return holds=True."""
        result = InvariantResult(
            invariant_name="Test",
            status=InvariantStatus.HOLDS,
            description="Test passes",
        )
        assert result.holds is True
        assert result.violated is False

    def test_violated_property(self):
        """Result with VIOLATED status should return violated=True."""
        result = InvariantResult(
            invariant_name="Test",
            status=InvariantStatus.VIOLATED,
            description="Test fails",
        )
        assert result.holds is False
        assert result.violated is True

    def test_inconclusive_is_neither(self):
        """INCONCLUSIVE status is neither holds nor violated."""
        result = InvariantResult(
            invariant_name="Test",
            status=InvariantStatus.INCONCLUSIVE,
            description="Cannot determine",
        )
        assert result.holds is False
        assert result.violated is False


# =============================================================================
# DebitsEqualCreditsInvariant Tests
# =============================================================================


class TestDebitsEqualCreditsInvariant:
    """Test the debits=credits invariant checker."""

    @given(
        debit_amount=money_amount,
    )
    @settings(max_examples=100)
    def test_balanced_entry_holds(self, debit_amount: Decimal):
        """Property: When debits equal credits, invariant holds."""
        # Create mock entry with equal debits and credits
        entry = MagicMock()
        entry.entry_number = "JE-TEST-001"
        entry.id = "test_id"
        entry.total_debits = debit_amount
        entry.total_credits = debit_amount  # Same = balanced

        invariant = DebitsEqualCreditsInvariant()
        result = invariant.check(entry)

        assert result.holds is True
        assert result.status == InvariantStatus.HOLDS

    @given(
        debit_amount=money_amount,
        difference=st.decimals(
            min_value=Decimal("0.001"),
            max_value=Decimal("1000"),
            places=4,
            allow_nan=False,
            allow_infinity=False,
        ),
    )
    @settings(max_examples=100)
    def test_unbalanced_entry_violates(self, debit_amount: Decimal, difference: Decimal):
        """Property: When debits != credits by more than tolerance, invariant violated."""
        # Skip if difference is within tolerance
        if difference <= BALANCE_TOLERANCE:
            return

        entry = MagicMock()
        entry.entry_number = "JE-TEST-002"
        entry.id = "test_id"
        entry.total_debits = debit_amount
        entry.total_credits = debit_amount + difference  # Unbalanced

        invariant = DebitsEqualCreditsInvariant()
        result = invariant.check(entry)

        assert result.violated is True
        assert result.status == InvariantStatus.VIOLATED

    def test_within_tolerance_holds(self):
        """Differences within tolerance should still hold."""
        entry = MagicMock()
        entry.entry_number = "JE-TEST-003"
        entry.id = "test_id"
        entry.total_debits = Decimal("100.00")
        entry.total_credits = Decimal("100.00005")  # Within 0.0001 tolerance

        invariant = DebitsEqualCreditsInvariant()
        result = invariant.check(entry)

        assert result.holds is True

    def test_invariant_has_name_and_description(self):
        """Invariant should have proper metadata."""
        invariant = DebitsEqualCreditsInvariant()

        assert invariant.name == "Debits Equal Credits"
        assert "debit" in invariant.description.lower()
        assert "credit" in invariant.description.lower()


# =============================================================================
# TrialBalanceInvariant Tests
# =============================================================================


class TestTrialBalanceInvariant:
    """Test the trial balance invariant checker."""

    @given(total=money_amount)
    @settings(max_examples=100)
    def test_balanced_trial_balance_holds(self, total: Decimal):
        """Property: Balanced trial balance satisfies invariant."""
        data = TrialBalanceData(
            total_debits=total,
            total_credits=total,
        )

        invariant = TrialBalanceInvariant()
        result = invariant.check(data)

        assert result.holds is True

    @given(
        total=money_amount,
        difference=st.decimals(
            min_value=Decimal("0.001"),
            max_value=Decimal("1000"),
            places=4,
            allow_nan=False,
            allow_infinity=False,
        ),
    )
    @settings(max_examples=100)
    def test_unbalanced_trial_balance_violates(self, total: Decimal, difference: Decimal):
        """Property: Unbalanced trial balance violates invariant."""
        if difference <= BALANCE_TOLERANCE:
            return

        data = TrialBalanceData(
            total_debits=total,
            total_credits=total + difference,
        )

        invariant = TrialBalanceInvariant()
        result = invariant.check(data)

        assert result.violated is True


# =============================================================================
# AccountingEquationInvariant Tests
# =============================================================================


class TestAccountingEquationInvariant:
    """Test the A = L + E invariant checker."""

    @given(
        liabilities=money_amount,
        equity=money_amount,
    )
    @settings(max_examples=100)
    def test_equation_holds_when_satisfied(self, liabilities: Decimal, equity: Decimal):
        """Property: When A = L + E, invariant holds."""
        assets = liabilities + equity  # Construct to satisfy

        data = BalanceSheetData(
            total_assets=assets,
            total_liabilities=liabilities,
            total_equity=equity,
        )

        invariant = AccountingEquationInvariant()
        result = invariant.check(data)

        assert result.holds is True

    @given(
        assets=money_amount,
        liabilities=money_amount,
        equity=money_amount,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.filter_too_much])
    def test_equation_violates_when_not_satisfied(
        self,
        assets: Decimal,
        liabilities: Decimal,
        equity: Decimal
    ):
        """Property: When A != L + E, invariant violated."""
        expected_assets = liabilities + equity
        difference = abs(assets - expected_assets)

        # Skip if accidentally balanced
        if difference <= BALANCE_TOLERANCE:
            return

        data = BalanceSheetData(
            total_assets=assets,
            total_liabilities=liabilities,
            total_equity=equity,
        )

        invariant = AccountingEquationInvariant()
        result = invariant.check(data)

        assert result.violated is True

    def test_violation_includes_explanation(self):
        """Violations should explain what went wrong."""
        data = BalanceSheetData(
            total_assets=Decimal("100"),
            total_liabilities=Decimal("40"),
            total_equity=Decimal("50"),  # 40 + 50 = 90 != 100
        )

        invariant = AccountingEquationInvariant()
        result = invariant.check(data)

        assert result.violated is True
        assert result.context is not None
        assert "violation_explanation" in result.context


# =============================================================================
# PeriodContinuityInvariant Tests
# =============================================================================


class TestPeriodContinuityInvariant:
    """Test the period continuity invariant checker."""

    @given(
        prior_balance=signed_amount,
        activity=signed_amount,
    )
    @settings(max_examples=100)
    def test_continuity_holds_when_satisfied(
        self,
        prior_balance: Decimal,
        activity: Decimal
    ):
        """Property: When Prior + Activity = Current, invariant holds."""
        current_balance = prior_balance + activity  # Construct to satisfy

        data = PeriodContinuityData(
            account_id="test_account",
            prior_period_ending_balance=prior_balance,
            current_period_activity=activity,
            current_period_ending_balance=current_balance,
        )

        invariant = PeriodContinuityInvariant()
        result = invariant.check(data)

        assert result.holds is True

    def test_discontinuity_detected(self):
        """Discontinuous balances should be detected."""
        data = PeriodContinuityData(
            account_id="test_account",
            prior_period_ending_balance=Decimal("100"),
            current_period_activity=Decimal("50"),
            current_period_ending_balance=Decimal("200"),  # Should be 150
        )

        invariant = PeriodContinuityInvariant()
        result = invariant.check(data)

        assert result.violated is True
        assert result.context is not None
        assert result.context["account_id"] == "test_account"


# =============================================================================
# InvariantRegistry Tests
# =============================================================================


class TestInvariantRegistry:
    """Test the invariant registry."""

    def test_registry_has_default_invariants(self):
        """Registry should have all standard invariants registered."""
        registry = InvariantRegistry()

        assert registry.get("Debits Equal Credits") is not None
        assert registry.get("Trial Balance") is not None
        assert registry.get("Accounting Equation") is not None
        assert registry.get("Period Continuity") is not None

    def test_registry_all_returns_list(self):
        """all() should return list of all invariants."""
        registry = InvariantRegistry()

        invariants = registry.all()
        assert len(invariants) >= 4  # At least the 4 defaults
        assert all(hasattr(inv, "check") for inv in invariants)

    def test_registry_get_nonexistent_returns_none(self):
        """Getting nonexistent invariant returns None."""
        registry = InvariantRegistry()

        result = registry.get("Nonexistent Invariant")
        assert result is None

    def test_check_entry_runs_balance_check(self):
        """check_entry should run the balance invariant."""
        registry = InvariantRegistry()

        entry = MagicMock()
        entry.entry_number = "JE-TEST-001"
        entry.id = "test_id"
        entry.total_debits = Decimal("100")
        entry.total_credits = Decimal("100")

        results = registry.check_entry(entry)

        assert len(results) == 1
        assert results[0].invariant_name == "Debits Equal Credits"
        assert results[0].holds is True
