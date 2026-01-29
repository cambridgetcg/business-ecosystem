# Jurisdiction vs Governing Law

**Gap Identified**: Schema has only `jurisdiction: String?` but contracts require both forum selection AND choice of law clauses—two distinct concepts.

---

## The Critical Distinction

| Concept | What It Determines | Example |
|---------|-------------------|---------|
| **Forum Selection (Jurisdiction)** | WHERE disputes will be litigated | "Any dispute shall be resolved in the courts of Delaware" |
| **Governing Law (Choice of Law)** | WHICH law will be applied | "This agreement shall be governed by the laws of New York" |

**Key Insight**: A contract can be litigated in one state but decided under the law of a completely different state.

---

## Forum Selection Clause Details

A forum selection clause designates the court and location where parties will resolve disputes. It addresses:

1. **Personal Jurisdiction** - The court's power to exercise authority over a party
2. **Venue** - The physical location where the court exercises its power

### Types of Forum Selection

| Type | Effect | Language Example |
|------|--------|------------------|
| **Permissive** | Confirms a court MAY be used, but doesn't prevent other courts | "Courts of Delaware shall have jurisdiction" |
| **Mandatory (Fixed)** | ALL disputes MUST go to specified court | "Courts of Delaware shall have **exclusive** jurisdiction" |
| **Mandatory (Floating)** | Forum selected based on future events | "Disputes shall be resolved in the defendant's home state" |

**Critical Word**: "Exclusive" is what makes a forum selection clause mandatory.

---

## Governing Law Clause Details

A choice of law clause determines which jurisdiction's **substantive law** governs the contract's interpretation and enforcement.

### Word Choice Matters

| Word Used | Interpretation |
|-----------|----------------|
| "Interpreted" or "Construed" | Some courts limit to interpretation rules only |
| "Governed" | All courts agree this selects full contract law |

**Best Practice**: Always include "governed" to avoid ambiguity.

### What Governing Law Does NOT Select

- Procedural law (that comes from the forum)
- Rules of evidence
- Statute of limitations (sometimes)

---

## Current Schema Gap

```prisma
model LegalMatter {
  court         String?
  jurisdiction  String?   // Conflates forum and governing law
  caseNumber    String?
}

model Contract {
  // Missing entirely!
}
```

---

## Recommended Schema Enhancement

```prisma
model Contract {
  // ... existing fields

  // Dispute Resolution
  governingLaw          String?   // e.g., "New York"
  governingLawCountry   String?   // e.g., "US"
  forumSelection        String?   // e.g., "State and Federal Courts of Delaware"
  forumSelectionType    ForumType @default(PERMISSIVE)
  arbitrationClause     Boolean   @default(false)
  arbitrationRules      String?   // e.g., "AAA Commercial Rules"
  arbitrationSeat       String?   // e.g., "New York, NY"

  // Venue
  venueCity             String?
  venueState            String?
  venueCountry          String?
}

enum ForumType {
  PERMISSIVE           // May use this forum
  EXCLUSIVE_FIXED      // Must use this specific forum
  EXCLUSIVE_FLOATING   // Determined by formula
}
```

---

## Enforcement Considerations

Forum selection clauses are generally enforced unless:
- Purpose was to evade mandatory law
- Fraud, duress, or undue influence in signing
- Evidence of bad faith
- Compelling public interest factors exist

**Global Seafood Inc. v. Bantry Bay (2011)**: "Governed by Irish Law and the Irish Courts" was held NOT to grant exclusive jurisdiction because it lacked the word "exclusive."

---

## Practical Implications

### Why Forum Selection May Be More Valuable

At contract drafting time:
- Hard to predict what disputes will arise
- Hard to know which state's law is most favorable
- Home forum provides: familiar judges, local counsel, convenience

### The Combined Clause

Best practice is to include both in a single section:

```
GOVERNING LAW AND JURISDICTION

This Agreement shall be governed by and construed in accordance with 
the laws of the State of Delaware, without regard to its conflict of 
laws principles. The parties irrevocably submit to the exclusive 
jurisdiction of the state and federal courts located in Wilmington, 
Delaware for the resolution of any disputes arising hereunder.
```

---

## Sources

- [Drafting Choice of Law and Forum Provisions | Holland & Knight](https://www.hklaw.com/en/insights/publications/2021/08/drafting-choice-of-law-for-us-agreements)
- [Forum Selection Clause | Cornell LII](https://www.law.cornell.edu/wex/forum_selection_clause)
- [Choice of Law and Choice of Forum Contract Provisions](https://www.ix-legal.com/blog/2024/february/choice-of-law-and-choice-of-forum-contract-provi/)
- [A Primer on Choice-of-Law Clauses | Transnational Litigation Blog](https://tlblog.org/a-primer-on-choice-of-law-clauses/)
- [A Primer on Forum Selection Clauses | Transnational Litigation Blog](https://tlblog.org/a-primer-on-forum-selection-clauses/)
