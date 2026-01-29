# Beneficial Ownership Information (BOI) and Corporate Transparency Act

## Knowledge Gap Identified

The Corporate Transparency Act (CTA) created federal beneficial ownership reporting requirements. Our model tracks shareholders and officers but lacks the specific data elements required for BOI reporting, exemption tracking, and the 25%/substantial control determination logic.

## Key Findings

### What the CTA Requires

The **Corporate Transparency Act** (enacted January 1, 2021) requires most business entities to report their true human owners to **FinCEN** (Financial Crimes Enforcement Network).

**Purpose**: Combat money laundering, terrorist financing, tax evasion, and other illicit activities that exploit anonymous shell companies.

### Mental Model

```
                         REPORTING COMPANY
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         MUST REPORT      MUST REPORT      MUST REPORT
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐  ┌──────────┐  ┌───────────────┐
    │ COMPANY         │  │ COMPANY  │  │ BENEFICIAL    │
    │ INFORMATION     │  │ APPLICANT│  │ OWNERS        │
    └─────────────────┘  └──────────┘  └───────────────┘
              │                │                │
    - Legal name         - Person who         Two Tests (OR):
    - DBAs               filed formation      ┌────────────────┐
    - Address            - Person who         │ 25% OWNERSHIP  │
    - Jurisdiction       directed filing      │      OR        │
    - Tax ID (EIN)                            │ SUBSTANTIAL    │
                                              │ CONTROL        │
                                              └────────────────┘
```

### Beneficial Owner Definition

A **natural person** (individual, not another entity) who meets EITHER test:

**Test A - 25% Ownership Interest**:
- Owns or controls at least 25% of ownership interests
- "Ownership interest" broadly defined: equity, stock, voting rights, capital/profit interests, convertible instruments, options

**Test B - Substantial Control** (ANY of these):
1. **Senior Officer**: CEO, CFO, COO, President, General Counsel
2. **Appointment Authority**: Power to appoint/remove majority of directors or officers
3. **Important Decisions**: Authority over important business decisions
4. **Other Control**: Any other form of substantial control

**Exclusions from Beneficial Owner**:
- Minor children (parent/guardian info reported instead)
- Nominees/agents acting on behalf of another
- Employees whose control derives solely from employment
- Individuals whose only interest is through inheritance rights
- Creditors (unless they meet control threshold)

### Required Information (Data Elements)

**For the Reporting Company**:
| Field | Description |
|-------|-------------|
| Full legal name | As registered |
| Trade names/DBAs | All names used |
| Current street address | Principal place of business |
| Jurisdiction of formation | State/tribe/foreign |
| Tax Identification Number | EIN |

**For Each Beneficial Owner**:
| Field | Description |
|-------|-------------|
| Full legal name | As on ID document |
| Date of birth | Complete DOB |
| Current residential address | Home address (not business) |
| Unique identifying number | From acceptable ID |
| Issuing jurisdiction | Of the ID document |
| Image of ID document | Copy of the document |

**Acceptable ID Documents**:
1. U.S. passport
2. State driver's license
3. State/local/tribal ID document
4. Foreign passport (if no U.S. document)

### The 23 Exemptions

| # | Exemption Category | Key Criteria |
|---|-------------------|--------------|
| 1 | Securities reporting issuer | SEC reporting company |
| 2 | Governmental authority | Federal, state, local, tribal |
| 3-6 | Financial institutions | Banks, credit unions, MSBs |
| 7-11 | Securities entities | Broker/dealers, exchanges, investment companies |
| 12-13 | Insurance entities | State-licensed insurers/producers |
| 14-18 | Regulated entities | CFTC registered, accounting firms, utilities |
| 19-20 | Tax-exempt entities | 501(c) confirmed status |
| **21** | **Large operating company** | **21+ employees, $5M+ revenue, US office** |
| 22 | Subsidiary of exempt | Wholly owned by exempt entity |
| 23 | Inactive entity | Pre-2020, no assets, no ownership changes |

**Large Operating Company Exemption** (most relevant for private companies):
All THREE criteria must be met:
1. 21+ full-time employees in the United States
2. Operating presence at a physical office in the US
3. Over $5 million in gross receipts/sales on prior year's federal tax return

### Filing Deadlines

| Entity Type | Initial BOI Report Deadline |
|-------------|---------------------------|
| Existing entities (formed before 1/1/2024) | January 1, 2025 |
| New entities (formed 1/1/2024 - 12/31/2024) | 90 days from formation |
| New entities (formed on or after 1/1/2025) | 30 days from formation |

**Update Requirements** (30-day deadline):
- Beneficial owner's name, address, or ID info changes
- Beneficial owner gains or loses 25%+ ownership
- New person exercises substantial control
- Person ceases to exercise substantial control
- Reporting company information changes

### Penalties

**Civil Penalties**:
- $500 per day of ongoing violation
- Maximum $10,000 per violation

**Criminal Penalties (willful violations)**:
- Up to $10,000 fine
- Up to 2 years imprisonment

**For unauthorized disclosure of BOI**:
- Up to $250,000 fine
- Up to 5 years imprisonment

## Model Implications

### Current Schema Gaps

