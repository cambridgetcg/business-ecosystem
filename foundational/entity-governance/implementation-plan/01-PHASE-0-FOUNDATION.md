# Phase 0: Foundation

## Overview

**Goal**: Build the architectural foundation that enables all future phases.

**Why Phase 0 First**: The dependency graph shows that jurisdiction model and entity type configuration are prerequisites for Phase 1 (BOI needs jurisdiction context) and Phase 2 (LLC support needs entity type config).

**Duration**: 2-3 weeks

---

## Deliverables

### 0.1 Jurisdiction Model Refactoring

**Problem**: Current model only tracks formation jurisdiction (country + state). Real entities interact with jurisdictions in 4 independent contexts.

**Current State** (schema.ts:85-98):
```typescript
legalEntities: {
  jurisdictionCountry: varchar('jurisdiction_country', { length: 2 }),
  jurisdictionState: varchar('jurisdiction_state', { length: 100 }),
}
```

**Target State**:
```typescript
// Formation jurisdiction (already exists, enhance)
legalEntities: {
  formationCountry: varchar('formation_country', { length: 2 }),
  formationSubdivision: varchar('formation_subdivision', { length: 100 }),
  formationType: varchar('formation_type'), // 'domestic' | 'domesticated' | 'converted'
  formationDate: timestamp('formation_date'),
  formationFilingNumber: varchar('formation_filing_number'),
}

// NEW: Jurisdiction profiles (reference data)
jurisdictionProfiles: {
  id: uuid,
  country: varchar(2),
  subdivision: varchar(100),

  // Formation rules
  entityTypesAllowed: jsonb,         // ['corporation', 'llc', 'lp', ...]
  formationFee: integer,
  expeditedAvailable: boolean,

  // Annual compliance
  annualReportRequired: boolean,
  annualReportFrequency: varchar,    // 'annual', 'biennial'
  annualReportDueDateRule: jsonb,
  franchiseTaxType: varchar,         // 'none', 'flat', 'shares', 'income'
  franchiseTaxRules: jsonb,

  // Foreign qualification
  qualificationFee: integer,
  qualificationDoingBusinessTriggers: jsonb,

  // Economic nexus (for tax)
  salesTaxNexusThreshold: jsonb,     // { revenue: 100000, transactions: 200 }
  incomeTaxNexusRules: jsonb,

  // Metadata
  effectiveDate: timestamp,
  sourceUrl: varchar,
}
```

**Migration Strategy**:
1. Add new columns to `legalEntities` (formationType, formationFilingNumber)
2. Create `jurisdictionProfiles` table
3. Populate profiles for top 10 states (DE, CA, NY, TX, FL, WA, NV, WY, IL, NJ)
4. Migrate existing jurisdiction data (no breaking changes)

**Files to Modify**:
- `src/infrastructure/persistence/schema.ts` - Add columns and new table
- `src/domain/value-objects/index.ts` - Add JurisdictionProfile value object
- `migrations/` - Create migration files

---

### 0.2 Entity Type Configuration System

**Problem**: Current model treats all entity types the same. Different types have fundamentally different governance requirements.

**Current State** (schema.ts:15-25):
```typescript
entityTypeEnum: ['corporation', 'llc', 'lp', 'llp', 'partnership',
                 'sole_proprietorship', 'nonprofit', 'trust', 'other']
```

**Target State**:
```typescript
// NEW: Entity-specific configuration
entityGovernanceConfig: {
  id: uuid,
  entityId: uuid,                    // FK to legalEntities

  // LLC-specific
  managementType: varchar,           // 'member_managed', 'manager_managed'
  hasOperatingAgreement: boolean,
  operatingAgreementDate: timestamp,

  // Corporation-specific
  subchapterSElection: boolean,
  sElectionEffectiveDate: timestamp,
  sElectionTerminationDate: timestamp,
  sElectionFormNumber: varchar,      // '2553'

  // Nonprofit-specific
  taxExemptStatus: varchar,          // '501c3', '501c4', '501c6', etc.
  irsExemptionLetterDate: timestamp,
  minimumBoardSize: integer,
  stateCharitableRegistration: boolean,

  // Trust-specific
  trustType: varchar,                // 'revocable', 'irrevocable', 'statutory', 'business'

  // Formality requirements (derived from type + jurisdiction)
  annualMeetingRequired: boolean,
  boardRequired: boolean,
  minutesRequired: boolean,
  bylawsRequired: boolean,
  operatingAgreementRequired: boolean,

  // Audit columns
  ...baseColumns,
}

// NEW: Entity type rules (reference data)
entityTypeRules: {
  id: uuid,
  entityType: varchar,
  jurisdictionProfileId: uuid,

  // Governance requirements
  annualMeetingRequired: boolean,
  boardRequired: boolean,
  minimumDirectors: integer,
  officersRequired: jsonb,           // ['president', 'secretary', 'treasurer']

  // Formality requirements
  minutesRequired: boolean,
  resolutionsRequired: boolean,
  governingDocumentType: varchar,    // 'bylaws', 'operating_agreement', 'partnership_agreement'

  // Tax default
  defaultTaxClassification: varchar, // 'c_corp', 'partnership', 'disregarded'
  taxElectionOptions: jsonb,         // ['s_corp', 'c_corp']

  ...baseColumns,
}
```

