# MG-07: Cash Forecasting ML Architecture

## Gap Classification

| Attribute | Value |
|-----------|-------|
| **Gap ID** | MG-07 |
| **Domain** | Treasury Operations |
| **Mission Capability** | M5: Accurate Cash Flow Forecasting |
| **Understanding Level** | KNOWS |
| **Priority** | CRITICAL |

---

## The Gap

We understand that **ML-driven cash forecasting** is expected ("AI-driven cash forecasting" - Kyriba, research 08). We do **not** understand **how to build it**—what models, what features, what training data, what accuracy is achievable.

---

## What We Know

From PURPOSE.md success metrics:
- **Forecast accuracy**: Within 5% of actual for 30-day projections

From research 08 (Treasury Technology):
- Kyriba offers "AI-driven cash forecasting"
- GTreasury positions as "AI-first"
- ML is mentioned but no implementation details

From insight/question 03 (AI Forecasting Regime Changes):
- Stress events cause model failures
- Regime detection is challenging

---

## What We Don't Know

### 1. Model Architecture

**Unknown**: What ML model types are appropriate for cash flow forecasting?

| Model Type | Suitable For | Limitations | Unknown |
|------------|-------------|-------------|---------|
| **ARIMA/SARIMA** | Time series with seasonality | Linear assumptions | Appropriate baseline? |
| **Prophet** | Business time series | Trend + seasonality | Parameter tuning? |
| **LSTM/RNN** | Sequential patterns | Training data needs | Data requirements? |
| **Transformer** | Complex patterns | Computational cost | Overkill? |
| **Ensemble** | Combined strengths | Complexity | How to weight? |

**Questions**:
- What model achieves 5% accuracy at 30 days?
- Should we use ensemble methods?
- What's the right tradeoff between complexity and accuracy?

### 2. Feature Engineering

**Unknown**: What features drive forecast accuracy?

| Feature Category | Examples | Availability |
|------------------|----------|--------------|
| **Historical cash flows** | Daily balances, payment patterns | Have |
| **Business drivers** | Sales forecasts, payroll schedules | Need integration |
| **External signals** | Interest rates, FX rates | Available |
| **Calendar effects** | Holidays, month-end, quarter-end | Available |
| **Customer behavior** | Payment timing patterns | Partial |
| **Macroeconomic** | GDP, unemployment | Available but noisy |

**Questions**:
- Which features have the highest predictive power?
- How do we handle missing or delayed features?
- What's the feature engineering pipeline?

### 3. Training Data Requirements

**Unknown**: How much historical data is needed?

| Time Horizon | Minimum Data | Ideal Data | Unknown |
|--------------|--------------|------------|---------|
| Daily forecast | 3 months? | 1 year? | Actual requirement |
| Weekly forecast | 6 months? | 2 years? | Actual requirement |
| Monthly forecast | 2 years? | 5 years? | Actual requirement |

**Questions**:
- How do we handle new entities with no history?
- How do we account for business changes (acquisitions, divestitures)?
- How do we weight recent vs. older data?

### 4. Accuracy Measurement

**Unknown**: How do we measure and report forecast accuracy?

| Metric | Formula | Use Case | Unknown |
|--------|---------|----------|---------|
| **MAPE** | Mean Absolute Percentage Error | Overall accuracy | Threshold for 5%? |
| **RMSE** | Root Mean Square Error | Penalizes large errors | Appropriate here? |
| **Bias** | Directional error | Systematic over/under | Acceptable range? |
| **Coverage** | Confidence interval hit rate | Uncertainty | How to calculate? |

**Questions**:
- What metric should we optimize for?
- How do we communicate uncertainty to users?
- What's the acceptable degradation during stress periods?

### 5. Cold Start Problem

**Unknown**: How do we forecast for new entities or accounts?

| Scenario | Challenge | Unknown |
|----------|-----------|---------|
| New subsidiary | No historical data | Bootstrap method |
| New bank account | No transaction patterns | Transfer learning? |
| Post-acquisition | Different business model | Model adaptation |

