# Insight 01: The Boundary Between Deterministic and Judgment

> Curiosity Question: At what point does a financial operation transition from deterministic (AI-safe) to judgment-requiring (human-needed)?

## The Insight

There is no clean boundary - there is a **gradient of determinism** that depends on context, not operation type.

```
FULLY DETERMINISTIC          JUDGMENT REQUIRED
       │                            │
       ▼                            ▼
  Balance Check              Useful Life Estimation
  Interest Calc              Impairment Assessment
  Currency Convert           Bad Debt Provision
  Depreciation Calc          Revenue Recognition
       │                            │
       │                            │
       └────────── THE ZONE ────────┘
                    │
            Context-Dependent
         (Same operation, different
          determinism based on inputs)
```

## The Discovery

### What Makes Something Deterministic

1. **Closed-form solution**: Can be expressed as a mathematical formula
2. **Objective inputs**: All inputs are measurable facts, not estimates
3. **Single correct answer**: No judgment about "reasonableness"
4. **Audit trail clarity**: The calculation can be reproduced exactly

### What Requires Human Judgment

1. **Estimation of future states**: Useful life, collectability, future cash flows
2. **Materiality decisions**: What's "significant enough" to report
3. **Intent classification**: Is this a trading security or held-to-maturity?
4. **Reasonableness assessment**: Does this make business sense?

### The Surprising Middle Ground

The same operation can be deterministic OR judgment-based depending on context:

| Operation | Deterministic Context | Judgment Context |
|-----------|----------------------|------------------|
| Depreciation | Straight-line with fixed life | Choosing useful life |
| Revenue | Cash sale recorded at POS | Multi-element arrangements |
| Allowance | Formula-based % of receivables | Specific customer analysis |
| Inventory valuation | FIFO/LIFO calculation | Net realizable value assessment |

## The Framework: DICE Test

A financial operation is deterministic if it passes all four:

- **D**ata: All inputs are objective facts (not estimates)
- **I**rreversible: The calculation has one unique answer
- **C**omputable: Can be expressed as a closed-form algorithm
- **E**videnceable: Result can be independently verified

If any fail, human judgment is required.

## Application to This System

### What the Accounting System Should Automate

| Component | Implementation | Why Deterministic |
|-----------|---------------|-------------------|
| Balance validation | `balance_validator.py:31` | Pure math: debits = credits |
| Period determination | `period_service.py` | Date lookup, not inference |
| Entry sequencing | `journal_entry_repository.py` | Counter increment |
| Status transitions | `posting_service.py` | State machine with clear rules |

### What Requires Human Flags

| Component | Current State | What's Needed |
|-----------|--------------|---------------|
| Estimate entries | Not implemented | `requires_human_approval` flag |
| Reversals | `create_reversal()` exists | But WHY to reverse needs human |
| Period close | `close_period()` exists | Readiness assessment is human |
| Adjustments | Adjusting periods exist | Adjustment decisions are human |

## The Aha Moment

**The boundary isn't about the operation - it's about the inputs.**

Depreciation calculation is deterministic.
Choosing the useful life is judgment.

The system should:
1. Accept human-provided judgment inputs
2. Apply deterministic calculations to those inputs
3. Never pretend to make judgment calls itself
4. Flag when inputs look like they might need review

## Code Implications

```python
# Current: Implicit assumption all inputs are valid
entry = JournalEntry(
    entry_date=date(2026, 1, 15),
    lines=[...],
)

# Better: Explicit flag for judgment-based inputs
entry = JournalEntry(
    entry_date=date(2026, 1, 15),
    lines=[...],
    contains_estimates=True,  # Flags for human review
    estimate_basis="Management assessment of useful life",
)
```

## Research Sources

- PCAOB auditing standards on estimates and fair value
- FASB guidance on critical accounting estimates
- Academic literature on automation boundaries in financial reporting

---

## Questions This Raises

1. Should the system maintain a registry of "judgment-required" account codes?
2. How do we distinguish "entered by human" from "approved by human"?
3. Can we build a detector for when inputs look like they might be estimates?

---

*Insight recorded: January 2026*
*Source: Integration of implementation experience with curiosity question research*