**Migration Strategy**:
1. Create `entityGovernanceConfig` table
2. Create `entityTypeRules` reference table
3. Populate rules for common combinations (DE Corporation, DE LLC, CA LLC, etc.)
4. Create config records for existing entities with defaults

**Files to Modify**:
- `src/infrastructure/persistence/schema.ts` - Add tables
- `src/domain/entity/models/` - Add EntityGovernanceConfig model
- `src/application/commands/create-legal-entity.ts` - Create config on entity creation

---

### 0.3 Event Infrastructure Enhancement

**Problem**: Current events are basic. Need structured schemas, versioning, and reliable delivery for cross-service integration.

**Current State** (from README.md:163-170):
```
entity.created
entity.updated
entity.dissolved
subsidiary.added
filing.completed
shares.issued
```

**Target State**:
```typescript
// Event schema structure
interface DomainEvent<T> {
  eventId: string;                   // UUID
  eventType: string;                 // 'entity-governance.entity.created'
  eventVersion: string;              // 'v1'
  aggregateId: string;               // Entity ID
  aggregateType: string;             // 'LegalEntity'
  occurredAt: string;                // ISO timestamp
  correlationId?: string;            // For request tracing
  causationId?: string;              // Parent event ID
  metadata: {
    userId?: string;
    source: string;
    environment: string;
  };
  payload: T;                        // Event-specific data
}

// Enhanced event types
const EventTypes = {
  // Entity lifecycle (existing, enhanced)
  ENTITY_CREATED: 'entity-governance.entity.created',
  ENTITY_UPDATED: 'entity-governance.entity.updated',
  ENTITY_DISSOLVED: 'entity-governance.entity.dissolved',
  ENTITY_STATUS_CHANGED: 'entity-governance.entity.status-changed',

  // Corporate structure (existing, enhanced)
  SUBSIDIARY_ADDED: 'entity-governance.structure.subsidiary-added',
  SUBSIDIARY_REMOVED: 'entity-governance.structure.subsidiary-removed',
  OWNERSHIP_CHANGED: 'entity-governance.structure.ownership-changed',

  // Filing (existing, enhanced)
  FILING_COMPLETED: 'entity-governance.filing.completed',
  FILING_DUE: 'entity-governance.filing.due',
  FILING_OVERDUE: 'entity-governance.filing.overdue',

  // Shares (existing, enhanced)
  SHARES_ISSUED: 'entity-governance.shares.issued',
  SHARES_TRANSFERRED: 'entity-governance.shares.transferred',

  // Configuration (new)
  GOVERNANCE_CONFIG_CREATED: 'entity-governance.config.created',
  GOVERNANCE_CONFIG_UPDATED: 'entity-governance.config.updated',
  TAX_ELECTION_FILED: 'entity-governance.config.tax-election-filed',
} as const;

// Event payload schemas (Zod)
const EntityCreatedPayloadSchema = z.object({
  entityId: z.string().uuid(),
  name: z.string(),
  legalName: z.string(),
  entityType: EntityTypeSchema,
  formationJurisdiction: JurisdictionSchema,
  formationDate: z.date().optional(),
  taxId: z.string().optional(),
});
```

**Implementation**:
1. Create event schema definitions with Zod
2. Create event publisher with retry logic
3. Create event store table for audit/replay
4. Add correlation ID to all operations

