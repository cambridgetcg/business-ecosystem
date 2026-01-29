# Foundational Layer Implementation Plan

> A comprehensive plan to realize the purpose and mission of the foundational layer, synthesizing insights from 35 research documents (27 original + 8 nuance gaps).

## Executive Summary

The foundational layer exists to provide **what the business IS** - legal structure, financial foundation, regulatory compliance, and identity/security. This plan translates research understanding into a phased implementation strategy that:

1. **Builds the core domains** with proper entity-centric architecture
2. **Integrates cross-domain concerns** identified in nuance gap research
3. **Addresses failure modes** and regulatory nuances often overlooked
4. **Establishes events and contracts** that enable operational layer dependencies

---

## Mission Alignment

### Entity Governance Mission
> "To provide a single source of truth for legal entity formation, corporate structure, governance, and compliance"

### Accounting Mission
> "To maintain the integrity, accuracy, and auditability of all financial transactions"

### Banking-Treasury Mission
> "To provide centralized cash management, payment processing, and treasury operations"

### Synthesis
The foundational layer succeeds when:
- **Zero entity-related errors** across the ecosystem
- **Financial statements producible** at any time with full confidence
- **No payment failures**, reconciliation gaps, or liquidity surprises
- **100% regulatory compliance** for entity filings, tax, and AML

---

## Current State Assessment

### What Exists

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT IMPLEMENTATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ENTITY-GOVERNANCE (TypeScript/Drizzle)                                    │
│  ├─ Schema: ✅ Comprehensive (16 tables, 8 subdomains)                     │
│  ├─ API: 🔶 Partial (routes exist, handlers incomplete)                    │
│  ├─ Events: ❌ Not implemented                                             │
│  └─ Cross-domain: ❌ Missing nuance integrations                           │
│                                                                             │
│  BANKING-TREASURY (TypeScript/Drizzle)                                     │
│  ├─ Schema: 🔶 Basic (4 tables)                                            │
│  ├─ API: 🔶 Partial                                                        │
│  ├─ Events: ❌ Not implemented                                             │
│  └─ Cross-domain: ❌ Missing nuance integrations                           │
│                                                                             │
│  ACCOUNTING (Python/SQLAlchemy)                                            │
│  ├─ Schema: ❌ Not implemented                                             │
│  ├─ API: ❌ Not implemented                                                │
│  ├─ Events: ❌ Not implemented                                             │
│  └─ Cross-domain: ❌ Missing nuance integrations                           │
│                                                                             │
│  KYC-IDENTITY (TypeScript/Drizzle)                                         │
│  ├─ Schema: ✅ Implemented                                                 │
│  ├─ API: 🔶 Partial                                                        │
│  └─ Events: ❌ Not implemented                                             │
│                                                                             │
│  COMPLIANCE, TAX, CORPORATE-SECURITY                                       │
│  └─ All: ❌ Not started (README only)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Research Revealed

| Research Area | Key Insight | Implementation Impact |
|---------------|-------------|----------------------|
| **Jurisdiction Complexity** | Four jurisdiction contexts (formation, qualification, nexus, regulatory) | Entity schema needs expansion |
| **Transfer Pricing** | Required for ALL intercompany transactions | New cross-domain service needed |
| **Banking De-Risking** | Relationships can terminate unexpectedly | Banking contingency features |
| **Economic Substance** | Offshore entities need substance tracking | Entity governance expansion |
| **CFC/GILTI/PFIC** | OBBBA 2025 changes fundamental calculations | Tax service design impact |
| **BaaS Risk** | Middleware creates systemic vulnerability | BaaS provider assessment features |
| **Cash Pooling** | Cross-domain treasury tool | New treasury subservice |
| **SMLLC Veil Piercing** | Higher risk requires tracking | Veil health scoring feature |
| **409A Valuations** | Complex timing and material event triggers | Cap table integration |

---

## Architecture Overview

### Domain Dependency Graph

