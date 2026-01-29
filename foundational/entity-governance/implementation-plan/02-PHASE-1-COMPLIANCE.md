# Phase 1: Critical Compliance (BOI/CTA)

## Overview

**Goal**: Achieve full compliance with the Corporate Transparency Act (CTA) beneficial ownership information (BOI) reporting requirements.

**Why Phase 1 Priority**: This is the only CRITICAL priority item with:
- Federal law mandate
- Significant penalties ($500/day, up to $10,000, criminal liability)
- Fixed regulatory deadlines

**Duration**: 3-4 weeks

**Prerequisites**: Phase 0 complete (jurisdiction model, entity config, event infrastructure)

---

## Regulatory Context

### Corporate Transparency Act (CTA)

**Enacted**: January 1, 2021 (effective January 1, 2024)

**Purpose**: Combat money laundering, terrorist financing, tax evasion, and other illicit activities through anonymous shell companies.

**Requirement**: Report beneficial ownership information (BOI) to FinCEN.

### Deadlines

| Entity Type | Initial Filing Deadline |
|-------------|------------------------|
| Existing (formed before 1/1/2024) | January 1, 2025 |
| New (1/1/2024 - 12/31/2024) | 90 days from formation |
| New (on/after 1/1/2025) | 30 days from formation |

**Update Filings**: Within 30 days of any change to:
- Beneficial owner information
- Beneficial owner status (gained/lost 25% or control)
- Company information

### Penalties

| Violation | Penalty |
|-----------|---------|
| Civil (failure to report) | $500/day, up to $10,000 |
| Criminal (willful) | Up to $10,000 fine + 2 years imprisonment |
| Unauthorized disclosure | Up to $250,000 + 5 years |

---

## Deliverables

### 1.1 Beneficial Owners Table

**Required Data Elements** (per FinCEN):

```typescript
beneficialOwners: {
  id: uuid,
  entityId: uuid,                    // FK to legalEntities
  personId: uuid,                    // Link to person record if exists

  // Required by FinCEN
  fullLegalName: varchar(500),       // As appears on ID document
  dateOfBirth: date,                 // REQUIRED - not in current schema
  residentialAddress: jsonb,         // Home address, NOT business
  //   {
  //     street1: string,
  //     street2?: string,
  //     city: string,
  //     stateProvince: string,
  //     postalCode: string,
  //     country: string (ISO 3166-1 alpha-2)
  //   }

  // Identification document
  idDocumentType: varchar,           // 'us_passport', 'state_drivers_license',
                                     // 'state_id', 'tribal_id', 'foreign_passport'
  idDocumentNumber: varchar,         // REQUIRED
  idIssuingJurisdiction: varchar,    // State or country code
  idExpirationDate: date,
  idDocumentImageKey: varchar,       // S3 key for document image

  // FinCEN Identifier (optional alternative)
  fincenIdentifier: varchar,         // If person has obtained FinCEN ID

  // Qualification basis
  qualificationBasis: varchar,       // 'ownership', 'control', 'both'
  ownershipPercentage: integer,      // Basis points (2500 = 25%)
  substantialControlType: varchar,   // 'senior_officer', 'appointment_authority',
                                     // 'important_decisions', 'other_control'
  substantialControlDescription: text,

  // Status tracking
  status: varchar,                   // 'active', 'inactive'
  effectiveDate: timestamp,          // When became beneficial owner
  endDate: timestamp,                // When ceased to be beneficial owner
  endReason: varchar,                // 'ownership_decreased', 'control_lost', 'death', 'other'

  // Audit columns
  ...baseColumns,
}
```

**Indexes**:
- `idx_beneficial_owners_entity` on `(entity_id)`
- `idx_beneficial_owners_status` on `(entity_id, status)`
- `idx_beneficial_owners_fincen` on `(fincen_identifier)` WHERE NOT NULL

---

### 1.2 Company Applicants Table

For entities formed on or after January 1, 2024, must also report company applicants.

```typescript
companyApplicants: {
  id: uuid,
  entityId: uuid,

  // Two types of applicants
  applicantType: varchar,            // 'direct_filer', 'director_of_filing'

  // Same data elements as beneficial owners
  fullLegalName: varchar(500),
  dateOfBirth: date,
  businessAddress: jsonb,            // Can be business address (unlike BO)
  idDocumentType: varchar,
  idDocumentNumber: varchar,
  idIssuingJurisdiction: varchar,
  idExpirationDate: date,
  idDocumentImageKey: varchar,
  fincenIdentifier: varchar,

  // Audit columns
  ...baseColumns,
}
```

