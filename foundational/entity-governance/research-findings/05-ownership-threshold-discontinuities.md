# Research Finding: Ownership Threshold Discontinuities

## The Aha Moment

**Before Integration**: Ownership % is a continuous variable with gradual effects

**After Integration**: Specific ownership thresholds create DISCRETE compliance changes - cliff effects where 0.1% difference triggers completely different obligations

---

## The Core Insight

```
OWNERSHIP AS CLIFF EFFECTS
══════════════════════════

MENTAL MODEL: "More ownership = more responsibility (gradual)"

REALITY: "Cross a threshold = completely different rules"

     0%                                                           100%
     │                                                             │
     │    10%        20%        25%        50%        80%          │
     │     │          │          │          │          │           │
     ├─────┼──────────┼──────────┼──────────┼──────────┼───────────┤
     │     │          │          │          │          │           │
     │     ▼          ▼          ▼          ▼          ▼           │
     │   US SH     DRD 65%    BOI         CFC       DRD 100%      │
     │   for CFC   kicks in   REPORTING   status    Consolidated  │
     │                        REQUIRED               returns OK    │
     │                                                             │

At 24.9%: No BOI reporting required
At 25.0%: Full BOI reporting with FinCEN identification

This is not gradual. This is a compliance cliff.
```

---

## The Threshold Map

### Tax Thresholds

```
TAX OWNERSHIP THRESHOLDS
────────────────────────

10% THRESHOLD
├── Purpose: US Shareholder status for Controlled Foreign Corporation (CFC)
├── Trigger: 10%+ voting power OR value
├── Consequence: Must include pro-rata share of Subpart F income
└── Citation: IRC §951(b)

20% THRESHOLD
├── Purpose: Affiliates for consolidated returns (partial)
├── Trigger: 20%+ voting power
├── Consequence: 65% Dividends Received Deduction (not 50%)
└── Citation: IRC §243(c)

50% THRESHOLD (Control)
├── Purpose: CFC status determination
├── Trigger: >50% voting power controlled by US shareholders
├── Consequence: Corporation is a CFC; complex reporting begins
└── Citation: IRC §957(a)

Note: CFC requires BOTH:
- Corporation is >50% controlled by US shareholders
- Counting only shareholders who are ≥10% US shareholders

80% THRESHOLD
├── Purpose: Affiliated group status
├── Trigger: 80%+ voting power AND 80%+ value
├── Consequence:
│   ├── 100% Dividends Received Deduction
│   ├── Eligibility for consolidated tax returns
│   └── Potential deferred intercompany gains
└── Citation: IRC §243(b), §1504(a)

100% THRESHOLD
├── Purpose: Disregarded entity election
├── Trigger: Single owner (100%)
├── Consequence: Can elect to be disregarded for tax purposes
└── Citation: Treas. Reg. §301.7701-3
```

### Regulatory Thresholds

```
BENEFICIAL OWNERSHIP (CTA/BOI) THRESHOLDS
─────────────────────────────────────────

25% THRESHOLD
├── Purpose: Beneficial owner identification for FinCEN
├── Trigger: 25%+ ownership interest (equity, capital, profit, voting)
├── Consequence:
│   ├── Must report to FinCEN within deadlines
│   ├── Must provide identification documents
│   ├── Updates required within 30 days of changes
│   └── $500/day civil penalties for non-compliance
└── Citation: 31 CFR 1010.380

Note: Also triggered by "substantial control" regardless of ownership %
```

```
SEC BENEFICIAL OWNERSHIP THRESHOLDS
───────────────────────────────────

5% THRESHOLD
├── Purpose: Schedule 13D/13G reporting
├── Trigger: 5%+ of voting class of public company
├── Consequence: Must file with SEC within 10 days
└── Citation: Exchange Act §13(d)

10% THRESHOLD
├── Purpose: Section 16 insider status
├── Trigger: 10%+ beneficial ownership of public company
├── Consequence:
│   ├── Short-swing profit rule (§16(b))
│   ├── Form 3/4/5 reporting requirements
│   └── Trading restrictions
└── Citation: Exchange Act §16
```

### Corporate Governance Thresholds