```
                              ┌─────────────────────────┐
                              │    OPERATIONAL LAYER    │
                              │  (contracts, insurance) │
                              └───────────┬─────────────┘
                                          │ depends on
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FOUNDATIONAL LAYER                                 │
│                                                                             │
│    ┌───────────────────┐                                                    │
│    │ ENTITY GOVERNANCE │◄───────────────────────────────────────────────┐   │
│    │   (FOUNDATION)    │                                                │   │
│    │                   │                                                │   │
│    │ • Legal entities  │                                                │   │
│    │ • Governance      │                                                │   │
│    │ • Cap table       │                                                │   │
│    │ • Compliance      │                                                │   │
│    │ • Jurisdiction    │────────────────┐                               │   │
│    │   tracking        │                │                               │   │
│    └─────────┬─────────┘                │                               │   │
│              │                          │                               │   │
│              │ entity context           │ jurisdiction/nexus            │   │
│              ▼                          ▼                               │   │
│    ┌─────────────────┐        ┌─────────────────┐        ┌───────────┐ │   │
│    │   ACCOUNTING    │◄──────►│      TAX        │◄──────►│COMPLIANCE │ │   │
│    │                 │        │                 │        │           │ │   │
│    │ • GL/Ledger     │        │ • Returns       │        │ • Policy  │ │   │
│    │ • Journal entry │        │ • Provisions    │        │ • Audit   │ │   │
│    │ • Multi-curr    │        │ • CFC/GILTI     │        │ • AML     │ │   │
│    │ • Reporting     │        │ • Transfer prce │        │           │ │   │
│    └────────┬────────┘        └────────┬────────┘        └─────┬─────┘ │   │
│             │                          │                       │       │   │
│             │ financial data           │ withholding           │ KYC   │   │
│             ▼                          ▼                       ▼       │   │
│    ┌─────────────────────────────────────────────────────────────────┐ │   │
│    │                     BANKING-TREASURY                            │ │   │
│    │                                                                 │ │   │
│    │ • Bank accounts    • Payments        • Cash pooling             │ │   │
│    │ • Reconciliation   • Forecasting     • Intercompany netting     │ │   │
│    │ • BaaS assessment  • De-risk monitoring                         │ │   │
│    └─────────────────────────────────────────────────────────────────┘ │   │
│                                    │                                   │   │
│                                    │ identity verification             │   │
│                                    ▼                                   │   │
│    ┌──────────────────┐        ┌──────────────────┐                   │   │
│    │   KYC-IDENTITY   │◄──────►│CORPORATE-SECURITY│                   │   │
│    │                  │        │                  │                   │   │
│    │ • Identity       │        │ • Access control │                   │   │
│    │ • Verification   │        │ • Audit          │                   │   │
│    │ • Risk scoring   │        │ • Incidents      │                   │   │
│    └──────────────────┘        └──────────────────┘                   │   │
│                                                                       │   │
└───────────────────────────────────────────────────────────────────────┴───┘
```

### Cross-Domain Integration Points (from Nuance Gap Research)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-DOMAIN INTEGRATIONS REQUIRED                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. TRANSFER PRICING (Entity → Accounting → Tax)                           │
│     ├─ Intercompany agreement definition (Entity)                          │
│     ├─ Transaction recording at arm's length (Accounting)                  │
│     ├─ Documentation and CbCR preparation (Tax)                            │
│     └─ Payment execution matching policy (Banking)                         │
│                                                                             │
│  2. CASH POOLING (Entity → Accounting → Banking)                           │
│     ├─ Legal structure for pool (Entity - cash pool agreements)            │
│     ├─ Intercompany loan tracking (Accounting)                             │
│     ├─ Sweep execution and interest (Banking)                              │
│     └─ Transfer pricing on interest (Tax)                                  │
│                                                                             │
│  3. BENEFICIAL OWNERSHIP (Entity → Compliance → KYC)                       │
│     ├─ Cap table changes trigger BOI updates (Entity)                      │
│     ├─ CTA filing preparation (Compliance)                                 │
│     └─ Bank KYC synchronization (KYC → Banking)                            │
│                                                                             │
│  4. VEIL PROTECTION (Entity → Accounting → Banking)                        │
│     ├─ Formality tracking and alerts (Entity)                              │
│     ├─ Separate books evidence (Accounting)                                │
│     └─ Separate account maintenance (Banking)                              │
│                                                                             │
│  5. 409A VALUATIONS (Entity.CapTable → Accounting → Tax)                   │
│     ├─ Valuation triggers from cap table events (Entity)                   │
│     ├─ Stock compensation expense (Accounting)                             │
│     └─ Tax compliance tracking (Tax)                                       │
│                                                                             │
│  6. BANKING CONTINUITY (Entity → Banking → Compliance)                     │
│     ├─ Entity good standing for banking (Entity)                           │
│     ├─ De-risking monitoring and contingency (Banking)                     │
│     └─ AML compliance affecting relationships (Compliance)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 0: Foundation & Shared Contracts
**Goal**: Establish shared infrastructure that all domains depend on

#### 0.1 Event Infrastructure
```typescript
// shared/events/foundational-events.ts

// Entity Governance Events
type EntityCreated = { entityId: string; entityType: EntityType; jurisdiction: Jurisdiction; };
type EntityUpdated = { entityId: string; changes: EntityChanges; };
type EntityDissolved = { entityId: string; dissolutionDate: Date; };
type CapTableChanged = { entityId: string; changeType: CapTableChangeType; };
type GovernanceActionRecorded = { entityId: string; actionType: string; };
type JurisdictionAdded = { entityId: string; jurisdictionType: JurisdictionType; jurisdiction: Jurisdiction; };

// Accounting Events
type AccountCreated = { accountId: string; entityId: string; accountType: AccountType; };
type JournalEntryPosted = { entryId: string; entityId: string; amount: Money; };
type PeriodClosed = { entityId: string; period: FiscalPeriod; };
type ReconciliationCompleted = { entityId: string; accountId: string; };

// Banking-Treasury Events
type BankAccountOpened = { accountId: string; entityId: string; bankId: string; };
type PaymentCompleted = { paymentId: string; amount: Money; status: PaymentStatus; };
type CashPositionUpdated = { entityId: string; position: CashPosition; };
type DeRiskingAlertRaised = { entityId: string; bankId: string; alertType: DeRiskingSignal; };
```