```
shareholders table                     GAPS IDENTIFIED
├── name                              ├── Missing: date of birth
├── taxId                             ├── Missing: residential address
├── contactEmail                      ├── Missing: ID document type
├── address (business)                ├── Missing: ID document number
└── shareholderType                   ├── Missing: ID document image
                                      ├── Missing: ID issuing jurisdiction
                                      └── Missing: FinCEN identifier

legal_entities table                  GAPS IDENTIFIED
├── name, legalName                   ├── Missing: DBAs/trade names (array)
├── jurisdictionCountry/State         ├── Need: BOI filing status tracking
├── taxId                             ├── Need: exemption status + reason
└── status                            └── Need: company applicant tracking
```

### Recommended Schema Extensions

```typescript
// Beneficial Owner Registry
export const beneficialOwners = pgTable('beneficial_owners', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  personId: uuid('person_id'), // Link to person/individual record
  fullLegalName: varchar('full_legal_name'),
  dateOfBirth: date('date_of_birth'),

  // Residential address (required - cannot be business address)
  residentialAddress: jsonb('residential_address'),

  // Identification document
  idDocumentType: varchar('id_document_type'), // 'us_passport' | 'state_drivers_license' | 'state_id' | 'foreign_passport'
  idDocumentNumber: varchar('id_document_number'),
  idIssuingJurisdiction: varchar('id_issuing_jurisdiction'),
  idExpirationDate: date('id_expiration_date'),
  idDocumentImageKey: varchar('id_document_image_key'),

  // FinCEN identifier (if person has one)
  fincenIdentifier: varchar('fincen_identifier'),

  // Qualification basis
  ownershipPercentage: integer('ownership_percentage'), // basis points
  substantialControlType: varchar('substantial_control_type'),
  substantialControlDescription: text('substantial_control_description'),

  // Status
  status: varchar('status'), // 'active' | 'inactive'
  effectiveDate: timestamp('effective_date'),
  endDate: timestamp('end_date'),
  // ... audit columns
});

// BOI Filing Tracking
export const boiFilings = pgTable('boi_filings', {
  id: uuid('id').primaryKey(),
  entityId: uuid('entity_id').references(() => legalEntities.id),
  filingType: varchar('filing_type'), // 'initial' | 'update' | 'correction'
  status: varchar('status'), // 'pending' | 'submitted' | 'accepted' | 'rejected'
  dueDate: timestamp('due_date'),
  submittedDate: timestamp('submitted_date'),
  acceptedDate: timestamp('accepted_date'),
  fincenSubmissionId: varchar('fincen_submission_id'),
  fincenConfirmationNumber: varchar('fincen_confirmation_number'),
  reportedBeneficialOwners: jsonb('reported_beneficial_owners'),
  reportedCompanyApplicants: jsonb('reported_company_applicants'),
  rejectionReason: text('rejection_reason'),
  // ... audit columns
});

// Legal Entity BOI Extensions
// Add to legal_entities:
boiExemptionStatus: varchar('boi_exemption_status'), // 'exempt' | 'reporting_required' | 'under_review'
boiExemptionCategory: integer('boi_exemption_category'), // 1-23
boiExemptionDeterminationDate: timestamp('boi_exemption_determination_date'),
fullTimeEmployeeCount: integer('full_time_employee_count'),
hasUSPhysicalOffice: boolean('has_us_physical_office'),
priorYearGrossReceipts: integer('prior_year_gross_receipts'),
tradeNames: jsonb('trade_names'), // string array
```

### New Events Required

```typescript
export const BOIEventTypes = {
  // Beneficial Owner Changes
  BENEFICIAL_OWNER_IDENTIFIED: 'entity-governance.boi.owner-identified',
  BENEFICIAL_OWNER_REMOVED: 'entity-governance.boi.owner-removed',
  BENEFICIAL_OWNER_INFO_CHANGED: 'entity-governance.boi.owner-info-changed',

  // Threshold Crossings
  OWNERSHIP_THRESHOLD_CROSSED: 'entity-governance.boi.threshold-crossed',
  SUBSTANTIAL_CONTROL_GAINED: 'entity-governance.boi.control-gained',
  SUBSTANTIAL_CONTROL_LOST: 'entity-governance.boi.control-lost',

  // Filing Events
  BOI_FILING_DUE: 'entity-governance.boi.filing-due',
  BOI_FILING_SUBMITTED: 'entity-governance.boi.filing-submitted',
  BOI_FILING_ACCEPTED: 'entity-governance.boi.filing-accepted',
  BOI_FILING_REJECTED: 'entity-governance.boi.filing-rejected',
  BOI_UPDATE_REQUIRED: 'entity-governance.boi.update-required',

  // Exemption Events
  BOI_EXEMPTION_QUALIFIED: 'entity-governance.boi.exemption-qualified',
  BOI_EXEMPTION_LOST: 'entity-governance.boi.exemption-lost',
} as const;
```

## Why This Matters

1. **Federal compliance** - Penalties up to $10,000 + criminal liability
2. **Ownership calculation** - Must calculate across share classes and tiers
3. **Substantial control detection** - Officers auto-qualify; must track
4. **Update triggers** - 30-day window for any beneficial owner changes
5. **Exemption monitoring** - Employee count and revenue changes status
6. **Privacy requirements** - BOI data is highly sensitive (SSN-equivalent)

## Questions for Further Research

1. How do we calculate effective ownership through multi-tier structures?
2. Should BOI filing submission integrate with FinCEN's API directly?
3. How do we handle FinCEN identifiers for serial entrepreneurs?
4. What triggers should prompt automatic exemption re-evaluation?
