# Copyright Duration and Fair Use Doctrine

## Research Question
How is copyright duration calculated for different work types? What are the nuances of the fair use doctrine?

## Current Model Gap
The current `Copyright` entity has:
- `workType` - but duration isn't calculated based on it
- `authors[]` with `isWorkForHire` - but not using this for term calculation
- No concept of anonymous/pseudonymous works affecting duration
- **No fair use modeling at all** (completely missing)

---

## Key Findings

### Part 1: Copyright Duration Calculation

Duration depends on **when** the work was created and **who** created it.

#### Works Created After January 1, 1978

| Authorship Type | Duration |
|-----------------|----------|
| Single known author | **Life + 70 years** |
| Joint authors (known) | **Life of last survivor + 70 years** |
| Work made for hire | **95 years from publication** OR **120 years from creation** (whichever is shorter) |
| Anonymous work | **95 years from publication** OR **120 years from creation** |
| Pseudonymous work | **95 years from publication** OR **120 years from creation** |

#### Key Nuances

**Joint Works**:
- Must be two or more authors who **intended** to create a joint work
- Term measured from death of **last surviving** author
- Need to track death dates of ALL authors

**Work for Hire**:
- Employer is considered the "author" legally
- No individual life to measure against
- Two possible end dates - use whichever comes **first**

**Anonymous/Pseudonymous Special Rule**:
- If author's identity is **revealed** in Copyright Office records before term expires
- Term converts to **life + 70** based on actual author
- Creates incentive to register and reveal authorship

**Presumption of Death**:
- After 95 years from publication (or 120 from creation)
- Can get Copyright Office certification that author presumed dead
- Good faith reliance = complete defense to infringement

### Duration Calculation Examples

```
Single Author Created 2024, Dies 2080:
  Duration = 2080 + 70 = expires 2150

Joint Authors Created 2024, Author A Dies 2070, Author B Dies 2090:
  Duration = 2090 + 70 = expires 2160

Work for Hire Created 2024, Published 2025:
  Option 1: 2025 + 95 = 2120
  Option 2: 2024 + 120 = 2144
  Duration = earlier = expires 2120

Anonymous Work Created 2024, Published 2026:
  Default: min(2026+95, 2024+120) = 2121
  If identity revealed: life + 70 of revealed author
```

---

### Part 2: Fair Use Doctrine

Fair use is an **affirmative defense** to copyright infringement - meaning:
1. You admit you used the work
2. You argue it was permissible
3. **Burden is on YOU** to prove fair use

#### The Four Factors (17 U.S.C. § 107)

All four must be weighed together. No single factor is dispositive.

**Factor 1: Purpose and Character of Use** ⭐ (Most Important)
- Commercial vs nonprofit/educational
- **Transformative use** - adds new meaning/expression
- Criticism, commentary, parody favored
- Recent: Warhol v. Goldsmith (2023) - must truly transform, not just add style

**Factor 2: Nature of Copyrighted Work** (Least Important)
- Factual works → more fair use latitude
- Creative/artistic works → less fair use latitude
- Published vs unpublished (unpublished gets more protection)

**Factor 3: Amount and Substantiality Used**
- Quantitative: How much of the work?
- Qualitative: Did you take the "heart" of the work?
- Small amounts generally favor fair use
- But taking the "best part" can negate this

**Factor 4: Market Effect** ⭐ (Most Important)
- Does use substitute for the original?
- Does it harm potential licensing markets?
- Would widespread similar use cause harm?

#### Transformative Use (Critical Concept)

Post-Campbell v. Acuff-Rose (1994), **transformative use** became central:

| Transformative | Not Transformative |
|----------------|-------------------|
| Parody | Verbatim copying |
| Commentary/criticism | Different format, same purpose |
| Search engine thumbnails | Competing product |
| AI training (some cases) | Style transfer without new meaning |

**Recent Cases**:
- *Warhol v. Goldsmith* (2023): Warhol's Prince silkscreens NOT transformative - same licensing purpose
- *Thomson Reuters v. Ross* (2024): AI training not fair use
- *Bartz v. Anthropic* (2025): Generative AI training was "spectacularly transformative"

**USCO 2025 Report**: Skeptical that ALL AI training is fair use, especially when:
- Commercial purpose
- Outputs compete with originals
- "AI learning ≠ human learning"

---

## Domain Model Implications

### Missing Concepts for Duration
1. **Author death dates**: Needed for life+70 calculation
2. **Work type classification**: Work for hire vs standard
3. **Publication date** vs **creation date**: Both matter
4. **Identity revelation tracking**: For anonymous/pseudonymous
5. **Calculated expiration date**: Derived from above

### Missing Concepts for Fair Use
The current model has **no fair use framework**. Consider:
1. **License exceptions/permissions**: Beyond formal licenses
2. **Use justifications**: Documentation of fair use reliance
3. **Risk assessment**: For uses that may be challenged

### Suggested Schema Additions
```typescript
interface CopyrightProps {
  // ... existing
  
  // Duration calculation inputs
  authorshipType: 'individual' | 'joint' | 'work_for_hire' | 'anonymous' | 'pseudonymous';
  authorDeathDates?: AuthorDeathRecord[];  // For life+70 calculation
  identityRevealedDate?: Date;              // For anon/pseud conversion
  
  // Calculated
  calculatedExpirationDate?: Date;
  durationBasis: 'life_plus_70' | '95_from_pub' | '120_from_creation' | 'revealed_author';
}

interface AuthorDeathRecord {
  authorName: string;
  deathDate?: Date;       // null if still living
  isLastSurvivor?: boolean;
}

// Fair use is typically not modeled in the IP itself,
// but in usage/license context
interface FairUseAssessment {
  copyrightId: string;
  useDescription: string;
  assessmentDate: Date;
  
  // Four factors analysis
  factor1_purpose: {
    score: 'favors_fair_use' | 'neutral' | 'against_fair_use';
    isTransformative: boolean;
    isCommercial: boolean;
    notes: string;
  };
  factor2_nature: {
    score: 'favors_fair_use' | 'neutral' | 'against_fair_use';
    isFactual: boolean;
    isPublished: boolean;
    notes: string;
  };
  factor3_amount: {
    score: 'favors_fair_use' | 'neutral' | 'against_fair_use';
    percentageUsed?: number;
    usedHeartOfWork: boolean;
    notes: string;
  };
  factor4_market: {
    score: 'favors_fair_use' | 'neutral' | 'against_fair_use';
    substitutesForOriginal: boolean;
    harmsLicensingMarket: boolean;
    notes: string;
  };
  
  overallAssessment: 'likely_fair_use' | 'uncertain' | 'likely_not_fair_use';
  legalReviewDate?: Date;
  legalReviewer?: string;
}
```

---

## Sources
- [17 U.S.C. § 302 - Copyright Duration](https://www.law.cornell.edu/uscode/text/17/302)
- [Copyright Duration - BitLaw](https://bitlaw.com/copyright/duration.html)
- [Copyright Office - Duration FAQ](https://www.copyright.gov/help/faq/faq-duration.html)
- [Copyright Office - Fair Use Index](https://www.copyright.gov/fair-use/)
- [Stanford - Four Factors of Fair Use](https://fairuse.stanford.edu/overview/fair-use/four-factors/)
- [Fair Use - Wikipedia](https://en.wikipedia.org/wiki/Fair_use)
- [Copyright Alliance - How Long Does Copyright Last](https://copyrightalliance.org/faqs/how-long-does-copyright-last/)

---

## Research Date
2026-01-26