**Files to Create**:
- `src/domain/events/event-types.ts` - Event type constants
- `src/domain/events/event-schemas.ts` - Zod schemas per event
- `src/infrastructure/integration/event-publisher.ts` - Enhanced publisher
- `src/infrastructure/persistence/event-store.ts` - Event store schema

**Files to Modify**:
- `src/infrastructure/persistence/schema.ts` - Add event_store table
- `src/application/handlers/` - Publish events with new structure

---

### 0.4 Database Migration Framework

**Problem**: Need systematic approach to schema evolution as we add tables across phases.

**Current State** (drizzle.config.ts exists, migrations/ has initial migration)

**Target State**:
```
migrations/
├── 0001_initial_schema.sql              # Existing
├── 0002_jurisdiction_model.sql          # Phase 0.1
├── 0003_entity_governance_config.sql    # Phase 0.2
├── 0004_event_store.sql                 # Phase 0.3
├── 0005_jurisdiction_profiles_seed.sql  # Phase 0 reference data
└── 0006_entity_type_rules_seed.sql      # Phase 0 reference data
```

**Migration Principles**:
1. Each migration is idempotent (can run multiple times safely)
2. Migrations include both UP and DOWN (for rollback)
3. Data migrations separate from schema migrations
4. Reference data seeded via migrations

**Files to Create**:
- `migrations/0002_jurisdiction_model.sql`
- `migrations/0003_entity_governance_config.sql`
- `migrations/0004_event_store.sql`
- `migrations/0005_jurisdiction_profiles_seed.sql`
- `migrations/0006_entity_type_rules_seed.sql`

---

## Implementation Tasks

### Week 1: Jurisdiction Model

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Add formation columns to legalEntities | High | 2h | None |
| Create jurisdictionProfiles schema | High | 2h | None |
| Create JurisdictionProfile value object | High | 2h | Schema |
| Create migration 0002 | High | 1h | Schema |
| Seed top 10 state profiles | Medium | 4h | Migration |
| Update CreateLegalEntity command | Medium | 2h | Value objects |
| Add jurisdiction profile API endpoint | Medium | 2h | Schema |

### Week 2: Entity Configuration

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Create entityGovernanceConfig schema | High | 2h | None |
| Create entityTypeRules schema | High | 2h | None |
| Create EntityGovernanceConfig model | High | 2h | Schema |
| Create migration 0003 | High | 1h | Schema |
| Seed entity type rules | Medium | 4h | Migration |
| Update CreateLegalEntity to create config | Medium | 2h | Model |
| Add config API endpoints | Medium | 2h | Schema |

### Week 3: Events & Migrations

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Define event type constants | High | 1h | None |
| Create event payload schemas | High | 2h | Constants |
| Create event store schema | High | 2h | None |
| Enhance event publisher | High | 4h | Schemas |
| Create migration 0004 | High | 1h | Schema |
| Update handlers to publish enhanced events | Medium | 4h | Publisher |
| Verify all migrations run cleanly | High | 2h | All migrations |
| Test event delivery end-to-end | High | 2h | Publisher |

---

## Schema Definitions

### jurisdictionProfiles Table

```sql
CREATE TABLE jurisdiction_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(2) NOT NULL,
  subdivision VARCHAR(100),

  -- Formation rules
  entity_types_allowed JSONB DEFAULT '[]',
  formation_fee INTEGER,
  expedited_available BOOLEAN DEFAULT false,

  -- Annual compliance
  annual_report_required BOOLEAN DEFAULT true,
  annual_report_frequency VARCHAR(20) DEFAULT 'annual',
  annual_report_due_date_rule JSONB,
  franchise_tax_type VARCHAR(20),
  franchise_tax_rules JSONB,

  -- Foreign qualification
  qualification_fee INTEGER,
  qualification_triggers JSONB,

  -- Economic nexus
  sales_tax_nexus_threshold JSONB,
  income_tax_nexus_rules JSONB,

  -- Metadata
  effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_url VARCHAR(500),

  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(country, subdivision)
);

CREATE INDEX idx_jurisdiction_profiles_country ON jurisdiction_profiles(country);
CREATE INDEX idx_jurisdiction_profiles_subdivision ON jurisdiction_profiles(country, subdivision);
```

### entityGovernanceConfig Table

