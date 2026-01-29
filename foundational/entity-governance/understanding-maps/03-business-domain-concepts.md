# Understanding Map: Business Domain Concepts

## Overview

This document synthesizes understanding of core business domain concepts that entity governance must model: cap tables and equity structures, beneficial ownership and CTA compliance, corporate veil protection, and holding company patterns.

**Source Research**: 03-beneficial-ownership-cta.md, 05-cap-table-complexity.md, 06-corporate-veil-formalities.md, 08-holding-company-structures.md

---

## Core Concept Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BUSINESS DOMAIN CONCEPTS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐         ┌─────────────────────┐                   │
│  │   CAP TABLE         │         │ BENEFICIAL OWNERSHIP│                   │
│  │   COMPLEXITY        │         │   (CTA/BOI)         │                   │
│  │                     │         │                     │                   │
│  │ Who owns what?      │◄───────►│ Who REALLY owns it? │                   │
│  │ What are the terms? │         │ Federal reporting   │                   │
│  │ What happens at     │         │ 25% OR control test │                   │
│  │ exit?               │         │                     │                   │
│  └──────────┬──────────┘         └──────────┬──────────┘                   │
│             │                               │                               │
│             │      WHO OWNS THE ENTITY?     │                               │
│             │                               │                               │
│             │         ┌─────────┐           │                               │
│             └────────►│ ENTITY  │◄──────────┘                               │
│                       └────┬────┘                                           │
│                            │                                                │
│             HOW IS IT      │     HOW IS IT                                  │
│             PROTECTED?     │     STRUCTURED?                                │
│                            │                                                │
│  ┌─────────────────────┐   │   ┌─────────────────────┐                     │
│  │   CORPORATE VEIL    │   │   │  HOLDING COMPANY    │                     │
│  │   & FORMALITIES     │◄──┴──►│  STRUCTURES         │                     │
│  │                     │       │                     │                     │
│  │ Maintain separation │       │ Tax efficiency      │                     │
│  │ Proper documentation│       │ Liability isolation │                     │
│  │ Avoid piercing      │       │ Ownership tiers     │                     │
│  └─────────────────────┘       └─────────────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Section 1: Cap Table Complexity

### Mental Model

A cap table is not just "who owns shares" - it's a complex financial instrument with preferences, rights, and conversion mechanics that determine who gets what in various scenarios.

```
CAP TABLE LAYERS
────────────────

LAYER 1: SHARES
├── Common Stock (founders, employees)
├── Preferred Stock (investors)
│   ├── Series A
│   ├── Series B
│   └── Series C
└── Warrants

LAYER 2: SHARE TERMS
├── Liquidation Preferences (who gets paid first)
├── Anti-dilution Protection (investor protections)
├── Conversion Rights (preferred → common)
└── Voting Rights

LAYER 3: CONVERTIBLE INSTRUMENTS (Not yet shares)
├── SAFEs (future equity)
├── Convertible Notes (debt → equity)
└── Warrants

LAYER 4: OPTION POOL (Reserved, not yet issued)
├── Authorized shares
├── Granted options
├── Exercised (now common)
└── Available for grants

LAYER 5: VALUATION
└── 409A Valuation (FMV for option pricing)
```

### Key Findings

#### Liquidation Preferences

When a company exits, proceeds flow in a "waterfall" that respects preferences.

**Types**:

| Type | Mechanics | Investor Impact |
|------|-----------|-----------------|
| **Non-Participating 1x** | Get preference OR convert (not both) | Choose greater amount |
| **Participating 1x** | Get preference AND share remaining | "Double dip" - more aggressive |
| **Capped Participating** | Participate up to cap (3x), then stop | Compromise |

**Example** ($50M exit, Series A invested $10M for 20%):

```
NON-PARTICIPATING                    PARTICIPATING
────────────────                     ─────────────
Preference: $10M                     Preference: $10M
OR                                   PLUS
Convert: 20% × $50M = $10M           Remaining: $40M × 20% = $8M

Series A takes: $10M                 Series A takes: $18M
Founders get: $40M                   Founders get: $32M
```

#### Anti-Dilution Provisions

Protect investors in down rounds (raising at lower valuation).

| Type | Effect on Founders |
|------|-------------------|
| **Full Ratchet** | Maximum dilution - conversion price drops to new price |
| **Broad-Based Weighted Average** | Moderate dilution - standard |
| **Narrow-Based Weighted Average** | Less moderate dilution |

