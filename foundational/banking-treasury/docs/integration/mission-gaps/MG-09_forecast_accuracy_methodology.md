# MG-09: Forecast Accuracy Measurement Methodology

## Gap Classification

| Attribute | Value |
|-----------|-------|
| **Gap ID** | MG-09 |
| **Domain** | Treasury Operations |
| **Mission Capability** | M5: Accurate Cash Flow Forecasting |
| **Understanding Level** | KNOWS |
| **Priority** | LOW |

---

## The Gap

PURPOSE.md requires "forecasts within 5% of actual for 30-day projections." We don't have a clear methodology for **measuring, reporting, and validating** this accuracy claim.

---

## What We Know

From PURPOSE.md success metrics:
- Target: Within 5% of actual for 30-day projections

From research 08 (Treasury Technology):
- Vendors claim "AI-driven forecasting"
- Accuracy claims exist but methodology unclear

---

## What We Don't Know

### 1. Metric Definition

**Unknown**: What exactly does "within 5%" mean?

| Interpretation | Formula | Implication |
|----------------|---------|-------------|
| **MAPE** | Mean Absolute Percentage Error | Average error across forecasts |
| **Max error** | Largest single deviation | Worst case bound |
| **Median error** | 50th percentile | Typical case |
| **Coverage** | % of actuals within ±5% | Probability guarantee |

**Questions**:
- Is 5% MAPE, or 5% max error?
- Is it per entity, per currency, or consolidated?
- Is it daily forecasts or cumulative?

### 2. Measurement Window

**Unknown**: How do we measure forecast accuracy over time?

| Approach | Description | Unknown |
|----------|-------------|---------|
| **Rolling** | Trailing 30-day average | Window size selection |
| **Point-in-time** | Each forecast individually | Variance handling |
| **Cohort** | Forecasts made at same time | Comparison methodology |
| **Holdout** | Reserved test data | Data selection |

### 3. Ground Truth Definition

**Unknown**: What is "actual" cash position?

| Question | Challenge |
|----------|-----------|
| What time? | End of day? Intraday? |
| What accounts? | All? Operating only? |
| What currency? | Base currency? Each currency? |
| Adjustments? | Exclude one-time items? |

### 4. Reporting Format

**Unknown**: How do we report accuracy to stakeholders?

| Audience | Needs | Unknown |
|----------|-------|---------|
| **Treasury team** | Detailed metrics | Dashboard design |
| **CFO** | Summary accuracy | Executive format |
| **Auditors** | Methodology documentation | Audit evidence |
| **Board** | High-level confidence | Presentation format |

### 5. Continuous Monitoring

**Unknown**: How do we track accuracy degradation over time?

```
                    ACCURACY TREND
    5% ─────────────────────────────────────────
       │
    4% │         ╭──╮
       │        ╱    ╲
    3% │   ╭───╯      ╲
       │  ╱            ╲    ← Alert threshold?
    2% │ ╱              ╲
       │╱                ╲
    1% │                  ╲___
       │
    0% └──────────────────────────────────────
       Jan  Feb  Mar  Apr  May  Jun  Jul  Aug
```

**Questions**:
- When should we alert on degradation?
- How do we distinguish noise from trend?
- When does model need retraining?

---

## Impact on Mission

### M5: Accurate Cash Flow Forecasting

**SUCCESS METRIC** (PURPOSE.md):
- Forecasting accuracy: Within 5% of actual for 30-day projections

**BLOCKED BY THIS GAP**: Cannot claim success without:
- Clear metric definition
- Consistent measurement methodology
- Documented validation approach

### Audit and Compliance

Without defined methodology:
- Cannot prove 5% claim to auditors
- Cannot compare to benchmarks
- Cannot track improvement over time

---

## Research Required

### Primary Questions

1. **Metric selection**: What accuracy metric should we use (MAPE, coverage, etc.)?
2. **Measurement window**: How do we aggregate accuracy over time?
3. **Ground truth**: What is the definitive "actual" position?
4. **Reporting**: How do we communicate accuracy to different audiences?
5. **Monitoring**: How do we detect accuracy degradation?

### Secondary Questions

1. What accuracy metrics do peers report?
2. What do auditors expect for forecast validation?
3. How do we handle accuracy during stress periods?
4. Should we have different metrics for different horizons?

---

## Proposed Methodology Framework

### Primary Metric: MAPE

```
MAPE = (1/n) × Σ |Actual - Forecast| / |Actual| × 100%

Where:
  n = number of forecast periods evaluated
  Actual = realized cash position
  Forecast = predicted cash position
```

### Measurement Protocol

```
1. CAPTURE FORECAST
   - Record forecast at T-30
   - Store by entity, currency, horizon
   - Timestamp and version

2. CAPTURE ACTUAL
   - Record actual at T-0
   - End-of-day position
   - Same scope as forecast

3. CALCULATE ERROR
   - Compare forecast to actual
   - Compute percentage error
   - Store in accuracy database

4. AGGREGATE
   - Rolling 90-day MAPE
   - Segmented by entity, currency
   - Trend analysis
```

### Reporting Tiers

| Tier | Audience | Content | Frequency |
|------|----------|---------|-----------|
| **Operational** | Treasury team | Detailed metrics, exceptions | Daily |
| **Management** | CFO, Controllers | Summary MAPE, trends | Weekly |
| **Executive** | Board, Audit | High-level accuracy, benchmarks | Monthly |

### Alert Thresholds

| Condition | Action |
|-----------|--------|
| MAPE > 5% for 7 days | Investigate |
| MAPE > 7% for 3 days | Alert treasury lead |
| MAPE > 10% any day | Escalate to CFO |
| Consistent bias (>2%) | Retrain model |

---

## Connection to Existing Work

| Document | Relevance |
|----------|-----------|
| MG-07 (Forecasting ML Architecture) | Model produces forecasts |
| MG-08 (Regime Changes) | Accuracy varies by regime |
| prompts/10_forecasting_ml_architecture.md | Section 4 |

---

## Resolution Criteria

This gap is **RESOLVED** when:

- [ ] Primary accuracy metric selected and defined
- [ ] Measurement protocol documented
- [ ] Ground truth definition established
- [ ] Reporting tiers designed
- [ ] Monitoring and alerting approach defined
- [ ] Audit documentation created

---

*Gap Identified: January 2026*
*Blocks: Forecast accuracy validation*
*Estimated Research Effort: 0.5-1 session*
*Dependencies: MG-07 (base ML architecture)*
