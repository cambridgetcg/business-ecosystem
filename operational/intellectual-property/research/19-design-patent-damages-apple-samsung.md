# Design Patent Damages: Lessons from Apple v. Samsung

## Research Question
What did Apple v. Samsung teach us about design patent damages? How does the "article of manufacture" issue affect design patent valuation and strategy?

## Aha Moment That Sparked This
> "Design patents are fundamentally different creatures from utility patents - the Egyptian Goddess 'ordinary observer' test creates a visual similarity threshold that utility patents don't have."

The synthesis revealed that design patents need their own treatment, and Apple v. Samsung brought design patent damages into sharp focus.

---

## Key Findings

### The Apple v. Samsung Saga (2011-2018)

**Timeline**:
- 2011: Apple sues Samsung for patent infringement (both utility and design patents)
- 2012: Jury awards Apple $1.05 billion (later reduced)
- 2015: Federal Circuit upholds $399M design patent damages
- 2016: Supreme Court unanimously reverses, remands for "article of manufacture" determination
- 2017: Retrial on design patent damages
- 2018: Final settlement (confidential terms)

**The Core Legal Issue**:
- 35 U.S.C. § 289 allows recovery of "total profit" for design patent infringement
- Question: Total profit of *what*? The entire product or just the component?

### The Supreme Court's Samsung Electronics v. Apple Inc. (2016)

**Holding**: The "article of manufacture" for § 289 purposes can be the entire product sold OR a component of that product.

**Key Quote from Opinion**:
> "The term 'article of manufacture' is broad enough to encompass both a product sold to a consumer as well as a component of that product."

**What the Court Did NOT Do**:
- Did not provide a test for identifying the relevant article of manufacture
- Did not decide whether the article was the phone or just the case/screen
- Remanded for lower court to determine

### The "Article of Manufacture" Problem

**Before Samsung v. Apple**:
- Federal Circuit presumed total profits = profits on entire product
- Design patent on phone case → all profits from phone

**After Samsung v. Apple**:
- Must determine the "article of manufacture" to which the design applies
- Could be entire product, major component, or minor component
- Creates significant uncertainty in damages calculation

**The Practical Challenge**:

| Article Identified | Damages Basis | Apple's Potential Recovery |
|-------------------|---------------|---------------------------|
| Entire iPhone | $399 per phone × millions sold | Hundreds of millions |
| Phone case + screen | ~$100-150 component value | Significantly less |
| Screen alone | ~$50-75 component value | Much less |

### Factors Courts May Consider (Post-Samsung)

The Supreme Court left this to lower courts, but likely factors include:

1. **Scope of the design claim** - What does the design patent actually cover?
2. **Physical/conceptual identity** - Is the design a separate article or integral?
3. **Consumer perception** - What do consumers see as the "article"?
4. **Commercial realities** - How is the product manufactured and sold?

### Impact on Design Patent Strategy

**Pre-Samsung Approach**:
- File design patents on overall product appearance
- Maximum damages = total product profits
- Strong leverage in litigation

**Post-Samsung Approach**:
- Consider filing on components separately
- Design patents on "articles" sold separately may have clearer damages
- Need to analyze "article of manufacture" during prosecution

**Strategic Implications**:

| Strategy | Rationale |
|----------|-----------|
| File on separable components | Clearer article identification |
| File both product + component designs | Flexibility in litigation |
| Document design's contribution to sales | Support apportionment arguments |
| Consider design patent families | Cover different "articles" |

### The 2018 Settlement

Apple and Samsung settled their 7-year global patent war in June 2018. Terms were confidential.

**What We Know**:
- No public monetary figures
- Both sides likely compromised significantly
- Design patent damages uncertainty contributed to settlement pressure

**Lesson**: Even landmark Supreme Court victories don't guarantee favorable outcomes - the uncertainty the decision created may have pushed both parties toward settlement.

### Design Patent Damages Post-Samsung: The Uncertainty Era

**Current State (2026)**:
- No clear Federal Circuit test for "article of manufacture"
- Case-by-case determinations
- Increased focus on expert testimony about product architecture
- Greater emphasis on design patent claim drafting