#### 0.2 Shared Value Objects
```typescript
// shared/value-objects/

// Money (used everywhere)
interface Money { amount: Decimal; currency: CurrencyCode; }

// Jurisdiction (critical for entity governance)
interface Jurisdiction {
  country: CountryCode;
  subdivision?: string;  // ISO 3166-2
  locality?: string;
}

interface JurisdictionContext {
  formation: Jurisdiction;
  qualifications: ForeignQualification[];
  taxNexus: TaxNexus[];
  regulatory: RegulatoryJurisdiction[];
}

// Entity Reference (used by all domains)
interface EntityReference {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  formationJurisdiction: Jurisdiction;
}
```

#### 0.3 Database Partitioning Strategy
Following banking-treasury PARTITIONING.md pattern:
- Time-series data partitioned by month (transactions, audit logs)
- Entity-centric data partitioned by entity_id for multi-tenant isolation

---

### Phase 1: Entity Governance Completion
**Goal**: Complete the foundation that all other domains depend on

#### 1.1 Schema Enhancements (from Research)

```typescript
// NEW: Multi-context jurisdiction tracking (from 01-jurisdiction-complexity)
export const jurisdictionContexts = pgTable('jurisdiction_contexts', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  contextType: varchar('context_type', { length: 50 }).notNull(), // formation|qualification|tax_nexus|regulatory
  jurisdiction: jsonb('jurisdiction').notNull(),
  effectiveDate: timestamp('effective_date').notNull(),
  endDate: timestamp('end_date'),
  registrationNumber: varchar('registration_number', { length: 100 }),
  registeredAgentId: uuid('registered_agent_id'),
  filingRequirements: jsonb('filing_requirements'),
  metadata: jsonb('metadata'),
});

// NEW: Economic substance tracking (from 03-economic-substance-requirements)
export const economicSubstanceProfiles = pgTable('economic_substance_profiles', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  relevantActivities: jsonb('relevant_activities').notNull(),
  entityClassification: varchar('entity_classification', { length: 50 }).notNull(),
  isHighRiskIP: boolean('is_high_risk_ip').default(false),
  substanceEvidence: jsonb('substance_evidence'),
  lastReportDate: timestamp('last_report_date'),
  nextReportDue: timestamp('next_report_due'),
  complianceStatus: varchar('compliance_status', { length: 50 }).notNull(),
});

// NEW: Veil health tracking (from 07-single-member-llc-veil-piercing)
export const veilHealthAssessments = pgTable('veil_health_assessments', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  assessmentDate: timestamp('assessment_date').notNull(),
  formalitiesScore: integer('formalities_score').notNull(),
  capitalizationScore: integer('capitalization_score').notNull(),
  separationScore: integer('separation_score').notNull(),
  documentationScore: integer('documentation_score').notNull(),
  insuranceScore: integer('insurance_score').notNull(),
  overallScore: integer('overall_score').notNull(),
  riskLevel: varchar('risk_level', { length: 20 }).notNull(),
  findings: jsonb('findings'),
  recommendations: jsonb('recommendations'),
});

// NEW: 409A valuation tracking (from 08-409a-valuation-nuances)
export const valuations409A = pgTable('valuations_409a', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  valuationDate: timestamp('valuation_date').notNull(),
  reportDate: timestamp('report_date').notNull(),
  expirationDate: timestamp('expiration_date').notNull(),
  commonStockFMV: decimal('common_stock_fmv', { precision: 20, scale: 6 }).notNull(),
  enterpriseValue: decimal('enterprise_value', { precision: 20, scale: 2 }),
  primaryMethod: varchar('primary_method', { length: 50 }).notNull(),
  dlom: decimal('dlom', { precision: 5, scale: 4 }),
  appraiserId: varchar('appraiser_id', { length: 100 }).notNull(),
  safeHarborType: varchar('safe_harbor_type', { length: 50 }).notNull(),
  safeHarborQualified: boolean('safe_harbor_qualified').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  supersededBy: uuid('superseded_by'),
});

// NEW: Material event tracking for 409A
export const materialEventTriggers = pgTable('material_event_triggers', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull().references(() => legalEntities.id),
  eventDate: timestamp('event_date').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  description: text('description'),
  currentValuationId: uuid('current_valuation_id').references(() => valuations409A.id),
  requiresNewValuation: boolean('requires_new_valuation').notNull(),
  assessmentRationale: text('assessment_rationale'),
  newValuationId: uuid('new_valuation_id').references(() => valuations409A.id),
});
```

#### 1.2 Domain Services

```
entity-governance/src/
├── domain/
│   ├── entities/
│   │   ├── legal-entity.ts
│   │   ├── jurisdiction-context.ts      # NEW
│   │   ├── economic-substance.ts        # NEW
│   │   └── veil-health.ts               # NEW
│   ├── services/
│   │   ├── jurisdiction-service.ts      # Multi-context jurisdiction management
│   │   ├── substance-service.ts         # Economic substance compliance
│   │   ├── veil-health-service.ts       # Veil protection scoring
│   │   └── valuation-409a-service.ts    # 409A valuation lifecycle
│   └── events/
│       ├── entity-events.ts
│       └── cap-table-events.ts
├── application/
│   ├── commands/
│   │   ├── create-entity.ts
│   │   ├── add-jurisdiction.ts          # NEW
│   │   ├── assess-veil-health.ts        # NEW
│   │   └── record-409a-valuation.ts     # NEW
│   └── queries/
│       ├── get-entity.ts
│       ├── get-jurisdiction-summary.ts  # NEW
│       └── get-veil-health-report.ts    # NEW
└── infrastructure/
    ├── persistence/
    │   └── schema.ts                    # Enhanced
    └── event-publishers/
        └── entity-event-publisher.ts    # NEW
```