---

### 1.3 BOI Filings Table

```typescript
boiFilings: {
  id: uuid,
  entityId: uuid,

  // Filing type
  filingType: varchar,               // 'initial', 'updated', 'corrected', 'newly_exempt'
  filingReason: text,                // Why this filing (for updates/corrections)

  // Status tracking
  status: varchar,                   // 'draft', 'pending', 'submitted', 'accepted',
                                     // 'rejected', 'exempt'
  dueDate: timestamp,                // When filing is due
  submittedDate: timestamp,          // When submitted to FinCEN
  acceptedDate: timestamp,           // When FinCEN accepted
  rejectedDate: timestamp,           // If rejected

  // FinCEN response
  fincenSubmissionId: varchar,       // Submission tracking ID
  fincenConfirmationNumber: varchar, // Confirmation upon acceptance
  rejectionReason: text,             // If rejected, why

  // Filing content snapshot
  reportedCompanyInfo: jsonb,        // Company info at time of filing
  reportedBeneficialOwners: jsonb,   // Array of BO data at time of filing
  reportedCompanyApplicants: jsonb,  // Array of CA data at time of filing

  // Audit columns
  ...baseColumns,
}
```

---

### 1.4 BOI Exemption Tracking

Enhance `legalEntities` table with exemption tracking:

```typescript
// Add to legalEntities
boiExemptionStatus: varchar,         // 'exempt', 'reporting_required', 'under_review'
boiExemptionCategory: integer,       // 1-23 (exemption category number)
boiExemptionDeterminationDate: timestamp,
boiExemptionNotes: text,

// Large Operating Company Exemption (#21) tracking
fullTimeEmployeeCount: integer,
hasUsPhysicalOffice: boolean,
priorYearGrossReceipts: integer,     // In cents

// Trade names for company info
tradeNames: jsonb,                   // Array of DBAs/trade names
```

**The 23 Exemptions**:

| # | Category | Auto-Detectable? |
|---|----------|------------------|
| 1 | Securities reporting issuer | Yes (if SEC status tracked) |
| 2 | Governmental authority | Yes (entity type) |
| 3-6 | Financial institutions | Partial (entity type + license) |
| 7-11 | Securities entities | Partial (entity type + registration) |
| 12-13 | Insurance entities | Partial (entity type + license) |
| 14-18 | Regulated entities | Partial |
| 19-20 | Tax-exempt entities | Yes (if 501c status tracked) |
| **21** | **Large operating company** | **Yes (employee count, revenue, office)** |
| 22 | Subsidiary of exempt | Yes (parent relationship + parent status) |
| 23 | Inactive entity | Yes (formation date, activity) |

---

### 1.5 Threshold Monitoring

Create system to detect when:
- Ownership crosses 25% threshold
- Someone gains/loses substantial control
- Exemption status changes

```typescript
// Ownership threshold calculation
const calculateOwnershipPercentage = (
  shareholdings: Shareholding[],
  shareholderId: string,
  shareClasses: ShareClass[]
): number => {
  // Sum all shares held by this shareholder
  // Consider: direct holdings, indirect (through entities), convertible
  // Return percentage in basis points
};

// Substantial control detection
const hasSubstantialControl = (
  officers: Officer[],
  personId: string
): { hasControl: boolean; controlType: string } => {
  const seniorOfficerTitles = ['ceo', 'cfo', 'coo', 'president', 'general_counsel'];
  const officer = officers.find(o => o.personId === personId);

  if (officer && seniorOfficerTitles.includes(officer.title)) {
    return { hasControl: true, controlType: 'senior_officer' };
  }

  // Check other control types...
  return { hasControl: false, controlType: null };
};
```

---

### 1.6 Domain Events