**Broad-Based Formula**:
```
New Price = Old Price × (Shares Before + Money at Old Price) / (Shares Before + Shares Actually Issued)
```

#### Convertible Instruments

**SAFEs (Simple Agreement for Future Equity)**:
- NOT debt (no interest, no maturity)
- Converts at next priced round
- Has valuation cap AND/OR discount
- Y Combinator standard for seed

**Convertible Notes**:
- IS debt (interest accrues, has maturity)
- Principal + interest converts
- If no conversion by maturity → company must repay (problem)

**SAFE Conversion Example**:
```
SAFE: $500K at $5M cap, 20% discount
Series A: $10M pre-money, $1.00/share

Cap conversion: $5M ÷ $10M = $0.50/share
Discount conversion: $1.00 × 80% = $0.80/share

SAFE converts at LOWER price → $0.50/share
Shares issued: $500K ÷ $0.50 = 1,000,000 shares
```

#### Fully Diluted Ownership

**Critical distinction**:

| Calculation | What It Counts | Use |
|-------------|---------------|-----|
| **Issued & Outstanding** | Only actually issued shares | Legal ownership |
| **Fully Diluted** | Issued + all potential shares | Investor negotiations |

```
FULLY DILUTED CALCULATION
────────────────────────
Common issued:                  8,000,000
Preferred (as-if converted):    2,000,000
Options outstanding:            1,500,000
SAFE conversions (estimated):     700,000
Notes (estimated):                500,000
Warrants:                         300,000
                               ──────────
TOTAL FULLY DILUTED:           13,000,000

Founder owns 4M shares:
- 50% of issued
- 30.8% fully diluted ← what matters
```

#### 409A Valuations

**What**: Independent appraisal of common stock fair market value.

**Why**: Options granted below FMV trigger immediate taxation + 20% penalty.

**When required**:
- After any priced round
- Every 12 months
- After material events
- Before granting options

**Key insight**: Common is worth LESS than preferred (25-35% typically) because:
- No liquidation preference
- No anti-dilution protection
- No voting/control rights

---

## Section 2: Beneficial Ownership (CTA/BOI)

### Mental Model

The Corporate Transparency Act (CTA) requires disclosure of the HUMANS who ultimately own or control business entities - cutting through corporate structures to find real people.

```
                    REPORTING COMPANY
                          │
          ┌───────────────┼───────────────┐
          │               │               │
     COMPANY INFO    COMPANY          BENEFICIAL
                     APPLICANT        OWNERS
          │               │               │
    • Legal name      • Filer           TWO TESTS (OR):
    • DBAs            • Director        ┌─────────────────┐
    • Address                           │ 25% OWNERSHIP   │
    • Jurisdiction                      │      OR         │
    • EIN                               │ SUBSTANTIAL     │
                                        │ CONTROL         │
                                        └─────────────────┘
```

### Key Findings

#### The Two Tests

**Test A - 25% Ownership Interest**:
- Owns or controls ≥25% of ownership interests
- "Ownership interest" broadly defined:
  - Equity, stock, voting rights
  - Capital or profit interests
  - Convertible instruments
  - Options, warrants
  - Put/call arrangements

**Test B - Substantial Control** (ANY of these):
1. **Senior Officer**: CEO, CFO, COO, President, General Counsel
2. **Appointment Authority**: Power to appoint/remove majority of directors/officers
3. **Important Decisions**: Authority over significant business decisions
4. **Other Control**: Any other form of substantial control

#### Required Data Elements

**For Each Beneficial Owner**:

| Field | Description | Why Missing from Current Schema |
|-------|-------------|-------------------------------|
| Full legal name | As on ID | Have "name" but not verified |
| Date of birth | DOB | **MISSING** |
| Residential address | Home, NOT business | Have "address" but business address |
| ID document type | Passport, license | **MISSING** |
| ID document number | From acceptable ID | **MISSING** |
| ID issuing jurisdiction | State/country | **MISSING** |
| ID document image | Copy of document | **MISSING** |

**FinCEN Identifier**: An individual can obtain a FinCEN ID to use instead of providing all personal info each time. **MISSING** from schema.

#### The 23 Exemptions

Most relevant for private companies:

| # | Exemption | Criteria |
|---|-----------|----------|
| **21** | **Large Operating Company** | 21+ US employees AND $5M+ revenue AND US physical office |
| 22 | Subsidiary of exempt | Wholly owned by exempt entity |
| 23 | Inactive entity | Pre-2020, no assets, no changes |

