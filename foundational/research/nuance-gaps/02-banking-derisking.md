# Banking De-Risking and Relationship Termination

## Knowledge Gap Identified

Current banking-treasury research assumes banking relationships will be available and stable. It does not address the critical failure mode of de-risking: when banks terminate relationships, leaving entities unable to conduct basic financial operations.

## Key Findings

### Definition of De-Risking

De-risking refers to the phenomenon of financial institutions terminating or restricting business relationships with clients or categories of clients to avoid, rather than manage, risk.

```
CRITICAL INSIGHT: De-risking is a REAL risk
├─ Banks can terminate relationships with limited notice
├─ Some industries/jurisdictions are systematically "unbankable"
├─ Termination can freeze all business operations
└─ Recovery options are limited and time-consuming
```

### Primary Triggers for Account Closure

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DE-RISKING TRIGGERS                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PROFITABILITY FACTORS                                              │
│  ├─ Low transaction volume (not profitable for the bank)            │
│  ├─ High compliance cost relative to revenue                        │
│  ├─ Resource constraints for AML/KYC monitoring                     │
│  └─ Regulatory scrutiny increasing costs                            │
│                                                                     │
│  RISK FACTORS                                                       │
│  ├─ Industry classification (high-risk categories)                  │
│  ├─ Jurisdiction concerns (operating in/with high-risk countries)   │
│  ├─ Reputational risk (association with controversial activities)   │
│  ├─ Regulatory uncertainty (lack of clarity on compliance)          │
│  └─ Cyber risk exposure                                             │
│                                                                     │
│  COMPLIANCE FACTORS                                                 │
│  ├─ Insufficient KYC documentation                                  │
│  ├─ Beneficial ownership opacity                                    │
│  ├─ Complex corporate structures                                    │
│  ├─ Suspicious transaction patterns                                 │
│  └─ Failure to respond to information requests                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### High-Risk Categories Most Affected

| Category | Risk Level | Impact |
|----------|------------|--------|
| **Money Service Businesses** | Very High | Systematic exclusion |
| **Correspondent Banks (small)** | High | Declining relationships |
| **Charities in conflict regions** | High | Limited banking options |
| **Cryptocurrency businesses** | High | Few banking partners |
| **Embassies/Foreign Missions** | Medium-High | Compliance burden |
| **Politically Exposed Persons** | Medium-High | Enhanced scrutiny |
| **Gaming/E-gaming** | Medium | Selective acceptance |
| **Emerging Market Exporters** | Medium | Volume-dependent |

### Types of De-Risking

```
WHOLESALE DE-RISKING
├─ Complete withdrawal from entire sectors
├─ Most criticized approach
├─ Ignores individual risk levels
└─ Example: "We don't bank ANY crypto companies"

SELECTIVE/PARTIAL DE-RISKING
├─ Account maintained but services limited
├─ Cross-border payments restricted
├─ Trade finance unavailable
└─ Example: "You can have a checking account but no wire transfers"

CORRESPONDENT BANKING WITHDRAWAL
├─ Bank terminates relationship with other banks
├─ Affects entire countries/regions
├─ Creates "financial deserts"
└─ Example: Declining correspondent relationships with small island nations
```

### Economic Impact Research (2024)

Research combining data on terminated correspondent bank relationships shows:
- When local respondent banks lose correspondent access, corporate clients experience decreased exports
- Affected firms only partially offset lost exports with domestic sales
- Results in lower total revenues and employment
- Sharp decline in correspondent banking over the past decade has raised macroeconomic concerns

### Regulatory Position

The FATF explicitly states that de-risking is **not in line with FATF Recommendations**:

```
FATF POSITION:
├─ De-risking can result in financial exclusion
├─ Creates less transparency (pushes activity underground)
├─ May increase money laundering/terrorist financing risks
├─ Banks should manage, not avoid, customer risk
└─ Risk-based approach requires individual assessment
```

### US Treasury De-Risking Strategy (2023)

Key elements from Treasury's official strategy:
- Federal regulators do not direct banks to make account decisions
- Encourage banks to manage relationships individually
- Provide "sufficient time" for customers to find alternatives before termination
- Exception: When doing so would be contrary to law or pose additional risk

### Protection Strategies

