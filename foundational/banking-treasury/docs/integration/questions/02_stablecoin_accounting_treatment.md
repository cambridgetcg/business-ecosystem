# Question: What Is The Accounting Treatment For Stablecoin Treasury Holdings?

## The Gap

Research confirmed stablecoins are functionally **treasury rails** (24/7, instant, low-cost). But when USDC sits in our corporate wallet between transactions, how does it appear on the balance sheet?

## The Specific Question

```
If we hold $10M USDC overnight for operational liquidity:
  → Is it "Cash and Cash Equivalents"?
  → Is it "Short-term Investments"?
  → Is it "Digital Assets" with different rules?
  → Does the answer change by jurisdiction?
```

## Why This Matters

### Treasury Policy Implications
Most treasury policies have limits like:
- "Cash equivalents must be at least 80% of liquidity buffer"
- "No more than 20% in investments"

If stablecoins are classified as "investments" or "digital assets," holding them for operational purposes may violate policy—even though they're more liquid than money market funds.

### Reporting Implications
- Cash equivalents: No fair value adjustment
- Investments: Mark-to-market (even though 1:1 pegged)
- Digital assets: Different disclosure requirements

### Audit Implications
Auditors will ask:
- What's the impairment model?
- How is redemption risk disclosed?
- Are crypto custodian controls SOC-compliant?

## Current Understanding

| Classification | Treatment | Implication |
|----------------|-----------|-------------|
| **Cash Equivalent** | No FV adjustment, grouped with cash | Simplest, but may not qualify |
| **Short-term Investment** | Mark-to-market through OCI or P&L | Volatility in financials |
| **Intangible Asset** | Current GAAP treatment for crypto | Impairment-only model (bad) |
| **Financial Asset** | Depends on instrument classification | Need analysis |

## Regulatory Landscape

### FASB ASU 2023-08 (Effective 2025)
- Crypto assets measured at fair value
- Changes in FV recognized in net income
- But: Does this apply to **stablecoins** or just volatile crypto?

### SEC Staff Accounting Bulletin (SAB 121)
- Requires recognition of liability for custodied crypto
- Applies to banks holding customer crypto
- Does this affect corporate treasury holdings?

### GENIUS Act (July 2025)
- Requires 100% reserve backing
- Monthly attestations
- Does regulatory status change accounting treatment?

## Hypotheses to Investigate

### Hypothesis 1: Stablecoins Are Cash Equivalents
- 100% backed, instant redemption, stable value
- Meets ASC 305-10-20 definition (90 day maturity, negligible risk)
- Counter: Redemption through issuer, not immediate

### Hypothesis 2: Stablecoins Are Short-Term Investments
- Not direct claim on cash
- Subject to issuer credit risk
- Requires FV accounting

### Hypothesis 3: Post-GENIUS Stablecoins Qualify Differently
- Federal licensing + 100% reserves + oversight
- May meet higher bar for cash equivalent treatment
- Similar to money market fund argument

## Research Directions

1. **Big 4 accounting firm guidance** — What are KPMG/PwC/EY/Deloitte saying?
2. **SEC enforcement actions** — Any precedent on stablecoin classification?
3. **FASB project agenda** — Are they specifically addressing stablecoins?
4. **Peer company disclosures** — How are MicroStrategy, Tesla, etc. treating holdings?

## The Policy Decision

This question affects treasury policy design:

```
IF stablecoins = cash equivalents:
  → Can count toward liquidity buffer
  → No mark-to-market volatility
  → Standard cash pooling applies

IF stablecoins = investments:
  → Separate from cash in policy
  → Investment policy limits apply
  → Different reporting line

IF stablecoins = digital assets:
  → Impairment risk reporting
  → May need board-level crypto policy
  → Enhanced custodian due diligence
```

## Connected Questions

- How do stablecoin holdings affect banking covenants that reference "cash"?
- What custodian controls do auditors require for digital asset attestation?
- How do unrealized FV gains/losses flow through tax reporting?

---

*Priority: HIGH — Affects treasury policy and financial reporting*
*Research type: Accounting standards analysis + regulatory guidance*