**Emerging Approaches**:
1. **Physical separability test** - Can the component be physically separated?
2. **Consumer perception test** - What do consumers view as the "product"?
3. **Marketing emphasis test** - How is the design featured in marketing?
4. **Manufacturing independence test** - Is it made/sold separately elsewhere?

---

## Domain Model Implications

### Enhanced DesignPatentDetails

```typescript
interface DesignPatentDetails {
  // ... existing fields from doc 12

  // Article of manufacture analysis (damages-relevant)
  articleOfManufactureAnalysis?: ArticleOfManufactureAnalysis;
}

interface ArticleOfManufactureAnalysis {
  // What the design patent covers
  claimedDesignScope: string;           // Description of what design covers

  // Article identification
  potentialArticles: ArticleCandidate[];
  recommendedArticle?: string;
  analysisDate?: Date;

  // Supporting evidence
  physicalSeparability: boolean;
  soldSeparately: boolean;
  marketingEmphasis: 'product' | 'component' | 'feature';
  consumerPerceptionEvidence?: string;

  // Damages implications
  estimatedDamagesBasis?: {
    entireProduct: number;
    componentLevel: number;
    featureLevel: number;
  };
}

interface ArticleCandidate {
  name: string;                         // e.g., "smartphone", "phone case", "screen"
  level: 'entire_product' | 'major_component' | 'minor_component' | 'feature';
  estimatedValue: number;
  supportingFactors: string[];
  weaknesses: string[];
}
```

### New Entity: DesignPatentLitigation

```typescript
interface DesignPatentLitigation {
  id: string;
  designPatentId: string;

  // Case details
  caseNumber: string;
  court: string;
  filingDate: Date;
  status: 'pending' | 'settled' | 'decided';

  // Parties
  plaintiff: string;
  defendant: string;

  // Article of manufacture determination
  articleDetermination?: {
    claimedByPlaintiff: string;
    claimedByDefendant: string;
    courtDetermination?: string;
    determinationBasis?: string;
  };

  // Damages
  damagesClaimed?: number;
  damagesAwarded?: number;
  damagesBasis?: 'total_profits' | 'apportioned' | 'reasonable_royalty';

  // Outcome
  outcome?: 'plaintiff_victory' | 'defendant_victory' | 'settlement' | 'dismissed';
  settlementTerms?: string;           // Usually confidential

  // Lessons learned
  strategicInsights?: string[];
}
```

---

## Strategic Recommendations

1. **Claim drafting** - Consider how design claims will define the "article"
2. **Family strategy** - File on both products and separable components
3. **Evidence preservation** - Document design's contribution to product value
4. **Expert development** - Build relationships with damages experts
5. **Settlement calculus** - Factor in article uncertainty in litigation decisions
6. **Portfolio review** - Assess existing design patents for damages vulnerability

---

## The Broader Lesson

Apple v. Samsung demonstrates that **winning the legal battle doesn't guarantee winning the war**. Even after a Supreme Court victory, the uncertainty created by the remand may have ultimately reduced Apple's leverage.

For IP strategy, this teaches:
- Legal precedent is only part of the value equation
- Uncertainty can be weaponized by defendants
- Settlement economics often trump courtroom victories
- Design patent prosecution should anticipate litigation

---

## Sources

- [Samsung Electronics v. Apple Inc., 580 U.S. ___ (2016)](https://supreme.justia.com/cases/federal/us/580/15-777/)
- [Apple v. Samsung Settlement - Reuters](https://www.reuters.com/article/us-apple-samsung-settlement-idUSKCN1J327L)
- [Design Patent Damages After Samsung - WIPO Magazine](https://www.wipo.int/wipo_magazine/en/2017/02/article_0006.html)
- [Article of Manufacture Analysis - IPWatchdog](https://www.ipwatchdog.com/design-patent-damages/)
- [Federal Circuit Design Patent Cases - Patently-O](https://patentlyo.com/patent/design-patents)

---

## Research Date
2026-01-27
