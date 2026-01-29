# Research Finding: The LLC Paradigm Shift

## The Aha Moment

**Before Integration**: LLC = Corporation with less paperwork

**After Integration**: LLC = Partnership with liability shield. Fundamentally different paradigm requiring fundamentally different data model.

---

## The Core Insight

```
THE PARADIGM DIFFERENCE
═══════════════════════

CORPORATION PARADIGM                    LLC PARADIGM
(Statutory framework)                   (Contractual freedom)
        │                                      │
        ▼                                      ▼
┌─────────────────────┐              ┌─────────────────────┐
│ Certificate of      │              │ Certificate of      │
│ Incorporation       │              │ Organization        │
│ (State filing)      │              │ (State filing)      │
└─────────┬───────────┘              └─────────┬───────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│ BYLAWS              │              │ OPERATING AGREEMENT │
│ (Internal rules)    │              │ (THE contract)      │
│ - Limited variation │              │ - Almost anything   │
│ - Statutory default │              │   goes              │
└─────────────────────┘              └─────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│ SHAREHOLDERS        │              │ MEMBERS             │
│ - Own shares        │              │ - Own interests     │
│ - Recorded in stock │              │ - Tracked in capital│
│   ledger            │              │   accounts          │
└─────────────────────┘              └─────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│ SHARE CLASSES       │              │ MEMBERSHIP CLASSES  │
│ - Voting rights     │              │ - Voting % (can     │
│   per share         │              │   differ from       │
│ - Dividends pro-rata│              │   ownership %)      │
│ - Liquidation pref  │              │ - Allocations       │
│   (fixed)           │              │   (flexible)        │
└─────────────────────┘              │ - Distributions     │
                                     │   (waterfall)       │
                                     └─────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│ BOARD OF DIRECTORS  │              │ MEMBER-MANAGED      │
│ - Elected by        │              │   or                │
│   shareholders      │              │ MANAGER-MANAGED     │
│ - Appoints officers │              │ - Operating         │
│                     │              │   agreement decides │
└─────────────────────┘              └─────────────────────┘
```

---

## Why LLCs Are Different

### 1. Ownership Is Not Shares

**Corporation**:
- Ownership = shares
- Shares have par value (often $0.001)
- Total shares authorized vs issued vs outstanding
- Stock ledger is the official record

**LLC**:
- Ownership = membership interest (percentage OR units)
- No par value concept
- Capital accounts track economic position
- Operating agreement is the official record

### 2. Voting Can Differ From Ownership

**Corporation**:
- Voting rights attached to shares
- Common stock typically 1 vote per share
- Preferred may have special voting (veto rights)
- Generally: more shares = more votes

**LLC**:
- Voting rights set by operating agreement
- Can be per capita (each member = 1 vote)
- Can be per percentage interest
- Can be different for different decisions
- Voting % can differ from ownership %

**Example**:
```
Member A: 60% ownership, 40% voting, 50% profit allocation
Member B: 40% ownership, 60% voting, 50% profit allocation

This is NORMAL for an LLC. Impossible for a corporation.
```

### 3. Profit Allocation Is Flexible

**Corporation**:
- Dividends distributed pro-rata by shares
- Can't give 60% owner only 40% of dividends
- Preferred dividends are fixed (8% of liquidation preference)

**LLC**:
- Allocations defined by operating agreement
- Can allocate depreciation 100% to high-bracket member
- Can have preferred return waterfalls
- Can have promote/carry structures

**Example Waterfall**:
```
LLC DISTRIBUTION WATERFALL
──────────────────────────
Tier 1: Return of Capital
        - Until each member's capital account reaches $0

Tier 2: Preferred Return (8% IRR)
        - 100% to Investors until 8% IRR achieved

Tier 3: Catch-Up
        - 100% to Manager until Manager has 20% of cumulative distributions

Tier 4: Carried Interest
        - 80% to Investors, 20% to Manager (the "carry")
```

### 4. Management Structure Is Contractual

**Corporation**:
- MUST have board of directors (statutory requirement)
- Board appoints officers
- Shareholders elect board
- Structure is fixed by statute

**LLC**:
- No board required (unless operating agreement says so)
- Member-managed: all members run it (like general partnership)
- Manager-managed: designated managers run it (like LP)
- Operating agreement can create board-like structure if desired

### 5. Capital Accounts vs Stock Ledger

**Corporation Stock Ledger**:
```
Shareholder    | Shares    | Class   | Date Acquired | Cert #
───────────────┼───────────┼─────────┼───────────────┼───────
John Smith     | 1,000,000 | Common  | 2020-01-15    | C-001
Jane Doe       | 500,000   | Common  | 2020-06-01    | C-002
Acme Ventures  | 2,000,000 | Series A| 2021-03-15    | P-001
```

