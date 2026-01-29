# Research Finding: Control and Ownership Duality

## The Aha Moment

**Before Integration**: More ownership = more control

**After Integration**: Ownership and control are INDEPENDENT dimensions. You can have 100% control with 0% ownership, or 99% ownership with no control.

---

## The Core Insight

```
THE DUALITY MATRIX
══════════════════

                    LOW CONTROL                    HIGH CONTROL
                         │                              │
   ┌─────────────────────┼──────────────────────────────┼─────────────────────┐
   │                     │                              │                     │
   │  LIMITED PARTNER    │                              │  GENERAL PARTNER    │
H  │  - 99% ownership    │                              │  - 1% ownership     │
I  │  - 0% control       │                              │  - 100% control     │
G  │  - Limited liability│                              │  - Unlimited        │
H  │                     │                              │    liability        │
   │─────────────────────┼──────────────────────────────┼─────────────────────│
O  │                     │                              │                     │
W  │  PREFERRED STOCK    │                              │  CEO/EXECUTIVE      │
N  │  - 80% economic     │                              │  - 0% ownership     │
E  │  - 0 votes          │                              │  - Day-to-day       │
R  │  - Liquidation      │                              │    control          │
S  │    preference       │                              │  - "Substantial     │
H  │                     │                              │    control" (BOI)   │
I  │─────────────────────┼──────────────────────────────┼─────────────────────│
P  │                     │                              │                     │
   │  PASSIVE INVESTOR   │                              │  BOARD MEMBER       │
L  │  - <5% ownership    │                              │  - 0% ownership     │
O  │  - No board seat    │                              │  - Strategic        │
W  │  - Dividend rights  │                              │    decisions        │
   │    only             │                              │  - Director duties  │
   │                     │                              │                     │
   └─────────────────────┴──────────────────────────────┴─────────────────────┘
```

---

## Why This Matters for BOI/CTA

### The 25% OR Substantial Control Rule

The Corporate Transparency Act defines beneficial owner as someone with:

1. **Ownership**: 25% or more ownership interest, **OR**
2. **Substantial Control**: Exercise of substantial control over the entity

These are **independent triggers**. You only need ONE.

### Substantial Control Indicators

From FinCEN guidance, substantial control includes:

```
AUTOMATIC BENEFICIAL OWNERS (Substantial Control)
═════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│ SENIOR OFFICERS (regardless of ownership)                       │
│                                                                 │
│ ✓ CEO, President (or equivalent)                                │
│ ✓ CFO (or equivalent)                                           │
│ ✓ COO (or equivalent)                                           │
│ ✓ General Counsel (or equivalent)                               │
│ ✓ Any other officer performing similar functions                │
│                                                                 │
│ These are AUTOMATIC beneficial owners even with 0% ownership    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ OTHER SUBSTANTIAL CONTROL INDICATORS                            │
│                                                                 │
│ ○ Authority to appoint/remove board members or officers         │
│ ○ Authority over important decisions (contracts, loans, etc.)   │
│ ○ Any other form of substantial control                         │
│                                                                 │
│ These require EVALUATION to determine beneficial owner status   │
└─────────────────────────────────────────────────────────────────┘
```

### The "Important Decisions" Test

What constitutes authority over "important decisions"?

| Decision Type | Examples |
|--------------|----------|
| **Financial** | Major contracts, loans, capital allocation |
| **Strategic** | M&A, entering new markets, major partnerships |
| **Personnel** | Hiring/firing senior executives, compensation |
| **Governance** | Amending governing documents, issuing equity |
| **Operational** | Major asset purchases/sales, business line changes |

---

## Entity Type Variations

### Corporation

```
CORPORATE CONTROL STRUCTURE
───────────────────────────

SHAREHOLDERS
    │
    │ ELECT (based on voting shares)
    ▼
BOARD OF DIRECTORS
    │
    │ APPOINT
    ▼
OFFICERS (CEO, CFO, etc.)
    │
    │ MANAGE
    ▼
DAY-TO-DAY OPERATIONS

Control Flows Downward:
- Shareholders with voting shares → control board composition
- Board → controls officer appointment
- Officers → control operations

BUT: Economic rights may be separate
- Preferred stock: high economic, low/no voting
- Common stock: lower economic preference, voting rights
```

