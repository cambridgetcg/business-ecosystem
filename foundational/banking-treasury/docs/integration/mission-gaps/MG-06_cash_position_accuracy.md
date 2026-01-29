# MG-06: Cash Position Accuracy Guarantees

## Gap Classification

| Attribute | Value |
|-----------|-------|
| **Gap ID** | MG-06 |
| **Domain** | Cash Visibility |
| **Mission Capability** | M3: Real-Time Liquidity Visibility |
| **Understanding Level** | KNOWS |
| **Priority** | IMPORTANT |

---

## The Gap

We have a **99.99% accuracy target** for cash positions. We do **not** understand **how to guarantee** this level of accuracy with data from multiple, potentially unreliable sources.

---

## What We Know

From PURPOSE.md success metrics:
- **Cash position accuracy**: 99.99% accuracy between reported and actual balances

From research:
- Bank APIs can fail
- Data can be delayed
- FX rates fluctuate
- Some banks only provide batch files

---

## What We Don't Know

### 1. What Does 99.99% Mean?

**Unknown**: How do we define and measure "accuracy"?

| Definition | Implication | Unknown |
|------------|-------------|---------|
| **99.99% of balances within $X** | Absolute tolerance | What is X? |
| **99.99% of balances within Y%** | Percentage tolerance | What is Y? |
| **99.99% of time, balances correct** | Temporal availability | Measurement window? |
| **99.99% of accounts report correctly** | Account coverage | Per-account or aggregate? |

**Questions**:
- Is 99.99% per account, per currency, or consolidated?
- What tolerance is acceptable (absolute? percentage?)?
- How do we measure accuracy (vs. what baseline)?

### 2. Data Validation Patterns

**Unknown**: How do we validate incoming balance data?

| Validation Type | Description | Unknown |
|-----------------|-------------|---------|
| **Sanity checks** | Balance within expected range | How to set ranges dynamically? |
| **Consistency checks** | Balance change matches transactions | How to reconcile in real-time? |
| **Cross-source validation** | Multiple sources agree | How to weight disagreements? |
| **Historical continuity** | No unexplained jumps | What constitutes "unexplained"? |

### 3. Error Detection and Correction

**Unknown**: How do we detect and correct errors?

| Error Type | Detection | Correction |
|------------|-----------|------------|
| **Stale data** | Timestamp comparison | Use last known + flag |
| **Missing data** | Gap detection | Interpolate or flag |
| **Incorrect data** | Validation failure | Quarantine + alert |
| **Duplicate data** | Idempotency check | Deduplicate |

**Questions**:
- How do we distinguish error from legitimate change?
- What's the escalation path for detected errors?
- How do we prevent cascading errors in consolidated positions?

### 4. FX Rate Impact

**Unknown**: How do FX rates affect position accuracy?

| Challenge | Description | Unknown |
|-----------|-------------|---------|
| **Rate source** | Which rate to use? | Bank rate vs. market rate |
| **Rate timing** | When to apply rate? | Real-time vs. daily fix |
| **Rate changes** | How to handle volatility? | Update frequency |
| **Multi-currency aggregation** | Conversion chain | Intermediate currency impact |

**Questions**:
- What FX tolerance is acceptable in position?
- How often should consolidated position recalculate with new rates?
- How do we handle positions during extreme volatility?

### 5. Reconciliation Loop

**Unknown**: How do we continuously validate position accuracy?

```
                    ┌─────────────────┐
                    │  Reported       │
                    │  Position       │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────┐      ┌──────────────┐
│ Bank        │─────►│  Reconcile   │
│ Statement   │      │  Position    │
└─────────────┘      └──────┬───────┘
                            │
                    ┌───────┴───────┐
                    │ Discrepancy?  │
                    └───────┬───────┘
                            │
               ┌────────────┴────────────┐
               │ YES                     │ NO
               ▼                         ▼
        ┌──────────────┐          ┌──────────────┐
        │ Investigate  │          │ Confirmed    │
        │ & Correct    │          │ Accurate     │
        └──────────────┘          └──────────────┘
```

**Questions**:
- How often do we reconcile position vs. statements?
- What's acceptable discrepancy threshold?
- How do we track accuracy over time?

---

## Impact on Mission

### M3: Real-Time Liquidity Visibility

**SUCCESS METRIC** (PURPOSE.md):
- Cash position accuracy: 99.99%

**BLOCKED BY THIS GAP**: Cannot guarantee 99.99% without:
- Clear definition of "accuracy"
- Validation patterns
- Error detection/correction
- Continuous reconciliation

### Financial Impact

Inaccurate cash positions lead to:
- **Overdrafts**: Position shows more cash than exists
- **Missed investments**: Position shows less cash than exists
- **Wrong decisions**: Management acts on incorrect data
- **Audit findings**: Reported vs. actual discrepancies

---

## Research Required

### Primary Questions

1. **Accuracy definition**: How should 99.99% be measured and reported?
2. **Validation patterns**: What industry patterns exist for financial data validation?
3. **Error handling**: How do mature treasury systems handle data errors?
4. **FX impact**: How do we maintain accuracy with currency fluctuations?
5. **Reconciliation loop**: What continuous validation approach is appropriate?

### Secondary Questions

1. What accuracy do vendor TMS solutions (Kyriba, SAP) claim?
2. How do banks guarantee accuracy in their reporting?
3. What audit controls are required for cash position reporting?
4. How do we handle accuracy during system maintenance/outages?

---

## Proposed Accuracy Framework (To Be Validated)

### Accuracy Tiers

| Tier | Definition | Target | Measurement |
|------|------------|--------|-------------|
| **T1: Core cash** | USD/EUR/GBP main accounts | 99.99% | Real-time |
| **T2: Operating accounts** | Local currency, active | 99.9% | Hourly |
| **T3: Secondary accounts** | Low activity, non-critical | 99% | Daily |

### Validation Layers

```
Layer 1: Input Validation
├── Schema validation (correct format)
├── Range validation (reasonable values)
└── Timestamp validation (not future-dated)

Layer 2: Consistency Validation
├── Balance continuity (opening + transactions = closing)
├── Cross-account consistency (intercompany matches)
└── Historical consistency (no unexplained jumps)

Layer 3: Reconciliation Validation
├── Bank statement matching
├── Transaction-level proof
└── Discrepancy flagging
```

### Error Classification

| Class | Example | Action |
|-------|---------|--------|
| **Critical** | Balance 10x higher than expected | Quarantine, alert, manual review |
| **Warning** | Balance outside normal range | Flag, include with warning |
| **Info** | Minor timing difference | Log, auto-correct |

---

## Connection to Existing Work

| Document | Relevance |
|----------|-----------|
| MG-05 (Real-time architecture) | Architecture affects accuracy |
| research/15_RECONCILIATION_EDGE_CASES.md | Matching patterns |
| No existing question or prompt | **NEW GAP** |

---

## Resolution Criteria

This gap is **RESOLVED** when:

- [ ] 99.99% accuracy definition established
- [ ] Validation patterns documented
- [ ] Error detection/correction approach defined
- [ ] FX impact strategy documented
- [ ] Continuous reconciliation loop designed
- [ ] Audit controls specified

---

*Gap Identified: January 2026*
*Blocks: Phase 2 success metrics*
*Estimated Research Effort: 1 session + architecture design*
