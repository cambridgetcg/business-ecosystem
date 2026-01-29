# FRAND Terms and Compulsory Licensing

## Research Question
What are FRAND obligations for standard essential patents? When and how can governments force licensing?

## Current Model Gap
The current `License` entity has:
- `licenseType: 'exclusive' | 'non_exclusive' | 'sole' | 'sublicense'`
- No concept of FRAND obligations
- No tracking of standard essential patent status
- No compulsory licensing mechanisms

---

## Key Findings

### Part 1: FRAND Licensing

#### What Are Standard Essential Patents (SEPs)?

**SEP** = Patent that is **essential** to implementing a technical **standard** (e.g., 4G/LTE, WiFi, HEVC video codec)

When a patent holder contributes technology to a standards body (SSO), they typically must commit to license on **FRAND** terms:
- **F**air
- **R**easonable
- **A**nd
- **N**on-**D**iscriminatory

#### The FRAND Problem

**Core tension**:
- SEP holder: "My patent is essential - pay what I ask or you can't implement the standard"
- Implementer: "You committed to FRAND - you can't demand whatever you want"

**Hold-up vs Hold-out**:
- **Hold-up**: SEP holder demands excessive royalties (taking advantage of essentiality)
- **Hold-out**: Implementer refuses to negotiate, uses tech while fighting in court

#### Determining "Reasonable" Royalty

No standard formula exists. Courts use various approaches:

**Top-Down Approach**:
1. Estimate total aggregate royalty burden for entire standard
2. Divide among all SEP holders based on patent contribution
3. Calculate per-patent rate

**Bottom-Up Approach**:
1. Analyze comparable license agreements
2. Hypothetical negotiation (what would willing parties agree to?)
3. Incremental value of the patented technology

**Cost-Based Approach**:
1. SEP holder's R&D investment over time
2. Number of potential licensees
3. Calculate rate that provides fair return on investment

#### Recent Developments (2024-2025)

**UK Courts - Interim FRAND Licenses**:
- Courts now set **interim rates** during disputes
- Prevents hold-up while final FRAND terms determined
- Key cases: Panasonic v. Xiaomi, Nokia v. Amazon, Lenovo v. Ericsson

**Global Rate Setting**:
- Some courts (UK, China) set **global FRAND rates** for entire portfolios
- Controversial - whose courts get to decide worldwide terms?
- China: Huawei v. InterDigital set 0.019% rate

**EU SEP Regulation** (proposed 2023):
- SEP registration database
- Mandatory essentiality checks
- Aggregate royalty determination process
- Status: Withdrawn/stalled as of 2025

---

### Part 2: Compulsory Licensing

The US has two main mechanisms for forcing patent licenses:

#### 1. Government Patent Use - 28 U.S.C. § 1498

**What it does**: Federal government can use **any** patented invention without permission

**Key features**:
- Applies to **any patent** (not limited to federally-funded)
- No prior negotiation required
- Patent holder gets "reasonable and entire compensation" (typically ~10% of sales)
- Patent holder cannot get injunction against government
- Must sue in Court of Federal Claims for compensation

**Notable use**: In 2001, after anthrax attacks, HHS Secretary threatened to invoke § 1498 for Cipro (anthrax treatment). Bayer responded with 50% price cut to avoid it.

#### 2. March-In Rights - Bayh-Dole Act

**What it does**: Government can grant compulsory licenses on patents developed with **federal funding**

**Requirements** (35 U.S.C. § 203):
1. Contractor hasn't achieved "practical application"
2. Health/safety needs not being met
3. Public use requirements not satisfied
4. Exclusive licensee not manufacturing substantially in US

**Limitations**:
- Only applies to **federally-funded inventions**
- Has **never** been exercised in 40+ years since enactment
- Price control is NOT explicitly authorized (debated)

**The "Reasonable Terms" Debate**:
- "Practical application" requires invention "available to the public on reasonable terms"
- Some argue: excessively high prices = unreasonable terms
- Others: Bayh-Dole was never intended for price control
- Agencies have consistently declined to exercise march-in for pricing reasons

