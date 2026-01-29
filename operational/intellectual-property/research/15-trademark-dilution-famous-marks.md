# Trademark Dilution: Protection for Famous Marks

## Research Question
What is trademark dilution? How does it differ from trademark infringement? What are blurring and tarnishment? What makes a mark "famous"?

## Current Model Gap
The current `Trademark` entity focuses on registration and use but:
- No "famous mark" designation or tracking
- No dilution risk assessment
- No blurring/tarnishment monitoring
- No integration with enforcement for dilution claims

---

## Key Findings

### Dilution vs. Infringement

| Aspect | Traditional Infringement | Dilution |
|--------|-------------------------|----------|
| **Legal basis** | 15 U.S.C. § 1114 (registered) / § 1125(a) (unregistered) | 15 U.S.C. § 1125(c) |
| **Requires** | Likelihood of confusion | NO confusion required |
| **Applies to** | Any valid trademark | **Famous marks only** |
| **Harm addressed** | Consumer confusion | Weakening of mark's distinctiveness |
| **Competition** | Usually competitors | Can be unrelated goods/services |

### What is Dilution?

**Trademark dilution** occurs when use of a similar mark **weakens** the distinctive quality of a famous mark, even without any confusion or competition.

> "The owner of a famous mark... shall be entitled to an injunction against another person who... commences use of a mark... that is likely to cause dilution by blurring or dilution by tarnishment of the famous mark, **regardless of the presence or absence of actual or likely confusion, of competition, or of actual economic injury.**"
> — 15 U.S.C. § 1125(c)

### Two Types of Dilution

#### 1. Dilution by Blurring

**Definition**: Association arising from similarity that **impairs the distinctiveness** of the famous mark.

**What it looks like**:
- KODAK pianos
- ROLLS ROYCE cafes
- GOOGLE dry cleaners

Even without confusion, these uses would "blur" the connection between the famous mark and its source.

**Blurring Factors** (15 U.S.C. § 1125(c)(2)(B)):
1. Degree of similarity between marks
2. Degree of distinctiveness of famous mark
3. Extent of exclusive use by famous mark owner
4. Degree of recognition of famous mark
5. Intent to create association with famous mark
6. Actual association between marks

#### 2. Dilution by Tarnishment

**Definition**: Association arising from similarity that **harms the reputation** of the famous mark.

**What it looks like**:
- Famous mark used in connection with:
  - Poor quality products
  - Unwholesome products/services
  - Sexual or obscene contexts
  - Illegal activities

**Classic Example**: "Enjoy Cocaine" in Coca-Cola script style → tarnishes COCA-COLA's reputation

### What Makes a Mark "Famous"?

The TDRA (2006) raised the bar significantly:

> "A mark is famous if it is **widely recognized by the general consuming public of the United States** as a designation of source of the goods or services of the mark's owner."

**Key Points**:
- Must be recognized by **general public**, not just niche market
- Nationwide recognition required
- Very few marks qualify

**Factors for Fame** (15 U.S.C. § 1125(c)(2)(A)):
1. Duration, extent, geographic reach of advertising/publicity
2. Amount, volume, geographic extent of sales
3. Extent of actual recognition
4. Federal registration status

**Examples of Famous Marks**:
- APPLE (computers)
- COCA-COLA
- GOOGLE
- NIKE
- DISNEY
- McDONALD'S
- STARBUCKS

**NOT Famous** (likely):
- Regional brands
- Industry-specific marks
- Emerging brands without nationwide recognition

### The TDRA (2006) Changes

The **Trademark Dilution Revision Act** of 2006 responded to *Moseley v. V Secret Catalogue* (2003):

| Before TDRA | After TDRA |
|-------------|------------|
| Required proof of **actual dilution** | Only requires **likelihood of dilution** |
| Lower bar for "famous" | Higher bar - must be famous to **general public** |
| Unclear blurring/tarnishment standards | Codified factors for each |

**Net effect**: Stronger right, but only for truly famous (mega) brands.

### Defenses to Dilution Claims

**Statutory Defenses** (15 U.S.C. § 1125(c)(3)):

1. **Fair use** (not as source designation):
   - Advertising/promotion to compare goods
   - Identifying/parodying the mark owner
   - Commentary or criticism

2. **News reporting and commentary**

3. **Noncommercial use**

**Parody Defense**:
- Protected when used for commentary/criticism
- NOT protected when used primarily to sell goods
- Line is often blurry

### Elements for Dilution Claim

To succeed on a federal dilution claim:

