# Patent Families and Continuation Practice

## Research Question
How do patent families work? What are the nuances of continuation, divisional, and CIP applications that the current domain model doesn't capture?

## Current Model Gap
The current `Patent` entity treats patents as isolated documents. It has no concept of:
- Parent-child relationships between applications
- Patent families spanning multiple applications
- Different priority dates for different claims within one application

---

## Key Findings

### Patent Family Definition
A **patent family** is a group of related patents that all trace back to the same priority application:
- **Simple families**: Linked by a single priority claim
- **Extended families**: All patents sharing at least one common priority

### Types of Continuing Applications

#### 1. Continuation Applications
- Contains **no new matter** - same specification as parent
- Claims only what was disclosed in parent
- **Preserves the parent's priority date** for all claims
- Filed while parent is still pending
- Must name at least one inventor from parent

**Use Case**: When examiner allows some claims but rejects others, or to pursue additional claim variations

#### 2. Divisional Applications
- **Carved out** of parent due to USPTO restriction requirement
- Claims a **distinct/independent invention** that was not elected in parent
- Also contains no new matter
- **Preserves parent's filing date**
- "True divisional" (filed in response to restriction) gets safe harbor from double patenting under 35 U.S.C. 121

**Use Case**: When USPTO issues restriction requirement saying application contains multiple inventions

#### 3. Continuation-in-Part (CIP) Applications
- **Adds new matter** not disclosed in parent
- Repeats substantial portion of parent specification
- **Split priority dates**:
  - Old content: gets parent's priority date
  - New content: gets CIP filing date
- Does NOT get 121 safe harbor protection
- Vulnerable to larger pool of prior art

**Use Case**: When invention has evolved and new features need protection

### Critical Requirements (All Types)
- Must be filed while parent is **still pending** (not issued or abandoned)
- Must claim priority to earlier application
- Must share at least one common inventor
- Per 35 U.S.C. 120 and 37 CFR 1.78

### 2025 Fee Changes (Important!)
New USPTO fees for continuing applications:
- **$2,700 extra** if filed >6 years after priority date
- **$4,000 extra** if filed >9 years after priority date
- May discourage late CIP filings - applicants may file new applications instead

---

## Domain Model Implications

### Missing Concepts
1. **Parent-child relationships** between Patent entities
2. **Family ID** to group related patents
3. **Continuing application type**: continuation | divisional | CIP
4. **Multiple priority dates** (for CIP claims)
5. **Restriction requirement** events and elections
6. **Safe harbor status** for true divisionals

### Suggested Schema Additions
```typescript
interface PatentFamily {
  familyId: string;
  priorityApplication: string; // original patent ID
  members: PatentFamilyMember[];
}

interface PatentFamilyMember {
  patentId: string;
  relationshipType: 'continuation' | 'divisional' | 'cip' | 'original';
  parentPatentId?: string;
  isTrueDivisional: boolean; // filed in response to restriction
  newMatterClaimNumbers?: number[]; // for CIP - which claims have later priority
}

// On Patent entity
interface PatentProps {
  // ... existing
  familyId?: string;
  parentPatentId?: string;
  continuationType?: 'continuation' | 'divisional' | 'cip';
  restrictionRequirementDate?: Date; // if divisional
}
```

---

## Sources
- [USPTO MPEP 201 - Types of Applications](https://www.uspto.gov/web/offices/pac/mpep/s201.html)
- [Continuing Patent Application - Wikipedia](https://en.wikipedia.org/wiki/Continuing_patent_application)
- [New USPTO Fee Rule 2025 - IPWatchdog](https://ipwatchdog.com/2025/01/08/new-uspto-fee-rule-continuing-applications-key-changes-strategic-considerations-applicants/)
- [Continuation vs Divisional vs CIP - Cionca IP](https://www.cioncaip.com/PatentInformation/DivisionalPatent)
- [CIP vs Continuation Filing Strategy](https://www.patenttrademarkblog.com/cip-vs-continuation-file/)

---

## Research Date
2026-01-26
