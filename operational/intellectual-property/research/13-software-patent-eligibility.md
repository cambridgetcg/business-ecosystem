# Software Patent Eligibility: Alice/Mayo Framework

## Research Question
What is the Alice/Mayo framework for patent eligibility? How does Section 101 affect software and AI patents? What are the latest developments and strategies for overcoming 101 rejections?

## Current Model Gap
The current `Patent` entity has no concept of:
- Subject matter eligibility status
- 101 rejection history
- Alice/Mayo step analysis
- Technical improvement documentation for eligibility arguments

---

## Key Findings

### The Eligibility Problem

**35 U.S.C. Section 101** defines patentable subject matter:
> "Whoever invents or discovers any new and useful **process, machine, manufacture, or composition of matter**, or any new and useful improvement thereof, may obtain a patent therefor..."

**Judicial Exceptions** (not patentable despite meeting 101 categories):
1. **Laws of nature**
2. **Natural phenomena**
3. **Abstract ideas** ← Most relevant for software

### The Alice/Mayo Two-Step Framework

After *Alice Corp. v. CLS Bank* (2014) and *Mayo v. Prometheus* (2012):

```
STEP 1: Is the claim "directed to" a judicial exception?
        │
        ├── NO  → Patent eligible (stop)
        │
        └── YES → Go to Step 2
                  │
                  ▼
STEP 2: Does the claim contain an "inventive concept"
        that transforms it into patent-eligible subject matter?
        │
        ├── YES → Patent eligible
        │
        └── NO  → NOT patent eligible (abstract idea)
```

### Step 1: "Directed To" Analysis

Claims are "directed to" an abstract idea if they:
- Recite a fundamental economic practice
- Describe methods of organizing human activity
- Constitute mathematical concepts/algorithms
- Involve mental processes performable in the human mind

**Abstract Idea Categories**:
| Category | Examples |
|----------|----------|
| Economic practices | Risk hedging, advertising, pricing |
| Human activity | Voting, dating matching, scheduling |
| Mathematical | Algorithms, formulas, calculations |
| Mental processes | Evaluation, judgment, comparison |

### Step 2: "Inventive Concept" (Something More)

Even if directed to abstract idea, claim is eligible if it adds "significantly more":

**What IS an inventive concept**:
- Improvement to computer functionality itself
- Improvement to another technology or technical field
- Specific, unconventional technical solution
- Particular machine or transformation

**What is NOT an inventive concept**:
- Generic computer implementation ("apply it")
- Conventional, well-understood activity
- Insignificant post-solution activity
- Simply adding "on a computer"

### August 2025 USPTO Memorandum

**Key Changes**:
1. Examiners must avoid labeling AI tasks as "mental processes" unless a human could **realistically** perform them with pen and paper
2. Distinguish between claims that **recite** an abstract idea vs. **involve** one
3. Consider whether invention contributes **practical application** or **technological improvement**

**Impact**: More nuanced analysis required; blanket 101 rejections discouraged for AI/ML claims.

### Recentive Analytics v. Fox Corp (April 2025)

Federal Circuit's **first major AI ruling** under Alice:

**Holding**: Patents on using ML to optimize TV broadcast schedules are **patent-ineligible**

**Reasoning**:
- Claims were directed to abstract idea of data analysis and scheduling
- Using "generic machine-learning models on conventional computing infrastructure" doesn't transform
- Improved accuracy/efficiency from using known ML models ≠ patent eligibility

**Key Lesson**: Claiming the *application* of generic ML to a known problem type is risky.

### November 2025 Policy Shift

USPTO rescinded portions of Biden-era AI guidance:
- AI treated as "tool only"
- No separate eligibility standard for AI-assisted inventions
- Focus on whether claims recite patentable subject matter regardless of AI involvement

### Strategies for Overcoming 101 Rejections

#### Claim Drafting Strategies

1. **Technical problem/solution**
   - Identify specific technical problem
   - Claim technical solution, not business result

2. **Concrete implementation**
   - Claim specific data structures
   - Recite particular processing steps
   - Include hardware elements where relevant

3. **Avoid functional language**
   - Describe HOW, not just WHAT
   - Avoid "means for" without technical detail

4. **Focus on computer improvement**
   - Processing speed improvement
   - Memory efficiency
   - Security enhancement
   - User interface improvement

#### Prosecution Strategies

1. **Detailed technical specification**
   - Explain technical architecture
   - Document benchmarks and improvements
   - Include system diagrams