---

## Impact on Mission

### M5: Accurate Cash Flow Forecasting

**SUCCESS METRIC** (PURPOSE.md):
- Forecasting accuracy: Cash forecasts within 5% of actual for 30-day projections

**BLOCKED BY THIS GAP**: Cannot implement forecasting without understanding:
- What model architecture to use
- What features to engineer
- How much training data is needed
- How to measure and guarantee 5% accuracy

### Implementation Plan Impact

**Phase 3 (Weeks 17-22)**: Cash Forecasting

```typescript
// From IMPLEMENTATION_PLAN.md
interface ForecastingService {
  generateForecast(entityId: string, params: ForecastParams): Promise<CashForecast>;
  runScenario(forecastId: string, scenario: Scenario): Promise<ScenarioResult>;
  measureAccuracy(forecastId: string): Promise<AccuracyMetrics>;
}
```

All three methods require understanding the ML architecture.

---

## Research Required

### Primary Questions

1. **Model selection**: What ML model types achieve 5% MAPE at 30 days for cash forecasting?
2. **Feature importance**: Which features have highest predictive power for cash flows?
3. **Training data**: What historical data window is needed for different forecast horizons?
4. **Accuracy measurement**: What metrics and thresholds define "success"?
5. **Cold start**: How do we handle entities with no historical data?

### Secondary Questions

1. How do vendor solutions (Kyriba, GTreasury) structure their ML pipelines?
2. What open-source frameworks are appropriate (Prophet, sklearn, PyTorch)?
3. How do we handle seasonality at different levels (weekly, monthly, quarterly, annual)?
4. What retraining frequency is needed?
5. How do we explain forecasts to non-technical users?

---

## Architectural Options to Investigate

### Option A: Classical Time Series

```
Historical Data → ARIMA/SARIMA → Forecast
                     ↑
              Seasonal decomposition
```

**Pros**: Well-understood, interpretable
**Cons**: Linear assumptions, may not hit 5%

### Option B: Prophet-Based

```
Historical Data + Holidays + Events → Prophet → Forecast
                                          ↑
                                   Growth + Seasonality + Changepoints
```

**Pros**: Handles business patterns well
**Cons**: May need customization

### Option C: Deep Learning

```
Historical Data → Feature Engineering → LSTM/Transformer → Forecast
                                              ↑
                                     Sequence modeling
```

**Pros**: Can capture complex patterns
**Cons**: Needs more data, less interpretable

### Option D: Ensemble

```
                    ┌─► ARIMA ────────┐
Historical Data ───►├─► Prophet ──────┼─► Weighted Ensemble → Forecast
                    └─► LSTM ─────────┘
```

**Pros**: Combines strengths
**Cons**: Complex to maintain

---

## Connection to Existing Work

| Document | Relevance |
|----------|-----------|
| questions/03_ai_forecasting_regime_changes.md | Covers regime change aspect |
| prompts/04_ai_cash_forecasting_resilience.md | Research prompt exists, needs architecture |
| research/08_TREASURY_TECHNOLOGY.md | Mentions AI, no details |

---

## Resolution Criteria

This gap is **RESOLVED** when:

- [ ] Model architecture selected and justified
- [ ] Feature engineering pipeline defined
- [ ] Training data requirements documented
- [ ] Accuracy metrics and thresholds established
- [ ] Cold start approach documented
- [ ] 5% accuracy at 30 days achievability validated
- [ ] Implementation pathway clear

---

## Resolution Status: ✓ RESOLVED

**Research findings documented in**: `research-findings/RF-01_forecasting_ml_architecture.md`

**Key decisions**:
- Model: LSTM + Prophet + XGBoost ensemble
- Target: 5% MAPE achievable at 30-day horizon
- Training data: 2 years minimum
- Implementation: 8-week phased approach

---

*Gap Identified: January 2026*
*Gap Resolved: January 2026*
*Blocks: Phase 3 implementation*