#### 1.3 API Endpoints

```
POST   /entities                          Create legal entity
GET    /entities/:id                      Get entity details
PUT    /entities/:id                      Update entity
DELETE /entities/:id                      Soft delete entity

# Jurisdiction (NEW)
POST   /entities/:id/jurisdictions        Add jurisdiction context
GET    /entities/:id/jurisdictions        Get all jurisdiction contexts
PUT    /entities/:id/jurisdictions/:jid   Update jurisdiction
GET    /entities/:id/jurisdiction-summary Complete jurisdiction analysis

# Veil Health (NEW)
POST   /entities/:id/veil-assessments     Run veil health assessment
GET    /entities/:id/veil-assessments     Get assessment history
GET    /entities/:id/veil-health          Current veil health status

# 409A Valuations (NEW)
POST   /entities/:id/valuations-409a      Record new valuation
GET    /entities/:id/valuations-409a      Get valuation history
POST   /entities/:id/material-events      Record material event
GET    /entities/:id/valuation-status     Current valuation status/expiry
```

---

### Phase 2: Accounting System
**Goal**: Build the financial backbone (Python/SQLAlchemy)

#### 2.1 Schema (following MISSION.md commitments)

```python
# accounting/src/infrastructure/persistence/models.py

class Account(Base):
    """Chart of accounts entry"""
    __tablename__ = 'accounts'

    id = Column(UUID, primary_key=True, default=uuid4)
    entity_id = Column(UUID, nullable=False, index=True)
    account_number = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    account_type = Column(Enum(AccountType), nullable=False)
    parent_id = Column(UUID, ForeignKey('accounts.id'))
    currency = Column(String(3), nullable=False)
    is_active = Column(Boolean, default=True)
    # ... audit columns

class JournalEntry(Base):
    """Immutable journal entry (MISSION: Immutability)"""
    __tablename__ = 'journal_entries'

    id = Column(UUID, primary_key=True, default=uuid4)
    entity_id = Column(UUID, nullable=False, index=True)
    entry_number = Column(String(50), nullable=False, unique=True)
    entry_date = Column(Date, nullable=False)
    posted_date = Column(DateTime(timezone=True))
    description = Column(Text, nullable=False)
    reference = Column(String(255))
    source_document_id = Column(UUID)
    status = Column(Enum(EntryStatus), nullable=False)
    # MISSION: Immutability - no update columns, corrections via reversing entries
    created_at = Column(DateTime(timezone=True), nullable=False)
    created_by = Column(UUID, nullable=False)

class JournalEntryLine(Base):
    """Journal entry line (MISSION: Financial Integrity - debits = credits)"""
    __tablename__ = 'journal_entry_lines'

    id = Column(UUID, primary_key=True, default=uuid4)
    journal_entry_id = Column(UUID, ForeignKey('journal_entries.id'), nullable=False)
    account_id = Column(UUID, ForeignKey('accounts.id'), nullable=False)
    debit_amount = Column(Numeric(20, 2))
    credit_amount = Column(Numeric(20, 2))
    currency = Column(String(3), nullable=False)
    exchange_rate = Column(Numeric(20, 10))
    description = Column(Text)

    # Constraint: exactly one of debit_amount or credit_amount must be set
    __table_args__ = (
        CheckConstraint(
            '(debit_amount IS NOT NULL AND credit_amount IS NULL) OR '
            '(debit_amount IS NULL AND credit_amount IS NOT NULL)',
            name='ck_single_amount'
        ),
    )

class FiscalPeriod(Base):
    """Fiscal period with close controls (MISSION: Period Controls)"""
    __tablename__ = 'fiscal_periods'

    id = Column(UUID, primary_key=True, default=uuid4)
    entity_id = Column(UUID, nullable=False, index=True)
    period_name = Column(String(50), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(Enum(PeriodStatus), nullable=False)  # open, soft_close, hard_close
    closed_at = Column(DateTime(timezone=True))
    closed_by = Column(UUID)

# NEW: Intercompany tracking (from 06-intercompany-netting-cash-pooling)
class IntercompanyTransaction(Base):
    """Tracks transactions between related entities"""
    __tablename__ = 'intercompany_transactions'

    id = Column(UUID, primary_key=True, default=uuid4)
    from_entity_id = Column(UUID, nullable=False, index=True)
    to_entity_id = Column(UUID, nullable=False, index=True)
    journal_entry_id = Column(UUID, ForeignKey('journal_entries.id'))
    transaction_type = Column(String(50), nullable=False)  # service_fee, royalty, loan, etc.
    amount = Column(Numeric(20, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    transfer_pricing_policy_id = Column(UUID)  # Reference to TP policy
    arm_length_validated = Column(Boolean)
    # ... audit columns

# NEW: Multi-currency tracking (from 06-multi-currency-accounting)
class CurrencyExposure(Base):
    """Track FX exposures by entity"""
    __tablename__ = 'currency_exposures'

    id = Column(UUID, primary_key=True, default=uuid4)
    entity_id = Column(UUID, nullable=False, index=True)
    functional_currency = Column(String(3), nullable=False)
    exposure_currency = Column(String(3), nullable=False)
    monetary_assets = Column(Numeric(20, 2))
    monetary_liabilities = Column(Numeric(20, 2))
    net_exposure = Column(Numeric(20, 2))
    as_of_date = Column(Date, nullable=False)
```