### LLC - Member-Managed

```
MEMBER-MANAGED LLC
──────────────────

ALL MEMBERS
    │
    │ DIRECTLY MANAGE (typically pro-rata to interest)
    ▼
OPERATIONS

Ownership typically = Control
- Each member has management rights
- Voting often per capita or per interest
- BUT operating agreement can override

Example Override:
Member A: 60% ownership, 40% voting
Member B: 40% ownership, 60% voting
```

### LLC - Manager-Managed

```
MANAGER-MANAGED LLC
───────────────────

MEMBERS                    MANAGERS
    │                          │
    │ Economic rights only     │ Management authority
    │ (like LPs)               │ (can be members or not)
    ▼                          ▼
DISTRIBUTIONS              OPERATIONS

Clear separation:
- Members own but don't control day-to-day
- Managers control but may not own
- Both can be beneficial owners for BOI
```

### Limited Partnership

```
LIMITED PARTNERSHIP STRUCTURE
─────────────────────────────

GENERAL PARTNER (GP)              LIMITED PARTNERS (LPs)
       │                                   │
       │ 1% ownership (typical)            │ 99% ownership (typical)
       │ UNLIMITED liability               │ LIMITED liability
       │ FULL control                      │ NO control (or lose protection)
       ▼                                   ▼
   OPERATIONS                          PASSIVE INVESTMENT

The Ultimate Duality:
- GP: Maximum control, maximum liability, minimum ownership
- LP: Minimum control, minimum liability, maximum ownership

WHY? LP protection requires passivity:
- If LP participates in control → becomes GP for liability purposes
- Control and liability are linked, not ownership and liability
```

---

## Data Model Implications

### Current Schema Problem

```typescript
// Current assumption (WRONG)
interface Shareholder {
  sharesOwned: number;     // Ownership only
  // Control derived from shares
}

// Reality needed
interface BeneficialOwner {
  // Ownership dimension
  ownershipPercentage: number;
  ownershipBasis: 'equity' | 'capital' | 'profits' | 'voting';

  // Control dimension (INDEPENDENT)
  isSubstantialControl: boolean;
  controlBasis: ControlIndicator[];

  // Either triggers BOI reporting
  isBeneficialOwner: boolean;  // ownership >= 25% OR isSubstantialControl
}

type ControlIndicator =
  | 'senior_officer_ceo'
  | 'senior_officer_cfo'
  | 'senior_officer_coo'
  | 'senior_officer_gc'
  | 'senior_officer_other'
  | 'appoints_removes_officers'
  | 'appoints_removes_directors'
  | 'important_decisions_authority'
  | 'other_substantial_control';
```

### Required Tracking

```typescript
// Officers table (automatic substantial control)
officers: {
  id: uuid,
  entityId: uuid,
  personId: uuid,
  title: varchar,  // 'CEO', 'CFO', etc.
  titleCategory: 'senior_officer' | 'other_officer',
  appointmentDate: timestamp,
  terminationDate: timestamp,

  // For BOI
  isBeneficialOwner: boolean,  // TRUE for senior officers
  controlBasis: varchar,  // 'senior_officer_ceo', etc.
}

// Beneficial owners table (separate from shareholders)
beneficialOwners: {
  id: uuid,
  entityId: uuid,
  personId: uuid,

  // Ownership prong
  ownershipPercentage: integer,  // basis points
  meetsOwnershipThreshold: boolean,  // >= 25%

  // Control prong
  hasSubstantialControl: boolean,
  controlIndicators: jsonb,  // array of ControlIndicator

  // Combined determination
  isBeneficialOwner: boolean,  // ownership OR control
  determinationBasis: 'ownership' | 'control' | 'both',

  // BOI filing data
  fincenId: varchar,
  identificationDocument: jsonb,
}
```

---

## Multi-Tier Control Calculation

### The Indirect Control Question

If A controls B, and B controls C, does A control C for BOI purposes?

