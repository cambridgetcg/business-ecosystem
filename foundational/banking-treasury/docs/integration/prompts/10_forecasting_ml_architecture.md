# Research Prompt: Cash Forecasting ML Architecture

## Research Objective

Design an **ML-based cash forecasting system** that achieves **5% accuracy at 30 days** as required by PURPOSE.md.

## Context

PURPOSE.md success metric:
- Forecasting accuracy: Cash forecasts within 5% of actual for 30-day projections

Current gap (MG-07): We don't understand what ML models, features, training data, or accuracy measurement approaches will achieve this target.

## Research Questions

### Section 1: Model Architecture Selection

**Primary question:** What ML model types achieve 5% MAPE at 30-day horizon for cash forecasting?

Investigate:

| Model | Appropriate For | Data Needs | Interpretability |
|-------|-----------------|------------|------------------|
| ARIMA/SARIMA | Stationary time series | 2+ years | High |
| Prophet | Business seasonality | 1+ years | High |
| LSTM/GRU | Complex patterns | Large datasets | Low |
| Transformer | Long dependencies | Very large | Low |
| XGBoost/LightGBM | Feature-rich | Moderate | Medium |
| Ensemble | Combined strengths | Varies | Medium |

For each model:
- What accuracy is achievable at 30 days?
- What are the training requirements?
- How does it handle regime changes?

**Desired output:**
- Model comparison with expected accuracy
- Recommended architecture (single vs. ensemble)
- Training/inference requirements

### Section 2: Feature Engineering

**Primary question:** Which features have highest predictive power for cash flows?

Investigate feature categories:

| Category | Features | Expected Impact |
|----------|----------|-----------------|
| **Historical** | Daily balances, rolling averages | High |
| **Calendar** | Day of week, month-end, holidays | Medium-High |
| **Business** | Sales forecasts, payroll dates | High |
| **Macroeconomic** | Interest rates, FX rates | Low-Medium |
| **Customer** | Payment patterns, DSO | Medium |
| **Operational** | AP/AR aging | High |

For each:
- Feature engineering approaches
- Data availability assessment
- Feature importance estimation

**Desired output:**
- Feature catalog with priority ranking
- Feature engineering pipeline design
- Data integration requirements

### Section 3: Training Data Requirements

**Primary question:** How much historical data is needed for different forecast horizons?

Investigate:
- Minimum viable training windows
- Ideal training windows
- Data quality requirements
- Handling of business changes (M&A, divestitures)

| Forecast Horizon | Minimum Data | Ideal Data |
|------------------|--------------|------------|
| Daily (1-7 days) | ? | ? |
| Weekly (1-4 weeks) | ? | ? |
| Monthly (1-3 months) | ? | ? |

**Desired output:**
- Training data requirements matrix
- Data quality checklist
- Cold start handling approach

### Section 4: Accuracy Measurement

**Primary question:** How do we measure and report forecast accuracy?

Investigate metrics:

| Metric | Formula | Use Case |
|--------|---------|----------|
| MAPE | Mean Absolute Percentage Error | Overall accuracy |
| RMSE | Root Mean Square Error | Large error penalty |
| Bias | Systematic over/under | Direction error |
| Coverage | Confidence interval hits | Uncertainty |

**Desired output:**
- Primary metric selection (for 5% target)
- Secondary metrics for monitoring
- Reporting dashboard specification
- Accuracy trending approach

### Section 5: Regime Change Handling

**Primary question:** How do we maintain accuracy during stress periods?

Investigate:
- Regime detection algorithms
- Model switching strategies
- Human override protocols
- Accuracy degradation expectations

**Desired output:**
- Regime detection approach
- Model adaptation strategy
- Human-in-the-loop design
- Stress period SLA (acceptable accuracy degradation)

### Section 6: Cold Start Problem

**Primary question:** How do we forecast for new entities with no history?

Investigate:
- Transfer learning approaches
- Template-based forecasting
- Industry/peer benchmarking
- Progressive model building

**Desired output:**
- Cold start strategy
- Minimum data for model activation
- Accuracy expectations during ramp-up

### Section 7: Implementation Options

**Primary question:** Build vs. buy analysis for forecasting capabilities

Investigate:
- Vendor solutions (Kyriba AI, GTreasury, CashAnalytics)
- Open-source frameworks (Prophet, sklearn, PyTorch Forecasting)
- Cloud ML services (AWS Forecast, Azure ML)
- Hybrid approaches

**Desired output:**
- Build vs. buy recommendation
- Integration architecture
- Total cost of ownership estimate

## Research Methodology

1. **Academic literature:** Time series forecasting, financial ML papers
2. **Vendor analysis:** Kyriba, GTreasury forecasting capabilities
3. **Open source:** Prophet documentation, PyTorch Forecasting
4. **Case studies:** Corporate treasury forecasting implementations

## Success Criteria

Research is complete when:
- [ ] Model architecture selected with expected accuracy
- [ ] Feature engineering pipeline defined
- [ ] Training data requirements documented
- [ ] Accuracy metrics established
- [ ] Regime change handling designed
- [ ] Cold start strategy defined
- [ ] 5% at 30 days achievability validated
- [ ] MG-07 gap resolved

## Related Files

- docs/integration/mission-gaps/MG-07_forecasting_ml_architecture.md
- docs/integration/questions/03_ai_forecasting_regime_changes.md
- docs/integration/prompts/04_ai_cash_forecasting_resilience.md
- docs/research/08_TREASURY_TECHNOLOGY.md

---

*Research Priority: HIGH*
*Estimated Effort: 3 sessions + prototype experimentation*
*Dependencies: Historical cash flow data for prototyping*