#### When Compulsory Licensing Might Apply

| Scenario | Mechanism | Likelihood |
|----------|-----------|------------|
| Government needs patented product | § 1498 | High (clear statutory authority) |
| Federally-funded drug too expensive | March-in | Very Low (never used, agencies reluctant) |
| SEP holder demands unreasonable terms | None directly | Courts set FRAND instead |
| National emergency | § 1498 | Moderate (COVID didn't trigger it) |

---

## Domain Model Implications

### Missing Concepts for FRAND
1. **Standard essential status**: Is patent declared essential to a standard?
2. **FRAND commitment**: What obligations were made?
3. **Standard body**: Which SSO (IEEE, ETSI, etc.)?
4. **Standard identification**: Which standard(s)?
5. **Aggregate royalty context**: Total burden for the standard

### Missing Concepts for Compulsory Licensing
1. **Federal funding source**: Agency, grant number
2. **March-in eligibility**: Was invention federally funded?
3. **Government use instances**: When § 1498 invoked
4. **Practical application status**: Is invention being used?

### Suggested Schema Additions
```typescript
// On Patent entity
interface PatentProps {
  // ... existing
  
  // SEP/FRAND
  isStandardEssential: boolean;
  standardEssentialDeclarations?: SEPDeclaration[];
}

interface SEPDeclaration {
  standardBody: 'IEEE' | 'ETSI' | 'ITU' | 'ISO' | 'IETF' | 'other';
  standardIdentifier: string;      // e.g., "802.11ax", "LTE Release 15"
  declarationDate: Date;
  frandCommitment: 'frand' | 'frand_rf' | 'rand' | 'none';  // RF = royalty-free
  declarationUrl?: string;
}

// On License entity - for FRAND licenses
interface LicenseProps {
  // ... existing
  
  isFrandLicense: boolean;
  frandRateType?: 'interim' | 'final' | 'negotiated';
  frandRateBasis?: 'top_down' | 'bottom_up' | 'cost_based' | 'comparable';
  frandDisputeStatus?: 'none' | 'pending' | 'resolved';
  courtSetRate?: boolean;           // Was rate set by court?
  rateSettingJurisdiction?: string; // Which court set rate?
}

// For tracking federal funding (Bayh-Dole implications)
interface FederalFunding {
  patentId: string;
  fundingAgency: string;            // NIH, NSF, DOD, etc.
  grantNumber: string;
  fundingAcknowledged: boolean;     // In patent application
  marchInEligible: boolean;
  governmentUseRightsGranted: boolean;
}

// For § 1498 events
interface GovernmentUseEvent {
  patentId: string;
  invokingAgency: string;
  invocationDate: Date;
  purpose: string;
  compensationClaimed: boolean;
  compensationAmount?: number;
  courtOfFederalClaimsCaseNumber?: string;
}
```

---

## Sources
- [Introduction to SEP & FRAND - Fish & Richardson](https://www.fr.com/insights/thought-leadership/blogs/introduction-to-sep-frand-issues/)
- [FRAND Interim Licenses - Kluwer Patent Blog](https://legalblogs.wolterskluwer.com/patent-blog/the-rise-of-frand-interim-licenses/)
- [Cost-Based FRAND Approach - IPWatchdog](https://ipwatchdog.com/2023/03/07/a-new-path-to-truly-fair-frand-rates-with-the-cost-based-approach/id=157414/)
- [28 USC § 1498 and Bayh-Dole - NYU JIPEL](https://jipel.law.nyu.edu/whether-and-how-the-u-s-government-should-exercise-its-compulsory-licensing-authority-under-28-u-s-c-1498-and-the-bayh-dole-act/)
- [Bayh-Dole Act - Wikipedia](https://en.wikipedia.org/wiki/Bayh%E2%80%93Dole_Act)
- [Government Patent Use - Wikipedia](https://en.wikipedia.org/wiki/Government_patent_use_(United_States))
- [March-In Rights and Pricing - CRS](https://www.congress.gov/crs-product/IF12582)

---

## Research Date
2026-01-26
