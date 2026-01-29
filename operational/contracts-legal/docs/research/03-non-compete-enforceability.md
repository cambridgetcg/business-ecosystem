# Non-Compete and Non-Solicitation Enforceability

**Gap Identified**: Schema has `nonCompeteDays` and `nonSolicitDays` as simple integers, but enforceability is a complex, state-specific legal question—not just a duration.

---

## Current Legal Landscape (2025)

### FTC Non-Compete Ban: DEAD

- **April 2024**: FTC announced nationwide ban on non-competes
- **August 2024**: Federal court stopped enforcement
- **September 2025**: FTC voluntarily dismissed appeals
- **Current Status**: Rule is NOT in effect and NOT enforceable

**Result**: We're back to the state-by-state patchwork.

---

## State-by-State Overview

### States with Complete Bans
| State | Notes |
|-------|-------|
| California | Banned since 1872; strengthened Jan 2024 with AB-1076 and SB-699 |
| Minnesota | Complete ban |
| Oklahoma | Complete ban |
| North Dakota | Complete ban |

### California's 2024 Strengthening
- AB-1076: Additional bars to enforcing non-competes
- SB-699: Extended protections
- **Exception**: Non-competes ARE allowed in sale of business, partnership dissolution, or LLC dissolution

### States with Limitations
Many states allow non-competes but with restrictions:
- Income thresholds
- Duration limits
- Geographic scope limits
- Industry-specific exemptions

**States actively limiting**: Arizona, Connecticut, Georgia, Illinois, Kentucky, Missouri, New York, Rhode Island, Tennessee

---

## What Makes a Non-Compete Enforceable

In states where permitted, courts generally require:

| Factor | Requirement |
|--------|-------------|
| **Legitimate Business Interest** | Protecting trade secrets, customer relationships, specialized training |
| **Reasonable Scope** | Geographic area limited to where business operates |
| **Reasonable Duration** | Typically 6-24 months; varies by industry and role |
| **Adequate Consideration** | New employment, promotion, bonus, or other value given |
| **Not Against Public Policy** | Cannot prevent someone from earning a living |

---

## Non-Solicitation Agreements

Non-solicits are generally more enforceable than non-competes because they're narrower. However:

> "If an employer adopts a term or condition that is so broad or onerous that it has the same functional effect as prohibiting a worker from seeking or accepting other work, then such a term or condition would be treated as a non-compete clause."

### Types of Non-Solicitation
1. **Customer non-solicit**: Can't solicit customers you worked with
2. **Employee non-solicit**: Can't recruit former colleagues
3. **Vendor/supplier non-solicit**: Less common, protects supply chain

---

## Current Schema Gap

```prisma
model EmploymentAgreement {
  nonCompeteDays  Int?
  nonSolicitDays  Int?
}
```

**What We're Missing**:
- State where agreement was made
- State where employee works
- Whether enforceable in that state
- Geographic scope
- What triggers the restriction
- What's being protected (business interest)

---

## Recommended Schema Enhancement

```prisma
model RestrictiveCovenant {
  id                    String   @id @default(cuid())
  employmentAgreementId String
  employmentAgreement   EmploymentAgreement @relation(...)

  type                  CovenantType
  
  // Scope
  durationDays          Int
  geographicScope       String?  // "50 mile radius of any company office"
  industryScope         String?  // "enterprise software"
  
  // Jurisdiction
  governingState        String   // State whose law governs
  employeeWorkState     String   // Where employee actually works
  
  // Business interest
  protectedInterest     String   // "customer relationships", "trade secrets"
  
  // Consideration
  considerationType     String   // "initial employment", "promotion", "bonus"
  considerationValue    Decimal?
  
  // Enforceability assessment
  enforceabilityRisk    RiskLevel
  enforceabilityNotes   String?
  lastReviewedAt        DateTime?
  reviewedBy            String?
  
  // Status
  status                CovenantStatus @default(ACTIVE)
  waivedAt              DateTime?
  waivedBy              String?
  waiverReason          String?
}

enum CovenantType {
  NON_COMPETE
  NON_SOLICIT_CUSTOMER
  NON_SOLICIT_EMPLOYEE
  NON_SOLICIT_VENDOR
  NON_DISCLOSURE
  NON_DISPARAGEMENT
}

enum CovenantStatus {
  ACTIVE
  EXPIRED
  WAIVED
  UNENFORCEABLE
}
```

---

## Ongoing FTC Enforcement

Even without the rule, the FTC continues enforcement:
- **September 2025**: FTC sued a pet cremation company for overbroad non-competes under Section 5 (unfair methods of competition)

**Takeaway**: Overly broad non-competes may still face federal scrutiny as unfair competition.

---

## Best Practices

1. **Avoid across-the-board use** - Tailor to business interests at risk
2. **Use NDAs instead where possible** - 95%+ of workers with non-competes already have NDAs
3. **Review by state** - Check enforceability in employee's work state
4. **Consider alternatives**: Garden leave, deferred compensation, training repayment
5. **Document legitimate interests** - Be specific about what you're protecting

---

## Sources

- [FTC Non-Compete Rule Announcement](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-announces-rule-banning-noncompetes)
- [FTC Abandons 2024 Non-Compete Rule | Husch Blackwell](https://www.huschblackwell.com/newsandinsights/ftc-abandons-2024-non-compete-rule-signals-priority-in-non-compete-enforcement-actions)
- [White & Case Global Non-Compete Resource Center](https://www.whitecase.com/insight-tool/white-case-global-non-compete-resource-center-ncrc)
- [Battle Over Non-Compete Ban | Jackson Lewis](https://www.jacksonlewis.com/insights/battle-overwar-isnt-employer-considerations-now-ftc-non-compete-ban-set-aside)
- [FTC Non-Compete Rule | DLA Piper](https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2024/ftc_bans_noncompetes)
