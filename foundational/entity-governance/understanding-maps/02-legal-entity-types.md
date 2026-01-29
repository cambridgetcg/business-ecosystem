# Understanding Map: Legal Entity Types

## Overview

This document synthesizes understanding of how different legal entity types have fundamentally different governance structures, ownership models, tax treatments, and formality requirements. A one-size-fits-all data model cannot properly represent these differences.

**Source Research**: 02-llc-operating-agreements.md, 04-entity-type-governance.md

---

## Core Mental Model

```
                         LEGAL ENTITY TYPES
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ CORPORATIONS│         │    LLCs     │         │ PARTNERSHIPS│
│             │         │             │         │             │
│ C-Corp      │         │ Member-     │         │ LP          │
│ S-Corp      │         │ Managed     │         │ LLP         │
│ (same legal │         │ Manager-    │         │ General     │
│  structure) │         │ Managed     │         │             │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       ▼                       ▼                       ▼
   SHARES                 MEMBERSHIP              PARTNERSHIP
   Shareholders           INTERESTS               INTERESTS
   Certificates           Members                 Partners
   Pro-rata voting        Capital Accounts        Capital Accounts
   Dividends              Distributions           Allocations
                          (Special Allocations)

       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ADDITIONAL TYPES                           │
├─────────────────────────────────────────────────────────────────┤
│ NONPROFIT       TRUST             SOLE PROPRIETORSHIP           │
│ No owners       Grantor           No separate entity            │
│ Board only      Trustee           Unlimited liability           │
│ Mission focus   Beneficiary                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entity Type Deep Dives

### 1. C-Corporation

**Governing Documents**: Certificate of Incorporation + Bylaws

**Structure**:
```
SHAREHOLDERS
    │ (elect)
    ▼
BOARD OF DIRECTORS
    │ (appoints)
    ▼
OFFICERS (CEO, CFO, Secretary, etc.)
    │ (manage)
    ▼
CORPORATION OPERATIONS
```

**Key Characteristics**:

| Aspect | C-Corp |
|--------|--------|
| **Liability** | Limited to investment |
| **Taxation** | Double taxation (corporate + dividend) |
| **Ownership** | Unlimited shareholders, any type |
| **Share Classes** | Multiple classes allowed |
| **Foreign Owners** | Allowed |
| **Formalities** | Annual meetings, minutes, resolutions required |

**Why Choose C-Corp**:
- Raising venture capital (VCs need C-Corp structure)
- Going public eventually (IPO-ready)
- Retaining earnings at corporate rate
- Foreign ownership anticipated

---

### 2. S-Corporation

**What it is**: NOT a separate entity type. It's a TAX ELECTION for an existing corporation.

**Legal structure**: Identical to C-Corp (same state filings, same governance)

**Tax structure**: Pass-through (like partnership)

**Requirements** (must meet ALL):
- 100 or fewer shareholders
- Only US citizens/residents and certain trusts
- Single class of stock (voting differences OK)
- No corporation, partnership, or foreign shareholders

**Election**: IRS Form 2553, filed within 2 months 15 days of tax year start

```
C-CORP vs S-CORP TAXATION
─────────────────────────

                    C-CORP                    S-CORP
                    ──────                    ──────
Corporate Income    $100,000                  $100,000
Corporate Tax       ($21,000)                 $0 (pass-through)
                    ─────────                 ─────────
After-Tax at Corp   $79,000
                         │
Distributed as           │
Dividend                 │
                         ▼
Shareholder Tax     ($18,800)                 ($37,000)*
                    ─────────                 ─────────
Net to Shareholder  $60,200                   $63,000

