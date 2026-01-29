# Jurisdiction Complexity in Legal Entity Governance

## Knowledge Gap Identified

Our current `{country: string, state: string}` model captures only the geographic dimension while missing the functional, temporal, and relational dimensions of jurisdiction.

## Key Findings

### The Four Jurisdiction Contexts

```
┌─────────────────────────────────────────────────────────────────────┐
│                        JURISDICTION CONTEXTS                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. FORMATION JURISDICTION (Domicile)                               │
│     ├─ ONE per entity                                               │
│     ├─ Determines: Internal affairs doctrine                        │
│     ├─ Controls: Governance rules, liability protections            │
│     └─ Permanent unless: Domestication/Conversion                   │
│                                                                     │
│  2. QUALIFIED/REGISTERED JURISDICTIONS (Foreign Registration)       │
│     ├─ ZERO to MANY per entity                                      │
│     ├─ Triggered by: "Doing business" activities                    │
│     ├─ Grants: Right to transact, sue, own property                 │
│     └─ Requires: Registered agent, annual filings, fees             │
│                                                                     │
│  3. TAX NEXUS JURISDICTIONS (Economic Presence)                     │
│     ├─ ZERO to MANY per entity                                      │
│     ├─ Independent of: Registration status                          │
│     ├─ Triggered by: Physical presence OR economic thresholds       │
│     └─ Creates: Tax filing/payment obligations                      │
│                                                                     │
│  4. REGULATORY JURISDICTIONS (Activity-Based)                       │
│     ├─ ZERO to MANY per entity                                      │
│     ├─ Triggered by: Industry-specific activities                   │
│     └─ Examples: Banking licenses, securities, insurance            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

CRITICAL INSIGHT: These four contexts are INDEPENDENT
- Can have tax nexus without foreign qualification
- Can be qualified without having tax nexus
- Formation jurisdiction may have neither nexus nor business activity
```

### Formation Jurisdiction (Domicile State)

Under the "Internal Affairs Doctrine," formation jurisdiction's law governs:
- Fiduciary duties of officers and directors
- Shareholder rights and voting
- Dividend distributions
- Merger and acquisition procedures
- Liability protections (corporate veil)
- Dissolution procedures

**Key insight**: An entity can be formed in Delaware but never conduct business there.

### Foreign Qualification (Certificate of Authority)

Registration to lawfully "transact business" in a state where the entity was NOT formed.

**Triggers (state-specific but generally include)**:
```
USUALLY TRIGGERS QUALIFICATION:
├─ Having employees in the state
├─ Maintaining a physical office/location
├─ Owning or leasing real property
├─ Manufacturing or production facilities
├─ Soliciting orders that require local acceptance
└─ Providing services requiring local presence

USUALLY DOES NOT TRIGGER:
├─ Maintaining bank accounts
├─ Collecting debts
├─ Isolated or occasional transactions
├─ Conducting business in interstate commerce
├─ Holding meetings of shareholders/directors
├─ Maintaining registered agent for litigation
└─ Sales through independent contractors
```

**Consequences of failure to qualify**:
- Loss of access to state courts (cannot sue)
- Fines and back taxes with interest
- Personal liability for company officers
- Potential criminal penalties (rare)
- Unenforceability of contracts (some states)

### Tax Nexus (Economic Presence)

**Types of nexus**:
```
PHYSICAL PRESENCE NEXUS          ECONOMIC NEXUS (Post-Wayfair)
├─ Employees                     ├─ Sales revenue thresholds
├─ Property                      ├─ Transaction count thresholds
├─ Inventory                     └─ Varies wildly by state
└─ Office locations

DIFFERENT NEXUS TYPES:
├─ Income Tax Nexus (P.L. 86-272 protections)
├─ Sales Tax Nexus (Economic nexus dominant)
├─ Franchise Tax Nexus (Often tied to qualification)
└─ Employment Tax Nexus (Employee location)
```

### The Delaware Phenomenon

| Factor | Delaware Advantage | Why It Matters |
|--------|-------------------|----------------|
| Court of Chancery | Specialized business court, no juries | Predictable, expert decisions |
| Legal Precedent | 200+ years of corporate case law | Lawyers can predict outcomes |
| Flexibility | Director-friendly statutes | Broad indemnification |
| Speed | 24-hour filing, same-day available | Time-sensitive transactions |
| Privacy | No disclosure of shareholders | Confidentiality in ownership |
| Franchise Tax | Favorable for large authorized shares | "Assumed Par Value" method |