```
DELAWARE CORPORATE LAW THRESHOLDS
─────────────────────────────────

MAJORITY (>50%)
├── Routine matters
├── Director elections (plurality for uncontested)
├── Most shareholder approvals

SUPERMAJORITY (Often 66.7% or 75%)
├── Charter amendments (as specified)
├── Merger approval (DGCL: majority of outstanding)
├── Sale of all/substantially all assets

CONTROLLING SHAREHOLDER
├── Undefined precisely but generally >50% OR
├── Practical control through voting agreements
├── Triggers fiduciary duties to minority shareholders
```

---

## The Cliff Effect Problem

### Scenario: Approaching 25%

```
APPROACHING BOI THRESHOLD
─────────────────────────

Day 0: Investor owns 24.5%
       Status: NOT a beneficial owner
       Obligations: None under CTA

Day 1: Company issues new shares, investor now owns 25.1%
       Status: IS a beneficial owner
       Obligations:
       ├── Report within 30 days (if existing company)
       ├── Provide government ID
       ├── Provide identifying information
       └── Monitor for changes

The 0.6% change created FULL compliance obligations
```

### Scenario: Crossing 80%

```
CROSSING AFFILIATED GROUP THRESHOLD
───────────────────────────────────

Before: Parent owns 79% of Subsidiary
        Status: Not an affiliated group
        Tax implications:
        ├── 65% Dividends Received Deduction
        ├── Cannot file consolidated returns
        └── Intercompany transactions taxable

After: Parent acquires additional 2%, now owns 81%
       Status: Affiliated group
       Tax implications:
       ├── 100% Dividends Received Deduction
       ├── CAN file consolidated returns
       ├── Intercompany gains can be deferred
       └── BUT: More complex compliance

The 2% change transformed the entire tax structure
```

### Scenario: Losing CFC Status

```
LOSING CFC CONTROL
──────────────────

Before: US shareholders own 51% (CFC status)
        Obligations:
        ├── Report Subpart F income
        ├── Complex Form 5471 filing
        ├── PFIC analysis not needed

After: US ownership drops to 49%
       Status: No longer CFC
       Implications:
       ├── No more Subpart F inclusions
       ├── BUT: Now potentially PFIC
       ├── PFIC rules may be WORSE
       └── Different compliance regime entirely

Crossing the threshold doesn't simplify - it changes the entire framework
```

---

## Convertible Instruments Complexity

### The "When" Problem

When do convertible instruments count toward thresholds?

```
SAFE/CONVERTIBLE NOTE THRESHOLD ANALYSIS
────────────────────────────────────────

Scenario: SAFE with $2M investment, company valued at $8M
          If converted today: SAFE holder would own 25%

Question: Is SAFE holder a beneficial owner TODAY?

FinCEN BOI Position:
├── "Ownership interest" includes rights to acquire
├── BUT: SAFE is not yet equity
├── Resolution: Look at "equity, capital, profits, or voting" rights
├── SAFE holder has NO current equity, capital account, profits, or votes
└── Likely NOT a beneficial owner until conversion

Tax Position:
├── Not ownership until conversion
├── But watch for constructive ownership rules
└── Attribution rules may apply differently

SEC Position (if public):
├── 13D: Includes convertible securities in some calculations
├── Form 4: Complex rules on derivative securities
└── Different than tax and CTA rules
```

### The Denominator Problem

What's the ownership percentage when convertibles exist?

```
FULLY DILUTED VS ACTUAL OWNERSHIP
─────────────────────────────────

Cap Table:
├── Founder: 6M shares (actual)
├── Investor A: 2M shares (actual)
├── Investor B: SAFE converting to 2M shares (not yet issued)
├── Option Pool: 2M options outstanding (not exercised)

Actual Outstanding: 8M shares
Fully Diluted: 12M shares

Founder's Ownership:
├── Actual: 6M / 8M = 75%
├── Fully Diluted: 6M / 12M = 50%

Which matters for BOI threshold?
├── FinCEN: Generally actual ownership (rights currently held)
├── But: Complex instruments require analysis
└── Recommendation: Track BOTH and monitor thresholds on both bases
```

---

## Monitoring Requirements

### What System Must Track

