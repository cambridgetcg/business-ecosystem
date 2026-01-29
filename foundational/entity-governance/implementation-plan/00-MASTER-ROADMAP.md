# Entity Governance: Master Implementation Roadmap

## Mission Alignment

**Mission**: To provide a single source of truth for legal entity formation, corporate structure, governance, and compliance.

**Success Metric**: The absence of entity-related errors, compliance penalties, and governance failures across the entire ecosystem.

---

## Current State Assessment

### What Exists (Implementation: ~25%)

| Capability | Status | Coverage |
|------------|--------|----------|
| Basic entity lifecycle | Implemented | 70% |
| Corporate governance (boards, officers) | Implemented | 60% |
| Shareholder tracking | Basic | 40% |
| Corporate records (minutes, resolutions) | Implemented | 70% |
| Annual filings | Basic | 50% |
| Registered agents | Basic | 40% |

### What's Missing (Gap: ~75%)

| Capability | Status | Priority | Blocker |
|------------|--------|----------|---------|
| Beneficial Ownership (BOI/CTA) | Not Started | CRITICAL | Regulatory deadline |
| Multi-jurisdiction compliance | Not Started | HIGH | Core functionality |
| LLC-specific governance | Not Started | HIGH | Most common entity type |
| Entity type configuration | Not Started | HIGH | Generic handling |
| Advanced cap table | Not Started | MEDIUM | Investor relations |
| Corporate veil health | Not Started | MEDIUM | Liability protection |
| Holding structure optimization | Not Started | MEDIUM | Tax efficiency |

---

## Phasing Framework

### Phase Selection Criteria

| Phase | Criteria | Examples |
|-------|----------|----------|
| **Phase 0** | Foundation work that enables future phases | Jurisdiction model, entity config |
| **Phase 1** | Regulatory compliance with deadlines/penalties | BOI/CTA |
| **Phase 2** | Core functionality gaps affecting daily operations | Foreign qual, LLC support |
| **Phase 3** | Enhancements that improve efficiency/accuracy | Cap table, veil health |
| **Phase 4** | Long-term vision and innovation | AI governance, blockchain records |

### Dependency Graph

```
PHASE 0: FOUNDATION
├── Jurisdiction Model Refactoring
│   └── Required by: Phase 1 (BOI needs jurisdiction context)
│                    Phase 2 (Foreign qual is jurisdiction-based)
│
├── Entity Type Configuration
│   └── Required by: Phase 2 (LLC vs Corp governance differs)
│                    Phase 3 (Veil requirements differ by type)
│
└── Event Infrastructure
    └── Required by: All phases (events drive integration)

                    │
                    ▼

PHASE 1: CRITICAL COMPLIANCE
├── Beneficial Ownership (BOI/CTA)
│   ├── Depends on: Jurisdiction Model (Phase 0)
│   └── Independent of: Other Phase 1 work
│
└── Enhanced Shareholder Data
    └── Depends on: BOI requirements define fields needed

                    │
                    ▼

PHASE 2: MULTI-ENTITY OPERATIONS
├── Foreign Qualifications
│   └── Depends on: Jurisdiction Model (Phase 0)
│
├── LLC Support
│   ├── Depends on: Entity Type Configuration (Phase 0)
│   └── Parallel with: Foreign Qualifications
│
└── Entity Type Governance
    └── Depends on: Entity Type Configuration (Phase 0)

                    │
                    ▼

PHASE 3: ADVANCED FEATURES
├── Cap Table Complexity
│   └── Depends on: Enhanced Shareholder Data (Phase 1)
│
├── Corporate Veil Health
│   └── Depends on: Entity Type Governance (Phase 2)
│
└── Holding Structure Optimization
    └── Depends on: Foreign Qualifications (Phase 2)

                    │
                    ▼

PHASE 4: LONG-TERM VISION
├── Predictive Compliance Risk
├── AI Governance Recommendations
├── International Entity Expansion
└── Blockchain Record Certification
```

---

## Phase Summaries

### Phase 0: Foundation

**Goal**: Build the architectural foundation that enables all future work.

**Duration**: 2-3 weeks