```
DIRECT vs INDIRECT CONTROL
──────────────────────────

Scenario:
┌─────────┐
│    A    │ (Individual)
│  CEO of │
└────┬────┘
     │ substantial control
     ▼
┌─────────┐
│    B    │ (Holding Company)
│ 60% of  │
└────┬────┘
     │ majority ownership
     ▼
┌─────────┐
│    C    │ (Operating Company)
│         │
└─────────┘

Question: Is A a beneficial owner of C?

Answer: PROBABLY YES
- A has substantial control over B
- B has substantial control over C (majority ownership)
- Control "flows through" → A indirectly controls C
```

### FinCEN Guidance on Indirect Ownership

From the BOI rule:
- "Ownership interest" includes indirect ownership through other entities
- Must trace ownership through any number of intermediate entities
- BUT: Stops at reporting company exemptions

### Control Through Ownership Structures

| A's Position | A's Ownership of B | B's Ownership of C | A's Effective Ownership of C | A is BO of C? |
|-------------|-------------------|-------------------|------------------------------|---------------|
| CEO of B | 0% | 60% | 0% directly, controls 60% | YES (control) |
| Investor | 30% | 60% | 18% effective | NO (< 25%) |
| Investor | 50% | 60% | 30% effective | YES (>= 25%) |
| CEO + Investor | 30% | 60% | 18% + controls 60% | YES (control) |

---

## Liability Follows Control, Not Ownership

### Parent-Subsidiary Veil Piercing

Courts look at CONTROL indicators for veil piercing:

```
VEIL PIERCING FACTORS (Control-Based)
─────────────────────────────────────

✓ Parent CONTROLLED subsidiary's daily operations
✓ Parent and subsidiary shared officers/directors
✓ Parent made business decisions for subsidiary
✓ Parent controlled subsidiary's finances
✓ Subsidiary was undercapitalized by parent

✗ Parent merely OWNED subsidiary (not enough)
✗ Parent received dividends from subsidiary (not enough)
✗ Parent consolidated financial statements (not enough)

Key Insight:
Ownership alone ≠ piercing
Control indicators = piercing risk
```

### General Partner Liability

```
GP LIABILITY ILLUSTRATION
─────────────────────────

LP Structure:
- GP: 1% ownership, full control
- LPs: 99% ownership, no control

If LP has $100M in liabilities:
- GP personally liable for $100M (despite 1% ownership)
- LPs liable only for their contributions (despite 99% ownership)

WHY: Liability follows CONTROL, not ownership
- GP exercises control → unlimited liability
- LPs passive → limited liability

LP who participates in control:
- Loses limited liability protection
- Becomes liable as if a GP
- Control = liability, regardless of formal status
```

---

## Practical Scenarios

### Scenario 1: Investor vs CEO

```
TechCorp Inc. Structure:
- Founder/CEO: 15% ownership, runs company
- VC Firm: 40% ownership, 2 board seats
- Other investors: 45% ownership

Who are beneficial owners?

Founder/CEO:
- Ownership: 15% < 25% threshold ❌
- Control: Senior officer (CEO) ✓
- Result: BENEFICIAL OWNER via control

VC Firm:
- Ownership: 40% >= 25% threshold ✓
- Control: Board seats = may appoint/remove ✓
- Result: BENEFICIAL OWNER via ownership (also control)

Other investors:
- Ownership: each < 25% ❌
- Control: no operational involvement ❌
- Result: NOT beneficial owners
```

### Scenario 2: Silent vs Active Partner

```
ConsultingCo LLC (Member-Managed):
- Active Partner: 20% ownership, does all work, makes all decisions
- Silent Partner: 80% ownership, purely passive

Who are beneficial owners?

Active Partner:
- Ownership: 20% < 25% ❌
- Control: Runs the business, important decisions ✓
- Result: BENEFICIAL OWNER via substantial control

Silent Partner:
- Ownership: 80% >= 25% ✓
- Control: Passive ❌
- Result: BENEFICIAL OWNER via ownership

Both are beneficial owners, but for DIFFERENT reasons
```

### Scenario 3: Manager-Managed LLC

