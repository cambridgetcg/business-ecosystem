# MG-03: FX Hedge Accounting Automation

## Gap Classification

| Attribute | Value |
|-----------|-------|
| **Gap ID** | MG-03 |
| **Domain** | Treasury Operations |
| **Mission Capability** | M2: Payment Processing with Controls |
| **Understanding Level** | KNOWS |
| **Priority** | MEDIUM |

---

## The Gap

We understand **FX exposure management** (insight 05: net exposures first, then execute single trade). We do **not** understand how to **automate hedge accounting compliance** under ASC 815 / IFRS 9.

---

## What We Know

From research 13 (FX Execution Timing) and insight 05:
- FX exposure netting beats payment netting
- Aggregate exposures, execute single trade
- Natural hedging opportunities exist

From PURPOSE.md:
- Multi-currency payments with exchange rate tracking (Line 93)

---

## What We Don't Know

### 1. Hedge Designation Requirements

**Unknown**: What documentation is required to designate a hedge?

| Element | Requirement | Unknown |
|---------|-------------|---------|
| **Risk identification** | What specific risk is being hedged | Documentation format |
| **Hedging instrument** | Which forward/option hedges what | Linkage mechanics |
| **Hedged item** | Which exposure is hedged | Granularity level |
| **Effectiveness method** | How effectiveness is measured | Method selection |

### 2. Effectiveness Testing

**Unknown**: How do we automate hedge effectiveness testing?

| Method | Description | Automation Complexity |
|--------|-------------|----------------------|
| **Dollar offset** | Compare hedge/item changes | Simple but restrictive |
| **Regression** | Statistical relationship | Moderate |
| **Critical terms match** | Simplified approach | Simplest |
| **Hypothetical derivative** | Complex benchmark | Complex |

**Questions**:
- Which method is appropriate for treasury hedging?
- How often must effectiveness be tested?
- What documentation satisfies auditors?

### 3. Hedge Accounting Journal Entries

**Unknown**: What accounting entries are required?

| Hedge Type | Effective Portion | Ineffective Portion |
|------------|------------------|---------------------|
| **Cash flow hedge** | OCI | P&L immediately |
| **Fair value hedge** | P&L (offset) | P&L immediately |
| **Net investment hedge** | CTA | P&L immediately |

**Questions**:
- How do we calculate effective vs. ineffective portions?
- What are the reclassification triggers?
- How do we automate journal generation?

### 4. De-designation and Re-designation

**Unknown**: How do we handle hedge relationship changes?

| Scenario | Treatment | Unknown |
|----------|-----------|---------|
| Hedge no longer effective | De-designate | Timing, documentation |
| Hedged item cancelled | De-designate | Accounting impact |
| Rebalancing | Possible continuation | When allowed? |
| Voluntary termination | De-designate | Consequences |

### 5. System Integration

**Unknown**: How does hedge accounting integrate with treasury system?

```
FX Exposure            Hedge Execution        Accounting
    │                        │                    │
    ▼                        ▼                    ▼
┌─────────┐            ┌─────────┐          ┌─────────┐
│Aggregate│────────────│Execute  │──────────│Designate│
│Exposures│            │Forward  │          │Hedge    │
└─────────┘            └─────────┘          └─────────┘
    │                        │                    │
    │                        │                    ▼
    │                        │            ┌─────────────┐
    │                        │            │Effectiveness│
    │                        │            │Testing      │
    │                        │            └─────────────┘
    │                        │                    │
    │                        │                    ▼
    │                        │            ┌─────────────┐
    │                        └───────────►│Journal      │
    │                                     │Generation   │
    └────────────────────────────────────►└─────────────┘
```

---

## Impact on Mission

### M2: Payment Processing with Controls

**CAPABILITY** (PURPOSE.md): Multi-currency payments with exchange rate tracking

**PARTIALLY BLOCKED**: Can execute FX trades, but without proper hedge accounting:
- P&L volatility from mark-to-market
- Audit findings for non-compliance
- Potential restatement risk

### Implementation Plan Impact

**Phase 3 (Weeks 17-22)**: FX & Treasury Operations

```typescript
// From IMPLEMENTATION_PLAN.md
interface FXExposureService {
  aggregateExposures(entityIds: string[]): Promise<ExposureAggregation>;
  identifyNaturalHedges(exposures: FXExposure[]): Promise<HedgeOpportunity[]>;
  executeHedge(exposure: FXExposure, policy: HedgePolicy): Promise<HedgeResult>;
}
```

The `executeHedge` function needs hedge accounting integration to be audit-ready.

---

## Research Required

### Primary Questions

1. **Designation automation**: How do we automate hedge designation documentation?
2. **Effectiveness method**: Which method is appropriate for treasury hedging?
3. **Testing frequency**: How often must effectiveness be tested?
4. **Journal automation**: How do we auto-generate hedge accounting entries?
5. **De-designation triggers**: What events require de-designation?

### Secondary Questions

1. How do treasury systems (Kyriba, SAP) handle hedge accounting?
2. What does a hedge accounting audit look like?
3. How do we handle cross-currency hedges?
4. What's the impact of IFRS 9 vs. ASC 815 differences?

---

## Resolution Criteria

This gap is **RESOLVED** when:

- [ ] Designation documentation requirements defined
- [ ] Effectiveness testing method selected
- [ ] Testing automation approach designed
- [ ] Journal entry generation specified
- [ ] De-designation workflow documented
- [ ] Audit-ready hedge accounting can be implemented

---

*Gap Identified: January 2026*
*Blocks: Compliant FX hedging in Phase 3*
*Estimated Research Effort: 1-2 sessions + accounting advisor input*