**Deliverables**:
1. Jurisdiction model supporting 4 contexts (formation, qualification, nexus, regulatory)
2. Entity type configuration system (type-specific settings per entity)
3. Enhanced event infrastructure for cross-service integration
4. Database migration framework for schema evolution

**Success Criteria**:
- [ ] Can store formation jurisdiction distinct from operating jurisdictions
- [ ] Can configure entity-specific governance rules (LLC vs Corp)
- [ ] Events publish reliably with proper schemas
- [ ] Migrations run without data loss

**Detailed Plan**: See `01-PHASE-0-FOUNDATION.md`

---

### Phase 1: Critical Compliance (BOI/CTA)

**Goal**: Achieve full compliance with Corporate Transparency Act before regulatory deadlines.

**Duration**: 3-4 weeks

**Deliverables**:
1. Beneficial owners table with all FinCEN-required fields
2. BOI filing tracking (initial, update, correction)
3. Exemption status tracking (23 exemption categories)
4. Substantial control detection (auto-identify from officers)
5. 25% ownership threshold monitoring

**Success Criteria**:
- [ ] Can capture all data elements required by FinCEN BOI report
- [ ] Can track filing status (pending, submitted, accepted, rejected)
- [ ] System alerts when beneficial owner changes require update filing
- [ ] Exemption eligibility automatically evaluated

**Regulatory Context**:
- Existing entities: Deadline was January 1, 2025
- New entities (2024): 90 days from formation
- New entities (2025+): 30 days from formation
- Penalties: $500/day, up to $10,000, criminal liability for willful violations

**Detailed Plan**: See `02-PHASE-1-COMPLIANCE.md`

---

### Phase 2: Multi-Entity Operations

**Goal**: Support entities operating across multiple jurisdictions and entity types.

**Duration**: 4-6 weeks

**Deliverables**:

**2A: Foreign Qualifications**
1. Foreign qualifications table (where entity is authorized)
2. Per-qualification registered agents
3. Per-qualification filing requirements
4. Qualification status tracking (active, suspended, withdrawn)

**2B: LLC Support**
1. Operating agreements (distinct from bylaws)
2. Members table (distinct from shareholders)
3. Capital accounts tracking
4. Manager tracking (for manager-managed LLCs)
5. Distribution/allocation provisions

**2C: Entity Type Governance**
1. Entity governance configuration table
2. Partnership roles (GP/LP)
3. Trust parties (grantor/trustee/beneficiary)
4. Tax election tracking (S-Corp, check-the-box)

**Success Criteria**:
- [ ] Can track entity authorized in 5+ states with separate compliance per state
- [ ] Can model LLC with operating agreement, members, capital accounts
- [ ] Can distinguish member-managed vs manager-managed LLCs
- [ ] Can track S-Corp election status and effective date
- [ ] Can model LP with GP/LP roles and different rights

**Detailed Plan**: See `03-PHASE-2-OPERATIONS.md`

---

### Phase 3: Advanced Features

**Goal**: Enhance investor relations, liability protection, and tax optimization.

**Duration**: 4-6 weeks

**Deliverables**:

**3A: Cap Table Complexity**
1. Liquidation preferences (type, multiple, seniority)
2. Anti-dilution terms per share class
3. Convertible instruments (SAFEs, notes, warrants)
4. Option pool management
5. 409A valuation tracking

**3B: Corporate Veil Health**
1. Intercompany agreements tracking
2. Intercompany loans with proper documentation
3. Capitalization history
4. Veil health scoring/assessment
5. Formality compliance alerts

**3C: Holding Structure Optimization**
1. Entity purpose classification (operating, holding, IP, blocker)
2. Tax classification tracking
3. CFC status determination
4. Ownership threshold alerts (10%, 20%, 50%, 80%)

**Success Criteria**:
- [ ] Can model exit waterfall with participating preferred
- [ ] Can track SAFE conversion with cap and discount
- [ ] Can calculate fully diluted ownership
- [ ] Can score entity veil health based on formality compliance
- [ ] Can alert on intercompany loan documentation issues
- [ ] Can identify CFC status based on ownership structure

**Detailed Plan**: See `04-PHASE-3-ADVANCED.md`

---

### Phase 4: Long-Term Vision

**Goal**: Realize the strategic vision from PURPOSE.md.

**Duration**: Ongoing