```typescript
const BOIEventTypes = {
  // Beneficial owner lifecycle
  BENEFICIAL_OWNER_IDENTIFIED: 'entity-governance.boi.owner-identified',
  BENEFICIAL_OWNER_UPDATED: 'entity-governance.boi.owner-updated',
  BENEFICIAL_OWNER_REMOVED: 'entity-governance.boi.owner-removed',

  // Threshold events
  OWNERSHIP_THRESHOLD_CROSSED: 'entity-governance.boi.threshold-crossed',
  SUBSTANTIAL_CONTROL_GAINED: 'entity-governance.boi.control-gained',
  SUBSTANTIAL_CONTROL_LOST: 'entity-governance.boi.control-lost',

  // Filing events
  BOI_FILING_DUE: 'entity-governance.boi.filing-due',
  BOI_FILING_SUBMITTED: 'entity-governance.boi.filing-submitted',
  BOI_FILING_ACCEPTED: 'entity-governance.boi.filing-accepted',
  BOI_FILING_REJECTED: 'entity-governance.boi.filing-rejected',
  BOI_UPDATE_REQUIRED: 'entity-governance.boi.update-required',

  // Exemption events
  BOI_EXEMPTION_QUALIFIED: 'entity-governance.boi.exemption-qualified',
  BOI_EXEMPTION_LOST: 'entity-governance.boi.exemption-lost',
} as const;

// Event payloads
interface BeneficialOwnerIdentifiedPayload {
  entityId: string;
  beneficialOwnerId: string;
  fullLegalName: string;
  qualificationBasis: 'ownership' | 'control' | 'both';
  ownershipPercentage?: number;
  controlType?: string;
  effectiveDate: string;
}

interface OwnershipThresholdCrossedPayload {
  entityId: string;
  personId: string;
  previousPercentage: number;
  newPercentage: number;
  threshold: number; // 2500 = 25%
  direction: 'above' | 'below';
  triggersBoiUpdate: boolean;
}

interface BOIFilingDuePayload {
  entityId: string;
  filingId: string;
  filingType: 'initial' | 'updated' | 'corrected';
  dueDate: string;
  daysUntilDue: number;
}
```

---

## Implementation Tasks

### Week 1: Schema & Models

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create beneficialOwners schema | Critical | 2h | Phase 0 |
| Create companyApplicants schema | Critical | 1h | Phase 0 |
| Create boiFilings schema | Critical | 2h | Phase 0 |
| Add BOI columns to legalEntities | Critical | 1h | Phase 0 |
| Create migration files | Critical | 2h | Schemas |
| Create BeneficialOwner domain model | High | 2h | Schema |
| Create BOIFiling domain model | High | 2h | Schema |
| Create Zod validation schemas | High | 2h | Models |

### Week 2: Business Logic

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Implement ownership percentage calculation | Critical | 4h | Schema |
| Implement substantial control detection | Critical | 4h | Schema |
| Implement exemption evaluation (23 categories) | Critical | 6h | Schema |
| Implement threshold monitoring | High | 4h | Calculations |
| Create auto-detect for senior officers | High | 2h | Control detection |
| Create exemption #21 checker | High | 2h | Exemption evaluation |
| Create exemption #22 checker | High | 2h | Parent relationships |

### Week 3: Commands & Queries

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| CreateBeneficialOwner command | Critical | 3h | Models |
| UpdateBeneficialOwner command | Critical | 2h | Models |
| RemoveBeneficialOwner command | Critical | 2h | Models |
| CreateBOIFiling command | Critical | 3h | Models |
| SubmitBOIFiling command | High | 2h | Models |
| ListBeneficialOwners query | High | 2h | Schema |
| GetBOIFilingStatus query | High | 2h | Schema |
| GetBOIExemptionStatus query | High | 2h | Schema |
| CalculateOwnershipPercentage query | High | 2h | Calculations |

### Week 4: API & Events

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| POST /entities/:id/beneficial-owners | Critical | 2h | Commands |
| GET /entities/:id/beneficial-owners | Critical | 2h | Queries |
| PUT /entities/:id/beneficial-owners/:boId | High | 2h | Commands |
| DELETE /entities/:id/beneficial-owners/:boId | High | 2h | Commands |
| POST /entities/:id/boi-filings | High | 2h | Commands |
| GET /entities/:id/boi-filings | High | 2h | Queries |
| GET /entities/:id/boi-exemption-status | High | 2h | Queries |
| Implement BOI event publishing | Critical | 4h | Event schemas |
| Implement threshold event triggers | High | 3h | Monitoring |
| Implement filing due date alerts | High | 2h | Scheduling |

