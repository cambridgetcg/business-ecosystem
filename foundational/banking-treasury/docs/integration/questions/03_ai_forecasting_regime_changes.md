# Question: How Should AI Cash Forecasting Handle Liquidity Regime Changes?

## The Gap

Research documented 2025 stress events (April Treasury stress, September repo stress). AI models trained on normal conditions failed to predict regime shifts. How do we build forecasting that handles discontinuities?

## The Specific Question

```
When market conditions shift from "normal" to "stressed":
  → How does an AI model detect the regime change?
  → Should it switch to different model weights?
  → How do we avoid false positives (crying wolf)?
  → How do we incorporate exogenous signals (Fed actions, geopolitics)?
```

## Why This Matters

### The Model Failure Mode

```
Normal Regime:
  → Historical patterns predict well
  → Receivables arrive on schedule
  → Payables follow budget
  → AI forecasts: 95% accurate

Stress Regime:
  → Customers delay payments
  → Suppliers demand faster payment
  → Credit lines may be drawn
  → AI forecasts: Dangerously wrong (trained on normal)
```

### The Cost of Getting It Wrong

- **Under-predict stress**: Run out of cash, scramble for expensive emergency financing
- **Over-predict stress**: Hold excess liquidity, miss investment returns, appear weak to banks

## Current Understanding

| Approach | Strength | Weakness |
|----------|----------|----------|
| **Single model** | Simple, stable | Fails on regime shifts |
| **Ensemble models** | Can include stress model | How to weight? |
| **Regime-switching models** | Explicit state detection | Needs labeled regime data |
| **Exogenous inputs** | Can incorporate signals | Which signals? How weighted? |

## The Regime Detection Problem

### What Signals A Regime Shift?

**Market signals:**
- VIX > threshold
- Treasury yield curve inversion
- Credit spreads widening
- Fed balance sheet changes

**Operational signals:**
- DSO (Days Sales Outstanding) increasing
- Payment velocity slowing
- Customer inquiries about payment terms
- Supplier terms tightening

**The chicken-and-egg:**
- Wait for clear signals → React too late
- Act on early signals → Many false positives

## Hypotheses to Investigate

### Hypothesis 1: Hidden Markov Models (HMM)
- Model has latent "state" variable
- Observations depend on current state
- Transitions between states have probabilities
- Challenge: Defining states, training with limited stress data

### Hypothesis 2: Anomaly Detection Layer
- Detect when current patterns diverge from training data
- Trigger human review when anomaly detected
- Hybrid: AI predicts normal, humans handle anomalies
- Challenge: Defining "significant" divergence

### Hypothesis 3: Scenario Weighting
- Always run multiple scenarios (base, stress, severe)
- Adjust weights based on current indicators
- Output probability-weighted forecast
- Challenge: How to set weights objectively?

### Hypothesis 4: Reinforcement Learning
- Model learns to adjust based on forecast errors
- Can adapt to new regimes over time
- Challenge: Dangerous during actual stress

## Research Directions

1. **Academic literature** — Regime-switching models in finance/treasury
2. **Fed stress testing methodology** — How do regulators model regime shifts?
3. **Vendor solutions** — How do Kyriba, Highradius claim to handle this?
4. **Historical case studies** — How did forecasting fail in 2008, 2020, 2025?

## The Architectural Decision

This question affects forecasting architecture:

```
Option A: Single model + human override
  → Simple architecture
  → Requires skilled treasury team
  → Scales poorly

Option B: Multi-model with signal-based switching
  → Complex but autonomous
  → Requires regime classification
  → Risk of wrong model selection

Option C: Ensemble with dynamic weighting
  → Always considers multiple scenarios
  → Weights shift with indicators
  → More compute, more nuanced output

Option D: Hybrid with anomaly detection
  → AI handles normal, flags anomalies
  → Human reviews flagged periods
  → Explicit uncertainty acknowledgment
```

## The Training Data Problem

**The fundamental challenge:**
- Stress events are rare (2008, 2020, 2025)
- Models need data to learn
- Can't wait for more stress events to train

**Possible solutions:**
- Synthetic stress data generation
- Transfer learning from similar events
- Simulation-based training
- Incorporate external stress datasets

## Connected Questions

- How do we evaluate forecast accuracy during stress (when errors matter most)?
- What's the right confidence interval to report during high uncertainty?
- How should forecasts feed into Contingency Funding Plan triggers?

---

*Priority: MEDIUM — Important for robustness, but complex to solve*
*Research type: Academic literature + vendor analysis + architectural design*