**Capabilities** (from PURPOSE.md:187-197):
1. Multi-entity organizational chart visualization
2. Automated filing deadline notifications
3. Registered agent change workflow
4. Enhanced cap table analytics
5. Predictive compliance risk scoring
6. AI-powered governance recommendation engine
7. Blockchain-based corporate record certification
8. International entity support expansion (beyond US)

**Detailed Plan**: See `05-PHASE-4-VISION.md`

---

## Implementation Approach

### Database Evolution Strategy

```
MIGRATION APPROACH
──────────────────

1. ADDITIVE CHANGES (Preferred)
   ├── Add new tables (foreignQualifications, beneficialOwners, etc.)
   ├── Add new columns to existing tables
   ├── Add new indexes
   └── No data migration needed

2. TRANSFORMATIVE CHANGES (When Required)
   ├── Migrate existing data to new structure
   ├── Maintain backward compatibility during transition
   ├── Deprecate old columns after migration verified
   └── Remove deprecated columns in future release

3. BREAKING CHANGES (Avoid If Possible)
   ├── Requires coordinated deployment with consumers
   ├── API versioning for breaking endpoint changes
   └── Event schema versioning for breaking event changes
```

### Event Publishing Strategy

```
EVENT EVOLUTION
───────────────

CURRENT EVENTS (from README.md)
├── entity.created
├── entity.updated
├── entity.dissolved
├── subsidiary.added
├── filing.completed
└── shares.issued

NEW EVENTS (Per Phase)

Phase 1:
├── boi.owner-identified
├── boi.owner-removed
├── boi.threshold-crossed
├── boi.filing-due
├── boi.filing-submitted
└── boi.update-required

Phase 2:
├── qualification.filed
├── qualification.approved
├── qualification.suspended
├── qualification.withdrawn
├── member.admitted
├── member.withdrawn
├── capital-account.updated
└── tax-election.filed

Phase 3:
├── preference.created
├── safe.issued
├── safe.converted
├── valuation-409a.completed
├── veil-health.assessed
├── intercompany-agreement.created
└── ownership-threshold.crossed
```

### API Versioning Strategy

```
API EVOLUTION
─────────────

v1 (Current)
├── /api/v1/entities
├── /api/v1/entities/:id/subsidiaries
└── /api/v1/entities/:id/parent

v2 (Phase 2+)
├── /api/v2/entities (enhanced with type-specific fields)
├── /api/v2/entities/:id/qualifications (new)
├── /api/v2/entities/:id/beneficial-owners (new)
├── /api/v2/entities/:id/members (new, for LLCs)
└── /api/v2/entities/:id/capital-accounts (new, for LLCs)

VERSIONING RULES:
1. v1 endpoints remain stable during v2 development
2. New capabilities added to v2 first
3. v1 deprecated only after v2 is stable
4. Breaking changes require new major version
```

---

## Integration Strategy

### Service Dependencies

```
ENTITY-GOVERNANCE PROVIDES TO:
──────────────────────────────
├── accounting
│   ├── Entity information for GL structure
│   └── NEW: Capital account data (Phase 2)
│
├── banking-treasury
│   ├── Entity verification for account opening
│   └── NEW: Beneficial owner data for KYC (Phase 1)
│
├── tax
│   ├── Nexus and jurisdiction information
│   ├── NEW: Foreign qualifications (Phase 2)
│   └── NEW: Tax elections, CFC status (Phase 3)
│
├── compliance
│   ├── Entity-level requirements
│   ├── NEW: BOI filing status (Phase 1)
│   └── NEW: Foreign qualification compliance (Phase 2)
│
└── intellectual-property
    └── IP ownership attribution

ENTITY-GOVERNANCE CONSUMES FROM:
────────────────────────────────
├── tax
│   └── Tax ID assignments (EIN, state IDs)
│
├── compliance
│   └── Jurisdiction-specific filing requirements
│
└── kyc-identity
    └── Entity verification status
```

### Integration Points Per Phase

