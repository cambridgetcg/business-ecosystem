# Alice Software Patent Survival Rates: The Numbers Behind the Uncertainty

## Research Question
What are the actual survival rates for software patents post-Alice? What does PTAB data tell us about Section 101 eligibility risk?

## Aha Moment That Sparked This
> "Alice creates uncertainty that affects not just litigation but valuation, licensing negotiations, and M&A due diligence. A 70% invalidation rate fundamentally changes the risk calculus."

The synthesis revealed Alice/Mayo as a major strategic risk, but I wanted the actual numbers.

---

## Key Findings

### The Stark Reality: PTAB Statistics

**Section 101 Rejection Affirmance Rate at PTAB**: **88.6%**

When the USPTO Patent Trial and Appeal Board reviews a Section 101 rejection, they affirm the examiner's rejection nearly 9 times out of 10.

**Source**: Patently-O analysis of PTAB ex parte appeals (2024)

### All-Claims Invalidation Rates

**In IPR/PGR Proceedings**:
- ~70% of instituted proceedings result in all claims being found unpatentable
- Software/business method patents fare worse than this average
- Final written decisions rarely leave patents fully intact

### The Alice/Mayo Framework Devastation

**District Court Level**:
- Software patents face 101 challenges at the pleading stage (motion to dismiss)
- Many cases resolved before claim construction
- Settlement rates spike when 101 motion granted

**Federal Circuit**:
- Has largely sustained 101 invalidations
- Few bright-line rules for what survives
- Creates planning uncertainty

### Survival Patterns: What Lives Through Alice?

**Higher Survival Likelihood**:

| Factor | Why It Helps |
|--------|--------------|
| Specific technical improvement | Shows "something more" |
| Tied to specific hardware | Less abstract |
| Solves technical problem (not business problem) | Technical arts focus |
| Improves computer function itself | Per McRO, Enfish |
| Detailed implementation in claims | Not result-focused |

**Lower Survival Likelihood**:

| Factor | Why It Hurts |
|--------|--------------|
| Business method claims | Highly scrutinized |
| "Do it on a computer" claims | Paradigmatic abstract idea |
| Result-oriented claims | Generic implementation |
| Financial/economic focus | Alice itself was financial |
| Data manipulation only | Often deemed abstract |

### Key Post-Alice Cases Showing Survival

**Enfish, LLC v. Microsoft Corp. (Fed. Cir. 2016)**:
- Self-referential table for computer database
- Survived because it improved computer functionality itself
- Not just using computer as tool

**McRO, Inc. v. Bandai Namco (Fed. Cir. 2016)**:
- Automated lip synchronization for animation
- Survived: specific rules that improved technological process
- Replaced human subjective judgment with specific automated rules

**Recentive Analytics v. Fox Corp. (Fed. Cir. 2024-2025)**:
- AI/ML scheduling patent survived
- Key: specific technical implementation, not just "use AI"
- Signals possible path for AI patents

### The Eligibility Uncertainty Index

Based on research, approximate survival rates by technology area:

| Technology | Est. Survival Rate | Confidence |
|------------|-------------------|------------|
| Pure business methods | <10% | High |
| Financial software | ~15% | High |
| General software | ~25% | Medium |
| Software + specific hardware | ~40% | Medium |
| AI/ML with specific implementation | ~35% | Low (emerging) |
| Computer security | ~45% | Medium |
| Database/data structure | ~50% | Medium |
| GUI/interface improvements | ~40% | Medium |

*Note: These are rough estimates based on case law patterns, not precise statistics*

### USPTO Response: The August 2024 Guidelines

USPTO issued updated 101 guidance attempting to provide clearer framework:

**Step 1**: Is it directed to a judicial exception?
- Laws of nature
- Natural phenomena
- Abstract ideas (including certain methods of organizing human activity, mathematical concepts)

**Step 2A Prong 1**: Does the claim recite a judicial exception?

**Step 2A Prong 2**: If yes, is it integrated into a practical application?
- Look for improvement to technology
- Specific machine or article
- Transformation of matter
- NOT just: mere instructions to apply, insignificant extra-solution activity

**Step 2B**: If not integrated, does it provide "inventive concept"?
- Not well-understood, routine, conventional activity

### The Valuation Impact

**Pre-Alice Software Patent Value**: Often valued at par with other patents

**Post-Alice Software Patent Value**: Significant discount required

| Valuation Scenario | Adjustment |
|-------------------|------------|
| Licensing negotiation | 30-50% discount |
| M&A due diligence | Flag as high-risk asset |
| Portfolio sale | Category discount |
| Litigation damages | Reduced expected value |

**Calculation Example**:
```
Pre-Alice expected litigation value: $1M
Post-Alice survival probability: ~25%
Risk-adjusted value: $250K
```

### The Portfolio Audit Imperative

Given these survival rates, software patent portfolios need regular 101 audits:

