# GAP-11: How Do We Validate Our Mental Models?

> The meta-gap: knowing whether our understanding is correct.

## The Gap

This is a meta-understanding gap - it's about HOW we build and validate understanding, not WHAT we understand about accounting.

**Current state**: Research → Document → Implement → Hope the model was correct.

**Missing**: Feedback loops that reveal when our mental models are wrong.

---

## The Problem

### Why Mental Models Can Be Wrong

1. **Research limitations** - Documents describe ideals, not edge cases
2. **Interpretation errors** - We may misunderstand what we read
3. **Context mismatch** - General principles may not fit our specific needs
4. **Implicit assumptions** - We assume things that turn out false
5. **Knowledge gaps** - What we don't know we don't know

### When Model Errors Are Discovered

Currently, we discover model errors through:
- **Compilation errors** - Syntax/type mismatches (fast feedback)
- **Test failures** - Behavior doesn't match expectation (medium feedback)
- **Production bugs** - Real usage reveals problems (slow, costly feedback)
- **Audit findings** - External review catches issues (very slow, very costly)

The goal: **Move discovery earlier and make it systematic.**

---

## Research Findings

### Domain-Driven Design Validation Techniques

| Technique | What It Validates | How It Works |
|-----------|------------------|--------------|
| **Event Storming** | Process understanding | Stakeholders collaborate to map domain events |
| **Example Mapping** | Requirement understanding | Concrete examples reveal edge cases |
| **Specification by Example** | Behavior understanding | Executable specifications |
| **Model Exploration Whirlpool** | Model completeness | Iterative modeling with domain experts |

### Feedback Loop Hierarchy

```
Faster feedback = cheaper to fix

Compile-time    │ Type errors, missing imports
       ↓        │
Unit tests      │ Single component behavior
       ↓        │
Integration     │ Component interaction
       ↓        │
Acceptance      │ Business requirements
       ↓        │
Production      │ Real-world usage
       ↓        │
Audit           │ External expert review

Slower feedback = more expensive to fix
```

### Key Insight: The Accounting Domain Has a Validation Superpower

Accounting has **built-in invariants** that can validate understanding:

1. **Debits = Credits** - If this fails, something is fundamentally wrong
2. **Assets = Liabilities + Equity** - Balance sheet must balance
3. **Prior Period + Current Activity = Current Period** - Continuity equation
4. **Reconciliations** - External data confirms internal records

These invariants are **early warning systems** - violations signal model errors.

---

## Understanding Gap Analysis

### What We Currently Do

| Validation Type | Current State | Effectiveness |
|-----------------|---------------|---------------|
| Type checking | Enabled (Python + mypy) | Good for structure |
| Unit tests | Partial (some validators) | Good for behavior |
| Invariant checks | Balance validation only | Limited |
| Domain expert review | None | Gap |
| Production feedback | Not yet deployed | Unknown |

### What We're Missing

| Validation Type | Gap | Impact |
|-----------------|-----|--------|
| Executable specifications | No BDD/Gherkin specs | Requirements may be misunderstood |
| Property-based testing | Not using hypothesis/quickcheck | Edge cases missed |
| Invariant monitoring | Only balance check | Other invariants unchecked |
| Domain expert feedback | No expert in loop | Model may diverge from reality |
| Reconciliation framework | Not implemented | Can't verify against external truth |

---

## Implications for System Design

### Proposed Validation Layers

1. **Compile-Time Validation**
   - Strong typing for all value objects
   - Enums for constrained values
   - Branded types for IDs

2. **Invariant Validation**
   ```python
   class AccountingInvariant(ABC):
       """An accounting truth that must always hold."""

       @abstractmethod
       def check(self, context: Any) -> InvariantResult:
           """Verify the invariant holds."""
           pass

   class DebitsEqualCreditsInvariant(AccountingInvariant):
       def check(self, entry: JournalEntry) -> InvariantResult:
           diff = entry.total_debits - entry.total_credits
           return InvariantResult(
               holds=abs(diff) <= TOLERANCE,
               description=f"Debits ({entry.total_debits}) = Credits ({entry.total_credits})",
               violation=None if holds else f"Difference of {diff}"
           )

   class AccountingEquationInvariant(AccountingInvariant):
       def check(self, trial_balance: TrialBalance) -> InvariantResult:
           assets = sum(b for b in trial_balance if b.account_type.is_asset)
           liabilities = sum(b for b in trial_balance if b.account_type.is_liability)
           equity = sum(b for b in trial_balance if b.account_type.is_equity)
           holds = abs(assets - liabilities - equity) <= TOLERANCE
           return InvariantResult(...)
   ```

