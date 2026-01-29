# GAP-01: What Defines "Full Confidence" in Financial Statements?

> Beyond trial balance accuracy, what makes financial statements reliable?

## The Gap

MISSION.md states: "Financial statements can be produced at any time with full confidence in their accuracy."

**Current understanding**: Balance validation ensures debits = credits (trial balance accuracy).

**Missing understanding**: What additional assertions must be satisfied for "full confidence"?

---

## Research Findings

### The PCAOB Assertion Framework

The PCAOB defines **five management assertions** that auditors test for each account. These define what "confidence" means operationally:

| Assertion | What It Means | System Implication |
|-----------|---------------|-------------------|
| **Existence/Occurrence** | Recorded items exist; transactions occurred | Anti-fraud controls, source document linkage |
| **Completeness** | All items that should be recorded ARE recorded | No missing transactions (understatatement prevention) |
| **Valuation/Allocation** | Amounts are recorded at appropriate values | Correct account classification, proper measurement |
| **Accuracy** | Transactions recorded at correct amounts | Input validation, calculation verification |
| **Rights and Obligations** | Entity controls assets; liabilities are real obligations | Legal ownership verification |

### The Completeness vs. Existence Distinction

A critical insight: **Completeness addresses understatement** (did we miss anything?) while **Existence addresses overstatement** (did we record something fake?).

Current balance validation only ensures internal consistency - it doesn't verify:
- All transactions that SHOULD be recorded ARE recorded
- Recorded transactions actually OCCURRED
- Amounts are correctly VALUED

### What "Full Confidence" Requires

Based on PCAOB AS 1105 (Audit Evidence), confidence requires:

1. **Sufficient evidence** - enough to support assertions
2. **Appropriate evidence** - relevant and reliable
3. **Documentation** - clear audit trail to source

---

## Understanding Gap Analysis

### What We Currently Understand

| Aspect | Understanding Level | Evidence |
|--------|--------------------| ---------|
| Debits = Credits | ENABLED | `balance_validator.py` enforces |
| Transactions recorded | KNOWS | Journal entry model exists |
| Period controls | UNDERSTANDS | Period status machine implemented |

### What We Don't Yet Understand

| Aspect | Gap | Impact |
|--------|-----|--------|
| How to verify completeness | No mechanism to detect missing transactions | Understatement risk |
| How to verify existence | No source document linkage required | Fraud/error risk |
| How to verify valuation | No classification validation beyond account code | Misstatement risk |
| How to aggregate assertion confidence | No framework for "statement-level" confidence | Can't certify statements |

---

## Implications for System Design

### Current State
```
Journal Entry → Balance Check → Posted
                    ↓
            (Only checks: debits = credits)
```

### Required State
```
Journal Entry → Assertion Checks → Balance Check → Posted
                    ↓
            - Completeness: Source document required?
            - Existence: Transaction evidence linked?
            - Valuation: Account classification validated?
            - Accuracy: Amount within expected range?
            - Rights: Authorization chain complete?
```

### Proposed Enhancements

1. **Source Document Linkage**
   - Every journal entry MUST reference a source document
   - Source documents have their own lifecycle (received → verified → posted)
   - Enables existence/occurrence verification

2. **Completeness Controls**
   - Expected transaction detection (did we miss a recurring entry?)
   - Period cutoff enforcement (nothing posted after close)
   - Reconciliation checkpoints (bank rec, AR/AP aging)

3. **Valuation Validation**
   - Account type constraints (asset accounts don't normally have credit balances)
   - Amount reasonability checks (configurable thresholds)
   - Multi-currency rate validation

4. **Assertion Tracking**
   ```python
   class StatementAssertion(Enum):
       EXISTENCE = "existence"
       COMPLETENESS = "completeness"
       VALUATION = "valuation"
       ACCURACY = "accuracy"
       RIGHTS = "rights"

   class AssertionStatus:
       assertion: StatementAssertion
       satisfied: bool
       evidence: list[str]  # References to supporting documents
       verified_by: str     # User or system that verified
       verified_at: datetime
   ```

---

## Research Questions Answered

| Question | Answer | Confidence |
|----------|--------|------------|
| What assertions define confidence? | PCAOB 5-assertion framework | HIGH |
| Is balance validation sufficient? | NO - only addresses internal consistency | HIGH |
| What else is needed? | Completeness, existence, valuation, rights verification | MEDIUM |
| How do we implement this? | Source document linkage, cutoff controls, reconciliation | MEDIUM |

---

## Next Steps

1. **Immediate**: Add `source_document_id` to JournalEntry model
2. **Phase 2**: Implement reconciliation framework
3. **Phase 3**: Add assertion tracking to statement generation
4. **Research**: How do ERP systems implement assertion verification?

---

## Sources

- [PCAOB AS 1105: Audit Evidence](https://pcaobus.org/oversight/standards/auditing-standards/details/AS1105)
- [Financial Statement Assertions - AccountingTools](https://www.accountingtools.com/articles/financial-statement-assertions.html)
- [PCAOB Assertions: Ensuring Accurate Reports - Accounting Insights](https://accountinginsights.org/pcaob-assertions-ensuring-accurate-financial-reports/)

---

*Gap status: RESEARCHED*
*Last updated: January 2026*
