# MG-08: Forecasting Under Regime Changes

## Gap Classification

| Attribute | Value |
|-----------|-------|
| **Gap ID** | MG-08 |
| **Domain** | Treasury Operations |
| **Mission Capability** | M5: Accurate Cash Flow Forecasting |
| **Understanding Level** | AWARE |
| **Priority** | MEDIUM |

---

## The Gap

ML forecasting models trained on normal conditions fail during stress events (April 2025 Treasury market, September 2025 repo stress). We don't understand how to build forecasting that **detects regime changes** and **maintains reasonable accuracy** during stress.

---

## What We Know

From insight 06 (Liquidity Stress Requires Playbooks):
- 2025 stress events caught many treasuries unprepared
- Improvisation fails in crisis
- Pre-built responses are essential

From question 03 (AI Forecasting Regime Changes):
- Models trained on normal data fail during stress
- Regime detection is a known challenge
- Multiple approaches exist (HMM, anomaly detection, ensemble)

---

## What We Don't Know

### 1. Regime Detection Algorithms

**Unknown**: How do we detect when the market regime has changed?

| Approach | Description | Unknown |
|----------|-------------|---------|
| **Hidden Markov Model** | Latent state variable | State definition, training |
| **Change-point detection** | Statistical break detection | Sensitivity tuning |
| **Volatility threshold** | VIX or FX vol spike | Threshold selection |
| **Multi-signal composite** | Combined indicators | Signal weighting |

**Questions**:
- How quickly can we detect a regime change?
- How do we avoid false positives (crying wolf)?
- What signals have the highest predictive power?

### 2. Model Adaptation Strategies

**Unknown**: How should the forecasting model adapt during stress?

| Strategy | Description | Unknown |
|----------|-------------|---------|
| **Model switching** | Different model for stress | Switch criteria |
| **Weight adjustment** | Adjust ensemble weights | How to weight? |
| **Feature modification** | Different features in stress | Which features? |
| **Human override** | Manual intervention | Override protocol |

### 3. Stress-Aware Training

**Unknown**: How do we train models that handle stress?

| Challenge | Description | Unknown |
|-----------|-------------|---------|
| **Data scarcity** | Few stress events in history | Augmentation methods |
| **Distribution shift** | Stress patterns differ | Transfer learning |
| **Catastrophic forgetting** | Model forgets normal | Continual learning |

### 4. Acceptable Degradation

**Unknown**: What accuracy is acceptable during stress?

| Period | Normal Target | Stress Target |
|--------|--------------|---------------|
| 7-day forecast | 3% MAPE? | ?% MAPE |
| 30-day forecast | 5% MAPE | ?% MAPE |
| 90-day forecast | 10% MAPE? | ?% MAPE |

**Questions**:
- How much accuracy degradation is acceptable during stress?
- Should we communicate uncertainty differently?
- When should forecasts be suspended entirely?

---

## Impact on Mission

### M5: Accurate Cash Flow Forecasting

**SUCCESS METRIC** (PURPOSE.md):
- Forecasting accuracy: Within 5% of actual for 30-day projections

**IMPACT**: Target applies to normal conditions. During stress:
- 5% may not be achievable
- Users need to know uncertainty has increased
- Conservative projections may be more valuable than accurate ones

### Business Risk

Bad forecasts during stress lead to:
- Unexpected overdrafts (forecast too high)
- Missed crisis response timing (forecast too low)
- Loss of confidence in system

---

## Research Required

### Primary Questions

1. **Regime detection**: What algorithms detect regime changes with acceptable false positive rate?
2. **Adaptation strategy**: Should we switch models, adjust weights, or involve humans?
3. **Training approach**: How do we train stress-aware models with limited data?
4. **Degradation tolerance**: What accuracy is acceptable during stress?

### Secondary Questions

1. How do commercial vendors handle stress periods?
2. What early warning indicators have worked historically?
3. How do we communicate increased uncertainty to users?
4. Should CFP triggers integrate with forecast uncertainty?

---

## Proposed Architecture

```
                    ┌─────────────────────┐
                    │   REGIME DETECTOR   │
                    │                     │
                    │ • VIX level         │
                    │ • Credit spreads    │
                    │ • Internal signals  │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │ NORMAL     STRESSED │
                    │                     │
         ┌─────────┴─────────┐   ┌───────┴───────┐
         │                   │   │               │
         ▼                   ▼   ▼               ▼
┌─────────────────┐   ┌─────────────────┐ ┌─────────────┐
│ NORMAL MODEL    │   │ STRESS MODEL    │ │ HUMAN       │
│                 │   │                 │ │ OVERRIDE    │
│ • Full features │   │ • Conservative  │ │ OPTION      │
│ • ML optimized  │   │ • Wider bands   │ │             │
│ • 5% target     │   │ • 15%+ target   │ │             │
└─────────────────┘   └─────────────────┘ └─────────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │   OUTPUT            │
                    │                     │
                    │ • Point forecast    │
                    │ • Confidence band   │
                    │ • Regime indicator  │
                    │ • Uncertainty level │
                    └─────────────────────┘
```

---

## Connection to Existing Work

| Document | Relevance |
|----------|-----------|
| questions/03_ai_forecasting_regime_changes.md | Core question |
| prompts/04_ai_cash_forecasting_resilience.md | Research prompt |
| MG-07 (Forecasting ML Architecture) | Base architecture this extends |
| insight/06_liquidity_stress_requires_playbooks.md | Business context |

---

## Resolution Criteria

This gap is **RESOLVED** when:

- [ ] Regime detection approach selected
- [ ] Model adaptation strategy defined
- [ ] Training approach for stress scenarios documented
- [ ] Acceptable degradation levels established
- [ ] User communication strategy for uncertainty defined

---

*Gap Identified: January 2026*
*Blocks: Stress-robust forecasting in Phase 3*
*Estimated Research Effort: 1-2 sessions*
*Dependency: MG-07 (base ML architecture)*