#### 2.2 Domain Services

```
accounting/src/
├── domain/
│   ├── entities/
│   │   ├── account.py
│   │   ├── journal_entry.py
│   │   └── fiscal_period.py
│   ├── services/
│   │   ├── journal_service.py           # Entry creation with balance validation
│   │   ├── period_service.py            # Period open/close
│   │   ├── intercompany_service.py      # NEW: Intercompany tracking
│   │   └── multi_currency_service.py    # NEW: FX handling
│   └── invariants/
│       └── accounting_equation.py       # Assets = Liabilities + Equity
├── application/
│   ├── commands/
│   │   ├── post_journal_entry.py
│   │   ├── close_period.py
│   │   └── reverse_entry.py
│   └── queries/
│       ├── trial_balance.py
│       ├── financial_statements.py
│       └── intercompany_balances.py     # NEW
└── infrastructure/
    ├── persistence/
    │   └── models.py
    └── event_publishers/
        └── accounting_events.py
```

---

### Phase 3: Banking-Treasury Expansion
**Goal**: Extend basic banking to comprehensive treasury

#### 3.1 Schema Enhancements

```typescript
// NEW: Banking relationship health (from 02-banking-derisking)
export const bankingRelationships = pgTable('banking_relationships', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull(),
  bankId: varchar('bank_id', { length: 100 }).notNull(),
  bankName: varchar('bank_name', { length: 255 }).notNull(),
  relationshipType: varchar('relationship_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  openDate: timestamp('open_date').notNull(),
  lastReviewDate: timestamp('last_review_date'),
  nextReviewDate: timestamp('next_review_date'),
  healthScore: integer('health_score'),
  riskFlags: jsonb('risk_flags'),
  terminationRisk: varchar('termination_risk', { length: 20 }),
  backupBankId: varchar('backup_bank_id', { length: 100 }),
});

export const deRiskingEvents = pgTable('derisking_events', {
  ...baseColumns,
  relationshipId: uuid('relationship_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  eventDate: timestamp('event_date').notNull(),
  noticeDate: timestamp('notice_date'),
  effectiveDate: timestamp('effective_date'),
  reason: text('reason'),
  responseActions: jsonb('response_actions'),
  migrationStatus: varchar('migration_status', { length: 50 }),
});

// NEW: BaaS provider assessment (from 05-baas-regulatory-risk)
export const baasProviderAssessments = pgTable('baas_provider_assessments', {
  ...baseColumns,
  providerId: varchar('provider_id', { length: 100 }).notNull(),
  providerName: varchar('provider_name', { length: 255 }).notNull(),
  assessmentDate: timestamp('assessment_date').notNull(),
  financialHealth: jsonb('financial_health'),
  partnerBanks: jsonb('partner_banks'),
  regulatoryStatus: jsonb('regulatory_status'),
  technologyAssessment: jsonb('technology_assessment'),
  overallRiskScore: integer('overall_risk_score'),
  riskFlags: jsonb('risk_flags'),
});

// NEW: Cash pool structures (from 06-intercompany-netting-cash-pooling)
export const cashPoolStructures = pgTable('cash_pool_structures', {
  ...baseColumns,
  poolId: varchar('pool_id', { length: 100 }).notNull().unique(),
  poolName: varchar('pool_name', { length: 255 }).notNull(),
  poolType: varchar('pool_type', { length: 50 }).notNull(), // physical|notional
  headerEntityId: uuid('header_entity_id').notNull(),
  bankId: varchar('bank_id', { length: 100 }).notNull(),
  headerAccountId: uuid('header_account_id').notNull(),
  sweepTiming: varchar('sweep_timing', { length: 50 }).notNull(),
  targetBalance: decimal('target_balance', { precision: 20, scale: 2 }),
  benchmarkRate: varchar('benchmark_rate', { length: 50 }),
  spreadConfiguration: jsonb('spread_configuration'),
  poolAgreementRef: varchar('pool_agreement_ref', { length: 255 }),
  effectiveDate: timestamp('effective_date').notNull(),
});

export const cashPoolParticipants = pgTable('cash_pool_participants', {
  ...baseColumns,
  poolId: varchar('pool_id', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  accountId: uuid('account_id').notNull(),
  participationType: varchar('participation_type', { length: 50 }).notNull(),
  maxBorrowingLimit: decimal('max_borrowing_limit', { precision: 20, scale: 2 }),
  depositSpread: integer('deposit_spread'), // basis points
  borrowSpread: integer('borrowing_spread'), // basis points
  intercompanyAgreementRef: varchar('intercompany_agreement_ref', { length: 255 }),
  effectiveDate: timestamp('effective_date').notNull(),
});

// NEW: Intercompany netting (from 06-intercompany-netting-cash-pooling)
export const nettingRuns = pgTable('netting_runs', {
  ...baseColumns,
  runId: varchar('run_id', { length: 100 }).notNull().unique(),
  runDate: timestamp('run_date').notNull(),
  settlementDate: timestamp('settlement_date').notNull(),
  grossPayables: decimal('gross_payables', { precision: 20, scale: 2 }),
  grossReceivables: decimal('gross_receivables', { precision: 20, scale: 2 }),
  netSettlements: jsonb('net_settlements'),
  savingsVsGross: decimal('savings_vs_gross', { precision: 20, scale: 2 }),
  status: varchar('status', { length: 50 }).notNull(),
});
```

