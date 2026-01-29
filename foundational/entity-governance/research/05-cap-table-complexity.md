# Cap Table Complexity and Equity Structures

## Knowledge Gap Identified

Our current model has basic share classes and shareholdings, but real cap tables include:
- Liquidation preferences with multiple types
- Anti-dilution provisions
- Convertible instruments (SAFEs, notes)
- Option pools
- Waterfall calculations
- 409A valuations

## Key Findings

### Liquidation Preferences

When a company exits (acquisition or liquidation), proceeds are distributed according to a "waterfall" that respects liquidation preferences.

**Types of Liquidation Preferences**:

| Type | Description | Investor Impact |
|------|-------------|-----------------|
| **Non-Participating** | Get preference OR convert to common (not both) | Standard; choose greater amount |
| **Participating** | Get preference AND share in remaining proceeds | More aggressive; double-dip |
| **Capped Participating** | Participate up to a cap (e.g., 3x), then stop | Compromise position |

**Example Waterfall** ($50M exit):

```
NON-PARTICIPATING 1X
────────────────────
Series A invested $10M for 20%

Option 1: Take $10M preference
Option 2: Convert to common, get 20% × $50M = $10M

Same result - choose either.

At $100M exit:
Option 1: Take $10M preference
Option 2: Convert to common, get 20% × $100M = $20M

Series A converts → better outcome.
```

```
PARTICIPATING 1X
────────────────
Series A invested $10M for 20%

At $50M exit:
Step 1: Series A takes $10M preference
Step 2: Remaining $40M split pro-rata
        Series A gets 20% × $40M = $8M
Step 3: Series A total = $10M + $8M = $18M

Founders get: 80% × $40M = $32M
(vs. $40M with non-participating)
```

### Anti-Dilution Provisions

Protect investors when company raises at a lower valuation (down round).

| Type | Description | Dilution to Founders |
|------|-------------|---------------------|
| **Full Ratchet** | Conversion price drops to new price | MAXIMUM dilution |
| **Broad-Based Weighted Average** | Price adjusted by weighted formula | MODERATE dilution |
| **Narrow-Based Weighted Average** | Same formula, smaller share count | LESS MODERATE dilution |

**Broad-Based Weighted Average Formula**:

```
New Conversion Price = CP × (A + B) / (A + C)

Where:
CP = Current conversion price
A = Shares outstanding before new round
B = Shares that would issue at current price
C = Shares actually issued in new round
```

### Convertible Instruments

**SAFEs (Simple Agreement for Future Equity)**:
- NOT debt (no interest, no maturity)
- Converts to equity at next priced round
- Has valuation cap and/or discount
- Created by Y Combinator, industry standard for seed rounds

```
SAFE CONVERSION MECHANICS
─────────────────────────
SAFE: $500K at $5M cap, 20% discount

Series A: $10M pre-money, $1.00/share

Cap Conversion: $5M cap ÷ $10M = 50% = $0.50/share
Discount Conversion: $1.00 × (1 - 20%) = $0.80/share

SAFE converts at LOWER price → $0.50/share
$500K ÷ $0.50 = 1,000,000 shares
```

**Convertible Notes**:
- IS debt (has interest and maturity date)
- Principal + accrued interest converts
- Has valuation cap and/or discount
- If no conversion by maturity → company must repay (awkward)

### Option Pools and Equity Incentive Plans

**Option Pool**: Shares reserved for future employee grants.

```
OPTION POOL TRACKING
────────────────────
Authorized Pool:           1,500,000 shares
├── Granted, Unvested:       500,000 shares
├── Granted, Vested:         200,000 shares
├── Exercised → Common:      100,000 shares
└── Available for Grants:    700,000 shares
```

**The Option Pool Shuffle**:
Investors often require option pool expansion BEFORE their round (in pre-money), diluting founders more than if pool came from post-money.

### Fully Diluted vs Issued and Outstanding

| Calculation | What It Counts | Use Case |
|-------------|----------------|----------|
| **Issued & Outstanding** | Only actually issued shares | Legal ownership |
| **Fully Diluted** | Issued + all potential shares (options, SAFEs, notes) | Investor negotiations, 409A |

```
FULLY DILUTED CALCULATION
─────────────────────────
Common Stock issued:              8,000,000
Preferred Stock (as-if converted): 2,000,000
Options outstanding:              1,500,000
Warrants:                           300,000
SAFE conversions (estimated):       700,000
Convertible notes (estimated):      500,000
                                 ──────────
TOTAL FULLY DILUTED:             13,000,000

Founder owns 4M shares:
- 50% of issued (8M)
- 30.8% fully diluted (13M)  ← This is what matters
```

