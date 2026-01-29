# Design Patents: Protection and Infringement

## Research Question
How do design patents differ from utility patents? What is the "ordinary observer" test from Egyptian Goddess? How has design patent protection evolved?

## Current Model Gap
The current `Patent` entity has `patentType: 'utility' | 'design' | 'plant'` but:
- No design-specific attributes (ornamental features, drawings)
- No understanding of different infringement tests
- No tracking of design patent portfolio strategy
- Same prosecution workflow assumed for all types

---

## Key Findings

### Design vs. Utility Patents

| Aspect | Utility Patent | Design Patent |
|--------|---------------|---------------|
| **Protects** | How it works (function) | How it looks (appearance) |
| **Claim format** | Written claims | Single claim: "ornamental design for [article]" |
| **Drawings** | Illustrate; words control | **Drawings ARE the claim** |
| **Term** | 20 years from filing | **15 years from grant** (no maintenance fees) |
| **Maintenance fees** | Required at 3.5, 7.5, 11.5 years | **None** |
| **Infringement test** | Claim construction + literal/DOE | Ordinary observer test |
| **Prosecution time** | 2-4 years average | 1-2 years average |
| **Cost** | $10,000-$20,000+ | $2,000-$5,000 |

### What Design Patents Protect

Design patents protect the **ornamental appearance** of an article of manufacture:
- Shape and configuration
- Surface ornamentation
- Combination of both

**NOT protected**:
- Functional features (must use utility patent)
- Color alone (unless part of surface ornamentation)
- Dictated-by-function aspects

### The Egyptian Goddess Decision (2008)

**Egyptian Goddess, Inc. v. Swisa, Inc.** fundamentally changed design patent infringement analysis.

#### Before Egyptian Goddess (Two Tests)
1. **Ordinary Observer Test**: Would an ordinary observer be deceived?
2. **Point of Novelty Test**: Does accused design appropriate the "novel" features?

Both tests had to be satisfied for infringement.

#### After Egyptian Goddess (Single Test)
Only the **Ordinary Observer Test** applies, but informed by prior art:

> "If, in the eye of an ordinary observer, giving such attention as a purchaser usually gives, two designs are substantially the same, if the resemblance is such as to deceive such an observer, inducing him to purchase one supposing it to be the other, the first one patented is infringed by the other."

**Key refinement**: The ordinary observer now views differences **"in the context of the prior art."**

### How the Test Works Today

```
Step 1: Identify the claimed design (from drawings)
        ↓
Step 2: Identify the accused design
        ↓
Step 3: Consider relevant prior art
        ↓
Step 4: Through eyes of ordinary observer familiar with prior art:
        "Are the designs substantially the same such that
         the observer would be deceived?"
        ↓
        If YES → Infringement
        If NO  → No infringement
```

### Role of Prior Art

Prior art matters because it helps identify what makes the patented design **distinctive**:
- Close prior art → small differences matter more
- Distant prior art → focus on overall impression

**Burden**: Accused infringer must produce relevant prior art to narrow the comparison.

### Impact of Egyptian Goddess

**Expected effect**: Broader protection (eliminated point of novelty hurdle)

**Actual effect**: Mixed results
- Some courts still focus on "novel" features informally
- Overall impression analysis can favor either party
- District court outcomes haven't dramatically shifted

### Strategic Considerations

#### When to File Design Patents
- Consumer products where appearance drives purchase
- User interfaces (icons, GUI elements)
- Packaging and containers
- Fashion and accessories
- Automotive styling
- Furniture and housewares

#### Design Patent vs. Trade Dress
| Factor | Design Patent | Trade Dress |
|--------|--------------|-------------|
| Duration | 15 years fixed | Potentially unlimited |
| Requirements | Novel, ornamental | Distinctive, non-functional |
| Registration | Required | Optional (helps prove validity) |
| Strength | Presumption of validity | Must prove secondary meaning (usually) |

