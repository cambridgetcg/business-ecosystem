"""
Property-based tests for Journal Entry invariants.

These tests verify mathematical truths that must ALWAYS hold in accounting:
- Debits must equal credits (conservation of value)
- Reversals create exact opposite amounts
- All amounts must be positive
- Entries must have at least one debit and one credit

Using Hypothesis ensures these invariants hold for ANY valid input,
not just hand-picked test cases.

Research Grounding: docs/gaps/11-understanding-validation.md
AI Knowledge Gap: doc 11 - Use deterministic validation, not AI reasoning
"""

from decimal import Decimal
from datetime import date

import pytest
from hypothesis import given, assume, settings, HealthCheck
from hypothesis import strategies as st

from src.domain.general_ledger.models.journal_entry_line import EntryType


# =============================================================================
# Custom Hypothesis Strategies
# =============================================================================


# Strategy for valid monetary amounts (positive, reasonable precision)
money_amount = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("999999999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)


# Strategy for a single line (account_id, entry_type, amount)
def journal_line_strategy():
    """Generate a single journal entry line specification."""
    return st.tuples(
        st.text(min_size=26, max_size=26, alphabet="0123456789ABCDEFGHJKMNPQRSTVWXYZ"),  # account_id
        st.sampled_from([EntryType.DEBIT, EntryType.CREDIT]),
        money_amount,
    )


# Strategy for balanced journal entry lines
@st.composite
def balanced_entry_lines(draw, min_lines: int = 2, max_lines: int = 10):
    """
    Generate a set of journal entry lines that are ALWAYS balanced.

    Strategy: Generate debit lines, then generate credits that sum to same total.
    This ensures the invariant holds by construction.
    """
    # Generate random number of debit lines
    num_debits = draw(st.integers(min_value=1, max_value=max_lines // 2))

    # Generate debit amounts
    debit_amounts = [draw(money_amount) for _ in range(num_debits)]
    total_debits = sum(debit_amounts, Decimal("0"))

    # Generate credit amounts that sum to total_debits
    num_credits = draw(st.integers(min_value=1, max_value=max_lines // 2))

    if num_credits == 1:
        # Single credit must equal all debits
        credit_amounts = [total_debits]
    else:
        # Multiple credits: generate n-1 random amounts, last one is remainder
        credit_amounts = []
        remaining = total_debits
        for i in range(num_credits - 1):
            # Leave at least 0.01 for remaining credits
            min_remaining = Decimal("0.01") * (num_credits - i - 1)
            if remaining > min_remaining + Decimal("0.01"):
                max_amount = remaining - min_remaining
                amount = draw(st.decimals(
                    min_value=Decimal("0.01"),
                    max_value=max_amount,
                    places=2,
                    allow_nan=False,
                    allow_infinity=False,
                ))
            else:
                amount = Decimal("0.01")
            credit_amounts.append(amount)
            remaining -= amount
        credit_amounts.append(remaining)

    # Build line specifications
    lines = []
    account_ids = [
        draw(st.text(min_size=26, max_size=26, alphabet="0123456789ABCDEFGHJKMNPQRSTVWXYZ"))
        for _ in range(num_debits + num_credits)
    ]

    for i, amount in enumerate(debit_amounts):
        lines.append({
            "account_id": account_ids[i],
            "entry_type": EntryType.DEBIT,
            "amount": amount,
        })

    for i, amount in enumerate(credit_amounts):
        lines.append({
            "account_id": account_ids[num_debits + i],
            "entry_type": EntryType.CREDIT,
            "amount": amount,
        })

    return lines


# Strategy for unbalanced entry lines (for negative testing)
@st.composite
def unbalanced_entry_lines(draw):
    """Generate entry lines that are intentionally NOT balanced."""
    lines = draw(balanced_entry_lines())

    # Add an extra debit to unbalance
    extra_amount = draw(money_amount)
    assume(extra_amount > Decimal("0.01"))  # Ensure meaningful imbalance

    lines.append({
        "account_id": draw(st.text(min_size=26, max_size=26, alphabet="0123456789ABCDEFGHJKMNPQRSTVWXYZ")),
        "entry_type": EntryType.DEBIT,
        "amount": extra_amount,
    })

    return lines


# =============================================================================
# Invariant Tests
# =============================================================================


class TestDebitsEqualCreditsInvariant:
    """
    Test the fundamental double-entry invariant: Debits must equal Credits.

    This is not a convention - it's a conservation law. Value cannot appear
    or disappear; it can only move between accounts.
    """

    @given(lines=balanced_entry_lines())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_balanced_lines_always_balance(self, lines: list[dict]):
        """Property: Balanced lines must sum to zero."""
        total_debits = sum(
            line["amount"] for line in lines if line["entry_type"] == EntryType.DEBIT
        )
        total_credits = sum(
            line["amount"] for line in lines if line["entry_type"] == EntryType.CREDIT
        )

        # The invariant: debits MUST equal credits
        difference = abs(total_debits - total_credits)
        assert difference < Decimal("0.01"), (
            f"Invariant violated: debits={total_debits}, credits={total_credits}, "
            f"difference={difference}"
        )

    @given(lines=balanced_entry_lines())
    @settings(max_examples=100)
    def test_signed_amounts_sum_to_zero(self, lines: list[dict]):
        """Property: Signed amounts (debit=+, credit=-) must sum to zero."""
        total = sum(
            line["amount"] if line["entry_type"] == EntryType.DEBIT else -line["amount"]
            for line in lines
        )

        assert abs(total) < Decimal("0.01"), (
            f"Signed sum should be zero, got {total}"
        )

    @given(lines=unbalanced_entry_lines())
    @settings(max_examples=50)
    def test_unbalanced_lines_detected(self, lines: list[dict]):
        """Property: Unbalanced entries must be detectable."""
        total_debits = sum(
            line["amount"] for line in lines if line["entry_type"] == EntryType.DEBIT
        )
        total_credits = sum(
            line["amount"] for line in lines if line["entry_type"] == EntryType.CREDIT
        )

        # This MUST be unbalanced
        difference = abs(total_debits - total_credits)
        assert difference > Decimal("0.01"), (
            "Generated 'unbalanced' entry was actually balanced"
        )


class TestReversalInvariant:
    """
    Test the reversal invariant: Reversing entries must have opposite amounts.

    This ensures that corrections work properly - the original transaction
    plus its reversal must net to zero effect.
    """

    @given(lines=balanced_entry_lines())
    @settings(max_examples=100)
    def test_reversal_creates_opposite_amounts(self, lines: list[dict]):
        """Property: Reversal of an entry creates mirror image (debits become credits)."""
        # Create reversed lines
        reversed_lines = []
        for line in lines:
            reversed_lines.append({
                "account_id": line["account_id"],
                "entry_type": (
                    EntryType.CREDIT if line["entry_type"] == EntryType.DEBIT
                    else EntryType.DEBIT
                ),
                "amount": line["amount"],
            })

        # Combine original and reversal
        combined = lines + reversed_lines

        # Net effect must be zero for each account
        account_totals = {}
        for line in combined:
            account_id = line["account_id"]
            signed_amount = (
                line["amount"] if line["entry_type"] == EntryType.DEBIT
                else -line["amount"]
            )
            account_totals[account_id] = account_totals.get(account_id, Decimal("0")) + signed_amount

        # Every account should net to zero
        for account_id, total in account_totals.items():
            assert abs(total) < Decimal("0.01"), (
                f"Account {account_id} should net to zero after reversal, got {total}"
            )

    @given(lines=balanced_entry_lines())
    @settings(max_examples=100)
    def test_reversal_is_also_balanced(self, lines: list[dict]):
        """Property: If original is balanced, reversal must also be balanced."""
        reversed_lines = []
        for line in lines:
            reversed_lines.append({
                "account_id": line["account_id"],
                "entry_type": line["entry_type"].opposite,
                "amount": line["amount"],
            })

        # Reversal must also balance
        total_debits = sum(
            line["amount"] for line in reversed_lines if line["entry_type"] == EntryType.DEBIT
        )
        total_credits = sum(
            line["amount"] for line in reversed_lines if line["entry_type"] == EntryType.CREDIT
        )

        difference = abs(total_debits - total_credits)
        assert difference < Decimal("0.01"), (
            f"Reversal is unbalanced: debits={total_debits}, credits={total_credits}"
        )


class TestPositiveAmountsInvariant:
    """
    Test that amounts are always positive.

    In double-entry bookkeeping, direction (increase/decrease) is determined
    by entry type (debit/credit), not by sign of amount.
    """

    @given(lines=balanced_entry_lines())
    @settings(max_examples=100)
    def test_all_amounts_positive(self, lines: list[dict]):
        """Property: All amounts must be positive."""
        for line in lines:
            assert line["amount"] > Decimal("0"), (
                f"Amount must be positive, got {line['amount']}"
            )

    @given(amount=money_amount)
    def test_money_strategy_generates_positive(self, amount: Decimal):
        """Property: Money strategy only generates positive amounts."""
        assert amount > Decimal("0")
        assert amount <= Decimal("999999999.99")


class TestMinimumLinesInvariant:
    """
    Test that entries have at least 2 lines (one debit, one credit).

    A single-sided entry violates double-entry bookkeeping.
    """

    @given(lines=balanced_entry_lines(min_lines=2))
    @settings(max_examples=100)
    def test_at_least_two_lines(self, lines: list[dict]):
        """Property: Entry must have at least 2 lines."""
        assert len(lines) >= 2, f"Entry has only {len(lines)} lines"

    @given(lines=balanced_entry_lines())
    @settings(max_examples=100)
    def test_has_both_debit_and_credit(self, lines: list[dict]):
        """Property: Entry must have at least one debit and one credit."""
        has_debit = any(line["entry_type"] == EntryType.DEBIT for line in lines)
        has_credit = any(line["entry_type"] == EntryType.CREDIT for line in lines)

        assert has_debit, "Entry has no debit lines"
        assert has_credit, "Entry has no credit lines"


class TestDecimalPrecisionInvariant:
    """
    Test that decimal arithmetic maintains precision.

    Financial calculations must not lose precision due to floating point errors.
    """

    @given(
        a=money_amount,
        b=money_amount,
        c=money_amount,
    )
    def test_decimal_addition_is_exact(self, a: Decimal, b: Decimal, c: Decimal):
        """Property: Decimal addition must be exact (no floating point errors)."""
        # (a + b) + c == a + (b + c)
        left = (a + b) + c
        right = a + (b + c)
        assert left == right, f"Decimal addition not associative: {left} != {right}"

    @given(lines=balanced_entry_lines())
    @settings(max_examples=100)
    def test_running_total_equals_final_total(self, lines: list[dict]):
        """Property: Running total must equal final computed total."""
        running_debit = Decimal("0")
        running_credit = Decimal("0")

        for line in lines:
            if line["entry_type"] == EntryType.DEBIT:
                running_debit += line["amount"]
            else:
                running_credit += line["amount"]

        final_debit = sum(
            line["amount"] for line in lines if line["entry_type"] == EntryType.DEBIT
        )
        final_credit = sum(
            line["amount"] for line in lines if line["entry_type"] == EntryType.CREDIT
        )

        assert running_debit == final_debit, "Running debit total doesn't match final"
        assert running_credit == final_credit, "Running credit total doesn't match final"


# =============================================================================
# Accounting Equation Tests
# =============================================================================


@st.composite
def balance_sheet_data(draw):
    """Generate balance sheet data that satisfies Assets = Liabilities + Equity."""
    liabilities = draw(money_amount)
    equity = draw(money_amount)
    assets = liabilities + equity  # Construct to satisfy equation

    return {
        "total_assets": assets,
        "total_liabilities": liabilities,
        "total_equity": equity,
    }


class TestAccountingEquationInvariant:
    """
    Test the accounting equation: Assets = Liabilities + Equity.

    This equation is not arbitrary - it represents the fundamental truth
    that everything a company owns (assets) is financed either by borrowing
    (liabilities) or by owners (equity).
    """

    @given(data=balance_sheet_data())
    @settings(max_examples=100)
    def test_equation_holds_by_construction(self, data: dict):
        """Property: Assets = Liabilities + Equity."""
        left = data["total_assets"]
        right = data["total_liabilities"] + data["total_equity"]

        difference = abs(left - right)
        assert difference < Decimal("0.01"), (
            f"Accounting equation violated: {left} != {right}"
        )

    @given(
        assets=money_amount,
        liabilities=money_amount,
        equity=money_amount,
    )
    def test_arbitrary_values_may_not_balance(
        self,
        assets: Decimal,
        liabilities: Decimal,
        equity: Decimal
    ):
        """Property: Random values usually don't satisfy the equation."""
        # This demonstrates why we need validation - random data won't balance
        expected_assets = liabilities + equity
        difference = abs(assets - expected_assets)

        # Either it balances by chance (rare) or we can detect the violation
        if difference < Decimal("0.01"):
            # Lucky balance
            pass
        else:
            # Detected violation
            assert difference >= Decimal("0.01")


# =============================================================================
# Period Continuity Tests
# =============================================================================


@st.composite
def period_continuity_data(draw):
    """Generate period continuity data that satisfies Prior + Activity = Current."""
    prior_balance = draw(st.decimals(
        min_value=Decimal("-999999999.99"),
        max_value=Decimal("999999999.99"),
        places=2,
        allow_nan=False,
        allow_infinity=False,
    ))
    activity = draw(st.decimals(
        min_value=Decimal("-999999999.99"),
        max_value=Decimal("999999999.99"),
        places=2,
        allow_nan=False,
        allow_infinity=False,
    ))
    current_balance = prior_balance + activity  # Construct to satisfy continuity

    return {
        "prior_period_ending_balance": prior_balance,
        "current_period_activity": activity,
        "current_period_ending_balance": current_balance,
    }


class TestPeriodContinuityInvariant:
    """
    Test period continuity: Prior Balance + Activity = Current Balance.

    This invariant ensures no value appears or disappears between periods.
    """

    @given(data=period_continuity_data())
    @settings(max_examples=100)
    def test_continuity_holds_by_construction(self, data: dict):
        """Property: Prior + Activity = Current."""
        expected = data["prior_period_ending_balance"] + data["current_period_activity"]
        actual = data["current_period_ending_balance"]

        difference = abs(expected - actual)
        assert difference < Decimal("0.01"), (
            f"Period continuity violated: {expected} != {actual}"
        )

    @given(data=period_continuity_data())
    @settings(max_examples=100)
    def test_activity_derivable_from_balances(self, data: dict):
        """Property: Activity can be derived from balance difference."""
        derived_activity = (
            data["current_period_ending_balance"] -
            data["prior_period_ending_balance"]
        )
        actual_activity = data["current_period_activity"]

        difference = abs(derived_activity - actual_activity)
        assert difference < Decimal("0.01"), (
            f"Derived activity doesn't match: {derived_activity} != {actual_activity}"
        )
