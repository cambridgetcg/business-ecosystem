# Holding Company Structures

## Knowledge Gap Identified

Our model tracks parent-subsidiary relationships and ownership percentages but doesn't capture the strategic reasons for these structures. Understanding WHY organizations use holding structures is essential for proper modeling.

## Key Findings

### Strategic Objectives of Holding Structures

| Objective | Structure Pattern | Key Consideration |
|-----------|------------------|-------------------|
| **Liability Isolation** | Separate subs per risk pool | Maintain corporate formalities |
| **Tax Efficiency** | 80%+ ownership, check-the-box | Document business purpose |
| **Investor Requirements** | Blocker corporations | Balance cost vs. benefit |
| **International Operations** | Regional holding companies | Substance requirements |
| **IP Protection** | IP holding subsidiary | Transfer pricing compliance |

### Liability Isolation

Each subsidiary is a separate "person" in law. If Operating Sub A faces a lawsuit, assets in Parent HoldCo and Operating Sub B are protected.

```
            Parent HoldCo
                 │
    ┌────────────┼────────────┐
    │            │            │
OpCo Alpha   OpCo Beta   OpCo Gamma
(High Risk)  (Med Risk)  (Low Risk)

If Alpha is sued for $100M:
- Alpha's assets at risk
- Beta and Gamma assets protected
- Parent assets protected (if veil maintained)
```

### Blocker Corporations

**What it is**: A C-Corporation inserted between certain investors and an operating partnership/LLC.

**Why it exists**: Tax-exempt investors (pensions, endowments) and foreign investors face problems with pass-through entities:

```
WITHOUT BLOCKER:
Pension Fund ──────► Operating LLC
(Tax-Exempt)        (Pass-Through)
                          │
                          ▼
                    UBTI flows through
                    Pension loses tax-exempt status!

WITH BLOCKER:
Pension Fund ──────► Blocker Corp ──────► Operating LLC
(Tax-Exempt)        (C-Corp)             (Pass-Through)
                          │
                          ▼
                    Blocker pays corporate tax
                    Pension receives dividends
                    Tax-exempt status preserved!
```

**Use cases**:
- Tax-exempt US investors (pensions, endowments)
- Foreign investors avoiding ECI and US filing requirements
- Investors who cannot receive K-1s

### Tax Efficiency: Dividends Received Deduction (DRD)

When a US corp receives dividends from another US corp it owns:

| Ownership % | Deduction |
|-------------|-----------|
| < 20% | 50% |
| 20-79% | 65% |
| ≥ 80% | 100% |

At 80%+ ownership, dividends flow up tax-free (100% DRD).

### Tax Efficiency: Consolidated Returns

When parent owns 80%+ of subsidiary:
- File single consolidated federal return
- Losses in one sub offset income in another
- Intercompany transactions eliminated
- Timing advantages

### Check-the-Box Entity Classification

Treasury regulations allow entities to elect their tax classification:

| Entity Type | Default Classification | Can Elect? |
|-------------|----------------------|------------|
| Corporation | C-Corporation | No (per se corp) |
| LLC (single member) | Disregarded entity | Yes → Corp |
| LLC (multi-member) | Partnership | Yes → Corp |
| LP, LLP | Partnership | Yes → Corp |

**Strategic Use: Disregarded Entity**:
```
Parent Corp
     │
     ▼ (100% owns)
Single-Member LLC
(State law: separate entity)
(Tax law: disregarded/invisible)

Result: Liability protection + no separate tax return
```

### Transfer Pricing

Intercompany transactions must be priced at "arm's length" (as if between unrelated parties).

**Common Transaction Types**:
| Transaction | Pricing Method |
|-------------|----------------|
| Goods sales | Comparable uncontrolled price (CUP) |
| Services | Cost-plus or comparable profits |
| IP licensing | Comparable royalty rates |
| Intercompany loans | Arm's length interest rates |
| Management fees | Cost allocation + markup |

**IP Holding Company Example**:
```
US Parent
     │
     ├──────────────────────────┐
     │                          │
US OpCo                    IP Holding Sub
(Operating entity)         (Delaware or Ireland)
     │                          │
     └──────────────────────────┘
                 │
                 ▼
      IP License Agreement
      (Royalty must be arm's length)
```

### International Structures: CFCs