```typescript
// Ownership with threshold monitoring
ownershipTracking: {
  id: uuid,
  entityId: uuid,
  holderId: uuid,  // person or entity

  // Current ownership
  ownershipPercentage: integer,  // basis points (10000 = 100%)
  fullyDilutedPercentage: integer,  // including all convertibles

  // Threshold status
  thresholds: {
    boi_25: ThresholdStatus,
    tax_10_cfc: ThresholdStatus,
    tax_20_drd: ThresholdStatus,
    tax_50_control: ThresholdStatus,
    tax_80_affiliated: ThresholdStatus,
    sec_5_13d: ThresholdStatus,  // if applicable
    sec_10_insider: ThresholdStatus,  // if applicable
  },

  // Change tracking
  lastCalculated: timestamp,
  previousPercentage: integer,
  changeDate: timestamp,
}

type ThresholdStatus = {
  threshold: number,  // basis points
  currentStatus: 'below' | 'at_or_above',
  proximityWarning: boolean,  // within 5% of threshold
  crossedDate: timestamp | null,
  direction: 'crossed_up' | 'crossed_down' | null,
}
```

### Threshold Crossing Events

```typescript
// Events when thresholds are crossed
THRESHOLD_APPROACHING: 'entity-governance.ownership.threshold-approaching',
// Payload: { holderId, threshold, currentPercentage, thresholdPercentage }

THRESHOLD_CROSSED: 'entity-governance.ownership.threshold-crossed',
// Payload: { holderId, threshold, previousPercentage, newPercentage, direction }

BOI_OWNER_STATUS_CHANGED: 'entity-governance.boi.owner-status-changed',
// Payload: { personId, entityId, previousStatus, newStatus, reason }

CFC_STATUS_CHANGED: 'entity-governance.tax.cfc-status-changed',
// Payload: { entityId, previousStatus, newStatus, usOwnershipPercentage }

AFFILIATED_GROUP_STATUS_CHANGED: 'entity-governance.tax.affiliated-status-changed',
// Payload: { parentId, subsidiaryId, previousStatus, newStatus, ownershipPercentage }
```

---

## Implementation: Threshold Monitor

### Algorithm

```typescript
interface ThresholdConfig {
  name: string;
  thresholdBasisPoints: number;  // 2500 = 25%
  warningProximityBasisPoints: number;  // 500 = 5% away
  crossingDirection: 'up' | 'down' | 'both';
  eventType: string;
}

const THRESHOLDS: ThresholdConfig[] = [
  {
    name: 'BOI_25_PERCENT',
    thresholdBasisPoints: 2500,
    warningProximityBasisPoints: 300,  // 3% warning
    crossingDirection: 'both',
    eventType: 'BOI_OWNER_STATUS_CHANGED',
  },
  {
    name: 'CFC_US_SHAREHOLDER_10',
    thresholdBasisPoints: 1000,
    warningProximityBasisPoints: 200,
    crossingDirection: 'both',
    eventType: 'CFC_US_SHAREHOLDER_STATUS_CHANGED',
  },
  {
    name: 'AFFILIATED_GROUP_80',
    thresholdBasisPoints: 8000,
    warningProximityBasisPoints: 500,
    crossingDirection: 'both',
    eventType: 'AFFILIATED_GROUP_STATUS_CHANGED',
  },
  // ... more thresholds
];

function checkThresholdCrossings(
  holderId: string,
  entityId: string,
  previousBasisPoints: number,
  currentBasisPoints: number
): ThresholdEvent[] {
  const events: ThresholdEvent[] = [];

  for (const threshold of THRESHOLDS) {
    const wasAbove = previousBasisPoints >= threshold.thresholdBasisPoints;
    const isAbove = currentBasisPoints >= threshold.thresholdBasisPoints;

    // Check for crossing
    if (wasAbove !== isAbove) {
      events.push({
        type: threshold.eventType,
        threshold: threshold.name,
        direction: isAbove ? 'crossed_up' : 'crossed_down',
        previousPercentage: previousBasisPoints,
        currentPercentage: currentBasisPoints,
        holderId,
        entityId,
        crossedAt: new Date(),
      });
    }

    // Check for proximity warning (approaching from below)
    if (!wasAbove && !isAbove) {
      const distanceFromThreshold = threshold.thresholdBasisPoints - currentBasisPoints;
      if (distanceFromThreshold <= threshold.warningProximityBasisPoints) {
        events.push({
          type: 'THRESHOLD_APPROACHING',
          threshold: threshold.name,
          currentPercentage: currentBasisPoints,
          thresholdPercentage: threshold.thresholdBasisPoints,
          distanceRemaining: distanceFromThreshold,
          holderId,
          entityId,
        });
      }
    }
  }

  return events;
}
```