#### Design Patent Portfolio Strategy
1. **File early** - Before public disclosure (1-year grace period in US)
2. **Multiple designs** - Variations protect broader space
3. **Continuation practice** - File design continuations for variations
4. **Global protection** - Hague System for international filing
5. **Complement utility** - Both types for comprehensive protection

### 2015 Design Term Change

For applications filed **after May 13, 2015**:
- Term is **15 years from grant** (was 14 years)
- Aligned with Hague Agreement
- No maintenance fees (unchanged)

### Hague System for International Design Filing

Similar to PCT for utility patents, the Hague System allows:
- Single application to WIPO
- Designate multiple countries
- Streamlined international protection

**US joined in 2015**, enabling international design applications designating US.

### Design Patent Prosecution Tips

1. **Drawings are everything** - Solid lines define claim; broken lines show context
2. **Multiple views** - Show all aspects; what's not shown isn't claimed
3. **Minimal description** - Brief; let drawings speak
4. **Claim language** - "The ornamental design for [article] as shown"
5. **Continuation strategy** - File variations before grant

---

## Domain Model Implications

### Enhanced Patent Entity for Designs

```typescript
interface PatentProps {
  // ... existing
  patentType: 'utility' | 'design' | 'plant';

  // Design-specific (when patentType === 'design')
  designDetails?: DesignPatentDetails;
}

interface DesignPatentDetails {
  // Article of manufacture
  articleOfManufacture: string;    // "mobile phone", "chair", "icon"

  // What's claimed
  claimedFeatures: 'configuration' | 'surface_ornamentation' | 'both';
  featureDescription?: string;

  // Drawings
  drawingCount: number;
  viewTypes: ('front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'perspective')[];

  // Prosecution
  restrictionRequirement: boolean; // Multiple designs identified
  electedEmbodiment?: string;

  // Hague (international)
  hagueRegistrationNumber?: string;
  hagueDesignatedCountries?: string[];

  // Related designs
  relatedDesignPatentIds?: string[];  // Variations
  relatedUtilityPatentId?: string;    // Complementary utility patent
}
```

### Missing Entity: DesignInfringementAnalysis

```typescript
interface DesignInfringementAnalysis {
  id: string;
  designPatentId: string;
  accusedProductDescription: string;

  // Claim comparison
  claimedDesignDescription: string;
  accusedDesignDescription: string;

  // Prior art context
  relevantPriorArt: PriorArtReference[];
  priorArtCloseness: 'close' | 'moderate' | 'distant';

  // Ordinary observer analysis
  overallImpressionSimilar: boolean;
  keyDifferences: string[];
  keySimilarities: string[];

  // Conclusion
  infringementLikelihood: 'likely' | 'possible' | 'unlikely';
  confidenceLevel: 'high' | 'medium' | 'low';
  analysisNotes: string;

  // Preparer
  analysisDate: Date;
  preparedBy: string;
}
```

---

## Sources
- [Egyptian Goddess Test - Plus IP Firm](https://plusfirm.com/determining-design-patent-infringement-the-egyptian-goddess-test/)
- [Design Patent Litigation Post-Egyptian Goddess - Banner Witcoff](https://bannerwitcoff.com/_docs/library/articles/Design%20Patent%20Litigation%20and%20Procurement%20Post-Egyptian%20Goddess.pdf)
- [Analysis Post-Egyptian Goddess - MBHB](https://www.mbhb.com/intelligence/snippets/the-analysis-for-design-patent-infringement-post-egyptian-goddess/)
- [Design Patents Post Egyptian Goddess - Nutter](https://www.nutter.com/ip-law-bulletin/design-patents-post-egyptian-goddess)
- [Five Years Later - Finnegan](https://www.finnegan.com/en/insights/articles/five-years-later-did-egyptian-goddess-live-up-to-the-hype.html)
- [Ordinary Observer Test - HJKW Law](https://www.hjkwlaw.com/post/design-patent-infringement-the-ordinary-observer-test)

---

## Research Date
2026-01-27