*Assuming 37% individual rate
```

---

### 3. LLC (Limited Liability Company)

**THE FUNDAMENTAL DIFFERENCE**: LLCs operate on contractual partnership principles, NOT corporate principles.

**Governing Document**: Operating Agreement (single document, NOT bylaws)

```
CORPORATION MODEL               │  LLC MODEL
──────────────────              │  ─────────
Bylaws + Certificate            │  Operating Agreement
Shareholders                    │  Members
Shares                          │  Membership Interests
Stock Ledger                    │  Capital Accounts
Pro-rata Dividends              │  Flexible Distributions
Board of Directors              │  Member-Managed OR Manager-Managed
Officers                        │  Officers (if any)
```

**Management Types**:

| Type | Who Manages | Who Can Bind LLC | Best For |
|------|-------------|------------------|----------|
| **Member-Managed** | All members | Any member | Active owner-operators |
| **Manager-Managed** | Designated managers | Only managers | Passive investors + active management |

**Capital Accounts** (Critical LLC Concept):

Unlike shares, LLC members have capital accounts that track their economic position:

```
CAPITAL ACCOUNT TRACKING
────────────────────────
Opening Balance:              $50,000
+ Contributions:              $10,000
+ Allocated Profit:           $25,000
- Allocated Loss:             ($5,000)
- Distributions:              ($15,000)
                              ───────