2. **Distinguish prior art technically**
   - Show unconventional arrangement
   - Highlight technical advantages

3. **Cite favorable precedent**
   - Enfish (database improvement)
   - DDR Holdings (internet-specific solution)
   - McRO (automatic animation)
   - Core Wireless (improved GUI)

4. **Request interview**
   - Often more effective than written arguments
   - Explain technical nuances

### Example: Eligible vs. Ineligible AI Claims

**Likely Ineligible**:
> "A method of predicting customer behavior comprising: receiving customer data; applying a machine learning model to the data; outputting a prediction."

**More Likely Eligible**:
> "A computer-implemented method for improving neural network training efficiency comprising: implementing a novel gradient descent algorithm that reduces memory consumption by [specific technique]; dynamically adjusting batch sizes based on [specific criteria]; wherein training time is reduced by [measurable amount]."

### Legislative Efforts

**Patent Eligibility Restoration Act** (introduced multiple times):
- Would eliminate judicial exceptions
- Define subject matter eligibility in statute
- Limit 101 rejections
- **Status**: Not enacted as of 2026

Congress has been reluctant to act, leaving eligibility to courts and USPTO guidance.

---

## Domain Model Implications

### Enhanced Patent Entity for Eligibility Tracking

```typescript
interface PatentProps {
  // ... existing

  // Subject matter eligibility
  eligibilityStatus?: EligibilityStatus;
}

interface EligibilityStatus {
  // 101 rejection history
  received101Rejection: boolean;
  rejectionDate?: Date;
  rejectionBasis?: 'abstract_idea' | 'law_of_nature' | 'natural_phenomenon';
  abstractIdeaCategory?: 'economic' | 'human_activity' | 'mathematical' | 'mental_process';

  // Response strategy
  responseStrategy?: '101_arguments' | 'claim_amendment' | 'appeal' | 'rce';

  // Step 2 arguments
  inventiveConceptArguments?: string[];
  technicalImprovementsClaimed?: string[];

  // Outcome
  rejectionOvercome: boolean;
  overcomeBasis?: string;

  // Risk assessment (for pending/monitoring)
  eligibilityRisk?: 'high' | 'medium' | 'low';
  riskNotes?: string;
}

interface Section101RejectionHistory {
  patentId: string;
  rejectionId: string;

  // Rejection details
  officeActionDate: Date;
  rejectedClaims: number[];
  examinerCitation: string;       // Examiner's abstract idea characterization
  priorArtCitedForStep2?: string[];

  // Response
  responseDate?: Date;
  argumentsMade: string[];
  claimsAmended: boolean;
  amendmentDescription?: string;

  // Result
  outcome: 'maintained' | 'withdrawn' | 'appealed' | 'final_rejection';
  nextActionDate?: Date;
}
```

### Integration with Technology Classification

```typescript
interface TechnologyClassification {
  // Flag high-risk technology areas
  technologyArea: string;
  eligibilityRiskLevel: 'high' | 'medium' | 'low';

  // High-risk areas include:
  // - Business methods
  // - Financial technology
  // - Data processing
  // - Generic ML/AI applications
  // - Medical diagnostics (Mayo)

  // Lower-risk areas include:
  // - Hardware improvements
  // - Specific technical solutions
  // - Manufacturing processes
  // - Computer security
}
```

---

## Sources
- [USPTO August 2025 Memo on 101](https://www.uspto.gov/sites/default/files/documents/memo-101-20250804.pdf)
- [USPTO Raises Bar for 101 Rejections - Dykema](https://www.dykema.com/news-insights/uspto-raises-bar-for-101-rejections-in-ai-patents.html)
- [New USPTO Memo Analysis - IPWatchdog](https://ipwatchdog.com/2025/09/02/patent-eligibility-rejections-new-uspto-memo/)
- [Section 101 Reset for 2026 - Venable](https://www.venable.com/insights/publications/2025/12/the-101-reset-for-2026)
- [USPTO 2025 Software Patent Guidance - Martensen IP](https://www.martensenip.com/blog/2025/october/uspto-memo-2025-brings-breakthrough-for-software/)
- [Patent Eligibility Reform Overview - CRS](https://www.congress.gov/crs-product/IF12563)
- [Alice Step Two - BitLaw](https://www.bitlaw.com/guidance/patent/applying-step-two-of-Alice-Mayo-test.html)

---

## Research Date
2026-01-27