```
ENTITY-LEVEL PROTECTIONS:

1. DOCUMENTATION EXCELLENCE
   ├─ Maintain pristine KYC records
   ├─ Proactive beneficial ownership disclosure
   ├─ Clear, simple corporate structures
   └─ Transparent source of funds documentation

2. RELATIONSHIP DIVERSIFICATION
   ├─ Maintain 2-3 banking relationships minimum
   ├─ Different bank types (global, regional, community)
   ├─ Geographic diversification
   └─ Relationship banking vs transactional only

3. COMMUNICATION STRATEGY
   ├─ Proactive engagement with compliance officers
   ├─ Regular relationship reviews
   ├─ Advance notice of business changes
   └─ Respond immediately to information requests

4. BUSINESS MODEL CLARITY
   ├─ Clear, explainable business model
   ├─ Avoid complex structures unless necessary
   ├─ Substance over form
   └─ Document legitimate business purpose
```

## Cross-Domain Integration Requirements

### Entity Governance → Banking Stability
- Simple, clear corporate structures reduce de-risking risk
- Beneficial ownership transparency is critical
- Multi-jurisdiction complexity increases risk
- Holding company structures may complicate banking

### Accounting → Banking Continuity
- Clean financial records support relationship
- Audit trail demonstrates legitimacy
- Transaction patterns should be explainable
- Financial statements support account reviews

### Compliance → Banking Relationships
- AML/KYC compliance is foundational
- Sanctions screening must be robust
- Transaction monitoring shows good faith
- Suspicious activity reporting demonstrates compliance culture

## Model Implications

### Required Data Elements

```typescript
interface BankingRelationship {
  id: string;
  entityId: string;
  bankId: string;

  // Relationship status
  status: 'active' | 'under_review' | 'restricted' | 'terminated';
  openDate: Date;
  lastReviewDate: Date;
  nextReviewDate: Date;

  // Services
  services: BankingService[];
  restrictedServices?: BankingService[];

  // Health indicators
  healthScore: number;  // 0-100
  riskFlags: RiskFlag[];
  complianceStatus: ComplianceStatus;

  // Contingency
  backupBankId?: string;
  terminationRisk: 'low' | 'medium' | 'high';
}

interface DeRiskingEvent {
  id: string;
  relationshipId: string;
  eventType: 'restriction' | 'review' | 'notice' | 'termination';
  eventDate: Date;
  noticeDate?: Date;
  effectiveDate?: Date;
  reason?: string;

  // Response
  responseActions: Action[];
  alternativeBankId?: string;
  migrationStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface BankingContingencyPlan {
  entityId: string;
  primaryBankId: string;
  backupBanks: string[];

  // Critical accounts
  criticalAccounts: AccountId[];
  payrollAccountId: string;
  apAccountId: string;
  arAccountId: string;

  // Migration procedures
  migrationProcedure: Procedure;
  estimatedMigrationDays: number;

  // Triggers
  alertThresholds: AlertThreshold[];
}
```

## Warning Signs to Monitor

```
EARLY WARNING SIGNALS:

Banking Behavior Changes:
├─ Increased documentation requests
├─ More frequent compliance reviews
├─ Delays in transaction processing
├─ Service restrictions imposed
├─ Relationship manager changes
└─ Fee increases without clear rationale

Account Activity Flags:
├─ Transactions flagged for review
├─ Wire transfers delayed
├─ International payments blocked
├─ New signatories questioned
└─ Enhanced due diligence initiated
```

## Questions for Further Research

1. How should entities balance banking relationship diversification vs operational complexity?
2. What early warning systems can detect de-risking risk before formal notice?
3. How do different jurisdictions affect banking relationship stability?
4. What is the minimum viable banking relationship portfolio for operational resilience?
5. How should intercompany banking relationships be structured to avoid concentration risk?

## Sources

- [Congressional Research Service: De-Risking Overview](https://www.congress.gov/crs-product/IF10873)
- [FATF Guidance on Correspondent Banking](https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Correspondent-banking-services.html)
- [US State Department: De-Risking](https://www.state.gov/de-risking)
- [US Treasury De-Risking Strategy 2023](https://home.treasury.gov/system/files/136/Treasury_AMLA_23_508.pdf)
- [CEPR Research: Impact on International Trade](https://cepr.org/voxeu/columns/impact-de-risking-correspondent-banks-international-trade)

---

*Research conducted: January 2026*
*Gap identified in: banking-treasury/docs/research/ (not addressed)*
