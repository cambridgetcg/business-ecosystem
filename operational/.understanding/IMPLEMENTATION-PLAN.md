# Implementation Plan: Realizing the Operational Ecosystem Mission

**Created**: January 2026
**Based on**: Deep exploration of `.understanding/` research
**Purpose**: Close gaps and realize the mission of the operational layer

---

## Mission Statement

**The operational layer exists to manage what the business DOES** - document-centric, entity-scoped, compliance-aware business activities across contracts, insurance, intellectual property, and data privacy.

### Core Thesis
> Everything is a document owned by an entity with a lifecycle and compliance requirements.

### Success Vision
- All operational records traceable to legal entities
- All documents follow lifecycle state machines
- All deadlines tracked and never missed
- All compliance requirements met
- All domains communicate via events
- All cross-domain workflows automated

---

## Current State Assessment

### What Works (Leverage This)

| Asset | Status | Leverage |
|-------|--------|----------|
| contracts-legal domain | Mature | Use as template for other domains |
| IP domain architecture | CQRS pattern | Consider for complex domains |
| Gateway aggregation | Functional | Extend for new domains |
| Workflow engine | Core works | Connect to message queue |
| Research documentation | Exceptional | Implement recommendations |
| Entity-scoping pattern | Universal | Apply to new implementations |
| Document lifecycle | Documented | Reuse state machine |

### What's Broken (Fix This)

| Gap | Severity | Phase |
|-----|----------|-------|
| data-privacy domain unimplemented | CRITICAL | Phase 1 |
| insurance domain unimplemented | CRITICAL | Phase 2 |
| Message queue not connected | HIGH | Phase 1 |
| Compliance uses mocks | HIGH | Phase 2 |
| Trade Secret entity missing | HIGH | Phase 2 |
| Authorization not implemented | MEDIUM | Phase 3 |
| No tests anywhere | MEDIUM | All Phases |
| IP deadline tracking incomplete | MEDIUM | Phase 3 |

---

## Implementation Phases

## Phase 1: Foundation & Critical Compliance (Weeks 1-4)

**Theme**: Eliminate regulatory risk, enable event-driven architecture

### 1.1 Connect Message Queue (Week 1)

**Why First**: Without events flowing, the architecture is disconnected. Everything else depends on this.

**Tasks**:
```
□ Configure RabbitMQ connection in workflow engine
□ Implement event subscription in engine/src/index.ts
□ Connect domain event publishers to message queue
□ Test entity-governance.entity.created → workflow trigger
□ Document event flow in .understanding/
```

**Files to Modify**:
- `.orchestration/engine/src/index.ts` (remove TODO, add queue connection)
- Shared `@ecosystem/messaging` package

**Success Criteria**: Entity creation triggers entity-onboarding workflow automatically.

---

### 1.2 Data-Privacy Domain MVP (Weeks 2-4)

**Why Second**: Highest regulatory risk (GDPR fines up to 4% revenue). Consent and breach notification are legally mandated.

**Approach**: Follow contracts-legal patterns (Prisma + Hono + Zod)

#### Week 2: Schema & Core Entities

**Tasks**:
```
□ Create Prisma schema for data-privacy
  - ConsentRecord (purpose, basis, granted, withdrawn, expires)
  - DSARRequest (type, subject, status, deadline, response)
  - DataBreach (severity, detected, reported, affected)
  - ProcessingActivity (purpose, basis, data categories)

□ Implement repository layer (following contracts-legal pattern)
□ Create validators with Zod schemas
□ Set up middleware stack (auth, audit, error)
```