3. **Property-Based Testing**
   ```python
   from hypothesis import given, strategies as st

   @given(st.lists(st.decimals(), min_size=2))
   def test_balanced_entries_stay_balanced(amounts):
       """Any set of amounts, when split into debits/credits, should balance."""
       entry = create_balanced_entry(amounts)
       assert validate_balance(entry).is_valid

   @given(st.builds(JournalEntry, ...))
   def test_reversal_creates_opposite_entry(entry):
       """Reversing an entry should create equal and opposite amounts."""
       reversal = create_reversal(entry)
       assert reversal.total_debits == entry.total_credits
       assert reversal.total_credits == entry.total_debits
   ```

4. **Executable Specifications**
   ```gherkin
   Feature: Journal Entry Posting
     As an accountant
     I want to post balanced journal entries
     So that the ledger maintains integrity

     Scenario: Balanced entry posts successfully
       Given an open fiscal period for January 2026
       And a journal entry with:
         | Account      | Debit  | Credit |
         | Cash         | 100.00 |        |
         | Revenue      |        | 100.00 |
       When I post the entry
       Then the entry status should be POSTED
       And the period should have 1 posted entry

     Scenario: Unbalanced entry is rejected
       Given an open fiscal period for January 2026
       And a journal entry with:
         | Account      | Debit  | Credit |
         | Cash         | 100.00 |        |
         | Revenue      |        |  90.00 |
       When I try to post the entry
       Then the entry should be rejected
       And the error should mention "unbalanced"
   ```

5. **Reconciliation as Validation**
   ```python
   class ReconciliationResult:
       """Comparison between internal records and external truth."""
       internal_balance: Money
       external_balance: Money
       difference: Money
       reconciling_items: list[ReconcilingItem]
       is_reconciled: bool

   async def reconcile_bank_account(
       account_id: str,
       bank_statement: BankStatement
   ) -> ReconciliationResult:
       """Compare our records to bank's records."""
       # This validates our transaction recording is correct
   ```

---

## The Validation Feedback Loop

```
Mental Model
     │
     ▼
┌─────────────────┐
│ Implementation  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Invariant Check │────►│ Violation Found │───► Model needs fixing
└────────┬────────┘     └─────────────────┘
         │
         ▼ (passes)
┌─────────────────┐     ┌─────────────────┐
│ Property Tests  │────►│ Edge Case Fails │───► Model incomplete
└────────┬────────┘     └─────────────────┘
         │
         ▼ (passes)
┌─────────────────┐     ┌─────────────────┐
│ Spec Tests      │────►│ Behavior Wrong  │───► Misunderstood requirement
└────────┬────────┘     └─────────────────┘
         │
         ▼ (passes)
┌─────────────────┐     ┌─────────────────┐
│ Reconciliation  │────►│ Mismatch Found  │───► Real world differs
└────────┬────────┘     └─────────────────┘
         │
         ▼ (passes)
Mental Model VALIDATED
```

---

## Research Questions Answered

| Question | Answer | Confidence |
|----------|--------|------------|
| How to validate mental models? | Multiple feedback loops at different speeds | HIGH |
| What's unique about accounting? | Built-in invariants that catch errors | HIGH |
| What validation are we missing? | Property tests, executable specs, reconciliation | HIGH |
| How to catch errors earlier? | Move validation left (compile → test → prod) | HIGH |

---

## Next Steps

1. **Immediate**: Add accounting equation invariant check
2. **Phase 2**: Implement property-based tests with Hypothesis
3. **Phase 3**: Add executable specifications (Gherkin/Behave)
4. **Phase 4**: Build reconciliation framework
5. **Research**: Domain expert review process

---

*Gap status: RESEARCHED*
*Last updated: January 2026*
