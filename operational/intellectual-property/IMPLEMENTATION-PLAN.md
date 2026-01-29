# IP Service Implementation Plan

> **Mission**: To protect, manage, and maximize the value of intellectual property assets across the enterprise through systematic portfolio management, rights enforcement, and strategic licensing.

This implementation plan synthesizes findings from 16 research documents to realize the IP Service's purpose and mission as defined in PURPOSE.md.

---

## Executive Summary

**Current State**: 4 of 8 core domains partially implemented (Patent, Trademark, Copyright, License)
**Gap**: 4 domains entirely missing (Trade Secrets, Domain Names, IP Enforcement, IP Strategy)
**Research**: 16 documents identified 50+ new entities/enhancements needed

**Recommended Approach**: 4-phase implementation over 6-9 months
- **Phase 0**: Foundation (missing core entities)
- **Phase 1**: Compliance Infrastructure (deadline management)
- **Phase 2**: Strategic Capabilities (valuation, FTO, M&A)
- **Phase 3**: Advanced Features (enforcement, automation)

---

## Table of Contents

1. [Mission Alignment](#mission-alignment)
2. [Current State Assessment](#current-state-assessment)
3. [Gap Analysis](#gap-analysis)
4. [Phased Implementation Roadmap](#phased-implementation-roadmap)
5. [Entity Design Specifications](#entity-design-specifications)
6. [Dependency Graph](#dependency-graph)
7. [Success Metrics](#success-metrics)
8. [Risk Mitigation](#risk-mitigation)

---

## Mission Alignment

Every implementation item maps to one of the 5 purposes from PURPOSE.md:

| # | Purpose | Description | Primary Research Docs |
|---|---------|-------------|----------------------|
| P1 | **Protect Innovation** | Safeguard IP through registration, maintenance, enforcement | 01-08, 09, 12, 13, 15 |
| P2 | **Manage Portfolios** | Track complete lifecycle from creation to expiration | 01, 02, 06, 12 |
| P3 | **Enable Licensing** | Facilitate monetization through licensing agreements | 07, 14 |
| P4 | **Ensure Compliance** | Maintain deadlines, renewals, regulatory requirements | 03, 04, 05, 14 |
| P5 | **Inform Strategy** | Portfolio visibility for strategic decision-making | 10, 11, 15, 16 |

---

## Current State Assessment

### Implemented Entities

| Entity | Status | Key Gaps |
|--------|--------|----------|
| **Patent** | Partial | No families, no PCT, no maintenance fees, no entity size, no SEP/FRAND, no 101 tracking, no design-specific handling |
| **Trademark** | Partial | No Section 8/9, no Madrid IR, no use-per-class, no specimens, no fame assessment, no dilution monitoring |
| **Copyright** | Partial | No duration calculation, no author death tracking, no fair use framework |
| **License** | Partial | No FRAND indicators, no change-of-control provisions, no open source tracking |

### Missing Domains (from PURPOSE.md)

| Domain | STATUS | Impact |
|--------|--------|--------|
| **Trade Secrets** | NOT IMPLEMENTED | License references `trade_secret` type but no entity exists |
| **Domain Names** | NOT IMPLEMENTED | Entire subdomain missing |
| **IP Enforcement** | NOT IMPLEMENTED | Core protection function missing |
| **IP Strategy** | NOT IMPLEMENTED | No valuation, FTO, or due diligence capabilities |

---

## Gap Analysis

### By Research Document

| Doc | Primary Gap | New Entities | Enhancements |
|-----|-------------|--------------|--------------|
| 01 - Patent Families | No relationship tracking | PatentFamily, PatentFamilyMember | Patent: familyId, parentId, continuationType |
| 02 - PCT Filing | No international workflow | PriorityClaim, NationalPhaseEntry | Patent: applicationType, pctNumber, designatedStates |
| 03 - Maintenance Fees | No fee tracking | MaintenanceFee | Patent: entitySize, lapseDate, lapseReason |
| 04 - Trademark Use | No Section 8/9 | Section8Filing, NiceClassUseStatus | Trademark: useStatus[], specimenIds |
| 05 - Madrid Protocol | No IR tracking | MadridDesignation, CentralAttackProceeding | Trademark: registrationType, irNumber, dependencyEndDate |
| 06 - Copyright Duration | No calculation | AuthorDeathRecord, FairUseAssessment | Copyright: authorshipType, calculatedExpiration |
| 07 - FRAND/Compulsory | No SEP tracking | SEPDeclaration, FederalFunding, GovernmentUseEvent | Patent: isStandardEssential; License: isFrandLicense |
| 08 - Trade Secrets | **Entity missing** | **TradeSecret**, ProtectionMeasure, TradeSecretAccess, TradeSecretIncident, WhistleblowerNotice | - |
| 09 - Domain Disputes | **Domain missing** | **DomainName**, **DomainDispute**, BadFaithFactor | - |
| 10 - IP Valuation | No valuation | **IPValuation**, ValuationAssumption, ComparableTransaction | - |
| 11 - FTO Analysis | No clearance | **FTOAnalysis**, ProductFeature, FTOPatentRisk, ClaimElementMapping | - |
| 12 - Design Patents | Same as utility | DesignPatentDetails, DesignInfringementAnalysis | Patent: designDetails |
| 13 - Software Eligibility | No 101 tracking | EligibilityStatus, Section101RejectionHistory | Patent: eligibilityStatus |
| 14 - Open Source | No SBOM | **OpenSourceComponent**, **SBOM**, CopyleftTrigger, LicenseConflict | License: openSourceComponents[] |
| 15 - Trademark Dilution | No fame tracking | FameAssessment, SurveyEvidence, DilutionIncident | Trademark: fameStatus |
| 16 - IP Due Diligence | No M&A support | **IPDueDiligenceProject**, DueDiligenceFinding, ChangeOfControlProvision | License: changeOfControlProvisions[] |

---

## Phased Implementation Roadmap

```
PHASE 0         PHASE 1           PHASE 2          PHASE 3
Foundation      Compliance        Strategic        Advanced
(4-6 weeks)     (6-8 weeks)       (8-10 weeks)     (6-8 weeks)
    │               │                 │                │
    ▼               ▼                 ▼                ▼
┌─────────┐   ┌───────────┐    ┌───────────┐    ┌───────────┐
│Trade    │   │Maintenance│    │IP         │    │Enforcement│
│Secrets  │   │Fees       │    │Valuation  │    │Workflow   │
│         │   │           │    │           │    │           │
│Domain   │   │Section 8/9│    │FTO        │    │Analytics  │
│Names    │   │           │    │Analysis   │    │Dashboard  │
│         │   │Madrid     │    │           │    │           │
│Patent   │   │Dependency │    │Due        │    │API        │
│Families │   │           │    │Diligence  │    │Enhancement│
│         │   │Copyright  │    │           │    │           │
│License  │   │Duration   │    │Open Source│    │Automation │
│Enhanced │   │           │    │Compliance │    │           │
└─────────┘   └───────────┘    └───────────┘    └───────────┘
    │               │                 │                │
    P1,P2           P4               P5              P1,P5
```

---

### Phase 0: Foundation (Weeks 1-6)

**Goal**: Establish missing core entities that other features depend on.

#### 0.1 Trade Secret Entity [CRITICAL]

**Rationale**: License entity already references `ipType: 'trade_secret'` but no entity exists. This blocks trade secret licensing entirely.

**Entities**:
- `TradeSecret` - Core entity for confidential information
- `ProtectionMeasure` - Reasonable measures tracking (required for legal protection)
- `TradeSecretAccess` - Who has access and under what NDA
- `TradeSecretIncident` - Breach/disclosure events

**Research Source**: 08-trade-secret-protection.md

**Purpose Alignment**: P1 (Protect Innovation)

**Acceptance Criteria**:
- [ ] Can create/read/update trade secrets
- [ ] Can track protection measures with verification dates
- [ ] Can manage access control with NDA linkage
- [ ] Can log incidents and response measures
- [ ] Events published: TradeSecretCreated, ProtectionMeasureAdded, AccessGranted, IncidentDetected

---

#### 0.2 Domain Name Entity [HIGH]

**Rationale**: Brand protection requires domain portfolio management. UDRP/ACPA disputes tie directly to trademark protection.

**Entities**:
- `DomainName` - Domain records with registrar, expiration, status
- `DomainDispute` - UDRP/URS/ACPA proceedings
- `BadFaithFactor` - Evidence tracking for disputes

**Research Source**: 09-domain-name-disputes-udrp.md

**Purpose Alignment**: P1 (Protect Innovation)

**Acceptance Criteria**:
- [ ] Can register domain names with defensive trademark linkage
- [ ] Can track expiration and renewal dates
- [ ] Can initiate and manage UDRP/ACPA disputes
- [ ] Can record bad faith factors with evidence
- [ ] Events published: DomainRegistered, DisputeFiled, DisputeResolved

---

#### 0.3 Patent Family Support [HIGH]

**Rationale**: Patents don't exist in isolation. Continuation/divisional/CIP relationships are fundamental to portfolio management.

**Entities**:
- `PatentFamily` - Groups related patents
- `PatentFamilyMember` - Relationship records

**Patent Entity Enhancements**:
```typescript
+ familyId?: string;
+ parentPatentId?: string;
+ continuationType?: 'continuation' | 'divisional' | 'cip';
+ restrictionRequirementDate?: Date;
+ isTrueDivisional?: boolean;
```

**Research Source**: 01-patent-families-continuations.md

**Purpose Alignment**: P2 (Manage Portfolios)

**Acceptance Criteria**:
- [ ] Can create patent families with priority application
- [ ] Can add continuations/divisionals/CIPs with parent linkage
- [ ] Can query all family members from any member
- [ ] Family tree visualization data available

---

#### 0.4 License Entity Enhancements [HIGH]

**Rationale**: Current License entity lacks critical capabilities for FRAND, M&A, and open source compliance.

**License Entity Enhancements**:
```typescript
+ isFrandLicense?: boolean;
+ frandRateType?: 'interim' | 'final' | 'negotiated';
+ frandDisputeStatus?: 'none' | 'pending' | 'resolved';
+ changeOfControlProvisions?: ChangeOfControlProvision[];
+ openSourceComponents?: string[]; // References to OpenSourceComponent
```

**New Entities**:
- `ChangeOfControlProvision` - M&A trigger tracking

**Research Source**: 07-frand-compulsory-licensing.md, 16-ip-due-diligence-ma.md

**Purpose Alignment**: P3 (Enable Licensing)

**Acceptance Criteria**:
- [ ] Can flag licenses as FRAND-encumbered
- [ ] Can record change-of-control provisions with triggers
- [ ] Can query licenses affected by potential M&A
- [ ] Events published: FrandLicenseNegotiated, ChangeOfControlTriggered

---

### Phase 1: Compliance Infrastructure (Weeks 7-14)

**Goal**: Implement deadline tracking and compliance workflows. Missing a deadline can permanently destroy IP rights.

#### 1.1 Patent Maintenance Fees [CRITICAL]

**Rationale**: Utility patents require maintenance fee payments at 3.5, 7.5, and 11.5 years. Missing payment = patent lapses.

**Entities**:
- `MaintenanceFee` - Fee records with due dates, payment windows, status

**Patent Entity Enhancements**:
```typescript
+ entitySize: 'large' | 'small' | 'micro';
+ lapseDate?: Date;
+ lapseReason?: 'maintenance_fee_1' | 'maintenance_fee_2' | 'maintenance_fee_3';
+ wasRevived?: boolean;
+ revivalDate?: Date;
```

**Research Source**: 03-patent-maintenance-fees.md

**Purpose Alignment**: P4 (Ensure Compliance)

**Acceptance Criteria**:
- [ ] Maintenance fees auto-calculated from grant date
- [ ] Payment windows and grace periods tracked
- [ ] Alerts generated 90, 60, 30 days before due
- [ ] Lapse vs expiration properly distinguished
- [ ] Events published: MaintenanceFeeDue, MaintenanceFeePaid, PatentLapsed

---

#### 1.2 Trademark Section 8/9 Declarations [CRITICAL]

**Rationale**: Trademarks require affirmative declarations of continued use. Miss Section 8 = registration cancelled.

**Entities**:
- `Section8Filing` - Declaration records with specimens
- `NiceClassUseStatus` - Use tracking per class

**Trademark Entity Enhancements**:
```typescript
+ useStatus: NiceClassUseStatus[];
+ section8Filings: Section8Filing[];
```

**Research Source**: 04-trademark-use-requirements.md

**Purpose Alignment**: P4 (Ensure Compliance)

**Acceptance Criteria**:
- [ ] Section 8/9 deadlines auto-calculated from registration
- [ ] Use status trackable per Nice class
- [ ] Specimen attachment support
- [ ] Excusable non-use documentation
- [ ] Events published: Section8Due, Section8Filed, UseDeclarationAccepted, TrademarkCancelledNonUse

---

#### 1.3 Madrid Protocol Support [HIGH]

**Rationale**: International trademark protection via Madrid System requires understanding of 5-year dependency and central attack risk.

**Entities**:
- `MadridDesignation` - Country designations under IR
- `CentralAttackProceeding` - Attack tracking

**Trademark Entity Enhancements**:
```typescript
+ registrationType: 'national' | 'madrid_international' | 'madrid_extension';
+ internationalRegistrationNumber?: string;
+ basicMarkId?: string;
+ dependencyEndDate?: Date;
+ isIndependent?: boolean;
```

**Research Source**: 05-madrid-protocol-international-trademarks.md

**Purpose Alignment**: P4 (Ensure Compliance)

**Acceptance Criteria**:
- [ ] Can create Madrid IRs linked to basic mark
- [ ] Dependency period tracked with countdown
- [ ] Central attack proceedings tracked
- [ ] Transformation to national available after attack
- [ ] Events published: MadridIRFiled, DesignationProtected, CentralAttackFiled, IRBecameIndependent

---

#### 1.4 PCT International Filing [HIGH]

**Rationale**: PCT workflow is distinct from national filing. International phase timelines are different.

**Entities**:
- `PriorityClaim` - Priority chain tracking
- `NationalPhaseEntry` - Country entries from PCT

**Patent Entity Enhancements**:
```typescript
+ applicationType: 'provisional' | 'non_provisional' | 'pct' | 'national_phase';
+ pctApplicationNumber?: string;
+ pctFilingDate?: Date;
+ pctPublicationDate?: Date;
+ designatedStates?: string[];
+ priorityClaims?: PriorityClaim[];
```

**Research Source**: 02-pct-international-filing.md

**Purpose Alignment**: P2 (Manage Portfolios)

**Acceptance Criteria**:
- [ ] Can track PCT application separate from national entries
- [ ] Priority chain maintained with dates
- [ ] National phase entry deadlines calculated (30/31 months)
- [ ] Events published: PCTFiled, PCTPublished, NationalPhaseEntered

---

#### 1.5 Copyright Duration Calculation [MEDIUM]

**Rationale**: Copyright duration depends on authorship type and death dates. Currently not calculated.

**Entities**:
- `AuthorDeathRecord` - For life+70 calculation
- `FairUseAssessment` - Four-factor analysis (optional)

**Copyright Entity Enhancements**:
```typescript
+ authorshipType: 'individual' | 'joint' | 'work_for_hire' | 'anonymous' | 'pseudonymous';
+ authorDeathDates?: AuthorDeathRecord[];
+ identityRevealedDate?: Date;
+ calculatedExpirationDate?: Date;
+ durationBasis?: 'life_plus_70' | '95_from_pub' | '120_from_creation';
```

**Research Source**: 06-copyright-duration-fair-use.md

**Purpose Alignment**: P2 (Manage Portfolios)

**Acceptance Criteria**:
- [ ] Duration auto-calculated based on authorship type
- [ ] Joint works track all author death dates
- [ ] Anonymous/pseudonymous conversion supported
- [ ] Events published: AuthorDeathRecorded, CopyrightExpired

---

### Phase 2: Strategic Capabilities (Weeks 15-24)

**Goal**: Enable strategic decision-making with valuation, FTO analysis, and M&A support.

#### 2.1 IP Valuation Framework [HIGH]

**Rationale**: IP portfolio value is critical for licensing negotiations, M&A, financing, and strategic planning.

**Entities**:
- `IPValuation` - Valuation records with methodology
- `ValuationAssumption` - Key assumptions documented
- `ComparableTransaction` - Market data reference

**Research Source**: 10-ip-valuation-methods.md

**Purpose Alignment**: P5 (Inform Strategy)

**Acceptance Criteria**:
- [ ] Can create valuations using income/market/cost approaches
- [ ] Assumptions documented with sensitivity
- [ ] Comparable transactions maintained as reference data
- [ ] Valuation history preserved per asset
- [ ] Events published: ValuationCompleted, ValuationSuperseded

---

#### 2.2 Freedom to Operate Analysis [HIGH]

**Rationale**: Product launch clearance requires systematic patent risk assessment.

**Entities**:
- `FTOAnalysis` - Clearance projects
- `ProductFeature` - Features being cleared
- `FTOPatentRisk` - Identified patent risks
- `ClaimElementMapping` - Feature to claim mapping

**Research Source**: 11-freedom-to-operate-analysis.md

**Purpose Alignment**: P5 (Inform Strategy)

**Acceptance Criteria**:
- [ ] Can create FTO for product with features
- [ ] Can identify and assess patent risks
- [ ] Claim element mapping supported
- [ ] Risk levels and recommendations captured
- [ ] Events published: FTOStarted, PatentRiskIdentified, FTOCompleted

---

#### 2.3 IP Due Diligence for M&A [HIGH]

**Rationale**: M&A transactions require comprehensive IP audit and risk assessment.

**Entities**:
- `IPDueDiligenceProject` - M&A audit projects
- `DueDiligenceFinding` - Issues discovered

**Research Source**: 16-ip-due-diligence-ma.md

**Purpose Alignment**: P5 (Inform Strategy)

**Acceptance Criteria**:
- [ ] Can create due diligence projects for deals
- [ ] Findings tracked with severity and remediation
- [ ] Change-of-control provisions surfaced automatically
- [ ] Deal-breaker risks flagged
- [ ] Events published: DueDiligenceStarted, CriticalFindingIdentified, DueDiligenceCompleted

---

#### 2.4 Open Source Compliance [HIGH]

**Rationale**: Copyleft contamination can force disclosure of proprietary code. SBOM increasingly required.

**Entities**:
- `OpenSourceComponent` - OSS dependency tracking
- `SBOM` - Software Bill of Materials per product
- `CopyleftTrigger` - Trigger analysis
- `LicenseConflict` - Incompatibility tracking

**Research Source**: 14-open-source-licensing.md

**Purpose Alignment**: P4 (Ensure Compliance)

**Acceptance Criteria**:
- [ ] Can track OSS components with licenses
- [ ] SBOM generated per product version
- [ ] License compatibility checking
- [ ] Copyleft trigger analysis
- [ ] Events published: ComponentAdded, LicenseConflictDetected, SBOMGenerated

---

#### 2.5 Patent Specialized Features [MEDIUM]

**Design Patent Support** (Research: 12):
```typescript
Patent + {
  designDetails?: {
    articleOfManufacture: string;
    claimedFeatures: 'configuration' | 'surface_ornamentation' | 'both';
    drawingCount: number;
    viewTypes: string[];
  }
}
```

**Software Patent Eligibility** (Research: 13):
```typescript
Patent + {
  eligibilityStatus?: {
    received101Rejection: boolean;
    abstractIdeaCategory?: string;
    inventiveConceptArguments?: string[];
    eligibilityRisk?: 'high' | 'medium' | 'low';
  }
}
```

**SEP/FRAND Tracking** (Research: 07):
```typescript
Patent + {
  isStandardEssential: boolean;
  sepDeclarations?: SEPDeclaration[];
}
```

**Purpose Alignment**: P1, P2, P3

---

#### 2.6 Trademark Fame and Dilution [MEDIUM]

**Rationale**: Famous marks get additional protection against dilution (blurring/tarnishment) even without confusion.

**Entities**:
- `FameAssessment` - Fame status tracking
- `SurveyEvidence` - Recognition surveys
- `DilutionIncident` - Blurring/tarnishment events

**Trademark Entity Enhancements**:
```typescript
+ fameStatus?: FameAssessment;
+ dilutionIncidents?: DilutionIncident[];
```

**Research Source**: 15-trademark-dilution-famous-marks.md

**Purpose Alignment**: P1 (Protect Innovation)

**Acceptance Criteria**:
- [ ] Can assess and record fame status
- [ ] Survey evidence attached
- [ ] Dilution incidents tracked separately from infringement
- [ ] Events published: FameAssessed, DilutionIncidentDetected

---

### Phase 3: Advanced Features (Weeks 25-32)

**Goal**: Complete enforcement capabilities, add automation, and enhance API.

#### 3.1 IP Enforcement Workflow [HIGH]

**Note**: This domain was identified as a gap in research - needs research document before implementation.

**Planned Entities**:
- `InfringementCase` - Infringement tracking
- `CeaseAndDesist` - C&D letter management
- `LitigationMatter` - Lawsuit tracking
- `Settlement` - Settlement agreements

**Research Needed**: Create 17-ip-enforcement-workflow.md

**Purpose Alignment**: P1 (Protect Innovation)

---

#### 3.2 Notification and Deadline System [HIGH]

**Cross-cutting concern** affecting all compliance features:

- Deadline calculation engine
- Notification rules (90/60/30 days)
- Escalation paths
- Calendar integration (iCal export)
- Email/webhook notifications

**Purpose Alignment**: P4 (Ensure Compliance)

---

#### 3.3 Analytics Dashboard [MEDIUM]

- Portfolio overview (counts by type, status, jurisdiction)
- Upcoming deadlines calendar
- Risk heatmaps (FTO, eligibility, dilution)
- Valuation trends
- Compliance scorecard

**Purpose Alignment**: P5 (Inform Strategy)

---

#### 3.4 API Enhancements [MEDIUM]

- Bulk operations support
- Advanced filtering and search
- GraphQL alternative (optional)
- Webhook subscriptions for events
- Rate limiting and API keys

---

## Entity Design Specifications

### New Core Entities

#### TradeSecret

```typescript
interface TradeSecret {
  id: string;
  title: string;
  description: string;

  // Classification
  category: 'technical' | 'business' | 'financial' | 'customer' | 'process' | 'formula' | 'other';
  sensitivityLevel: 'confidential' | 'highly_confidential' | 'restricted';

  // Ownership
  ownerId: string;
  departmentOwner?: string;
  custodian?: string;

  // Dates
  identifiedDate: Date;
  lastReviewDate?: Date;

  // Status
  status: 'active' | 'disclosed' | 'abandoned' | 'converted_to_patent';

  // Economic value (required for legal protection)
  economicValueDescription: string;
  estimatedValue?: number;

  // Protection measures
  protectionMeasures: ProtectionMeasure[];

  // Access control
  accessRecords: TradeSecretAccess[];

  // Incidents
  incidents: TradeSecretIncident[];

  // Audit
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
```

#### DomainName

```typescript
interface DomainName {
  id: string;
  domainName: string;              // "example.com"
  tld: string;                     // "com"

  // Ownership
  ownerId: string;
  registrarName: string;
  registrationDate: Date;
  expirationDate: Date;
  autoRenew: boolean;

  // Status
  status: 'active' | 'expired' | 'suspended' | 'transferred' | 'cancelled';

  // Trademark linkage
  relatedTrademarkId?: string;
  registrationPurpose: 'primary' | 'defensive' | 'product' | 'campaign';

  // DNS
  nameservers?: string[];

  // Disputes
  activeDisputes: DomainDispute[];

  // Audit
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
```

#### IPValuation

```typescript
interface IPValuation {
  id: string;

  // What's being valued
  ipAssetId: string;
  ipAssetType: 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'portfolio';

  // Context
  purpose: 'licensing' | 'sale' | 'financing' | 'litigation' | 'tax' |
           'financial_reporting' | 'strategic_planning' | 'ma_due_diligence';
  valuationDate: Date;
  effectiveDate: Date;

  // Methodology
  primaryApproach: 'income' | 'market' | 'cost';
  methodology: string;
  secondaryApproach?: 'income' | 'market' | 'cost';

  // Results
  concludedValue: number;
  valueLow?: number;
  valueHigh?: number;
  currency: string;

  // Assumptions
  assumptions: ValuationAssumption[];

  // Preparer
  preparedBy: 'internal' | 'external';
  valuationFirmName?: string;

  // Documentation
  reportDocumentId?: string;
  status: 'draft' | 'final' | 'superseded';

  // Audit
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
```

#### FTOAnalysis

```typescript
interface FTOAnalysis {
  id: string;

  // What's being cleared
  productName: string;
  productDescription: string;
  productFeatures: ProductFeature[];

  // Scope
  jurisdictions: string[];
  searchDate: Date;
  cutoffDate: Date;

  // Results
  patentsIdentified: number;
  patentsAnalyzed: number;
  highRiskPatents: FTOPatentRisk[];
  mediumRiskPatents: FTOPatentRisk[];
  lowRiskPatents: FTOPatentRisk[];

  // Conclusion
  overallRiskLevel: 'high' | 'medium' | 'low' | 'clear';
  recommendations: string[];

  // Opinion
  opinionProvided: boolean;
  opinionDocumentId?: string;

  // Status
  status: 'in_progress' | 'completed' | 'superseded';

  // Audit
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
```

---

## Dependency Graph

```
                         FOUNDATION (Phase 0)
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │TradeSecret│         │DomainName │         │  Patent   │
   │   (NEW)   │         │   (NEW)   │         │ Families  │
   └─────┬─────┘         └─────┬─────┘         └─────┬─────┘
         │                     │                     │
         │                     │                     │
         ▼                     ▼                     ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │Protection │         │  Domain   │         │Maintenance│
   │ Measures  │         │ Disputes  │         │   Fees    │
   └───────────┘         └─────┬─────┘         └───────────┘
                               │
                               ▼
                         ┌───────────┐
                         │ Trademark │◄────────────────────┐
                         │(Enhanced) │                     │
                         └─────┬─────┘                     │
                               │                           │
         ┌─────────────────────┼─────────────────────┐     │
         │                     │                     │     │
         ▼                     ▼                     ▼     │
   ┌───────────┐         ┌───────────┐         ┌─────────┴─┐
   │Section 8/9│         │  Madrid   │         │   Fame/   │
   │ Tracking  │         │ Protocol  │         │ Dilution  │
   └───────────┘         └───────────┘         └───────────┘

                         STRATEGIC (Phase 2)
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │    IP     │         │   FTO     │         │    Due    │
   │ Valuation │         │ Analysis  │         │ Diligence │
   └───────────┘         └───────────┘         └───────────┘
         │                      │                      │
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ All IP Asset Types    │
                    │ (Patent, TM, ©, TS)   │
                    └───────────────────────┘
```

**Key Dependencies**:
1. `TradeSecret` must exist before License can properly handle `ipType: 'trade_secret'`
2. `DomainDispute` requires both `DomainName` and `Trademark` (for mark linkage)
3. `FTOAnalysis` requires `Patent` to be functional (risk identification)
4. `IPValuation` can value any IP type - requires all core entities
5. `IPDueDiligenceProject` audits everything - requires comprehensive entity coverage
6. Compliance features (MaintenanceFee, Section8Filing, Madrid) require enhanced parent entities

---

## Success Metrics

### Phase 0 (Foundation)
- [ ] 100% of IP types have corresponding entities
- [ ] License can be created for any IP type without errors
- [ ] Patent family tree can be constructed and queried

### Phase 1 (Compliance)
- [ ] All deadline-driven events have 90/60/30 day alerts
- [ ] Zero missed deadlines due to system gaps
- [ ] Section 8/9 and maintenance fee workflows functional

### Phase 2 (Strategic)
- [ ] Can produce IP valuation for any asset
- [ ] FTO analysis can map claims to product features
- [ ] M&A due diligence can surface all IP risks

### Phase 3 (Advanced)
- [ ] Enforcement workflow from detection to resolution
- [ ] Dashboard provides executive IP portfolio visibility
- [ ] API supports all documented operations

### Overall Mission Metrics

| Purpose | Metric | Target |
|---------|--------|--------|
| P1: Protect Innovation | IP assets registered/tracked | 100% coverage |
| P2: Manage Portfolios | Lifecycle events captured | All major events |
| P3: Enable Licensing | License creation success | No blocked scenarios |
| P4: Ensure Compliance | Deadlines met | 100% on-time |
| P5: Inform Strategy | Strategic queries answerable | FTO, Valuation, DD available |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Scope creep** | Strict phase boundaries; defer to next phase |
| **Data migration** | Existing entities enhanced incrementally; backward compatible |
| **Integration breaks** | All changes behind feature flags initially |
| **Missing requirements** | Research doc required before implementation |
| **Compliance deadlines** | Phase 1 prioritizes highest-risk deadlines (maintenance, Section 8) |

---

## Research Document Coverage

| Phase | Research Docs Used |
|-------|-------------------|
| Phase 0 | 01, 07, 08, 09, 16 |
| Phase 1 | 02, 03, 04, 05, 06 |
| Phase 2 | 10, 11, 12, 13, 14, 15, 16 |
| Phase 3 | (New research needed: 17-ip-enforcement-workflow.md) |

---

## Next Steps

1. **Review and approve this plan** with stakeholders
2. **Create technical design docs** for Phase 0 entities
3. **Set up project tracking** with phase milestones
4. **Begin Phase 0 implementation** with TradeSecret entity

---

*This implementation plan synthesizes findings from 16 research documents conducted on 2026-01-26 and 2026-01-27. It was created following the Purpose Prompter (PP) protocol with territory assessment, deep understanding, and creativity phases.*

**Plan Version**: 1.0
**Created**: 2026-01-27
**Research Foundation**: /research/00-research-index.md