**Controlled Foreign Corporation (CFC)**: Foreign corp where US shareholders (each 10%+) collectively own >50%.

**Key Concepts**:
| Concept | Description |
|---------|-------------|
| **Subpart F Income** | Passive income (dividends, interest, rents) + related-party transactions |
| **GILTI** | All CFC income exceeding 10% return on tangible assets |
| **Section 956** | Investment in US property triggers deemed dividend |
| **Previously Taxed Earnings** | Once US taxed, actual distributions are tax-free |

### Vertical vs. Horizontal Structures

**Vertical (Tiered)**:
```
     HoldCo
        │
     SubCo A
        │
     SubCo B
        │
     SubCo C
```
- Each entity owns the one below
- Sequential risk isolation
- Intermediate entities serve specific purposes

**Horizontal (Flat)**:
```
          HoldCo
             │
   ┌─────────┼─────────┐
   │         │         │
SubCo A   SubCo B   SubCo C
```
- Parent directly owns all subs
- Simpler governance
- Easier consolidated returns

**Hybrid (Common in Practice)**:
```
                Ultimate Parent
                       │
          ┌────────────┼────────────┐
          │            │            │
    US HoldCo     EMEA HoldCo   APAC HoldCo
          │            │            │
    ┌─────┼─────┐      │      ┌─────┼─────┐
    │     │     │      │      │     │     │
  OpCo1 OpCo2 IPCo   OpCo3  OpCo4 OpCo5 OpCo6
```

## Model Implications

### Recommended Schema Extensions

```typescript
// Entity Strategic Classification
// Add to legal_entities table:
purposeClassification: varchar('purpose_classification'),
// Values: 'operating', 'holding', 'ip_holding', 'real_estate_holding',
//         'blocker', 'finance_subsidiary', 'regional_holding'

taxClassification: varchar('tax_classification'),
// Values: 'c_corp', 's_corp', 'partnership', 'disregarded', 'foreign_corp'

// Tax Elections
export const taxElections = pgTable('tax_elections', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  electionType: varchar('election_type'), // 'check_the_box', 's_corp', 'qsub'
  electedClassification: varchar('elected_classification'),
  effectiveDate: timestamp('effective_date'),
  irsFormFiled: varchar('irs_form_filed'), // 'Form 8832', 'Form 2553'
  filedDate: timestamp('filed_date'),
  // ... audit columns
});

// Blocker Relationships
export const blockerRelationships = pgTable('blocker_relationships', {
  id: uuid('id').primaryKey(),
  blockerEntityId: uuid('blocker_entity_id').references(() => legalEntities.id),
  operatingEntityId: uuid('operating_entity_id').references(() => legalEntities.id),
  blockedInvestorTypes: text('blocked_investor_types').array(), // ['tax_exempt', 'foreign']
  effectiveDate: timestamp('effective_date'),
  // ... audit columns
});

// CFC Status Tracking
export const cfcStatus = pgTable('cfc_status', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  taxYear: integer('tax_year'),
  isCfc: boolean('is_cfc'),
  usOwnershipPercent: integer('us_ownership_percent'), // basis points
  subpartFIncome: integer('subpart_f_income'), // cents
  giltiIncome: integer('gilti_income'), // cents
  // ... audit columns
});
```

### Ownership Thresholds That Matter

The `parentSubsidiaryRelationships.ownershipPercentage` field drives critical determinations:

| Threshold | Significance |
|-----------|--------------|
| ≥10% | US shareholder for CFC purposes |
| ≥20% | 65% DRD eligibility |
| >50% | CFC status (with other 10%+ US shareholders) |
| ≥80% | 100% DRD, consolidated return eligibility |
| 100% | Disregarded entity election available |

System should alert when ownership changes cross these thresholds.

## Why This Matters

1. **Tax Integration** - Tax service needs to know structure purpose, not just relationships
2. **Compliance** - Different requirements for holding vs. operating companies
3. **Reporting** - Org charts should show tax classification
4. **Validation** - 80% threshold affects consolidated return eligibility
5. **International** - CFC status has significant US tax implications

## Questions for Further Research

1. How do we track effective ownership through multiple tiers?
2. Should we calculate CFC status automatically based on ownership?
3. How do we integrate transfer pricing documentation requirements?
4. How do we handle treaty benefits based on structure?