| Phase | Integration | Direction | Data |
|-------|-------------|-----------|------|
| 1 | banking-treasury | Provide | Beneficial owner data for KYC |
| 1 | compliance | Provide | BOI filing status |
| 2 | tax | Provide | Foreign qualifications, tax nexus |
| 2 | accounting | Provide | Capital account data |
| 3 | tax | Provide | Tax elections, CFC status |
| 3 | compliance | Provide | Veil health assessments |

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Schema migration causes data loss | Low | Critical | Comprehensive backup, staged rollout |
| Event schema changes break consumers | Medium | High | Event versioning, consumer notification |
| Performance degradation with new tables | Medium | Medium | Query optimization, indexing strategy |
| LLC model conflicts with existing corp model | Medium | Medium | Parallel structures, not modifications |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| BOI deadline missed | Low (with Phase 1 priority) | Critical | Phase 1 is highest priority |
| Incorrect beneficial owner determination | Medium | High | Clear 25%/control logic, audit trail |
| Foreign qualification requirements missed | Medium | High | Comprehensive state rule database |
| Veil piercing from poor documentation | Medium | High | Automated formality reminders |

### Regulatory Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CTA regulations change | Medium | Medium | Flexible schema, update procedures |
| State filing requirements change | High | Low | Configurable jurisdiction profiles |
| New beneficial ownership thresholds | Low | Medium | Parameterized threshold logic |

---

## Success Metrics

### Phase Completion Criteria

| Phase | Key Metric | Target |
|-------|------------|--------|
| 0 | Foundation tests pass | 100% |
| 1 | BOI data capture complete | All FinCEN fields |
| 1 | Exemption evaluation accurate | 23 categories |
| 2 | Multi-state entity trackable | 50+ jurisdictions |
| 2 | LLC model complete | Members, capital accounts, managers |
| 3 | Cap table calculations accurate | Fully diluted, waterfall |
| 3 | Veil health scoring operational | Automated assessment |

### Mission Metrics (from PURPOSE.md:159-169)

| Metric | Target | Phase Enabling |
|--------|--------|----------------|
| Entity data accuracy | 99.9% | 0, 2 |
| Filing compliance rate | 100% | 1, 2 |
| Event delivery latency | <100ms | 0 |
| Data freshness | <1 second | 0 |
| Zero missed filings | 0 penalties | 1, 2 |
| Entity setup time reduction | 80% | 2, 3 |
| Governance actions documented | 100% | 2, 3 |
| Cross-service consistency | Zero conflicts | All |

---

## Timeline Overview

```
IMPLEMENTATION TIMELINE
═══════════════════════

        Week 1-3        Week 4-7        Week 8-13       Week 14-19
           │               │                │                │
           ▼               ▼                ▼                ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   PHASE 0   │ │   PHASE 1   │ │   PHASE 2   │ │   PHASE 3   │
    │ Foundation  │ │ Compliance  │ │ Operations  │ │  Advanced   │
    │             │ │   (BOI)     │ │             │ │  Features   │
    │ - Juris-    │ │             │ │ - Foreign   │ │             │
    │   diction   │ │ - Beneficial│ │   Qual      │ │ - Cap Table │
    │ - Entity    │ │   Owners    │ │ - LLC       │ │ - Veil      │
    │   Config    │ │ - BOI       │ │   Support   │ │   Health    │
    │ - Events    │ │   Filings   │ │ - Entity    │ │ - Holding   │
    │             │ │ - Exemptions│ │   Types     │ │   Struct    │
    └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
           │               │                │                │
           ▼               ▼                ▼                ▼
    Foundation      BOI Compliance    Multi-Entity     Investor &
    Complete        Achieved          Operations       Protection
                                      Enabled          Enhanced
```

---

## Document Index

| Document | Purpose |
|----------|---------|
| `00-MASTER-ROADMAP.md` | This document - overall strategy and phasing |
| `01-PHASE-0-FOUNDATION.md` | Detailed Phase 0 implementation plan |
| `02-PHASE-1-COMPLIANCE.md` | Detailed Phase 1 (BOI/CTA) implementation plan |
| `03-PHASE-2-OPERATIONS.md` | Detailed Phase 2 implementation plan |
| `04-PHASE-3-ADVANCED.md` | Detailed Phase 3 implementation plan |
| `05-PHASE-4-VISION.md` | Long-term vision implementation plan |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-27 | Initial creation - synthesized from research, understanding maps, and PURPOSE.md |