#### 3.2 Domain Services

```
banking-treasury/src/
├── domain/
│   ├── entities/
│   │   ├── bank-account.ts
│   │   ├── payment.ts
│   │   ├── banking-relationship.ts      # NEW
│   │   ├── cash-pool.ts                 # NEW
│   │   └── baas-provider.ts             # NEW
│   ├── services/
│   │   ├── payment-service.ts
│   │   ├── reconciliation-service.ts
│   │   ├── relationship-health-service.ts  # NEW
│   │   ├── cash-pool-service.ts            # NEW
│   │   ├── netting-service.ts              # NEW
│   │   └── baas-risk-service.ts            # NEW
│   └── events/
│       ├── banking-events.ts
│       └── derisking-events.ts          # NEW
├── application/
│   ├── commands/
│   │   ├── initiate-payment.ts
│   │   ├── assess-relationship-health.ts   # NEW
│   │   ├── execute-cash-pool-sweep.ts      # NEW
│   │   └── run-intercompany-netting.ts     # NEW
│   └── queries/
│       ├── cash-position.ts
│       ├── relationship-status.ts          # NEW
│       └── baas-risk-assessment.ts         # NEW
```

---

### Phase 4: Tax Service
**Goal**: Build tax compliance with international complexity

#### 4.1 Schema

```typescript
// tax/src/infrastructure/persistence/schema.ts

// Tax nexus tracking (from 01-jurisdiction-complexity)
export const taxNexusRecords = pgTable('tax_nexus_records', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull(),
  jurisdiction: jsonb('jurisdiction').notNull(),
  nexusType: varchar('nexus_type', { length: 50 }).notNull(), // income|sales|franchise|employment
  establishedDate: timestamp('established_date').notNull(),
  establishedBy: varchar('established_by', { length: 100 }).notNull(), // trigger type
  isActive: boolean('is_active').notNull().default(true),
  terminatedDate: timestamp('terminated_date'),
  thresholdMetrics: jsonb('threshold_metrics'),
});

// CFC/GILTI tracking (from 04-cfc-gilti-pfic-anti-deferral)
export const cfcProfiles = pgTable('cfc_profiles', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull(),
  taxYear: integer('tax_year').notNull(),
  isCFC: boolean('is_cfc').notNull(),
  cfcStatusDate: timestamp('cfc_status_date'),
  usShareholderPercentage: decimal('us_shareholder_percentage', { precision: 5, scale: 2 }),
  testedIncome: decimal('tested_income', { precision: 20, scale: 2 }),
  subpartFIncome: jsonb('subpart_f_income'),
  qbai: decimal('qbai', { precision: 20, scale: 2 }),
  effectiveForeignTaxRate: decimal('effective_foreign_tax_rate', { precision: 5, scale: 4 }),
  hteEligible: boolean('hte_eligible'),
  hteElected: boolean('hte_elected'),
});

export const ptepPools = pgTable('ptep_pools', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull(),
  taxYear: integer('tax_year').notNull(),
  ptepCategory: varchar('ptep_category', { length: 50 }).notNull(),
  amount: decimal('amount', { precision: 20, scale: 2 }).notNull(),
  associatedFTC: decimal('associated_ftc', { precision: 20, scale: 2 }),
  distributedAmount: decimal('distributed_amount', { precision: 20, scale: 2 }),
});

// Transfer pricing (from 01-transfer-pricing-documentation)
export const transferPricingPolicies = pgTable('transfer_pricing_policies', {
  ...baseColumns,
  policyId: varchar('policy_id', { length: 100 }).notNull().unique(),
  policyType: varchar('policy_type', { length: 50 }).notNull(), // goods|services|ip|financing
  transferorEntityId: uuid('transferor_entity_id').notNull(),
  transfereeEntityId: uuid('transferee_entity_id').notNull(),
  tpMethod: varchar('tp_method', { length: 50 }).notNull(),
  methodRationale: text('method_rationale'),
  pricingMechanism: jsonb('pricing_mechanism'),
  benchmarkRate: varchar('benchmark_rate', { length: 100 }),
  effectiveDate: timestamp('effective_date').notNull(),
  reviewDate: timestamp('review_date'),
  intercompanyAgreementRef: varchar('intercompany_agreement_ref', { length: 255 }),
  masterFileRef: varchar('master_file_ref', { length: 255 }),
  localFileRef: varchar('local_file_ref', { length: 255 }),
});
```