**Schema Design** (based on research):
```prisma
model ConsentRecord {
  id            String    @id @default(cuid())
  entityId      String    // FK to entity-governance
  subjectId     String    // Data subject identifier
  purpose       String    // e.g., "marketing-emails"
  lawfulBasis   LawfulBasis
  grantedAt     DateTime
  withdrawnAt   DateTime?
  expiresAt     DateTime?
  proofRef      String?   // Link to consent capture evidence
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model DSARRequest {
  id            String      @id @default(cuid())
  entityId      String
  subjectId     String
  requestType   DSARType    // ACCESS, ERASURE, PORTABILITY, etc.
  status        DSARStatus  // RECEIVED, VERIFIED, PROCESSING, COMPLETED
  receivedAt    DateTime
  deadline      DateTime    // 30 days from receipt
  completedAt   DateTime?
  responseRef   String?     // Link to response document
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model DataBreach {
  id              String        @id @default(cuid())
  entityId        String
  severity        BreachSeverity
  detectedAt      DateTime
  reportedAt      DateTime?     // To authorities
  subjectsNotified DateTime?
  affectedCount   Int?
  description     String
  status          BreachStatus
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum LawfulBasis {
  CONSENT
  CONTRACT
  LEGAL_OBLIGATION
  VITAL_INTEREST
  PUBLIC_TASK
  LEGITIMATE_INTEREST
}

enum DSARType {
  ACCESS
  RECTIFICATION
  ERASURE
  PORTABILITY
  RESTRICTION
  OBJECTION
}

enum BreachSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

#### Week 3: API & Business Logic

**Tasks**:
```
□ Implement consent-management subdomain
  - POST /consent - Record consent
  - DELETE /consent/:id - Withdraw consent
  - GET /consent/subject/:subjectId - Get consents for subject
  - GET /consent/entity/:entityId - Get consents for entity

□ Implement dsar-handling subdomain
  - POST /dsar - Submit request
  - GET /dsar/:id - Get request status
  - POST /dsar/:id/verify - Verify subject identity
  - POST /dsar/:id/complete - Mark complete

□ Implement breach-management subdomain
  - POST /breach - Report breach
  - POST /breach/:id/notify-authority - Record authority notification
  - POST /breach/:id/notify-subjects - Record subject notification
```

#### Week 4: Integration & Events

**Tasks**:
```
□ Implement DomainComplianceClient interface
□ Expose /compliance-status endpoint for aggregator
□ Publish events:
  - consent.granted, consent.withdrawn
  - dsar.received, dsar.completed
  - breach.detected, breach.authority_notified
□ Subscribe to entity-governance events
□ Write integration tests for consent flow
□ Write integration tests for DSAR flow
```

**Success Criteria**:
- Can record consent and verify it across domains
- DSAR requests can be received and tracked to completion
- Breach notification workflow tracks 72-hour timeline

---

## Phase 2: Business Operations (Weeks 5-10)

**Theme**: Implement core business domains, connect compliance

### 2.1 Replace Compliance Mocks (Week 5)

**Tasks**:
```
□ Implement HttpDomainClient for compliance aggregator
□ Define /compliance-status endpoint contract for all domains
□ Connect contracts-legal compliance endpoint
□ Connect data-privacy compliance endpoint (from Phase 1)
□ Update gateway to use real compliance data
□ Test aggregated compliance view
```

**Success Criteria**: Compliance status reflects actual domain state.

---

### 2.2 Insurance Domain MVP (Weeks 6-9)

**Approach**: Start with policies and claims (highest value), defer complex features

#### Week 6: Schema & Core Entities

**Tasks**:
```
□ Create Prisma schema for insurance
  - InsurancePolicy (type, carrier, limits, deductible, dates)
  - PolicyCoverage (type, limits, inclusions, exclusions)
  - Claim (policy, incident, status, reserve, settlement)
  - CertificateOfInsurance (policy, holder, dates)