1. **Plaintiff owns famous, distinctive mark**
   - Inherently distinctive OR acquired distinctiveness
   - Famous to general consuming public

2. **Defendant used mark in commerce**
   - As a mark or trade name
   - After plaintiff's mark became famous

3. **Similarity** between marks

4. **Likelihood of dilution** (blurring or tarnishment)

### State Dilution Laws

Many states have their own dilution statutes:
- Often have **lower fame threshold** than federal
- May protect marks famous only in that state
- Can provide additional remedies
- No uniformity across states

### Strategic Considerations for Famous Mark Owners

1. **Document fame continuously**
   - Advertising spend and reach
   - Sales volume and geography
   - Survey evidence of recognition
   - Media coverage

2. **Monitor broadly**
   - Watch for uses in ANY product category
   - Don't limit to competitors

3. **Enforce consistently**
   - Failure to enforce can suggest acquiescence
   - Document enforcement history

4. **Consider both claims**
   - Infringement (if confusion exists)
   - Dilution (if mark is famous)

---

## Domain Model Implications

### Enhanced Trademark Entity

```typescript
interface TrademarkProps {
  // ... existing

  // Fame status
  fameStatus?: FameAssessment;

  // Dilution monitoring
  dilutionMonitoring?: DilutionMonitoringConfig;
}

interface FameAssessment {
  isFamousNationally: boolean;
  isFamousRegionally: boolean;
  fameJurisdictions?: string[];     // States if regional

  // Evidence of fame
  lastAssessmentDate: Date;
  advertisingSpendAnnual?: number;
  advertisingReach?: string;        // Geographic/demographic
  annualSalesVolume?: number;
  mediaReferences?: number;         // Press mentions
  surveyEvidence?: SurveyEvidence;

  // Strength indicators
  distinctivenessType: 'inherent' | 'acquired';
  yearsOfExclusiveUse: number;
  registrationDate: Date;

  assessmentNotes?: string;
}

interface SurveyEvidence {
  surveyDate: Date;
  surveyType: 'recognition' | 'association' | 'likelihood_of_confusion';
  recognitionPercentage?: number;   // % who recognize mark
  conductedBy: string;
  documentId?: string;
}
```

### New Entity: DilutionIncident

```typescript
interface DilutionIncident {
  id: string;
  famousMarkId: string;           // Our famous mark

  // Offending use
  offendingMarkDescription: string;
  offendingMarkImage?: string;
  offenderName: string;
  offenderGoodsServices: string;

  // Discovery
  discoveredDate: Date;
  discoveryMethod: 'watch_service' | 'internal_monitoring' | 'third_party_report' | 'other';

  // Analysis
  dilutionType: 'blurring' | 'tarnishment' | 'both';
  similarityLevel: 'high' | 'medium' | 'low';
  tarnishmentBasis?: string;       // If tarnishment: poor quality, unwholesome, etc.

  // Risk assessment
  riskLevel: 'high' | 'medium' | 'low';
  riskFactors: string[];

  // Response
  responseAction?: 'cease_desist' | 'litigation' | 'license' | 'monitor' | 'no_action';
  responseDate?: Date;
  caseId?: string;                 // Link to enforcement case

  // Outcome
  outcome?: 'resolved_favorably' | 'ongoing' | 'settled' | 'lost' | 'abandoned';
  outcomeDate?: Date;
  outcomeNotes?: string;
}
```

### Integration Points

- **Watch services**: Monitor for diluting uses beyond confusingly similar marks
- **Enforcement**: Different cause of action workflow for dilution vs. infringement
- **Fame documentation**: Regular updates to support future dilution claims

---

## Sources
- [15 U.S.C. § 1125 - Lanham Act](https://www.law.cornell.edu/uscode/text/15/1125)
- [Trademark Dilution - LII/Cornell](https://www.law.cornell.edu/wex/dilution_(trademark))
- [Trademark Dilution - BitLaw](https://www.bitlaw.com/trademark/dilution.html)
- [Blurring and Tarnishment - Nolo](https://www.nolo.com/legal-encyclopedia/what-trademark-dilution.html)
- [Trademark Infringement Causes of Action - Joe Ingram Law](https://joeingramlaw.com/articles/2025/march/trademark-infringement-causes-of-action-under-the-lanham-act/)
- [Trademark Dilution Analysis - Cohn Legal](https://www.cohnlg.com/trademark-dilution-a-comprehensive-analysis/)
- [Duke IP Casebook - Dilution Chapter](https://web.law.duke.edu/cspd/casebook/ch09/)

---

## Research Date
2026-01-27