**LLC Capital Account**:
```
Member         | Contributions | Allocated  | Allocated | Distributions | Balance
               |               | Profit     | Loss      |               |
───────────────┼───────────────┼────────────┼───────────┼───────────────┼─────────
John Smith     | $100,000      | +$50,000   | -$10,000  | -$30,000      | $110,000
Jane Doe       | $50,000       | +$25,000   | -$5,000   | -$15,000      | $55,000
Acme Ventures  | $1,000,000    | +$200,000  | -$40,000  | -$100,000     | $1,060,000
```

The capital account is a running balance, not a static share count.

---

## The Tax Classification Wrinkle

### Check-the-Box Elections

An LLC's TAX treatment is independent of its LEGAL structure:

| LLC Type | Default Tax Treatment | Can Elect |
|----------|----------------------|-----------|
| Single-Member | Disregarded Entity | C-Corp, S-Corp |
| Multi-Member | Partnership | C-Corp, S-Corp |

**Common Scenario**: LLC taxed as S-Corp
- Legal structure: LLC (operating agreement, members)
- Tax structure: S-Corp (salary requirements, K-1s)
- Must track BOTH dimensions

### Why This Matters for Data Model

```
CANNOT DO:
entityType: 'llc' | 'corporation' | 's_corp'  // WRONG - S-Corp is tax election

MUST DO:
legalStructure: 'corporation' | 'llc' | 'lp' | 'llp'
taxClassification: 'c_corp' | 's_corp' | 'partnership' | 'disregarded'
```

---

## Data Model Implications

### Current Schema Problem

The current schema (schema.ts:163-197) assumes corporate paradigm:

```typescript
shareholders: {
  shareholderType: varchar,
  name: varchar,
  // ... corporate framing
}

shareClasses: {
  className: varchar,
  authorizedShares: integer,  // LLCs don't have "authorized shares"
  parValue: integer,          // LLCs don't have par value
  votingRightsPerShare: integer,  // LLCs vote by % or per capita
  // ...
}

shareholdings: {
  shareholderId: uuid,
  shareClassId: uuid,
  sharesOwned: integer,  // LLCs have % or units, not shares
  // ...
}
```

### Required Parallel Structure

Need LLC-specific tables that won't fit in corporate structure:

```typescript
// Operating Agreement (not bylaws)
operatingAgreements: {
  id: uuid,
  entityId: uuid,
  effectiveDate: timestamp,
  amendmentNumber: integer,

  // Management structure
  managementType: 'member_managed' | 'manager_managed',

  // Allocation provisions (complex JSON)
  allocationProvisions: jsonb,  // Rules for profit/loss allocation
  distributionProvisions: jsonb,  // Waterfall structure
  votingProvisions: jsonb,  // Per capita, per interest, by matter

  // Transfer restrictions
  transferRestrictions: jsonb,  // ROFR, tag-along, drag-along

  fileStorageKey: varchar,
}

// Members (not shareholders)
members: {
  id: uuid,
  entityId: uuid,
  memberType: 'individual' | 'entity' | 'trust',
  name: varchar,

  // Ownership (can be % or units)
  membershipPercentage: integer,  // basis points
  membershipUnits: integer,  // if unit-based

  // Voting (can differ from ownership)
  votingPercentage: integer,  // basis points

  // Status
  admissionDate: timestamp,
  withdrawalDate: timestamp,

  // Tax
  taxId: varchar,
  taxAddress: jsonb,
}

// Capital Accounts (the heart of LLC economics)
capitalAccounts: {
  id: uuid,
  entityId: uuid,
  memberId: uuid,
  asOfDate: timestamp,

  // Running totals
  contributions: integer,  // cumulative contributions
  allocatedProfits: integer,  // cumulative allocated profits
  allocatedLosses: integer,  // cumulative allocated losses
  distributions: integer,  // cumulative distributions

  // Calculated
  balance: integer,  // contributions + profits - losses - distributions

  // Tax basis (different from book capital account!)
  taxBasis: integer,
}

// Capital Transactions (audit trail for capital account)
capitalTransactions: {
  id: uuid,
  capitalAccountId: uuid,
  transactionType: 'contribution' | 'allocation' | 'distribution',
  amount: integer,
  transactionDate: timestamp,
  description: text,
  taxYear: integer,
}

// Managers (for manager-managed LLCs)
managers: {
  id: uuid,
  entityId: uuid,
  personId: uuid,
  name: varchar,
  appointmentDate: timestamp,
  terminationDate: timestamp,
  hasSigningAuthority: boolean,
  compensationAmount: integer,
}
```