□ Implement repository layer
□ Create validators
□ Set up middleware
```

**Schema Design** (based on README analysis):
```prisma
model InsurancePolicy {
  id              String        @id @default(cuid())
  entityId        String        // FK to entity-governance
  policyNumber    String        @unique
  policyType      PolicyType    // GL, PROFESSIONAL, PROPERTY, etc.
  carrier         String
  effectiveDate   DateTime
  expirationDate  DateTime
  status          PolicyStatus
  premiumAmount   Decimal?
  coverages       PolicyCoverage[]
  claims          Claim[]
  certificates    CertificateOfInsurance[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model Claim {
  id              String        @id @default(cuid())
  policyId        String
  policy          InsurancePolicy @relation(fields: [policyId], references: [id])
  claimNumber     String        @unique
  incidentDate    DateTime
  reportedDate    DateTime
  status          ClaimStatus   // FILED, INVESTIGATING, SETTLED, CLOSED
  description     String
  reserveAmount   Decimal?
  settlementAmount Decimal?
  adjuster        String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum PolicyType {
  GENERAL_LIABILITY
  PROFESSIONAL_LIABILITY
  PROPERTY
  WORKERS_COMPENSATION
  CYBER
  PRODUCT_LIABILITY
}

enum ClaimStatus {
  FILED
  ACKNOWLEDGED
  INVESTIGATING
  RESERVE_SET
  NEGOTIATING
  SETTLED
  CLOSED
  DENIED
}
```

#### Weeks 7-8: API & Business Logic

**Tasks**:
```
□ Implement policy-management subdomain
  - CRUD for policies
  - Policy lifecycle (DRAFT → ACTIVE → EXPIRED)
  - Renewal tracking

□ Implement claims-management subdomain
  - Claim filing
  - Status workflow
  - Reserve management

□ Implement COI generation
  - Generate certificates for policy holders
  - PDF generation (or placeholder)
```

#### Week 9: Integration

**Tasks**:
```
□ Implement compliance endpoint
□ Publish events (policy.created, claim.filed, policy.expiring)
□ Subscribe to contract events (for coverage verification)
□ Update gateway to aggregate insurance data
□ Write tests for policy and claims workflows
```

---

### 2.3 Trade Secret Entity (Week 10)

**Tasks**:
```
□ Create TradeSecret entity in IP domain
  - Following existing entity patterns
  - Protection measures tracking
  - Access control log
  - No expiration (unlike other IP)

□ Update License entity to properly reference TradeSecrets
□ Add API routes for trade secrets
□ Write tests
□ Update research docs with implementation notes
```

**Schema Addition**:
```typescript
// In IP domain
interface TradeSecret {
  id: string;
  entityId: string;
  title: string;
  description: string;
  category: TradeSecretCategory;
  protectionMeasures: ProtectionMeasure[];
  accessLog: AccessLogEntry[];
  status: 'active' | 'disclosed' | 'abandoned';
  // No expirationDate - trade secrets last indefinitely if protected
}
```

---

## Phase 3: Excellence & Scale (Weeks 11-16)

**Theme**: Security, quality, performance

### 3.1 Authorization Implementation (Weeks 11-12)

**Tasks**:
```
□ Design permission model
  - Entity-level permissions
  - Domain-level permissions
  - Action-level permissions (read, write, admin)

□ Implement auth middleware for gateway
□ Implement auth middleware for each domain
□ Add permission checks to all endpoints
□ Test authorization flows
□ Document permission model
```

**Permission Model**:
```typescript
interface OperationalPermission {
  userId: string;
  entityId: string;
  domains: ('contracts-legal' | 'insurance' | 'ip' | 'data-privacy')[];
  actions: ('read' | 'write' | 'admin')[];
}
```

---

### 3.2 IP Deadline Management (Weeks 13-14)

**Tasks**:
```
□ Implement MaintenanceFee entity for patents
  - 3.5, 7.5, 11.5 year schedule
  - Payment windows and grace periods
  - Automated reminders

□ Implement Section8Declaration for trademarks
  - 5-6 year, 9-10 year schedule
  - Use evidence tracking

□ Implement deadline notification system
  - 90-day notice
  - 30-day warning
  - 7-day critical

□ Wire to expiration tracking system
□ Update IP dashboard with deadline view
```

---

### 3.3 Testing Foundation (Weeks 15-16)

**Tasks**:
```
□ Establish testing patterns (unit, integration, e2e)
□ Create test utilities (factories, mocks)
□ Write tests for contracts-legal (template for others)
□ Write tests for data-privacy
□ Write tests for insurance
□ Write cross-domain integration tests
□ Set up CI pipeline with test gates
```

---

### 3.4 CQRS Route Wiring (Week 16)

**Tasks**:
```
□ Wire IP routes to command/query handlers
□ Ensure events are published through handlers
□ Remove duplicate validation
□ Document the pattern for other domains
```

---

## Phase 4: Research Implementation (Ongoing)

**Theme**: Implement recommendations from research documentation

### Contracts-Legal Research Backlog

| Research Doc | Implementation | Priority |
|--------------|----------------|----------|
| 01 E-Signature | Add SignatureEvent model with consent capture | Medium |
| 02 Jurisdiction | Add governingLaw, forumSelection fields | Medium |
| 05 Amendment vs Addendum | ContractModification model | Low |
| 06 Revenue Recognition | PerformanceObligation model | Medium |
| 07 Force Majeure | ForceMajeureClause, ForceMajeureEvent | Low |
| 08 Material Breach | PerformanceIssue, BreachAllegation, CureAttempt | Medium |

### IP Research Backlog

| Research Doc | Implementation | Priority |
|--------------|----------------|----------|
| 01 Patent Families | parentPatentId, familyId, continuationType | Medium |
| 02 PCT Filing | PCT phase tracking, deadline states | High |
| 03 Maintenance Fees | MaintenanceFee entity (Phase 3) | High |
| 04 Trademark Use | UseEvidence per class | Medium |
| 05 Madrid Protocol | InternationalRegistration entity | Low |
| 07 FRAND Licensing | FRAND indicators on License | Medium |

---

## Success Metrics

### Phase 1 Complete When:
- [ ] Events flow from entity-governance to workflows
- [ ] Data-privacy can record consent and process DSARs
- [ ] Breach notification workflow exists

### Phase 2 Complete When:
- [ ] Compliance aggregation uses real data
- [ ] Insurance can manage policies and claims
- [ ] Trade Secret entity exists and integrates with licensing

### Phase 3 Complete When:
- [ ] Authorization enforced across all endpoints
- [ ] IP deadline tracking is comprehensive
- [ ] Test coverage > 70% for all domains
- [ ] IP routes use CQRS handlers properly

### Mission Realized When:
- [ ] All 4 domains are functional
- [ ] Cross-domain workflows execute automatically
- [ ] Compliance status is accurate and real-time
- [ ] No critical deadlines are missed
- [ ] All entities are auditable

---

## Principles for Implementation

### 1. Follow Existing Patterns
contracts-legal is the most mature. Use it as the template:
- Prisma + Hono + Zod
- validators → repository → service pattern
- Middleware stack (auth, audit, error)

### 2. Entity-Scope Everything
Every new entity must have `entityId` as FK to entity-governance.

### 3. Events for Integration
Domains never call each other directly. Publish events, let consumers react.

### 4. Document Lifecycle States
All document-like entities follow: DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → EXPIRED/TERMINATED

### 5. Test as You Build
Don't leave testing for "later". Each feature should include tests.

### 6. Update .understanding/
After implementing, update:
- coverage-map.md (close gaps)
- gap-analysis.md (mark closed)
- Relevant dimension files

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| data-privacy delays → regulatory exposure | Prioritize consent + breach notification first |
| Message queue complexity | Use existing @ecosystem/messaging patterns |
| Insurance complexity overwhelming | Start with Policy + Claim MVP only |
| Testing debt accumulates | Mandate tests with each PR |
| Authorization scope creep | Define clear permission model upfront |

---

## Quick Wins (Can Start Immediately)

1. **Connect message queue** - Small code change, big architectural impact
2. **Add compliance endpoint to contracts-legal** - Already mature, just add endpoint
3. **Create data-privacy Prisma schema** - Copy patterns from contracts-legal
4. **Wire IP routes to handlers** - Code exists, just connect it

---

## Next Steps

1. Review and approve this plan
2. Create issues/tasks for Phase 1 items
3. Begin with message queue connection (Week 1)
4. Assign data-privacy domain to team (Weeks 2-4)

---

*This plan synthesizes learnings from `.understanding/` research into actionable implementation steps. It prioritizes regulatory compliance, builds on existing patterns, and creates a path to realize the operational ecosystem mission.*