Closing Balance:              $65,000
```

**Special Allocations**: Unlike corporations, LLCs can allocate profits/losses disproportionately:

| Scenario | Corporate Rule | LLC Flexibility |
|----------|---------------|-----------------|
| Depreciation deductions | Pro-rata | Allocate 100% to high-tax-bracket member |
| Preferred return | Fixed dividend | 8% return to investors, then split |
| Capital vs. ordinary | Pro-rata | Different allocation for each |

**Tax Classification** (Check-the-Box):

| LLC Type | Default Tax | Can Elect |
|----------|-------------|-----------|
| Single-Member | Disregarded (Schedule C) | C-Corp, S-Corp |
| Multi-Member | Partnership (Form 1065) | C-Corp, S-Corp |

**Series LLCs**:

Some states allow a single LLC with multiple "series" - each series is a separate liability shield:

```
SERIES LLC (Master)
├── Series A (Real Estate #1)
│   └── Own liability, own members, own assets
├── Series B (Real Estate #2)
│   └── Own liability, own members, own assets
└── Series C (Real Estate #3)
    └── Own liability, own members, own assets

If Series A is sued → Series B and C assets protected
```

States allowing: Delaware, Texas, Illinois, Nevada, Oklahoma, Iowa, Tennessee, Utah, Montana, Alabama, Kansas, Missouri, Indiana, Puerto Rico

---

### 4. LP (Limited Partnership)

**Structure**:
```
GENERAL PARTNER(S)          ←── Unlimited liability, manages LP
        │
        ├── Often an LLC (to shield GP liability)
        │
        ▼
LIMITED PARTNER(S)          ←── Limited liability, passive investors
```

**Key Characteristics**:

| Aspect | General Partner | Limited Partner |
|--------|----------------|-----------------|
| **Liability** | UNLIMITED | Limited to investment |
| **Management** | Controls partnership | NO management role |
| **Can Bind LP** | Yes | No |
| **Active/Passive** | Active | Passive |

**Why LP Structure**:
- Investment funds (GP manages, LPs invest)
- Real estate deals (sponsor as GP, investors as LPs)
- Family wealth transfer (parents as GP, children as LPs)

**Tax**: Pass-through (Form 1065)

---

### 5. LLP (Limited Liability Partnership)

**What it is**: Partnership where ALL partners have limited liability for partnership debts and other partners' negligence.

**Key difference from LP**: No general/limited distinction - all partners can participate in management.

**Each partner liable for**:
- Own negligence/malpractice
- Wrongful acts they supervise
- Partnership debts they personally guarantee

**NOT liable for**:
- Other partners' negligence
- General partnership debts (in most states)

**Common use**: Professional service firms (law, accounting, architecture)

**Why LLPs for professionals**:
- Partners can practice without risking personal assets for colleagues' malpractice
- Maintains partnership taxation
- Professional licensing boards often require partnership structure

---

### 6. Nonprofit Corporation

**THE FUNDAMENTAL DIFFERENCE**: No owners. The organization belongs to its mission.

**Structure**:
```
MEMBERS (if any)           ←── May elect board (like shareholders)
        │                      but NO ownership/equity interest
        ▼
BOARD OF DIRECTORS         ←── Fiduciary duty to MISSION, not owners
        │
        ▼
OFFICERS                   ←── Same as for-profit corp
```

**Key Characteristics**:

| Aspect | Nonprofit |
|--------|-----------|
| **Ownership** | NONE (no shareholders, no equity) |
| **Profit Distribution** | PROHIBITED (no dividends) |
| **Governance** | Board of Directors (fiduciary to mission) |
| **Tax Status** | Must apply (Form 1023 for 501(c)(3)) |
| **Upon Dissolution** | Assets to similar nonprofit, NOT to individuals |

**Board Duties (heightened)**:
- **Duty of Care**: Reasonable prudence in decisions
- **Duty of Loyalty**: Organization's interests over personal
- **Duty of Obedience**: Adhere to charitable mission

**State-specific board requirements**:
- New Hampshire: Minimum 5 voting directors
- California: Minimum 1 director
- Most states: 1-3 minimum
- Many states: At least 2 officers (President/Secretary)

---

### 7. Trust

**THE FUNDAMENTAL DIFFERENCE**: Not a separate legal entity in traditional sense. It's a legal arrangement.

**Structure**:
```
GRANTOR                    ←── Creates and funds trust
    │
    ▼
TRUSTEE                    ←── Manages trust assets (fiduciary)
    │
    ▼
BENEFICIARY               ←── Entitled to trust benefits
```

**Types**:

| Type | Modifiable? | Tax Treatment | Use Case |
|------|-------------|--------------|----------|
| **Revocable Living Trust** | Yes | Grantor taxed | Estate planning, probate avoidance |
| **Irrevocable Trust** | No | Trust taxed (or beneficiary) | Asset protection, tax planning |
| **Statutory Trust** | No | Varies | Business operations (Delaware Statutory Trust) |
| **Business Trust** | No | Varies | Investment vehicles (REITs) |

**Why trusts in business context**:
- Real estate investment trusts (REITs)
- Delaware Statutory Trusts for 1031 exchanges
- Employee benefit trusts (ESOPs)
- Asset protection planning

---

## Governance Requirements by Type

| Entity Type | Annual Meeting | Minutes Required | Annual Report | Board Required |
|-------------|---------------|------------------|---------------|----------------|
| **C-Corp** | Yes | Yes | Yes | Yes |
| **S-Corp** | Yes | Yes | Yes | Yes |
| **LLC** | Generally No | Recommended | Varies | No (unless manager-managed) |
| **LP** | No | Recommended | Yes | No |
| **LLP** | No | Recommended | Yes | No |
| **Nonprofit** | Yes | Yes | Yes | Yes |
| **Trust** | No | Recommended | No | No |

---

## Tax Treatment Summary

```
TAXATION SPECTRUM
─────────────────

DOUBLE-TAXED                      PASS-THROUGH
     │                                 │
     ▼                                 ▼
┌─────────┐                     ┌─────────────────────┐
│ C-Corp  │                     │ S-Corp              │
│         │                     │ LLC (default)       │
│ Corp    │                     │ LP                  │
│ pays    │                     │ LLP                 │
│ tax,    │                     │ Partnership         │
│ then    │                     │                     │
│ dividend│                     │ Income "passes      │
│ taxed   │                     │ through" to owners  │
│ again   │                     │ on K-1              │
└─────────┘                     └─────────────────────┘

                    TAX-EXEMPT
                         │
                         ▼
                    ┌─────────┐
                    │501(c)(3)│
                    │Nonprofit│
                    │         │
                    │No tax if│
                    │mission- │
                    │related  │
                    └─────────┘
```

---

## Implementation Gap Analysis

### Current Implementation

```typescript
// schema.ts - What exists:
export const entityTypeEnum = pgEnum('entity_type', [
  'corporation',
  'llc',
  'lp',
  'llp',
  'partnership',
  'sole_proprietorship',
  'nonprofit',
  'trust',
  'other'
]);

// Only corporate-style tables:
bylaws        // NOT operating agreements
shareholders  // NOT members
shareClasses  // NOT membership interests
boards        // Doesn't fit LLCs, LPs, trusts
```

### What's Missing

```typescript
// NEEDED: Entity-Specific Governance Configuration
entityGovernanceConfig: {
  id: uuid,
  entityId: uuid,

  // LLC-specific
  managementType: varchar,              // 'member_managed', 'manager_managed'
  hasOperatingAgreement: boolean,

  // Corporation-specific
  hasSubchapterSElection: boolean,
  sElectionEffectiveDate: timestamp,
  sElectionTerminationDate: timestamp,

  // Nonprofit-specific
  taxExemptStatus: varchar,             // '501c3', '501c4', '501c6', etc.
  irsExemptionDate: timestamp,
  minimumBoardSize: integer,

  // Formality requirements (derived)
  annualMeetingRequired: boolean,
  boardRequired: boolean,
  minutesRequired: boolean,
}

// NEEDED: Operating Agreements (for LLCs)
operatingAgreements: {
  id: uuid,
  entityId: uuid,
  effectiveDate: timestamp,
  managementType: varchar,
  votingProvisions: jsonb,
  distributionProvisions: jsonb,
  transferRestrictions: jsonb,
  fileStorageKey: varchar,
}

// NEEDED: Members (LLC owners, distinct from shareholders)
members: {
  id: uuid,
  entityId: uuid,
  memberType: varchar,                  // 'individual', 'entity', 'trust'
  name: varchar,
  membershipPercentage: integer,        // basis points
  votingPercentage: integer,            // can differ from ownership!
  admissionDate: timestamp,
  withdrawalDate: timestamp,
}

// NEEDED: Capital Accounts (LLC/partnership economic tracking)
capitalAccounts: {
  id: uuid,
  entityId: uuid,
  memberId: uuid,
  asOfDate: timestamp,
  contributions: integer,               // cumulative
  allocatedProfits: integer,            // cumulative
  allocatedLosses: integer,             // cumulative
  distributions: integer,               // cumulative
  balance: integer,                     // calculated
}

// NEEDED: Managers (for manager-managed LLCs)
managers: {
  id: uuid,
  entityId: uuid,
  personId: uuid,
  name: varchar,
  appointmentDate: timestamp,
  terminationDate: timestamp,
  hasSigningAuthority: boolean,
}

// NEEDED: Partnership Roles (GP vs LP)
partnershipRoles: {
  id: uuid,
  entityId: uuid,
  partnerId: uuid,
  roleType: varchar,                    // 'general_partner', 'limited_partner'
  capitalContribution: integer,
  profitSharePercentage: integer,       // basis points
  lossSharePercentage: integer,         // basis points
  hasManagementRights: boolean,
  hasVotingRights: boolean,
}

// NEEDED: Trust Parties
trustParties: {
  id: uuid,
  entityId: uuid,
  partyId: uuid,
  roleType: varchar,                    // 'grantor', 'trustee', 'beneficiary', 'successor_trustee'
  isPrimary: boolean,
  beneficiaryInterestPercentage: integer,
  effectiveDate: timestamp,
}

// NEEDED: Tax Elections
taxElections: {
  id: uuid,
  entityId: uuid,
  electionType: varchar,                // 'check_the_box', 's_corp', 'qsub', 'reit'
  electedClassification: varchar,
  effectiveDate: timestamp,
  irsFormFiled: varchar,
  filedDate: timestamp,
}
```

---

## Curiosity Questions and Research Findings

### Q1: How do you handle an LLC taxed as S-Corp?

**Finding**: This is common and requires tracking BOTH:
- **Legal structure**: LLC (operating agreement, members, manager-managed, etc.)
- **Tax treatment**: S-Corp (limited shareholders, single class, Form 2553)

**Implementation implication**: Need separate `legalStructure` and `taxClassification` fields, not a single `entityType`.

### Q2: What happens when an entity converts from one type to another?

**Finding**: Conversions are common and require careful handling:

| Conversion | State Process | Tax Consequence |
|------------|--------------|-----------------|
| LLC → Corp | Statutory conversion or merger | Usually taxable (deemed liquidation) |
| Corp → LLC | Statutory conversion or merger | Usually taxable |
| C-Corp → S-Corp | Tax election only | No state change, tax election |
| S-Corp → C-Corp | Revocation/termination of election | No state change |
| LP → LLC | Statutory conversion | Usually tax-free if properly structured |

**Implementation implication**: Need conversion history tracking with effective dates.

### Q3: What are the liability implications for GP structured as LLC?

**Finding**: Common pattern to shield GP from unlimited liability:

```
           LP
           │
    ┌──────┴──────┐
    │             │
GP-LLC           Limited Partners
(1% interest)    (99% interest)
    │
    │ shields
    ▼
Individuals in GP-LLC
```

The GP-LLC structure means:
- GP-LLC has unlimited liability for LP debts (required by LP law)
- BUT individuals in GP-LLC have limited liability (LLC protection)
- Still need proper formalities in BOTH entities

### Q4: How do courts handle "informal" S-Corps that missed the 2553 deadline?

**Finding**: IRS has relief provisions:
- **Late election relief**: If reasonable cause and filed within 3 years 75 days
- **Private letter ruling**: For older situations, can request IRS ruling
- **State implications**: Some states don't automatically follow S-election

**Key case**: Many startups operate as S-Corps without properly filing 2553. This creates back-tax exposure.

---

## Domain Events Needed

```typescript
// Entity Type Events
S_ELECTION_FILED              // S-Corp election submitted to IRS
S_ELECTION_ACCEPTED           // IRS approved S-election
S_ELECTION_TERMINATED         // Lost S-status (voluntary or involuntary)
CHECK_THE_BOX_FILED           // LLC tax classification election
TAX_EXEMPT_STATUS_APPROVED    // IRS 501(c) determination letter received
TAX_EXEMPT_STATUS_REVOKED     // Lost tax-exempt status

// LLC Events
OPERATING_AGREEMENT_ADOPTED   // Initial operating agreement
OPERATING_AGREEMENT_AMENDED   // Operating agreement changed
MEMBER_ADMITTED               // New member joined
MEMBER_WITHDRAWN              // Member left
MANAGEMENT_TYPE_CHANGED       // Member-managed ↔ manager-managed
MANAGER_APPOINTED             // New manager (manager-managed)
MANAGER_REMOVED               // Manager removed

// Partnership Events
GENERAL_PARTNER_CHANGED       // GP substitution
LIMITED_PARTNER_ADMITTED      // New LP
LIMITED_PARTNER_WITHDRAWN     // LP exited

// Capital Account Events
CAPITAL_CONTRIBUTION_MADE     // Member/partner contributed capital
DISTRIBUTION_MADE             // Funds distributed to member/partner
ALLOCATION_RECORDED           // Profit/loss allocated
```

---

## Remaining Curiosity Questions

1. **How do Series LLCs interact with foreign qualification?**
   - Does each series need to qualify separately?
   - How do non-recognizing states treat Series LLCs?
   - What happens to series assets in bankruptcy?

2. **What triggers S-Corp termination?**
   - Exceeding 100 shareholders
   - Foreign shareholder
   - Second class of stock (when do voting differences create second class?)
   - Passive investment income > 25% for 3 years

3. **How do professional corporation (PC) requirements interact with entity type?**
   - Some states require PCs for certain professions
   - Different liability rules than regular corps
   - Can professionals use LLPs instead?

4. **What are the practical differences in director fiduciary duties between for-profit and nonprofit?**
   - Duty of obedience (unique to nonprofits)
   - Enhanced scrutiny for self-dealing
   - Cy pres doctrine for asset distribution

---

## Cross-References

- **02-llc-operating-agreements.md**: Detailed LLC governance
- **04-entity-type-governance.md**: Full comparison of all entity types
- **06-corporate-veil-formalities.md**: Formality requirements vary by type
- **08-holding-company-structures.md**: Entity type choices for holding structures