**Implementation implication**: Need to track:
- Full-time employee count
- US physical office presence
- Prior year gross receipts

#### Filing Deadlines

| Entity Type | Initial Filing Deadline |
|-------------|------------------------|
| Existing (formed before 1/1/2024) | January 1, 2025 |
| New (1/1/2024 - 12/31/2024) | 90 days from formation |
| New (on/after 1/1/2025) | 30 days from formation |

**Updates required within 30 days when**:
- Beneficial owner info changes
- Ownership crosses 25% threshold
- Someone gains/loses substantial control
- Company info changes

#### Penalties

| Type | Penalty |
|------|---------|
| Civil | $500/day, max $10,000 |
| Criminal (willful) | Up to $10,000 fine + 2 years prison |
| Unauthorized disclosure | Up to $250,000 + 5 years |

---

## Section 3: Corporate Veil Protection

### Mental Model

The corporate veil is the legal separation between a business entity and its owners. Maintaining it requires ongoing formality - courts look at EVIDENCE of separation.

```
WITHOUT VEIL (Sole Prop/GP)          WITH VEIL (Properly Maintained)
────────────────────────            ─────────────────────────────

Business ──────────► Personal        Business ──────► Business Creditors
Creditors            Assets                   │
                                              │ SHIELD
                                              │
                                    Personal ─┼─► Protected
                                    Assets    │
```

### Key Findings

#### The Two Prongs Test

Courts require BOTH for veil piercing:

**Prong 1 - Unity of Interest**:
- Commingling of funds
- Failure to observe formalities
- Undercapitalization
- Entity used as mere instrumentality

**Prong 2 - Inequitable Result**:
- Fraud or wrongdoing
- Creditor left without remedy
- Entity used to evade obligations

#### The Formality Checklist

**Formation (One-time)**:
- [ ] File formation documents
- [ ] Obtain EIN
- [ ] Adopt bylaws/operating agreement
- [ ] Issue ownership certificates
- [ ] Document initial capital contribution
- [ ] Open separate bank account
- [ ] Hold organizational meeting with minutes

**Ongoing (Annual/Periodic)**:
- [ ] Annual shareholder/member meeting
- [ ] Annual board/manager meeting
- [ ] File annual report with state
- [ ] Pay franchise/annual tax
- [ ] Maintain registered agent
- [ ] Update corporate records

**Transactional (As-needed)**:
- [ ] Board resolution for major contracts
- [ ] Resolution for loans/debt
- [ ] Resolution for real estate
- [ ] Resolution for officer changes
- [ ] Resolution for equity issuances
- [ ] Approval for related-party transactions

#### Intercompany Transaction Documentation

Related-party transactions require extra formality:

