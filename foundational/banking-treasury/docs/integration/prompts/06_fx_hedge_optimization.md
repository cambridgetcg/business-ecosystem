# Research Prompt: Dynamic FX Hedge Optimization

## Research Objective

Develop a framework for optimizing FX hedge ratios across volatility regimes while maintaining hedge accounting qualification.

## Context

Research established that FX exposure netting beats payment netting—net exposures first, then execute a single FX trade. But the hedge ratio question remains: What percentage of net exposure should be hedged, and how should this change as volatility regimes shift?

The constraint: ASC 815 hedge accounting requires "highly effective" hedging relationships. Dynamic adjustments may break hedge accounting, creating income statement volatility.

## Research Questions

### Section 1: Hedge Accounting Constraints

**Primary question:** What hedge ratio adjustments are permissible under hedge accounting rules?

Investigate:
- ASC 815 effectiveness testing requirements
- De-designation and re-designation mechanics
- Critical terms match method applicability
- Regression-based effectiveness testing
- Dollar-offset method limitations

**Desired output:**
- Hedge accounting constraint summary
- Permissible adjustment frequency/magnitude
- Decision tree: When does dynamic hedging break hedge accounting?

### Section 2: Optimal Hedge Ratio Theory

**Primary question:** What does academic literature say about optimal hedge ratios?

Investigate:
- Minimum variance hedge ratio
- Mean-variance optimization
- Utility-based approaches
- Regime-dependent optimal hedges
- Transaction cost effects

**Desired output:**
- Literature review summary
- Model comparison
- Applicability to corporate treasury (vs. financial institution)

### Section 3: Volatility Regime Detection

**Primary question:** How should treasury operations detect FX volatility regime changes?

Investigate:
- Implied volatility indicators
- Realized volatility thresholds
- GARCH model regime indicators
- Cross-asset correlation signals
- Central bank policy indicators

**Desired output:**
- Regime indicator set
- Threshold calibration methodology
- Signal validation approach

### Section 4: Hedge Instrument Selection

**Primary question:** How should instrument choice vary by volatility regime?

Investigate:
- Forward contracts (full protection, full cost)
- Options (asymmetric protection, premium cost)
- Collars (bounded protection, reduced cost)
- Participating forwards
- Natural hedging through operational decisions

**Desired output:**
- Instrument comparison by regime
- Cost-benefit analysis framework
- Instrument selection decision tree

### Section 5: Implementation Architecture

**Primary question:** How should dynamic hedging be operationalized?

Investigate:
- Rebalancing triggers (time-based vs. threshold-based)
- Execution protocols (single trade vs. averaging)
- Position monitoring requirements
- Reporting to stakeholders

**Desired output:**
- Hedge management workflow
- System requirements
- Reporting template

## Research Methodology

1. **Academic sources:** Journal of Finance, Journal of Financial Economics
2. **Practitioner resources:** FX Week, Treasury & Risk
3. **Accounting guidance:** FASB ASC 815, Big 4 hedge accounting guides
4. **Peer practices:** Treasury surveys on hedge management

## Success Criteria

Research is complete when:
- [ ] Hedge accounting constraints are mapped
- [ ] Optimal hedge ratio framework is defined
- [ ] Regime detection methodology is specified
- [ ] Instrument selection guidance is clear
- [ ] Operational workflow is designed
- [ ] Gap from questions/06 is addressed

## Related Files

- docs/integration/questions/06_hedge_ratio_volatility_regimes.md
- docs/integration/insights/05_fx_exposure_netting_beats_payment_netting.md
- docs/research/nuances/13_FX_EXECUTION_TIMING.md

---

*Research Priority: MEDIUM*
*Estimated Effort: 2 research sessions*
*Dependencies: FX derivatives expertise*
