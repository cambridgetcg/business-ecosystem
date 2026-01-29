# Question: What's The Optimal Hedge Ratio During Volatility Regime Shifts?

## The Gap

Research covered FX exposure netting but assumed stable hedging strategy. In practice, volatility regimes shift—what's the 80% hedge ratio during calm markets may be wrong during stress.

## The Specific Question

```
When FX volatility increases significantly:
  → Should hedge ratio increase (more protection)?
  → Or decrease (hedging costs spike, accept risk)?
  → How do you detect a regime shift vs. temporary spike?
  → What's the right response time—immediate vs. wait for confirmation?
```

## Why This Matters

### The Hedge Ratio Trade-off

```
LOW VOLATILITY REGIME:
  → Hedge cost: Low (tight forwards)
  → Unhedged risk: Moderate
  → Optimal ratio: Maybe 60-80%

HIGH VOLATILITY REGIME:
  → Hedge cost: High (wide forwards)
  → Unhedged risk: Very high
  → Optimal ratio: ??? (higher? lower?)
```

### The Wrong Decision Cost

| Decision | If Volatility Stays High | If Volatility Normalizes |
|----------|-------------------------|-------------------------|
| **Increase hedge** | Good (protected) | Overpaid for protection |
| **Decrease hedge** | Bad (exposed) | Good (saved cost) |
| **No change** | Depends on starting point | Depends on starting point |

## Current Understanding

| Factor | Increases Optimal Hedge | Decreases Optimal Hedge |
|--------|------------------------|------------------------|
| Exposure size | ↑ | ↓ |
| Exposure certainty | ↑ | ↓ |
| Hedge cost | ↓ | ↑ |
| Corporate risk tolerance | ↓ | ↑ |
| Accounting treatment | Depends | Depends |

## The Regime Detection Problem

### What Signals Regime Change?

**Implied volatility:**
- FX options IV spikes
- Challenge: How much spike = regime change?

**Realized volatility:**
- Historical vol exceeds threshold
- Challenge: Backward-looking, slow to detect

**Cross-market signals:**
- VIX correlation
- Interest rate differentials
- Risk-off asset movements

### The Timing Dilemma

```
                      VOLATILITY SPIKE
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
      REACT FAST      WAIT & SEE     IGNORE
            │              │              │
            ▼              ▼              ▼
    If spike persists: If temporary:  If persists:
    GOOD decision      GOOD decision  BAD decision
            │              │              │
            ▼              ▼              ▼
    If spike fades:   If persists:   If fades:
    Overpaid          Late response  No cost
```

## Hypotheses to Investigate

### Hypothesis 1: Dynamic Hedge Ratio Band
```
Hedge ratio = f(volatility regime)

Low vol: 70-80%
Medium vol: 75-85%
High vol: 85-95%

With hysteresis to prevent whipsawing
```

### Hypothesis 2: Cost-Adjusted Hedging
```
When hedge cost exceeds threshold:
  → Accept higher exposure
  → Use options for tail risk only
  → Wait for cost normalization

Rationale: Very expensive hedges are often
           offered at worst times
```

### Hypothesis 3: Exposure Certainty Weighting
```
In high volatility:
  → Hedge 100% of certain exposures
  → Hedge less of forecast exposures
  → Rationale: Reduce locked-in hedges
               when forecasts may change
```

### Hypothesis 4: Option Overlay Strategy
```
Base: Forward hedges at standard ratio

In high volatility:
  → Add put options for downside
  → Asymmetric protection
  → Higher cost, better profile
```

## Research Directions

1. **Academic literature** — Optimal hedging under stochastic volatility
2. **Corporate treasury surveys** — How do peers adjust hedge ratios?
3. **Hedge accounting implications** — Does dynamic hedging break hedge accounting?
4. **Historical case studies** — Hedge performance during 2008, 2020, 2022, 2025

## The Hedge Accounting Constraint

**Critical limitation:** Dynamic hedge ratios may disqualify from hedge accounting.

ASC 815 requires:
- Hedging relationship must be "highly effective"
- Changes to designated hedges require de-designation and re-designation
- Frequent changes create income statement volatility

This may force a choice:
- **Static ratio:** Maintains hedge accounting, suboptimal protection
- **Dynamic ratio:** Optimal protection, hedge accounting complexity

## The Data Model Implication

```typescript
HedgePolicy {
  currency_pair: CurrencyPair
  base_hedge_ratio: percentage
  volatility_adjustments: VolatilityAdjustment[]
  hedge_accounting_treatment: 'cash_flow' | 'net_investment' | 'none'
  rebalancing_frequency: 'daily' | 'weekly' | 'monthly'
  rebalancing_threshold: percentage  // Min change to trigger
}

VolatilityAdjustment {
  volatility_regime: 'low' | 'medium' | 'high' | 'extreme'
  implied_vol_threshold: percentage
  adjusted_hedge_ratio: percentage
  instrument_preference: 'forward' | 'option' | 'collar'
}
```

## Connected Questions

- How do hedge ratio decisions interact with natural hedging from netting?
- What volatility forecasting model should drive hedge ratio adjustments?
- How do we explain dynamic hedging performance to the board?

---

*Priority: MEDIUM — Optimization question, not blocking*
*Research type: Academic literature + peer practice + accounting analysis*
