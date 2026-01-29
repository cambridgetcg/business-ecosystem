# Research Prompt: Resilient AI Cash Flow Forecasting

## Research Objective

Design an AI cash flow forecasting architecture that handles liquidity regime changes without catastrophic failure during stress events.

## Context

2025 stress events (April Treasury market, September repo market) demonstrated that AI models trained on normal conditions fail during regime shifts. The fundamental challenge: stress events are rare, but that's exactly when accurate forecasting matters most.

## Research Questions

### Section 1: Regime Detection Methods

**Primary question:** How can forecasting systems detect liquidity regime changes in real-time?

Investigate:
- Hidden Markov Models for regime detection
- Change-point detection algorithms
- Market-based indicators (VIX, credit spreads, Fed funds)
- Operational indicators (DSO, payment velocity)
- Composite early warning indices

**Desired output:**
- Comparison of regime detection approaches
- Signal set for regime change detection
- False positive/negative trade-off analysis

### Section 2: Multi-Model Architectures

**Primary question:** How should multiple forecasting models be combined to handle different regimes?

Investigate:
- Ensemble methods with regime-based weighting
- Regime-switching models (Markov-switching VAR)
- Model stacking approaches
- Expert model selection
- Bayesian model averaging

**Desired output:**
- Architecture options comparison
- Recommendation for multi-model approach
- Weight adjustment mechanism

### Section 3: Training on Scarce Stress Data

**Primary question:** How do you train stress-aware models with limited historical stress events?

Investigate:
- Synthetic stress data generation
- Transfer learning from similar events
- Simulation-based training
- External stress datasets (Fed stress tests, historical crises)
- Domain adaptation techniques

**Desired output:**
- Data augmentation strategy
- Stress event database structure
- Training protocol for stress scenarios

### Section 4: Uncertainty Quantification

**Primary question:** How should forecasts communicate uncertainty during high-volatility periods?

Investigate:
- Confidence interval methods (parametric, bootstrap, conformal)
- Scenario-based probabilistic forecasts
- Tail risk quantification
- Communication to non-technical stakeholders

**Desired output:**
- Uncertainty representation standards
- Dashboard visualization recommendations
- Executive summary format

### Section 5: Human-in-the-Loop Design

**Primary question:** When should humans override AI forecasts?

Investigate:
- Anomaly detection thresholds for human review
- Override protocols and documentation
- Learning from human corrections
- Accountability frameworks

**Desired output:**
- Human-AI collaboration workflow
- Override decision tree
- Feedback loop design

## Research Methodology

1. **Academic literature:** Finance/ML journals on regime-switching forecasting
2. **Vendor analysis:** Kyriba, Highradius, TIS AI forecasting approaches
3. **Fed stress testing:** CCAR/DFAST methodology applicability
4. **Historical case studies:** Forecast failures during 2008, 2020, 2025

## Success Criteria

Research is complete when:
- [ ] Regime detection approach is selected
- [ ] Multi-model architecture is designed
- [ ] Training strategy handles data scarcity
- [ ] Uncertainty is properly communicated
- [ ] Human override protocol is defined
- [ ] Gap from questions/03 is addressed

## Related Files

- docs/integration/questions/03_ai_forecasting_regime_changes.md
- docs/research/08_TREASURY_TECHNOLOGY.md
- docs/research/nuances/17_LIQUIDITY_STRESS_MANAGEMENT.md

---

*Research Priority: MEDIUM*
*Estimated Effort: 2-3 research sessions*
*Dependencies: Access to historical stress event data*