---

## Special Allocations Deep Dive

### What Makes Them "Special"

Normal allocation: 50% owner gets 50% of profits
Special allocation: 50% owner gets 70% of depreciation (to utilize their tax losses)

### IRS Requirements

Special allocations must have "substantial economic effect" (IRC §704(b)):

1. **Economic Effect**: Allocation must affect dollar amounts, not just tax items
2. **Substantiality**: Must have reasonable possibility of affecting amounts independent of tax

### Why Entity-Governance Cares

- Must track allocation PROVISIONS (what the operating agreement says)
- Must track allocation EVENTS (what actually happened each year)
- K-1 preparation (tax service) needs this data
- Waterfall calculations need allocation rules

---

## The Series LLC Complication

### What Is a Series LLC?

A single LLC with multiple internal "series," where each series:
- Has its own members
- Has its own assets
- Has its own liabilities (shielded from other series)
- Can have its own operating agreement provisions

### Data Model Challenge

```
SERIES LLC STRUCTURE
────────────────────
Master LLC
├── Series A (Real Estate Property 1)
│   ├── Members: John (50%), Jane (50%)
│   ├── Assets: $500K property
│   └── Liabilities: $300K mortgage
│
├── Series B (Real Estate Property 2)
│   ├── Members: John (100%)
│   ├── Assets: $800K property
│   └── Liabilities: $500K mortgage
│
└── Series C (Operating Business)
    ├── Members: John (50%), New Investor (50%)
    ├── Assets: Business operations
    └── Liabilities: Business debt

If Series C is sued → Only Series C assets at risk
                   → Series A and B protected
```

### Required Schema Extension

```typescript
llcSeries: {
  id: uuid,
  masterEntityId: uuid,  // The parent LLC
  seriesName: varchar,
  seriesDesignation: varchar,  // "Series A", etc.
  effectiveDate: timestamp,
  // Each series can have its own:
  managementType: 'member_managed' | 'manager_managed',
  operatingAgreementKey: varchar,  // Series-specific provisions
}

// Members can belong to specific series
seriesMembers: {
  id: uuid,
  seriesId: uuid,
  memberId: uuid,
  membershipPercentage: integer,
  votingPercentage: integer,
  admissionDate: timestamp,
}

// Capital accounts per series
seriesCapitalAccounts: {
  id: uuid,
  seriesId: uuid,
  memberId: uuid,
  // ... same as capital accounts but series-specific
}
```

---

## Migration Considerations

### Existing Entities

Current `shareholdings` data for LLCs is technically incorrect but functional:
- "Shares owned" is really membership units
- No capital account tracking
- No special allocation support

**Migration Strategy**:
1. For existing LLC records, create `members` entries from `shareholders`
2. Create initial `capitalAccounts` with contributions = shares × par value (approximation)
3. Mark as "migrated - needs review"
4. Don't delete `shareholdings` until verified

### New Entities

For new LLCs after Phase 2:
- Use `members` and `capitalAccounts` from the start
- Skip `shareholders`/`shareholdings` entirely for LLCs
- Operating agreement provisions drive behavior

---

## Open Questions

1. **Special Allocation Validation**: How do we validate that allocation provisions have "substantial economic effect"? Is this entity-governance's job or tax service's?

2. **Waterfall Calculation Engine**: Should complex waterfall calculations live in entity-governance or be delegated to a finance service?

3. **Series LLC Interstate Recognition**: What happens when a Series LLC formed in Delaware operates in California (which doesn't recognize series)?

4. **Capital Account Reconciliation**: How do book capital accounts (entity-governance) reconcile with tax capital accounts (tax service)?

5. **Conversion Handling**: When an LLC converts to a Corporation, how do capital accounts translate to shares?

---

## Summary

LLCs are not corporations with less paperwork. They're a fundamentally different ownership paradigm based on partnership principles. The current corporate-centric schema cannot properly model LLC economics, governance, or compliance. Phase 2 must introduce parallel LLC structures, not force LLC data into corporate tables.

**The 70% Problem**: LLCs represent ~70% of new business formations. We've built our data model for the 30% case.

---

## Sources

- research/02-llc-operating-agreements.md (primary)
- research/04-entity-type-governance.md (comparison)
- Delaware LLC Act (6 Del. C. § 18-101 et seq.)
- IRC §704(b) - Partnership allocations
- IRS Rev. Rul. 99-5 - Check-the-box elections
