# FX Execution & Currency Exposure Nuances

## Overview

FX risk management is documented extensively at the strategy level, but operational timing nuances—when to execute, how settlement timing affects exposure, and the interplay between payment and FX execution—are rarely covered. These nuances can cost 0.5-2% of payment value when mismanaged.

---

## The Problem Most Research Ignores

Standard documentation covers hedging instruments and strategies but ignores:
- **Execution timing** relative to payment initiation
- **Settlement date mismatches** between FX and payment
- **Intraday volatility** exposure windows
- **Spread variations** by time of day and market conditions
- **Natural hedging** optimization opportunities
- **Netting timing delays** creating exposure

---

## 2025 Market Context

### Dollar Volatility

| Event | Impact |
|-------|--------|
| **April 2025 tariff announcements** | USD's weakest start since 1973 |
| **"Triple decline"** | Equities, bonds, and USD fell simultaneously |
| **Asian trading hours** | Most USD depreciation occurred overnight |
| **Hedging costs spike** | Options premiums up, spreads wider |

**Implication**: FX execution timing now directly impacts cost more than any time in recent history.

**Source**: [BIS Bulletin 105 - Dollar's Slide April 2025](https://www.bis.org/publ/bisbull105.pdf)

---

## FX Settlement Risk

### The Risk Waterfall (FX Global Code 2025)

The revised FX Global Code (January 2025) establishes priority hierarchy:

| Priority | Method | Description |
|----------|--------|-------------|
| **1. PvP** | Payment vs. Payment | Eliminate settlement risk entirely |
| **2. Reduce size** | Netting | Minimize exposed amounts |
| **3. Reduce duration** | Same-day settlement | Shorten exposure window |

**Source**: [BIS CPMI FX Risk Mitigation](https://www.bis.org/cpmi/pietf/fx_risk_mitigation.pdf)

### Settlement Risk Quantification

| Settlement Method | Exposure Duration | Risk Level |
|-------------------|-------------------|------------|
| **CLS (PvP)** | Near-zero | Minimal |
| **Same-day bilateral** | Hours | Low |
| **T+1 bilateral** | 24 hours | Medium |
| **T+2 bilateral** | 48 hours | Higher |

---

## Execution Timing Best Practices

### When to Execute FX

| Scenario | Optimal Timing | Rationale |
|----------|----------------|-----------|
| **Known future payment** | At time of commitment | Lock in rate, eliminate uncertainty |
| **Recurring payments** | Rolling hedge program | Smooth exposure over time |
| **Uncertain timing** | Layered hedging | Partial coverage, adjust as certainty increases |
| **Urgent payment** | Spot with payment | Accept current rate, prioritize speed |

### Intraday Considerations

| Time Window (UTC) | Market Conditions | Spread |
|-------------------|-------------------|--------|
| **00:00-08:00** | Asia session only | Wider for non-JPY/AUD |
| **08:00-12:00** | Europe opens | Tightens for EUR, GBP |
| **12:00-17:00** | Europe + US overlap | Tightest spreads |
| **17:00-22:00** | US session only | Wider for non-USD pairs |
| **22:00-00:00** | Low liquidity | Widest spreads |

**Key Insight**: Execute during London-NY overlap for best pricing on major pairs.

---

## Payment vs. FX Timing Mismatch

### The Hidden Exposure

```
Day 1: FX trade executed (USD → EUR)
        │
        ├──> FX settles T+2
        │
Day 3: FX settles, EUR received
        │
        ├──> Payment initiated
        │
Day 4: Payment settles
        │
        └──> Total exposure window: 3 days
```

### Optimization: Align Settlement

```
Day 1: FX trade executed
        │
        ├──> Same-day EUR payment initiated
        │
Day 3: FX settles + Payment executes simultaneously
        │
        └──> Exposure window: 0 days (matched)
```

---

## Netting and FX Exposure

### Traditional Netting Problem

> "Traditional netting mechanisms have an invoice grouping requirement that adds a time-delay factor into the intercompany trade payable cycle. While they can help lower costs through net settlement, they don't improve and actually reinforce realization of foreign exchange gains and losses."

**Source**: [J.P. Morgan FX Exposure Netting](https://www.jpmorgan.com/insights/treasury/liquidity-management/fx-exposure-netting-risk-management-solutions)

### Better Approach: FX Exposure Netting

Instead of netting payments, net the FX **exposure** first:

1. **Aggregate all FX needs** across entities
2. **Net exposures** by currency pair
3. **Execute single FX transaction** for net amount
4. **Allocate** back to entities

**Benefits**:
- Reduced transaction costs
- Better rates (larger volume)
- Simplified hedge accounting
- Centralized control

---

## Automated FX Hedging Programs

### Benefits

| Capability | Impact |
|------------|--------|
| **Continuous visibility** | Real-time exposure tracking |
| **Automatic execution** | Remove timing decisions |
| **Policy enforcement** | Consistent hedge ratios |
| **Reduced cash flow variability** | Smoother P&L |

### Implementation Approach

1. **Define policy** (hedge ratio, instruments, horizons)
2. **Connect to forecasting** (expected cash flows)
3. **Set execution rules** (thresholds, timing windows)
4. **Automate reporting** (mark-to-market, effectiveness)

**Source**: [Kantox Cash Management and FX Risk](https://www.kantox.com/blog/cash-management-and-fx-risk-transforming-treasury-operations)

---

## Hedging Cost Considerations (2025)

### Current Market Conditions

| Factor | Impact on Hedging Cost |
|--------|----------------------|
| **Volatility spike** | Options premiums up significantly |
| **Bid-ask spreads** | Wider during volatile periods |
| **Forward points** | Reflect interest rate differentials |
| **Liquidity** | Unpredictable during stress |

### Cost Management Strategies

| Strategy | Benefit | Trade-off |
|----------|---------|-----------|
| **Layered hedging** | Dollar-cost averaging | Administrative complexity |
| **Participating forwards** | Upside participation | Higher premium |
| **Options vs. forwards** | Flexibility | Cost |
| **Natural hedging** | Zero cost | Requires matching exposures |

**Source**: [AlixPartners FX Hedging 2025](https://www.alixpartners.com/insights/102kxw9/navigating-fx-hedging-in-2025-strategies-for-a-turbulent-market/)

---

## Natural Hedging Optimization

### Concept

Match foreign currency inflows with outflows to eliminate need for financial hedging.

### Implementation

| Step | Action |
|------|--------|
| **1. Map exposures** | All currency in/outflows by entity |
| **2. Identify matches** | Same currency, similar timing |
| **3. Restructure if possible** | Invoice in local currency, pay in local currency |
| **4. Hedge residual** | Only net exposure needs hedging |

### Example

```
Entity A: €10M receivable (Q1)
Entity B: €8M payable (Q1)
          ─────────────────
Net:      €2M receivable (Q1) ← Only this needs hedging
```

---

## Repatriation and Currency Controls

### Countries with Significant Restrictions

| Country | Key Restrictions | Treasury Impact |
|---------|------------------|-----------------|
| **China** | Capital account controls, RMB not freely convertible | Trapped cash, slow repatriation |
| **India** | Dividend repatriation required, limits on individuals | Compliance overhead |
| **Brazil** | Tax on certain FX transactions | Additional costs |
| **Argentina** | Strict FX controls | Limited convertibility |
| **Russia** | Post-2022 sanctions | Effectively inaccessible |

### China Specifics

- **Repatriation upon liquidation** requires audited reports
- **Banks require extensive documentation**
- **SAFE approval** no longer required for most FDI transactions (September 2025 reforms)
- **Process can still be lengthy**

**Source**: [Norton Rose China FX Controls](https://www.nortonrosefulbright.com/en/knowledge/publications/7ece4ae5/safe-further-eases-control-over-fdi-and-cross-border-capital-account-transactions)

---

## System Design Implications

### Required Capabilities

1. **Real-time FX exposure aggregation** across entities
2. **Settlement date tracking** for payments and FX trades
3. **Intraday rate monitoring** with execution windows
4. **Hedge accounting support** (designation, effectiveness)
5. **Policy rule engine** (auto-hedge thresholds, limits)
6. **Multi-currency netting** with exposure awareness

### Data Model Considerations

```
FXExposure {
  entity_id: string
  currency_pair: CurrencyPair
  exposure_type: enum [RECEIVABLE, PAYABLE, FORECAST]
  amount: Money
  expected_settlement_date: date
  certainty_level: enum [COMMITTED, FORECAST, ESTIMATE]
  hedge_designation: string?  // For hedge accounting
  natural_hedge_match_id: string?  // Linked opposite exposure
}

HedgePolicy {
  currency_pair: CurrencyPair
  hedge_ratio_target: number  // e.g., 80%
  horizon_months: number  // How far forward to hedge
  instrument_preferences: HedgeInstrument[]
  execution_windows: TimeWindow[]  // When to execute
  threshold_amount: Money  // Minimum exposure to hedge
}
```

---

## Key Sources

- [BIS Dollar Slide Analysis](https://www.bis.org/publ/bisbull105.pdf)
- [J.P. Morgan FX Exposure Netting](https://www.jpmorgan.com/insights/treasury/liquidity-management/fx-exposure-netting-risk-management-solutions)
- [Xe FX Hedging Process](https://www.xe.com/blog/business/steps-in-an-fx-hedging-process-for-finance-and-treasury/)
- [ION Group FX Risk Optimization](https://iongroup.com/blog/treasury/optimizing-fx-risk-management-from-strategy-to-seamless-execution/)

---

*Research Date: January 2026*
*Gap Addressed: Operational timing nuances between FX and payment execution*