---

### Phase 5: Compliance Service
**Goal**: Regulatory compliance across all domains

#### 5.1 Schema

```typescript
// compliance/src/infrastructure/persistence/schema.ts

// BOI/CTA tracking (from 03-beneficial-ownership-cta)
export const boiReports = pgTable('boi_reports', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull(),
  reportType: varchar('report_type', { length: 50 }).notNull(), // initial|update|corrected
  filingDeadline: timestamp('filing_deadline').notNull(),
  filedDate: timestamp('filed_date'),
  confirmationNumber: varchar('confirmation_number', { length: 100 }),
  beneficialOwners: jsonb('beneficial_owners').notNull(),
  companyApplicants: jsonb('company_applicants'),
  status: varchar('status', { length: 50 }).notNull(),
});

// AML compliance (from 09-compliance-regulatory banking research)
export const amlRiskAssessments = pgTable('aml_risk_assessments', {
  ...baseColumns,
  entityId: uuid('entity_id').notNull(),
  assessmentDate: timestamp('assessment_date').notNull(),
  inherentRiskScore: integer('inherent_risk_score').notNull(),
  controlEffectiveness: integer('control_effectiveness').notNull(),
  residualRiskScore: integer('residual_risk_score').notNull(),
  riskFactors: jsonb('risk_factors'),
  mitigatingControls: jsonb('mitigating_controls'),
  nextAssessmentDate: timestamp('next_assessment_date'),
});
```

---

### Phase 6: Cross-Domain Integration
**Goal**: Implement the integration points identified in nuance gap research

#### 6.1 Integration Services

```typescript
// shared/integration/

// Transfer Pricing Integration
class TransferPricingIntegration {
  // Entity → Tax: Policy definition
  async onIntercompanyAgreementCreated(event: IntercompanyAgreementCreated) {
    await this.taxService.createTransferPricingPolicy(event);
  }

  // Accounting → Tax: Transaction validation
  async onIntercompanyTransactionPosted(event: JournalEntryPosted) {
    if (event.isIntercompany) {
      await this.taxService.validateArmLength(event);
    }
  }

  // Banking → Tax: Payment documentation
  async onIntercompanyPaymentCompleted(event: PaymentCompleted) {
    if (event.isIntercompany) {
      await this.taxService.recordTransferPricingPayment(event);
    }
  }
}

// Cash Pooling Integration
class CashPoolingIntegration {
  // Entity → Banking: Pool structure
  async onCashPoolAgreementCreated(event: CashPoolAgreementCreated) {
    await this.bankingService.initializeCashPool(event);
  }

  // Banking → Accounting: Sweep entries
  async onCashPoolSweepExecuted(event: CashPoolSweepExecuted) {
    await this.accountingService.postIntercompanyLoans(event);
  }

  // Accounting → Tax: Interest allocation
  async onIntercompanyInterestAccrued(event: InterestAccrued) {
    await this.taxService.validateArmLengthInterest(event);
  }
}

// 409A Integration
class Valuation409AIntegration {
  // Entity.CapTable → Entity.Valuation: Material event detection
  async onCapTableChanged(event: CapTableChanged) {
    const triggers = await this.detectMaterialEvent(event);
    if (triggers.requiresNewValuation) {
      await this.valuationService.flagValuationRequired(event.entityId);
    }
  }

  // Entity.Valuation → Accounting: Stock comp expense
  async onValuation409ARecorded(event: Valuation409ARecorded) {
    await this.accountingService.updateStockCompExpense(event);
  }
}

// Banking Continuity Integration
class BankingContinuityIntegration {
  // Entity → Banking: Good standing
  async onEntityStatusChanged(event: EntityUpdated) {
    if (event.changes.status === 'suspended') {
      await this.bankingService.alertRelationshipRisk(event.entityId);
    }
  }

  // Banking → All: De-risking alert
  async onDeRiskingAlertRaised(event: DeRiskingAlertRaised) {
    await this.notifyStakeholders(event);
    await this.initiateContingencyPlan(event);
  }
}
```

---