---

## Schema Definitions

### beneficial_owners Table

```sql
CREATE TABLE beneficial_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  person_id UUID,

  -- Required by FinCEN
  full_legal_name VARCHAR(500) NOT NULL,
  date_of_birth DATE NOT NULL,
  residential_address JSONB NOT NULL,

  -- Identification document
  id_document_type VARCHAR(30) NOT NULL,
  id_document_number VARCHAR(100) NOT NULL,
  id_issuing_jurisdiction VARCHAR(100) NOT NULL,
  id_expiration_date DATE,
  id_document_image_key VARCHAR(500),

  -- FinCEN Identifier (alternative)
  fincen_identifier VARCHAR(50),

  -- Qualification basis
  qualification_basis VARCHAR(20) NOT NULL, -- 'ownership', 'control', 'both'
  ownership_percentage INTEGER,              -- Basis points
  substantial_control_type VARCHAR(30),
  substantial_control_description TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  end_reason VARCHAR(50),

  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  version INTEGER NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CHECK (ownership_percentage IS NULL OR (ownership_percentage >= 0 AND ownership_percentage <= 10000)),
  CHECK (qualification_basis IN ('ownership', 'control', 'both')),
  CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_beneficial_owners_entity ON beneficial_owners(entity_id);
CREATE INDEX idx_beneficial_owners_entity_status ON beneficial_owners(entity_id, status);
CREATE INDEX idx_beneficial_owners_fincen_id ON beneficial_owners(fincen_identifier)
  WHERE fincen_identifier IS NOT NULL;
```

### company_applicants Table

```sql
CREATE TABLE company_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,

  applicant_type VARCHAR(20) NOT NULL, -- 'direct_filer', 'director_of_filing'

  full_legal_name VARCHAR(500) NOT NULL,
  date_of_birth DATE NOT NULL,
  business_address JSONB NOT NULL,

  id_document_type VARCHAR(30) NOT NULL,
  id_document_number VARCHAR(100) NOT NULL,
  id_issuing_jurisdiction VARCHAR(100) NOT NULL,
  id_expiration_date DATE,
  id_document_image_key VARCHAR(500),

  fincen_identifier VARCHAR(50),

  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  version INTEGER NOT NULL DEFAULT 1,

  -- Constraints
  CHECK (applicant_type IN ('direct_filer', 'director_of_filing'))
);

CREATE INDEX idx_company_applicants_entity ON company_applicants(entity_id);
```

### boi_filings Table

```sql
CREATE TABLE boi_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,

  filing_type VARCHAR(20) NOT NULL,
  filing_reason TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  due_date TIMESTAMP WITH TIME ZONE,
  submitted_date TIMESTAMP WITH TIME ZONE,
  accepted_date TIMESTAMP WITH TIME ZONE,
  rejected_date TIMESTAMP WITH TIME ZONE,

  fincen_submission_id VARCHAR(100),
  fincen_confirmation_number VARCHAR(100),
  rejection_reason TEXT,

  reported_company_info JSONB,
  reported_beneficial_owners JSONB NOT NULL DEFAULT '[]',
  reported_company_applicants JSONB NOT NULL DEFAULT '[]',

  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  version INTEGER NOT NULL DEFAULT 1,

  -- Constraints
  CHECK (filing_type IN ('initial', 'updated', 'corrected', 'newly_exempt')),
  CHECK (status IN ('draft', 'pending', 'submitted', 'accepted', 'rejected', 'exempt'))
);

CREATE INDEX idx_boi_filings_entity ON boi_filings(entity_id);
CREATE INDEX idx_boi_filings_status ON boi_filings(status);
CREATE INDEX idx_boi_filings_due ON boi_filings(due_date) WHERE status IN ('draft', 'pending');
```

### legal_entities BOI columns