### Pro-Rata Rights and Preemptive Rights

**Pro-Rata Rights**: Right to invest in future rounds to maintain ownership percentage.

**ROFR (Right of First Refusal)**: Right to match any offer to purchase shares from existing shareholders.

**Co-Sale (Tag-Along)**: Right to sell proportionally when founders/major holders sell.

### 409A Valuations

**What it is**: Independent appraisal of common stock fair market value for tax purposes.

**Why it matters**: Options granted below FMV trigger immediate taxation + 20% penalty.

**When required**:
- After any priced financing round
- Every 12 months
- After material events
- Before granting options

**Key insight**: Common stock is worth LESS than preferred because:
- No liquidation preference
- No anti-dilution protection
- No information rights
- No voting/control rights

Typical ratio: Common 409A = 25-35% of preferred price

## Model Implications

### Current Schema Gaps

1. **`share_classes`** has basic `liquidation_preference` integer but no type (participating/non-participating)
2. **No `multiple`** field (1x, 2x, etc.)
3. **No `seniority_rank`** for waterfall ordering
4. **No anti-dilution tracking**
5. **No convertible instruments table** (SAFEs, notes)
6. **No option pool management**
7. **No 409A valuation tracking**

### Recommended Extensions

```typescript
// Enhanced Liquidation Preferences
export const liquidationPreferences = pgTable('liquidation_preferences', {
  id: uuid('id').primaryKey(),
  shareClassId: uuid('share_class_id').references(() => shareClasses.id),
  preferenceType: varchar('preference_type'), // 'non_participating', 'participating', 'capped_participating'
  multiple: integer('multiple'), // 100 = 1x, 200 = 2x (basis points)
  participationCap: integer('participation_cap'), // null = uncapped
  seniorityRank: integer('seniority_rank'), // 1 = most senior
  // ... audit columns
});

// Anti-Dilution Terms
export const antiDilutionTerms = pgTable('anti_dilution_terms', {
  id: uuid('id').primaryKey(),
  shareClassId: uuid('share_class_id').references(() => shareClasses.id),
  antiDilutionType: varchar('anti_dilution_type'), // 'full_ratchet', 'broad_weighted_avg', 'narrow_weighted_avg', 'none'
  carveOuts: jsonb('carve_outs'), // Exceptions (option pool, etc.)
  // ... audit columns
});

// Convertible Instruments
export const convertibleInstruments = pgTable('convertible_instruments', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  holderId: uuid('holder_id').references(() => shareholders.id),
  instrumentType: varchar('instrument_type'), // 'safe', 'convertible_note', 'warrant'
  principalAmount: integer('principal_amount'), // cents
  valuationCap: integer('valuation_cap'), // cents
  discountPercent: integer('discount_percent'), // basis points
  interestRate: integer('interest_rate'), // basis points (for notes)
  maturityDate: timestamp('maturity_date'),
  issueDate: timestamp('issue_date'),
  status: varchar('status'), // 'outstanding', 'converted', 'repaid'
  // Conversion details
  conversionDate: timestamp('conversion_date'),
  convertedToShareClassId: uuid('converted_to_share_class_id'),
  sharesIssued: integer('shares_issued'),
  // ... audit columns
});

// Option Pool Management
export const optionPools = pgTable('option_pools', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  planName: varchar('plan_name'),
  shareClassId: uuid('share_class_id').references(() => shareClasses.id),
  authorizedShares: integer('authorized_shares'),
  effectiveDate: timestamp('effective_date'),
  expirationDate: timestamp('expiration_date'),
  // ... audit columns
});

// 409A Valuations
export const valuations409a = pgTable('valuations_409a', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  valuationDate: timestamp('valuation_date'),
  effectiveUntil: timestamp('effective_until'),
  commonShareFmv: integer('common_share_fmv'), // cents
  methodology: varchar('methodology'),
  valuationFirm: varchar('valuation_firm'),
  reportStorageKey: varchar('report_storage_key'),
  // ... audit columns
});
```

## Why This Matters

1. **Investor Relations** - Investors care deeply about preference mechanics
2. **Exit Planning** - Waterfall analysis determines who gets what
3. **Employee Compensation** - Option grants need current 409A
4. **Fundraising** - Understanding cap table is essential for term sheet negotiation
5. **Legal Compliance** - 409A violations have severe tax penalties

## Questions for Further Research

1. How do we model scenario analysis (exit at different valuations)?
2. Should waterfall calculations be in entity-governance or a separate finance service?
3. How do we handle QSBS (Qualified Small Business Stock) tracking?
4. What reporting/visualization does the cap table need?