## Implementation Timeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION TIMELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 0: Foundation (Weeks 1-2)                                           │
│  ├─ Week 1: Event infrastructure, shared value objects                     │
│  └─ Week 2: Database partitioning, shared contracts                        │
│                                                                             │
│  PHASE 1: Entity Governance Completion (Weeks 3-6)                         │
│  ├─ Week 3: Jurisdiction context schema + service                          │
│  ├─ Week 4: Veil health + economic substance                               │
│  ├─ Week 5: 409A valuation tracking                                        │
│  └─ Week 6: Event publishing + API completion                              │
│                                                                             │
│  PHASE 2: Accounting System (Weeks 7-12)                                   │
│  ├─ Weeks 7-8: Core GL, journal entries, period management                 │
│  ├─ Weeks 9-10: Multi-currency, intercompany tracking                      │
│  └─ Weeks 11-12: Financial statements, event publishing                    │
│                                                                             │
│  PHASE 3: Banking-Treasury Expansion (Weeks 13-18)                         │
│  ├─ Weeks 13-14: Relationship health, de-risking monitoring                │
│  ├─ Weeks 15-16: Cash pooling, intercompany netting                        │
│  └─ Weeks 17-18: BaaS risk assessment, event publishing                    │
│                                                                             │
│  PHASE 4: Tax Service (Weeks 19-24)                                        │
│  ├─ Weeks 19-20: Tax nexus tracking, returns                               │
│  ├─ Weeks 21-22: CFC/GILTI/PFIC tracking                                   │
│  └─ Weeks 23-24: Transfer pricing policy management                        │
│                                                                             │
│  PHASE 5: Compliance Service (Weeks 25-28)                                 │
│  ├─ Weeks 25-26: BOI/CTA compliance                                        │
│  └─ Weeks 27-28: AML risk assessment                                       │
│                                                                             │
│  PHASE 6: Cross-Domain Integration (Weeks 29-32)                           │
│  ├─ Weeks 29-30: Integration services implementation                       │
│  └─ Weeks 31-32: End-to-end testing, documentation                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

### Functional Criteria

| Domain | Criterion | Measurement |
|--------|-----------|-------------|
| **Entity Governance** | Entity data accuracy | 99.9% accuracy in status/structure |
| **Entity Governance** | Filing compliance | 100% on-time filing rate |
| **Entity Governance** | Veil health monitoring | All SMLLCs assessed quarterly |
| **Accounting** | Journal entry integrity | 100% debit = credit enforcement |
| **Accounting** | Period controls | Zero entries to closed periods |
| **Accounting** | Audit trail | 100% traceability |
| **Banking-Treasury** | Cash position accuracy | 99.99% balance accuracy |
| **Banking-Treasury** | Payment success rate | >99.5% completion |
| **Banking-Treasury** | Reconciliation automation | >95% auto-matched |
| **Tax** | Transfer pricing compliance | 100% documented transactions |
| **Tax** | CFC/GILTI tracking | Complete for all CFCs |
| **Compliance** | BOI filing compliance | 100% on-time |
| **Compliance** | AML risk assessment | All entities assessed annually |

### Integration Criteria

| Integration | Criterion | Measurement |
|-------------|-----------|-------------|
| Entity → All | Event delivery | <100ms latency |
| Entity → Accounting | GL creation on entity create | 100% automated |
| Entity → Banking | Account opening enabled | <1s propagation |
| Accounting → Banking | Reconciliation data | Daily sync |
| CapTable → 409A | Material event detection | 100% captured |
| Banking → Compliance | Transaction AML screening | Real-time |

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Regulatory changes** (OBBBA, Synapse Rule) | High | High | Modular design for rule updates |
| **Integration complexity** | Medium | High | Event-driven architecture, loose coupling |
| **Performance at scale** | Medium | Medium | Partitioning strategy, indexes |
| **Cross-domain consistency** | Medium | High | Saga pattern for distributed transactions |
| **Audit compliance** | Low | High | Immutability patterns, complete logging |

---

## Appendix: Research Document Index

### Entity Governance Research
1. 01-jurisdiction-complexity.md - Multi-context jurisdiction model
2. 02-llc-operating-agreements.md - LLC governance
3. 03-beneficial-ownership-cta.md - BOI requirements
4. 04-entity-type-governance.md - Entity type selection
5. 05-cap-table-complexity.md - Equity structures
6. 06-corporate-veil-formalities.md - Veil protection
7. 07-multi-jurisdiction-compliance.md - Multi-state compliance
8. 08-holding-company-structures.md - Holding company design

### Accounting Research
1. 01-double-entry-bookkeeping-standards.md
2. 02-journal-entry-immutability.md
3. 03-fiscal-period-management.md
4. 04-audit-trail-requirements.md
5. 05-chart-of-accounts-structure.md
6. 06-multi-currency-accounting.md
7. 07-revenue-recognition.md
8. 08-financial-statement-presentation.md

### Banking-Treasury Research
1. 00-RESEARCH_OVERVIEW.md
2. 01-INTERNATIONAL_BANKING.md
3. 02-NATIONAL_BANKING_US.md
4. 03-REGIONAL_PAYMENT_NETWORKS.md
5. 04-BAAS_PROVIDERS.md
6. 05-PAYMENT_PROCESSORS.md
7. 06-CROSS_BORDER_RAILS.md
8. 07-STABLECOIN_CRYPTO.md
9. 08-TREASURY_TECHNOLOGY.md
10. 09-COMPLIANCE_REGULATORY.md

### Nuance Gap Research
1. 01-transfer-pricing-documentation.md
2. 02-banking-derisking.md
3. 03-economic-substance-requirements.md
4. 04-cfc-gilti-pfic-anti-deferral.md
5. 05-baas-regulatory-risk.md
6. 06-intercompany-netting-cash-pooling.md
7. 07-single-member-llc-veil-piercing.md
8. 08-409a-valuation-nuances.md

---

*Implementation Plan created: January 2026*
*Based on: 35 research documents synthesized via Purpose Prompter methodology*
*Next Action: Begin Phase 0 - Foundation & Shared Contracts*