**Required Elements**:
1. Written agreement between entities
2. Signed by authorized officers of EACH entity
3. Fair market value pricing (arm's length)
4. Economic substance (services actually provided)
5. Separate approval by each entity's board

**Intercompany Loans - Special Requirements**:
- Written promissory note
- Fixed maturity date
- Interest at least AFR (Applicable Federal Rate)
- Regular payments actually made
- Borrower ability to repay
- Board approval both sides

**Red Flags** (looks like equity, not debt):
- No maturity date
- No interest or below-market rate
- No payments made
- Debt exceeds repayment ability
- No documentation

#### Parent-Subsidiary Veil Piercing Risk

**High Risk** (Subsidiary treated as department):
- Shared bank accounts without agreements
- Parent pays subsidiary bills directly
- No independent subsidiary decision-making
- Overlapping directors with no independence
- Parent dictates all decisions
- No separate board meetings
- Third parties unaware of separation

**Low Risk** (Proper separation):
- Separate bank accounts
- Own board meetings and minutes
- Independent officers (can overlap but act independently)
- Arm's length intercompany agreements
- Adequate subsidiary capitalization
- Third parties informed of separate entity

---

## Section 4: Holding Company Structures

### Mental Model

Holding companies create intentional legal separation for tax efficiency and liability isolation. The structure serves specific strategic purposes.

```
            ┌─────────────────────────┐
            │    ULTIMATE PARENT      │
            │    (Often Delaware)     │
            └───────────┬─────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ US      │    │ EMEA    │    │ APAC    │
   │ HOLDCO  │    │ HOLDCO  │    │ HOLDCO  │
   └────┬────┘    └────┬────┘    └────┬────┘
        │              │              │
   ┌────┼────┐         │         ┌────┼────┐
   │    │    │         │         │    │    │
   ▼    ▼    ▼         ▼         ▼    ▼    ▼
OpCo1 OpCo2 IPCo    OpCo3     OpCo4 OpCo5 OpCo6
```

### Key Findings

#### Strategic Objectives

| Objective | Structure Pattern | Key Consideration |
|-----------|------------------|-------------------|
| **Liability Isolation** | Separate subs per risk pool | Maintain formalities |
| **Tax Efficiency** | 80%+ ownership | Document business purpose |
| **Investor Requirements** | Blocker corporations | Balance cost vs. benefit |
| **International Ops** | Regional holding companies | Substance requirements |
| **IP Protection** | IP holding subsidiary | Transfer pricing |

#### Ownership Thresholds That Matter

| Threshold | Significance |
|-----------|--------------|
| ≥10% | US shareholder for CFC purposes |
| ≥20% | 65% Dividends Received Deduction |
| >50% | CFC status (with other 10%+ US shareholders) |
| ≥80% | 100% DRD, consolidated return eligibility |
| 100% | Disregarded entity election available |

**Implementation implication**: Alert when ownership crosses these thresholds.

#### Blocker Corporations

A C-Corp inserted between certain investors and operating partnership:

```
WITHOUT BLOCKER                      WITH BLOCKER
───────────────                      ────────────

Pension Fund                         Pension Fund
(Tax-Exempt)                         (Tax-Exempt)
     │                                    │
     ▼                                    ▼
Operating LLC                        Blocker Corp (C-Corp)
(Pass-Through)                            │
     │                                    ▼
     ▼                               Operating LLC
UBTI flows through                        │
Pension loses exemption!                  ▼
                                     Blocker pays corp tax
                                     Pension gets dividends
                                     Exemption preserved!
```

**Use cases**:
- Tax-exempt US investors (pensions, endowments)
- Foreign investors avoiding ECI
- Investors who cannot receive K-1s

#### Controlled Foreign Corporations (CFC)

**Definition**: Foreign corp where US shareholders (each ≥10%) collectively own >50%.

**Implications**:
- **Subpart F Income**: Passive income taxed currently to US shareholders
- **GILTI**: Income exceeding 10% return on assets taxed currently
- **Section 956**: US property investment triggers deemed dividend

---

## Implementation Gap Analysis

### Current Schema vs. Needed

```
CONCEPT                 CURRENT STATE         NEEDED
───────────────────────────────────────────────────────────────

CAP TABLE COMPLEXITY
  Liquidation prefs     Integer field only    Type, multiple, seniority, cap
  Anti-dilution         None                  Terms per share class
  SAFEs/Notes           None                  Convertible instruments table
  Option pools          None                  Pool management table
  409A                  None                  Valuation history table

BENEFICIAL OWNERSHIP
  BOI data             Basic shareholder      DOB, residential addr, ID docs
  Filing tracking      None                   BOI filings table
  Exemption status     None                   Exemption tracking
  25% calculation      None                   Ownership threshold events

CORPORATE VEIL
  Meeting minutes      Yes                    ✓
  Resolutions          Yes                    ✓
  Intercompany         None                   Agreements, loans tables
  Veil health          None                   Health scoring table
  Capitalization       None                   History tracking

HOLDING STRUCTURES
  Parent-subsidiary    Basic ownership %      Purpose classification
  Tax classification   None                   Tax election tracking
  Blocker tracking     None                   Blocker relationship table
  CFC status           None                   CFC determination table
```

### Priority Schema Extensions

```typescript
// CAP TABLE
liquidationPreferences: {
  shareClassId, preferenceType, multiple, participationCap, seniorityRank
}
antiDilutionTerms: {
  shareClassId, antiDilutionType, carveOuts
}
convertibleInstruments: {
  entityId, holderId, instrumentType, principalAmount, valuationCap,
  discountPercent, interestRate, maturityDate, status, conversionDetails
}
optionPools: {
  entityId, planName, shareClassId, authorizedShares, grantedShares,
  exercisedShares, availableShares
}
valuations409a: {
  entityId, valuationDate, effectiveUntil, commonShareFmv, methodology,
  valuationFirm
}

// BENEFICIAL OWNERSHIP
beneficialOwners: {
  entityId, personId, fullLegalName, dateOfBirth, residentialAddress,
  idDocumentType, idDocumentNumber, idIssuingJurisdiction, idDocumentImageKey,
  fincenIdentifier, ownershipPercentage, substantialControlType, status
}
boiFilings: {
  entityId, filingType, status, dueDate, submittedDate, acceptedDate,
  fincenSubmissionId, rejectionReason
}

// CORPORATE VEIL
intercompanyAgreements: {
  party1EntityId, party2EntityId, agreementType, effectiveDate,
  pricingMethod, approvalResolutions
}
intercompanyLoans: {
  lenderEntityId, borrowerEntityId, principalAmount, interestRate,
  maturityDate, paymentFrequency, approvalResolutions, status
}
veilHealthAssessments: {
  entityId, assessmentDate, overallScore, componentScores, riskFactors
}

// HOLDING STRUCTURES
legalEntities.purposeClassification: 'operating' | 'holding' | 'ip_holding' | 'blocker' | ...
legalEntities.taxClassification: 'c_corp' | 's_corp' | 'partnership' | 'disregarded' | ...
taxElections: {
  entityId, electionType, electedClassification, effectiveDate, irsFormFiled
}
cfcStatus: {
  entityId, taxYear, isCfc, usOwnershipPercent, subpartFIncome, giltiIncome
}
```

---

## Curiosity Questions

### Cap Table
1. How do you calculate fully diluted ownership with multiple SAFE caps at different valuations?
2. What are the 409A implications of a down round with full ratchet anti-dilution?
3. How should waterfall calculations handle participating preferred conversion decisions?
4. When does a voting agreement create a "second class of stock" for S-Corp purposes?

### Beneficial Ownership
5. How do you calculate effective ownership through multi-tier structures for BOI?
6. What triggers automatic BOI update filing requirements?
7. How should the system handle FinCEN identifiers for serial entrepreneurs?
8. What documentation proves "substantial control" vs. just being an officer?

### Corporate Veil
9. What metrics should trigger automated "veil health" warnings?
10. How do we integrate with banking-treasury to verify separate accounts?
11. What intercompany transaction dollar threshold requires formal agreement?
12. How do courts evaluate "adequate capitalization" - is there a formula?

### Holding Structures
13. How do you calculate effective ownership through 5+ tiers for CFC/threshold purposes?
14. When does a management fee arrangement create nexus/qualification issues?
15. How do treaty benefits interact with CFC status determination?
16. What documentation is required for transfer pricing defense in audit?

---

## Domain Events Needed

```typescript
// Cap Table Events
LIQUIDATION_PREFERENCE_CREATED
SAFE_ISSUED
SAFE_CONVERTED
NOTE_ISSUED
NOTE_CONVERTED
NOTE_MATURED
OPTION_POOL_CREATED
OPTION_POOL_EXPANDED
VALUATION_409A_COMPLETED
DOWN_ROUND_DETECTED                  // Trigger anti-dilution

// BOI Events
BENEFICIAL_OWNER_IDENTIFIED
BENEFICIAL_OWNER_REMOVED
OWNERSHIP_THRESHOLD_CROSSED          // 25% boundary
SUBSTANTIAL_CONTROL_GAINED
SUBSTANTIAL_CONTROL_LOST
BOI_FILING_DUE
BOI_FILING_SUBMITTED
BOI_FILING_ACCEPTED
BOI_UPDATE_REQUIRED
BOI_EXEMPTION_QUALIFIED
BOI_EXEMPTION_LOST

// Corporate Veil Events
INTERCOMPANY_AGREEMENT_CREATED
INTERCOMPANY_LOAN_ORIGINATED
INTERCOMPANY_LOAN_PAYMENT_MISSED     // Veil risk alert
VEIL_HEALTH_ASSESSED
VEIL_RISK_DETECTED
FORMALITY_MISSING_ALERT

// Holding Structure Events
OWNERSHIP_THRESHOLD_CROSSED          // 10%, 20%, 50%, 80% boundaries
CFC_STATUS_CHANGED
CONSOLIDATED_RETURN_ELIGIBILITY_CHANGED
TAX_ELECTION_FILED
BLOCKER_RELATIONSHIP_CREATED
```

---

## Cross-References

- **03-beneficial-ownership-cta.md**: Full CTA requirements and exemptions
- **05-cap-table-complexity.md**: Detailed preference mechanics, SAFEs, 409A
- **06-corporate-veil-formalities.md**: Complete formality checklist, intercompany rules
- **08-holding-company-structures.md**: Tax efficiency strategies, CFC rules