**Delaware cost structure**:
```
DELAWARE FRANCHISE TAX (Corporations)
├─ Minimum: $175/year
├─ Maximum: $200,000/year
├─ Due: March 1 annually
├─ Late Fee: $200 + 1.5%/month interest
└─ $50 annual report fee

DELAWARE LLCs
├─ Annual Tax: $300 flat
├─ Due: June 1 annually
└─ No annual report required
```

### State Comparison Matrix

| State | Formation Fee | Annual Report | Franchise Tax | Unique Features |
|-------|---------------|---------------|---------------|-----------------|
| Delaware | $89 Corp, $90 LLC | March 1 (Corp only) | $175-200K Corp | Chancery Court |
| Wyoming | $100 | Anniversary month | None | First LLC state, no income tax |
| Nevada | $75 LLC + $150 report + $200 lic | Anniversary month | None | No income tax, privacy |
| California | $70 LLC | Within 90 days, then biennially | $800/year MINIMUM | Mandatory operating agreement |
| Texas | $300 | Annually | 0.375% to 0.75% margin | No income tax but margin tax |

### International Jurisdiction Models

```
FEDERAL/NATIONAL MODEL (UK, Singapore, Ireland)
├─ Single registration authority
├─ Uniform requirements nationwide
└─ Simpler: ONE jurisdiction per entity per country

STATE/PROVINCIAL MODEL (US, Germany, Canada)
├─ Sub-national registration authorities
├─ Varying requirements by region
└─ Complex: Formation + N qualifications + M nexus points

SUPRANATIONAL OVERLAY (EU)
├─ Directive 2017/1132 harmonizes minimum standards
├─ Cross-border register interconnection
├─ National requirements still vary significantly

OFFSHORE/SPECIAL JURISDICTIONS (BVI, Cayman, Jersey)
├─ Minimal public disclosure
├─ Tax neutrality
├─ Special economic substance requirements (post-2019)
```

## Model Implications

### Current Schema Gaps

```typescript
// CURRENT - Insufficient
export const JurisdictionSchema = z.object({
  country: z.string().length(2), // ISO 3166-1 alpha-2
  state: z.string().max(100).optional(),
});
```

### Recommended Schema Extension

```typescript
// Formation Jurisdiction (ONE per entity)
interface FormationJurisdiction {
  country: CountryCode;
  subdivision?: string;           // ISO 3166-2
  formationType: FormationType;   // 'domestic' | 'domesticated' | 'converted'
  filingNumber: string;
  filingDate: Date;
  filingAuthority: string;
  jurisdictionProfile?: JurisdictionProfileId;
}

// Foreign Qualification (MANY per entity)
interface ForeignQualification {
  id: string;
  entityId: string;
  jurisdiction: { country: CountryCode; subdivision: string; };
  status: QualificationStatus;
  qualificationDate: Date;
  withdrawalDate?: Date;
  certificateNumber?: string;
  registeredAgentId: string;
  filingRequirements: FilingRequirementId[];
  qualificationReason: string;
}

// Tax Nexus (MANY per entity)
interface TaxNexus {
  id: string;
  entityId: string;
  jurisdiction: { country: CountryCode; subdivision?: string; locality?: string; };
  nexusType: NexusType;           // 'income' | 'sales' | 'franchise' | 'employment'
  establishedDate: Date;
  establishedBy: NexusTrigger;
  isActive: boolean;
  terminatedDate?: Date;
  thresholdMetrics?: {
    salesRevenue?: Money;
    transactionCount?: number;
    evaluationPeriod: string;
  };
}
```

## Why This Matters

1. **Multi-state compliance** - Cannot track filing requirements without knowing all jurisdictions
2. **Tax integration** - Tax service needs nexus information separate from registration
3. **Registered agent management** - One per qualification state, not just formation
4. **Filing calendar accuracy** - Different deadlines per jurisdiction
5. **Entity migration** - Domestication changes formation jurisdiction

## Questions for Further Research

1. How do we track effective ownership through multiple tiers for nexus calculation?
2. Should we calculate economic nexus automatically based on sales data?
3. How do we integrate treaty benefits based on jurisdiction structure?
4. What triggers should automatically prompt qualification analysis?