```sql
ALTER TABLE legal_entities
  ADD COLUMN boi_exemption_status VARCHAR(20),
  ADD COLUMN boi_exemption_category INTEGER,
  ADD COLUMN boi_exemption_determination_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN boi_exemption_notes TEXT,
  ADD COLUMN full_time_employee_count INTEGER,
  ADD COLUMN has_us_physical_office BOOLEAN,
  ADD COLUMN prior_year_gross_receipts BIGINT,
  ADD COLUMN trade_names JSONB DEFAULT '[]';

-- Constraints
ALTER TABLE legal_entities
  ADD CONSTRAINT chk_boi_exemption_status
  CHECK (boi_exemption_status IS NULL OR
         boi_exemption_status IN ('exempt', 'reporting_required', 'under_review'));

ALTER TABLE legal_entities
  ADD CONSTRAINT chk_boi_exemption_category
  CHECK (boi_exemption_category IS NULL OR
         (boi_exemption_category >= 1 AND boi_exemption_category <= 23));

CREATE INDEX idx_legal_entities_boi_status ON legal_entities(boi_exemption_status);
```

---

## API Endpoints

### Beneficial Owners

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/entities/:id/beneficial-owners` | List beneficial owners |
| POST | `/api/v2/entities/:id/beneficial-owners` | Add beneficial owner |
| GET | `/api/v2/entities/:id/beneficial-owners/:boId` | Get beneficial owner |
| PUT | `/api/v2/entities/:id/beneficial-owners/:boId` | Update beneficial owner |
| DELETE | `/api/v2/entities/:id/beneficial-owners/:boId` | Remove beneficial owner |

### BOI Filings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/entities/:id/boi-filings` | List BOI filings |
| POST | `/api/v2/entities/:id/boi-filings` | Create BOI filing |
| GET | `/api/v2/entities/:id/boi-filings/:fId` | Get filing details |
| POST | `/api/v2/entities/:id/boi-filings/:fId/submit` | Submit to FinCEN |

### BOI Status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/entities/:id/boi-status` | Get BOI compliance status |
| GET | `/api/v2/entities/:id/boi-exemption` | Get exemption evaluation |
| POST | `/api/v2/entities/:id/boi-exemption/evaluate` | Re-evaluate exemption |

### Threshold Checks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/entities/:id/ownership-percentages` | Calculate all ownership |
| GET | `/api/v2/entities/:id/substantial-control` | Identify controllers |

---

## Exemption Evaluation Logic

```typescript
interface ExemptionEvaluation {
  isExempt: boolean;
  exemptionCategory: number | null;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  requiresManualReview: boolean;
  evaluatedAt: Date;
}

const evaluateBOIExemption = async (
  entity: LegalEntity,
  config: EntityGovernanceConfig,
  parentEntity?: LegalEntity
): Promise<ExemptionEvaluation> => {

  // Exemption #21: Large Operating Company
  if (entity.fullTimeEmployeeCount >= 21 &&
      entity.hasUsPhysicalOffice &&
      entity.priorYearGrossReceipts > 500000000) { // $5M in cents
    return {
      isExempt: true,
      exemptionCategory: 21,
      reason: 'Large operating company: 21+ employees, US office, >$5M revenue',
      confidence: 'high',
      requiresManualReview: false,
      evaluatedAt: new Date(),
    };
  }

  // Exemption #22: Subsidiary of exempt entity
  if (parentEntity && parentEntity.boiExemptionStatus === 'exempt') {
    // Check if 100% owned
    const relationship = await getParentRelationship(entity.id, parentEntity.id);
    if (relationship.ownershipPercentage === 10000) { // 100%
      return {
        isExempt: true,
        exemptionCategory: 22,
        reason: `Wholly owned subsidiary of exempt entity (${parentEntity.name})`,
        confidence: 'high',
        requiresManualReview: false,
        evaluatedAt: new Date(),
      };
    }
  }

  // Exemption #23: Inactive entity
  if (entity.incorporationDate < new Date('2020-01-01') &&
      entity.status === 'inactive') {
    return {
      isExempt: true,
      exemptionCategory: 23,
      reason: 'Inactive entity formed before 2020',
      confidence: 'medium',
      requiresManualReview: true, // Need to verify no assets, no ownership changes
      evaluatedAt: new Date(),
    };
  }

  // Exemption #19-20: Tax-exempt entities
  if (config.taxExemptStatus && config.irsExemptionLetterDate) {
    return {
      isExempt: true,
      exemptionCategory: config.taxExemptStatus.startsWith('501c3') ? 19 : 20,
      reason: `Tax-exempt organization (${config.taxExemptStatus})`,
      confidence: 'high',
      requiresManualReview: false,
      evaluatedAt: new Date(),
    };
  }

  // Not exempt - reporting required
  return {
    isExempt: false,
    exemptionCategory: null,
    reason: 'No exemption applies',
    confidence: 'high',
    requiresManualReview: false,
    evaluatedAt: new Date(),
  };
};
```