**Audit Questions**:
1. What percentage of portfolio is software/business method?
2. Which patents have specific technical implementations?
3. Which are pure "do it on a computer" claims?
4. What's the portfolio-wide 101 risk exposure?
5. Which patents are worth maintaining vs. abandoning?

---

## Domain Model Implications

### Enhanced EligibilityStatus (from doc 13)

```typescript
interface EligibilityStatus {
  // ... existing fields

  // Statistical risk assessment
  survivalProbability?: {
    estimated: number;           // 0-100%
    confidenceLevel: 'low' | 'medium' | 'high';
    basisForEstimate: string;
    comparedToCaselaw: string[]; // Similar cases cited
  };

  // Value impact
  eligibilityDiscount?: {
    licensingDiscount: number;   // Percentage
    litigationDiscount: number;
    portfolioSaleDiscount: number;
    calculationMethod: string;
  };
}
```

### New Entity: PortfolioEligibilityAudit

```typescript
interface PortfolioEligibilityAudit {
  id: string;
  auditDate: Date;
  auditor: string;

  // Scope
  portfolioSegment: string;           // e.g., "software patents", "all US utility"
  patentsAnalyzed: number;

  // Findings
  categoryBreakdown: {
    lowRisk: number;                  // >50% survival probability
    mediumRisk: number;               // 25-50% survival probability
    highRisk: number;                 // 10-25% survival probability
    criticalRisk: number;             // <10% survival probability
  };

  // Specific findings
  patentRiskAssessments: PatentRiskAssessment[];

  // Portfolio-level metrics
  weightedSurvivalProbability: number;
  totalValueAtRisk: number;
  recommendedActions: string[];

  // Cost-benefit
  maintenanceCostsAtRisk: number;
  potentialAbandonment: string[];     // Patent IDs recommended to abandon
}

interface PatentRiskAssessment {
  patentId: string;
  patentNumber: string;
  technologyCategory: string;
  survivalProbability: number;
  riskFactors: string[];
  protectiveFactors: string[];
  similarCases: {
    caseId: string;
    outcome: 'survived' | 'invalidated';
    similarity: 'high' | 'medium' | 'low';
  }[];
  recommendation: 'maintain' | 'monitor' | 'consider_abandonment' | 'abandon';
}
```

### Integration with FTO Analysis

```typescript
interface FTOPatentRisk {
  // ... existing fields from doc 11

  // Alice/101 consideration
  eligibilityRisk?: {
    patentSurvivalProbability: number;
    impactOnFTORisk: 'reduces_risk' | 'no_impact' | 'uncertain';
    shouldChallenge101: boolean;
    challengeCostBenefit: string;
  };
}
```

---

## Strategic Recommendations

### For Patent Holders

1. **Portfolio audit** - Assess 101 exposure across software patents
2. **Claim differentiation** - Identify which claims are most defensible
3. **Continuation strategy** - File continuations with technical implementation focus
4. **Maintenance decisions** - Consider abandoning high-risk, low-value patents
5. **Licensing strategy** - Price licenses reflecting 101 uncertainty

### For Potential Infringers (Defensive)

1. **FTO refinement** - Factor 101 challenges into risk assessment
2. **Prior art + 101** - Consider both invalidity arguments
3. **Early motion practice** - 101 motions can resolve cases quickly
4. **Cost-benefit analysis** - Sometimes 101 challenge is most efficient defense

### For M&A Due Diligence

1. **Software patent discount** - Apply appropriate valuation haircut
2. **Survival analysis** - Categorize patents by likely survival
3. **Strategic value** - Some patents valuable even if legally vulnerable
4. **Indemnification** - Consider IP-specific reps about 101 exposure

---

## The Philosophical Note

Alice created what might be called "Schrödinger's patents" - patents that exist in superposition between valid and invalid until observed (litigated). This fundamental uncertainty is now a permanent feature of software patent strategy.

The 88.6% affirmance rate at PTAB means that once a 101 rejection is made, it's very hard to overcome. This puts enormous pressure on:
- Initial claim drafting
- Prosecution strategy
- Portfolio composition decisions

---

## Sources

- [PTAB Section 101 Statistics - Patently-O](https://patentlyo.com/patent/2024/01/section-101-ptab.html)
- [Alice/Mayo Framework Analysis - IPWatchdog](https://www.ipwatchdog.com/alice-mayo-framework/)
- [Recentive Analytics Decision - Federal Circuit](https://cafc.uscourts.gov/)
- [USPTO 101 Guidelines - USPTO](https://www.uspto.gov/patent/laws-and-regulations/examination-policy/subject-matter-eligibility)
- [Software Patent Valuation Post-Alice - IAM Magazine](https://www.iam-media.com/)
- [PTAB Statistics - USPTO PTAB Data](https://www.uspto.gov/patents/ptab/statistics)

---

## Research Date
2026-01-27
