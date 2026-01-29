# MG-04: Stablecoin Accounting Classification

## Gap Classification

| Attribute | Value |
|-----------|-------|
| **Gap ID** | MG-04 |
| **Domain** | Payment Processing |
| **Mission Capability** | M2: Payment Processing with Controls |
| **Understanding Level** | KNOWS |
| **Priority** | CRITICAL |

---

## The Gap

We understand that **stablecoins are treasury rails** (insight 03). We do **not** understand **how they appear on the balance sheet**, which affects treasury policy, reporting, and compliance.

---

## What We Know

From research 07 (Stablecoin/Crypto) and insight 03:
- USDC/USDT are 24/7 payment rails with instant finality
- Enterprise use cases: SpaceX, Scale AI
- GENIUS Act (July 2025) provides regulatory clarity
- 100% reserve backing required
- Monthly attestations mandated

From PURPOSE.md (Line 198-199):
- Non-goal: "Handle cryptocurrency" (may evolve)
- This explicitly acknowledges stablecoin integration is future scope

---

## What We Don't Know

### 1. Balance Sheet Classification

**Unknown**: How should operational stablecoin holdings be classified?

| Classification | Treatment | Implications | Unknown |
|----------------|-----------|--------------|---------|
| **Cash equivalent** | Grouped with cash, no FV adjustment | Simplest, but may not qualify | Qualification criteria |
| **Short-term investment** | Mark-to-market through OCI/P&L | Volatility in financials | Which sub-category? |
| **Digital asset (intangible)** | Impairment-only under old rules | Worst treatment | FASB 2023-08 applicability |
| **Financial instrument** | Depends on classification | Complex analysis | Instrument type? |

**Why It Matters**:
- Treasury policies often limit "investments" to X%
- If stablecoins aren't "cash," holding them violates policy
- Different classifications have different audit requirements

### 2. FASB ASU 2023-08 Applicability

**Unknown**: Does the new crypto accounting standard apply to stablecoins?

| Question | Unknown |
|----------|---------|
| Scope | Are stablecoins "crypto assets" under the standard? |
| Fair value | Do 1:1 pegged assets still need FV accounting? |
| Effective date | When does this apply to corporate holdings? |
| Voluntary early adoption | Should we adopt early? |

### 3. Post-GENIUS Act Treatment

**Unknown**: Does federal regulation change accounting classification?

| GENIUS Act Requirement | Potential Accounting Impact |
|----------------------|---------------------------|
| 100% reserve backing | Reduces credit risk → cash equivalent argument stronger |
| Federal licensing | Legitimizes as monetary instrument |
| Monthly attestations | Provides verification for auditors |
| Federal oversight | Similar to money market fund regulation |

**Question**: Does GENIUS Act compliance create a new category that qualifies as cash equivalent?

### 4. Custody and Control

**Unknown**: How does custody arrangement affect classification?

| Custody Model | Accounting Question |
|---------------|---------------------|
| Self-custody (hot wallet) | Do we have "control" for asset recognition? |
| Exchange custody | Is this "restricted cash"? |
| Qualified custodian | Does SOC 2 compliance change treatment? |
| Omnibus vs. segregated | Impact on balance sheet presentation? |

### 5. Audit Requirements

**Unknown**: What do auditors require for stablecoin attestation?

| Audit Area | Unknown |
|------------|---------|
| Existence | How to verify on-chain holdings? |
| Valuation | 1:1 peg assumption valid? |
| Controls | What SOC reports satisfy auditors? |
| Disclosure | What disclosures are required? |

---

## Impact on Mission

### M2: Payment Processing with Controls

**CAPABILITY** (PURPOSE.md): Payment initiation across rails including stablecoin

**BLOCKED BY THIS GAP**: Cannot integrate stablecoin payments into treasury operations without:
- Clear accounting classification
- Treasury policy alignment
- Audit-ready documentation

### Roadmap Impact

**PURPOSE.md Long-term Vision** (Line 213):
- "International payment hub" includes stablecoin rails

Without resolving accounting, we cannot:
- Set treasury policy limits for stablecoin holdings
- Report cash positions accurately
- Pass audit for stablecoin balances

---

## Research Required

### Primary Questions

1. **FASB ASU 2023-08 scope**: Does it apply to stablecoins specifically?
2. **Cash equivalent qualification**: Under ASC 305-10-20, can stablecoins qualify?
3. **Post-GENIUS Act treatment**: Does federal regulation change classification?
4. **Big 4 guidance**: What are KPMG/PwC/EY/Deloitte recommending?
5. **Peer disclosures**: How are public companies (if any) classifying holdings?

### Secondary Questions

1. How do stablecoin holdings affect banking covenants that reference "cash"?
2. What custody controls satisfy SOX requirements?
3. How do unrealized FV gains/losses flow through taxes?
4. What insurance products exist for custody losses?

---

## Classification Decision Tree (To Be Validated)

```
Stablecoin Holding
       │
       ▼
┌──────────────────────────────────────┐
│ Is it from a GENIUS Act-compliant    │
│ issuer (federally licensed, 100%     │
│ reserves, monthly attestations)?     │
└──────────────────┬───────────────────┘
                   │
          ┌───────┴────────┐
          │ YES            │ NO
          ▼                ▼
┌─────────────────┐  ┌─────────────────┐
│ FASB 2023-08    │  │ Traditional     │
│ fair value      │  │ intangible      │
│ accounting      │  │ (impairment)    │
└────────┬────────┘  └─────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Does it meet ASC 305 cash           │
│ equivalent criteria?                │
│ - Readily convertible to cash       │
│ - So near maturity (<90 days)       │
│ - Insignificant risk of value change│
└────────────────┬────────────────────┘
                 │
        ┌────────┴────────┐
        │ YES             │ NO
        ▼                 ▼
┌───────────────┐  ┌───────────────┐
│ Cash          │  │ Short-term    │
│ equivalent    │  │ investment    │
│ (preferred)   │  │ (FV through   │
│               │  │  income)      │
└───────────────┘  └───────────────┘
```

**Note**: This tree needs validation through research.

---

## Connection to Existing Work

| Document | Relevance |
|----------|-----------|
| questions/02_stablecoin_accounting_treatment.md | Covers this question |
| prompts/01_stablecoin_treasury_integration.md | Section 2 addresses accounting |
| insight/03_stablecoins_are_treasury_rails.md | Business case established |
| research/07_STABLECOIN_CRYPTO.md | Operational properties documented |

---

## Resolution Criteria

This gap is **RESOLVED** when:

- [ ] FASB ASU 2023-08 applicability determined
- [ ] Cash equivalent qualification criteria analyzed
- [ ] Classification decision tree validated
- [ ] Audit requirements documented
- [ ] Draft accounting policy language created
- [ ] Treasury policy impact assessed

---

*Gap Identified: January 2026*
*Blocks: Stablecoin payment integration*
*Estimated Research Effort: 1-2 sessions + accounting advisor input*