---

## Success Criteria

### Functional Criteria

- [ ] Can capture all 14 FinCEN-required data elements for beneficial owners
- [ ] Can track company applicants for entities formed after 1/1/2024
- [ ] Can track BOI filing status (draft → submitted → accepted/rejected)
- [ ] Can evaluate all 23 exemption categories
- [ ] Exemption #21 auto-evaluates based on employee count, office, revenue
- [ ] Exemption #22 auto-evaluates based on parent ownership
- [ ] System detects when ownership crosses 25% threshold
- [ ] System detects when officer gains substantial control
- [ ] Events publish for all BOI-related changes
- [ ] API provides full CRUD for beneficial owners

### Compliance Criteria

- [ ] Data model matches FinCEN BOIR form fields
- [ ] ID document image can be stored securely
- [ ] Residential address captured (not business address)
- [ ] FinCEN identifier supported as alternative to full data
- [ ] Filing due dates calculated correctly based on formation date
- [ ] Update filing required within 30 days of changes

### Integration Criteria

- [ ] BOI data available to banking-treasury for KYC
- [ ] BOI filing status available to compliance service
- [ ] Events flow to interested services

---

## Security Considerations

BOI data is highly sensitive (comparable to SSN):

| Requirement | Implementation |
|-------------|---------------|
| Encryption at rest | PostgreSQL column-level encryption for PII |
| Encryption in transit | TLS 1.3 for all API calls |
| Access control | Role-based access, audit logging |
| ID document storage | S3 with server-side encryption, signed URLs |
| Data retention | Per FinCEN guidance (currently indefinite) |
| Audit trail | All access logged to event_store |

---

## Rollback Plan

If Phase 1 deployment fails:

1. **Feature flag**: BOI features behind feature flag, can disable
2. **Schema rollback**: Migrations have DOWN scripts
3. **Data preservation**: New tables, no existing data affected

```bash
# Disable feature
UPDATE feature_flags SET enabled = false WHERE feature = 'boi_reporting';

# Rollback if needed
pnpm db:migrate:down 0010  # BOI filings
pnpm db:migrate:down 0009  # Company applicants
pnpm db:migrate:down 0008  # Beneficial owners
pnpm db:migrate:down 0007  # Legal entities BOI columns
```

---

## Verification Checklist

Before marking Phase 1 complete:

```
BOI COMPLIANCE VERIFICATION
═══════════════════════════

□ DATA MODEL
  □ beneficial_owners table with all 14 FinCEN fields
  □ company_applicants table
  □ boi_filings table with status tracking
  □ legal_entities has exemption columns
  □ All migrations run cleanly

□ BUSINESS LOGIC
  □ Ownership percentage calculated correctly
  □ Substantial control detected for senior officers
  □ Exemption #21 evaluates (employees, office, revenue)
  □ Exemption #22 evaluates (subsidiary of exempt)
  □ 25% threshold monitoring works
  □ Control gain/loss detection works

□ API
  □ CRUD for beneficial owners
  □ BOI filing endpoints
  □ Exemption status endpoint
  □ Ownership percentage endpoint

□ EVENTS
  □ BOI.OWNER_IDENTIFIED publishes
  □ BOI.THRESHOLD_CROSSED publishes
  □ BOI.FILING_DUE publishes
  □ BOI.UPDATE_REQUIRED publishes

□ SECURITY
  □ PII encrypted at rest
  □ ID document storage secured
  □ Access logging implemented
  □ Role-based access enforced

□ INTEGRATION
  □ Events consumable by banking-treasury
  □ Events consumable by compliance
```

---

## Next Steps After Phase 1

With BOI compliance achieved, Phase 2 can begin:

| Phase 1 Enables | Phase 2 Work |
|-----------------|--------------|
| BOI filing infrastructure | Foreign qualification filings (similar pattern) |
| Ownership calculation | Multi-tier ownership for holding structures |
| Exemption evaluation | Entity type-specific compliance |
| Event infrastructure | LLC-specific events |