### Transaction Planning Integration

```typescript
// Before equity transactions, check threshold implications
function analyzeThresholdImpact(
  transaction: ProposedTransaction
): ThresholdImpactAnalysis {
  const currentOwnership = getCurrentOwnership(transaction.entityId);
  const projectedOwnership = projectOwnership(currentOwnership, transaction);

  const impacts: ThresholdImpact[] = [];

  for (const holder of projectedOwnership.holders) {
    const current = currentOwnership.holders.find(h => h.id === holder.id);
    const currentBp = current?.basisPoints ?? 0;
    const projectedBp = holder.basisPoints;

    const crossings = checkThresholdCrossings(
      holder.id,
      transaction.entityId,
      currentBp,
      projectedBp
    );

    if (crossings.length > 0) {
      impacts.push({
        holderId: holder.id,
        holderName: holder.name,
        currentOwnership: currentBp / 100,
        projectedOwnership: projectedBp / 100,
        thresholdsCrossed: crossings.map(c => c.threshold),
        complianceImplications: getComplianceImplications(crossings),
      });
    }
  }

  return {
    transaction,
    hasThresholdImpacts: impacts.length > 0,
    impacts,
    recommendedActions: generateRecommendations(impacts),
  };
}
```

---

## Compliance Calendar Integration

### Threshold-Triggered Deadlines

```
WHEN THRESHOLD CROSSED → DEADLINE CREATED
─────────────────────────────────────────

BOI 25% Crossed (Up):
└── Deadline: Report beneficial owner within 30 days
    └── Task: Collect FinCEN identification information
    └── Task: File BOI report update

BOI 25% Crossed (Down):
└── Deadline: Report beneficial owner removal within 30 days
    └── Task: File BOI report update

CFC 10% US Shareholder Status Gained:
└── Deadline: Include in tax planning for current year
    └── Task: Track Subpart F income allocation
    └── Task: Prepare Form 5471 information

Affiliated Group 80% Crossed:
└── Deadline: Evaluate consolidated return election
    └── Task: Analyze tax implications
    └── Task: Make election if beneficial
```

---

## Open Questions

1. **Convertible Timing**: Exactly when does a SAFE holder's "right to acquire" create ownership for BOI purposes?

2. **Attribution Rules**: How do family attribution rules (IRC §318) affect threshold calculations for tax purposes vs. BOI?

3. **Multiple Classes**: How do you calculate ownership % when there are multiple share classes with different rights?

4. **Phantom Equity**: Do profit interests or phantom equity count toward ownership thresholds?

5. **Foreign Thresholds**: What are the equivalent thresholds in non-US jurisdictions for multi-jurisdiction entities?

---

## Summary

Ownership thresholds create compliance discontinuities:

| Threshold | Consequence | Compliance Burden |
|-----------|-------------|-------------------|
| 10% | CFC US shareholder status | High (Subpart F) |
| 20% | Better DRD | Low (automatic) |
| 25% | BOI reporting required | Medium (FinCEN) |
| 50% | CFC control | High (Form 5471) |
| 80% | Affiliated group | Medium-High (consolidated) |

**Key Implementation Requirements**:
1. Monitor ownership in basis points for precision
2. Track both actual and fully-diluted ownership
3. Alert on threshold proximity (not just crossing)
4. Generate compliance deadlines on crossing
5. Analyze threshold impact before transactions

**The Takeaway**: A 0.1% ownership change can trigger millions in compliance costs. The system must treat thresholds as first-class concerns, not edge cases.

---

## Sources

- research/03-beneficial-ownership-cta.md (BOI thresholds)
- research/08-holding-company-structures.md (tax thresholds)
- IRC §243 (Dividends Received Deduction)
- IRC §951, §957 (CFC rules)
- IRC §1504 (Affiliated groups)
- 31 CFR 1010.380 (BOI final rule)