```sql
CREATE TABLE entity_governance_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,

  -- LLC-specific
  management_type VARCHAR(20),
  has_operating_agreement BOOLEAN DEFAULT false,
  operating_agreement_date TIMESTAMP WITH TIME ZONE,

  -- Corporation-specific
  subchapter_s_election BOOLEAN DEFAULT false,
  s_election_effective_date TIMESTAMP WITH TIME ZONE,
  s_election_termination_date TIMESTAMP WITH TIME ZONE,
  s_election_form_number VARCHAR(20),

  -- Nonprofit-specific
  tax_exempt_status VARCHAR(20),
  irs_exemption_letter_date TIMESTAMP WITH TIME ZONE,
  minimum_board_size INTEGER,
  state_charitable_registration BOOLEAN DEFAULT false,

  -- Trust-specific
  trust_type VARCHAR(20),

  -- Formality requirements
  annual_meeting_required BOOLEAN DEFAULT true,
  board_required BOOLEAN DEFAULT true,
  minutes_required BOOLEAN DEFAULT true,
  bylaws_required BOOLEAN DEFAULT true,
  operating_agreement_required BOOLEAN DEFAULT false,

  -- Audit columns
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  version INTEGER NOT NULL DEFAULT 1,

  -- Constraints
  UNIQUE(entity_id)
);

CREATE INDEX idx_entity_governance_config_entity ON entity_governance_config(entity_id);
```

### event_store Table

```sql
CREATE TABLE event_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  event_version VARCHAR(10) NOT NULL DEFAULT 'v1',
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  correlation_id UUID,
  causation_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  publish_attempts INTEGER DEFAULT 0,
  last_error TEXT
);

CREATE INDEX idx_event_store_aggregate ON event_store(aggregate_type, aggregate_id);
CREATE INDEX idx_event_store_type ON event_store(event_type);
CREATE INDEX idx_event_store_occurred ON event_store(occurred_at);
CREATE INDEX idx_event_store_unpublished ON event_store(published_at) WHERE published_at IS NULL;
```

---

## Success Criteria

### Functional Criteria

- [ ] Can create entity with formation jurisdiction details (type, filing number)
- [ ] Jurisdiction profiles loaded for top 10 states
- [ ] Entity governance config created automatically on entity creation
- [ ] Entity type rules queryable by type + jurisdiction
- [ ] Events publish with full schema (eventId, version, correlation, payload)
- [ ] Event store captures all domain events
- [ ] All migrations run without errors

### Non-Functional Criteria

- [ ] No breaking changes to existing API endpoints
- [ ] No data loss during migration
- [ ] Event publish latency <100ms
- [ ] Query performance unchanged or improved

---

## Rollback Plan

If Phase 0 deployment fails:

1. **Schema rollback**: Each migration has DOWN script
2. **Code rollback**: Deploy previous version
3. **Data preservation**: New columns are nullable, no data loss

```bash
# Rollback migrations
pnpm db:migrate:down 0004
pnpm db:migrate:down 0003
pnpm db:migrate:down 0002

# Or restore from backup
pg_restore -d entity_governance backup_pre_phase0.dump
```

---

## Dependencies on Phase 1

Phase 0 completion enables Phase 1 (BOI/CTA):

| Phase 0 Deliverable | Phase 1 Dependency |
|---------------------|-------------------|
| Jurisdiction profiles | BOI filings are jurisdiction-specific |
| Entity governance config | Determines BOI exemption eligibility |
| Event infrastructure | BOI events need proper structure |
| Migration framework | BOI tables follow same pattern |

---

## Verification Checklist

Before marking Phase 0 complete:

```
FOUNDATION VERIFICATION
═══════════════════════

□ JURISDICTION MODEL
  □ legalEntities has formation columns
  □ jurisdictionProfiles table exists
  □ Top 10 states seeded with accurate data
  □ API can query jurisdiction rules

□ ENTITY CONFIGURATION
  □ entityGovernanceConfig table exists
  □ entityTypeRules table exists
  □ Config created on entity creation
  □ Type-specific fields populated correctly

□ EVENTS
  □ Event schemas defined with Zod
  □ Event store table exists
  □ Events publish with full structure
  □ Events persist to event store
  □ Correlation ID flows through

□ MIGRATIONS
  □ All migrations run cleanly (up)
  □ All migrations reverse cleanly (down)
  □ No data loss on migration
  □ Reference data seeded correctly

□ NON-BREAKING
  □ Existing API endpoints unchanged
  □ Existing tests pass
  □ No performance regression
```