```
RealEstateCo LLC (Manager-Managed):
- Members: 10 investors, each 10% ownership
- Manager: 0% ownership, makes all operational decisions

Who are beneficial owners?

Each Member:
- Ownership: 10% < 25% ❌
- Control: Passive (manager-managed) ❌
- Result: NOT beneficial owners

Manager:
- Ownership: 0% ❌
- Control: Runs the company, all important decisions ✓
- Result: BENEFICIAL OWNER via substantial control

ONLY the non-owner manager is a beneficial owner
```

---

## Implementation Requirements

### Dual-Path Beneficial Owner Detection

```typescript
function determineBeneficialOwners(entity: LegalEntity): BeneficialOwner[] {
  const owners: BeneficialOwner[] = [];

  // Path 1: Ownership threshold (>= 25%)
  const ownershipOwners = entity.equityHolders
    .filter(h => calculateOwnershipPercentage(h) >= 2500)  // basis points
    .map(h => ({
      personId: h.personId,
      isBeneficialOwner: true,
      determinationBasis: 'ownership',
      ownershipPercentage: calculateOwnershipPercentage(h),
      hasSubstantialControl: false,
      controlIndicators: [],
    }));

  // Path 2: Substantial control
  const controlOwners = [
    // Senior officers (automatic)
    ...entity.officers
      .filter(o => o.titleCategory === 'senior_officer')
      .map(o => ({
        personId: o.personId,
        isBeneficialOwner: true,
        determinationBasis: 'control',
        ownershipPercentage: findOwnership(o.personId, entity),
        hasSubstantialControl: true,
        controlIndicators: [o.controlBasis],
      })),

    // Other substantial control (evaluated)
    ...entity.controlPersons
      .filter(cp => cp.hasSubstantialControl)
      .map(cp => ({
        personId: cp.personId,
        isBeneficialOwner: true,
        determinationBasis: 'control',
        ownershipPercentage: findOwnership(cp.personId, entity),
        hasSubstantialControl: true,
        controlIndicators: cp.indicators,
      })),
  ];

  // Merge (some may qualify via both paths)
  return mergeUnique(ownershipOwners, controlOwners, (a, b) =>
    a.personId === b.personId ? { ...a, ...b, determinationBasis: 'both' } : null
  );
}
```

### Events for Control Changes

```typescript
// Control change events (trigger BOI updates)
OFFICER_APPOINTED: 'entity-governance.officer.appointed',
OFFICER_TERMINATED: 'entity-governance.officer.terminated',
OFFICER_TITLE_CHANGED: 'entity-governance.officer.title-changed',

CONTROL_PERSON_IDENTIFIED: 'entity-governance.control.person-identified',
CONTROL_PERSON_REMOVED: 'entity-governance.control.person-removed',

BENEFICIAL_OWNER_ADDED: 'entity-governance.boi.owner-added',
BENEFICIAL_OWNER_REMOVED: 'entity-governance.boi.owner-removed',
BENEFICIAL_OWNER_CHANGED: 'entity-governance.boi.owner-changed',
```

---

## Open Questions

1. **Informal Control**: How do you document control exercised through family relationships, economic pressure, or informal influence?

2. **Shared Control**: If 3 people share substantial control (committee decision-making), are all 3 beneficial owners?

3. **Control Through Contract**: If a service provider has veto rights over certain decisions via contract, is that substantial control?

4. **Delegated Authority**: If CEO delegates all decisions to COO, does CEO remain beneficial owner?

5. **Control Threshold**: Is there a minimum level of "important decisions" authority that triggers substantial control?

---

## Summary

Control and ownership are independent dimensions:
- **Ownership** = economic interest (dividends, distributions, liquidation proceeds)
- **Control** = decision-making power (operations, strategy, governance)

For BOI/CTA compliance, must track BOTH:
- 25% ownership threshold
- Substantial control indicators (especially senior officers)

For liability protection, control matters more than ownership:
- Veil piercing looks at control behavior
- LP status depends on NOT exercising control
- GP liability unlimited regardless of ownership %

**The Implementation Takeaway**: Cannot derive control from ownership. Must track independently and combine for beneficial owner determination.

---

## Sources

- research/03-beneficial-ownership-cta.md (primary)
- research/04-entity-type-governance.md (entity variations)
- FinCEN BOI Final Rule (31 CFR 1010.380)
- FinCEN Small Entity Compliance Guide
- Veil piercing case law principles

