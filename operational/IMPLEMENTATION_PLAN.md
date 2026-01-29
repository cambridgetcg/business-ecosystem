# Operational Ecosystem Implementation Plan

Strategic roadmap to realize the full purpose and mission of the operational domain layer.

---

## Executive Summary

### Mission

Enable businesses to execute **what they DO** - contracts, insurance, IP management, and privacy compliance - through coordinated operational domains that reference foundational entities, integrate via events, and maintain regulatory compliance.

### Current State

| Component | Status | Completion |
|-----------|--------|------------|
| Contracts-Legal | Implemented | 85% |
| Intellectual Property | Implemented | 80% |
| Data Privacy | Scaffold Only | 5% |
| Insurance | Scaffold Only | 5% |
| Orchestration Layer | Implemented | 90% |
| Gateway | Implemented | 95% |
| **Overall Ecosystem** | **Partial** | **~50%** |

### Target State

A fully operational ecosystem where:
- All four domains are implemented and production-ready
- Cross-domain workflows execute automatically
- Regulatory compliance is tracked and enforced
- Entity-centric views provide unified operational visibility
- Event-driven architecture enables loose coupling at scale

---

## Strategic Priorities

Based on understanding layer research (see `.orchestration/understanding/`):

### Critical (Blocks Core Mission)

| Priority | Initiative | Why Critical |
|----------|-----------|--------------|
| C1 | Message Queue Infrastructure | Events defined but no transport - blocks production |
| C2 | Data Privacy Implementation | GDPR compliance requires functional privacy domain |
| C3 | Trade Secret Entity | Major IP type completely missing |

### High (Enables Key Capabilities)

| Priority | Initiative | Why High |
|----------|-----------|----------|
| H1 | Insurance Domain Implementation | Completes operational coverage |
| H2 | Cross-Domain DSAR Workflow | GDPR erasure spans all domains |
| H3 | Entity Dissolution Workflow | Major lifecycle event undefined |

### Medium (Enhances Quality)

| Priority | Initiative | Why Medium |
|----------|-----------|------------|
| M1 | E-Signature Ceremony | Legal requirements not captured |
| M2 | Patent Families | Parent-child relationships missing |
| M3 | Service-to-Service Auth | Internal API security undefined |
| M4 | Unified Audit Trail | Cross-domain correlation needed |

---

## Implementation Phases

### Phase 0: Foundation (Weeks 1-2)

**Objective**: Establish infrastructure prerequisites that unblock all subsequent work.

#### Initiatives

##### 0.1 Message Queue Selection & Implementation
**Priority**: C1 (Critical)

**Decision Required**: RabbitMQ vs AWS SNS+SQS vs Kafka

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| RabbitMQ | Simple, battle-tested, good DX | Self-managed infrastructure | Development/staging |
| SNS+SQS | AWS-native, managed, scalable | AWS lock-in, eventual consistency | Production |
| Kafka | Event sourcing ready, replay | Complex, overkill for current scale | Future option |

**Recommended Path**: RabbitMQ for development, SNS+SQS for production with abstraction layer.

**Tasks**:
- [ ] Define `@ecosystem/messaging` concrete implementation
- [ ] Create message queue infrastructure (Terraform/CDK)
- [ ] Implement publisher adapter for both transports
- [ ] Implement subscriber adapter with retry/DLQ
- [ ] Update all domains to use concrete implementation
- [ ] Add integration tests for event flow

**Success Criteria**:
- Events published from one domain are received by another
- Dead letter queue captures failed messages
- Local development works with RabbitMQ
- Staging/production uses SNS+SQS

**Dependencies**: None (foundational)

**Estimated Effort**: 1 developer, 2 weeks

---

##### 0.2 Service-to-Service Authentication
**Priority**: M3 (Medium, but needed early)

**Tasks**:
- [ ] Define service account pattern
- [ ] Implement JWT-based service tokens
- [ ] Add service identity to request context
- [ ] Update middleware in all domains
- [ ] Document authentication flow

**Success Criteria**:
- Workflow engine authenticates to all domains
- Gateway authenticates to all domains
- Service identity available in audit logs

**Dependencies**: None

**Estimated Effort**: 1 developer, 1 week

---

#### Phase 0 Exit Criteria

- [ ] Message queue infrastructure operational
- [ ] Events flow between contracts-legal and orchestration
- [ ] Service-to-service auth implemented
- [ ] CI/CD pipeline includes integration tests

---

### Phase 1: Privacy Foundation (Weeks 3-6)

**Objective**: Implement data-privacy domain to enable GDPR compliance.

#### Initiatives

##### 1.1 Data Privacy Core Implementation
**Priority**: C2 (Critical)

**Subdomains to Implement** (in order):

1. **Consent Management** (Week 3)
   - ConsentRecord entity with Prisma schema
   - Lawful basis tracking (6 GDPR types)
   - Grant/withdraw consent endpoints
   - Consent expiration tracking

2. **Data Subject Rights** (Week 4)
   - DSARRequest entity
   - Request types: ACCESS, RECTIFICATION, ERASURE, PORTABILITY, RESTRICTION, OBJECTION
   - 30-day deadline tracking
   - Status workflow: SUBMITTED → IN_PROGRESS → COMPLETED

3. **Breach Management** (Week 5)
   - DataBreach entity
   - Severity levels (LOW, MEDIUM, HIGH, CRITICAL)
   - 72-hour notification tracking
   - Authority notification workflow
   - Subject notification workflow

4. **Processing Activities** (Week 6)
   - ProcessingActivity entity (Article 30 records)
   - Retention policy tracking
   - Data inventory foundation

**Pattern to Follow**: Contracts-legal service-repository architecture

```
data-privacy/src/
├── routes/           # Hono handlers
├── domain/
│   ├── consent/      # ConsentService, ConsentRepository
│   ├── dsar/         # DSARService, DSARRepository
│   ├── breach/       # BreachService, BreachRepository
│   └── processing/   # ProcessingService, ProcessingRepository
├── middleware/       # Copy from contracts-legal
└── lib/              # Prisma, errors, logging
```

**Events to Publish**:
```typescript
'data-privacy.consent.granted'
'data-privacy.consent.withdrawn'
'data-privacy.dsar.submitted'
'data-privacy.dsar.completed'
'data-privacy.breach.detected'
'data-privacy.breach.authority_notified'
```

**Success Criteria**:
- All 4 subdomains have working CRUD operations
- Events published for all state changes
- Compliance aggregator receives privacy status
- Gateway includes privacy in entity overview

**Dependencies**: Phase 0 (message queue)

**Estimated Effort**: 2 developers, 4 weeks

---

##### 1.2 Cross-Domain DSAR Workflow
**Priority**: H2 (High)

**Problem**: DSAR erasure request must delete data across ALL domains where the data subject appears.

**Design**:
```yaml
id: dsar-erasure
trigger:
  type: event
  source: data-privacy.dsar.submitted
  filter:
    type: ERASURE

steps:
  - id: identify-contracts
    domain: contracts-legal
    action: findPartiesBySubjectId

  - id: identify-ip
    domain: intellectual-property
    action: findInventorsBySubjectId

  - id: identify-insurance
    domain: insurance
    action: findClaimantsBySubjectId

  - id: pseudonymize-contracts
    domain: contracts-legal
    action: pseudonymizeParty
    dependsOn: [identify-contracts]

  - id: pseudonymize-ip
    domain: intellectual-property
    action: pseudonymizeInventor
    dependsOn: [identify-ip]

  - id: complete-dsar
    domain: data-privacy
    action: completeDSAR
    dependsOn: [pseudonymize-contracts, pseudonymize-ip]
```

**Key Decisions**:
- **Pseudonymization over deletion**: Legal records often can't be deleted; replace PII with pseudonyms
- **Audit trail preserved**: Log the erasure but don't delete logs
- **Compensation on failure**: If one domain fails, mark DSAR as partial, notify operator

**Tasks**:
- [ ] Add `findBySubjectId` endpoints to contracts-legal
- [ ] Add `findBySubjectId` endpoints to IP
- [ ] Add pseudonymization actions to both
- [ ] Create DSAR erasure workflow YAML
- [ ] Add DSAR workflow to workflow engine
- [ ] Test cross-domain erasure flow

**Success Criteria**:
- DSAR erasure request triggers cross-domain pseudonymization
- All affected records identified automatically
- Partial failure handled gracefully
- Complete audit trail of erasure

**Dependencies**: 1.1 (data-privacy core)

**Estimated Effort**: 1 developer, 1 week

---

#### Phase 1 Exit Criteria

- [ ] Data-privacy domain operational with 4 subdomains
- [ ] Privacy events flow to compliance aggregator
- [ ] DSAR erasure workflow functional
- [ ] Gateway entity overview includes privacy status
- [ ] GDPR Article 30 records can be maintained

---

### Phase 2: IP Completion & Insurance Start (Weeks 7-10)

**Objective**: Complete critical IP gaps and begin insurance implementation.

#### Initiatives

##### 2.1 Trade Secret Entity
**Priority**: C3 (Critical)

**Why Critical**: Trade secrets are a major IP type. Without this entity:
- Cannot track trade secret protection measures
- Cannot license trade secrets
- Cannot track access/disclosure
- DTSA compliance impossible

**Entity Design**:
```typescript
interface TradeSecret {
  id: string;
  entityId: string;
  title: string;
  description: string;
  category: 'technical' | 'business' | 'financial' | 'operational';
  status: 'active' | 'disclosed' | 'abandoned';

  // Protection measures (DTSA "reasonable measures")
  protectionMeasures: ProtectionMeasure[];

  // Access control
  accessList: AccessGrant[];
  accessLog: AccessLogEntry[];

  // Value assessment
  estimatedValue?: number;
  valueBasis?: string;

  // Disclosure tracking
  disclosures: Disclosure[];

  // Audit columns
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

interface ProtectionMeasure {
  type: 'nda' | 'access_control' | 'encryption' | 'physical' | 'training' | 'policy';
  description: string;
  implementedAt: Date;
  lastReviewedAt?: Date;
}
```

**Pattern to Follow**: IP domain aggregate pattern (like Patent, Trademark)

**Tasks**:
- [ ] Create TradeSecret aggregate with domain behavior
- [ ] Add protection measure tracking
- [ ] Add access logging
- [ ] Create Drizzle schema and migrations
- [ ] Implement repository
- [ ] Add command handlers (CreateTradeSecret, AddProtectionMeasure, LogAccess)
- [ ] Add query handlers (GetTradeSecret, ListTradeSecrets, GetAccessLog)
- [ ] Add REST endpoints
- [ ] Integrate with License aggregate (trade secret licensing)
- [ ] Add events: `trade-secret.created`, `trade-secret.accessed`, `trade-secret.disclosed`

**Success Criteria**:
- Trade secrets can be created and tracked
- Protection measures documented per DTSA
- Access is logged for audit
- Trade secrets can be licensed (integrates with License)
- Gateway includes trade secrets in IP overview

**Dependencies**: None (extends existing IP domain)

**Estimated Effort**: 1 developer, 2 weeks

---

##### 2.2 Insurance Policy Management Core
**Priority**: H1 (High)

**Subdomains to Implement** (in order):

1. **Policy Management** (Weeks 8-9)
   - Policy entity with Prisma schema
   - Coverage types and limits
   - Deductible tracking
   - Expiration/renewal tracking
   - Endorsement management

2. **Claims Management** (Week 10)
   - Claim entity
   - Status workflow: FILED → ASSIGNED → UNDER_REVIEW → SETTLED/DENIED
   - Reserve tracking
   - Settlement recording

**Pattern to Follow**: Contracts-legal service-repository architecture

**Tasks**:
- [ ] Create Prisma schema for policies and claims
- [ ] Implement PolicyService and PolicyRepository
- [ ] Implement ClaimService and ClaimRepository
- [ ] Add REST endpoints
- [ ] Publish events: `insurance.policy.created`, `insurance.policy.renewed`, `insurance.claim.filed`
- [ ] Integrate with compliance aggregator
- [ ] Add to gateway aggregation

**Success Criteria**:
- Policies can be created with coverage details
- Policy expiration triggers alerts
- Claims can be filed and tracked
- Gateway includes insurance in entity overview

**Dependencies**: Phase 0 (message queue)

**Estimated Effort**: 2 developers, 3 weeks

---

##### 2.3 Contract-Insurance Integration
**Priority**: H1 (High)

**Problem**: Contracts often require insurance coverage. Need automated verification.

**Workflow**:
```yaml
id: contract-insurance-check
trigger:
  type: event
  source: contracts-legal.contract.created

steps:
  - id: extract-requirements
    domain: contracts-legal
    action: getInsuranceRequirements

  - id: verify-coverage
    domain: insurance
    action: verifyCoverage
    input:
      entityId: ${input.entityId}
      requirements: ${extract-requirements.result}

  - id: flag-gaps
    domain: insurance
    action: createCoverageGapAlert
    condition: "${verify-coverage.result.hasGaps} == true"
```

**Tasks**:
- [ ] Add insurance requirements field to contract model
- [ ] Create `getInsuranceRequirements` action in contracts-legal
- [ ] Create `verifyCoverage` action in insurance
- [ ] Create workflow definition
- [ ] Add COI (Certificate of Insurance) tracking

**Success Criteria**:
- New contracts trigger automatic coverage check
- Coverage gaps are flagged
- COI can be requested and tracked

**Dependencies**: 2.2 (insurance policy management)

**Estimated Effort**: 1 developer, 1 week

---

#### Phase 2 Exit Criteria

- [ ] Trade Secret entity operational with protection tracking
- [ ] Insurance policy management functional
- [ ] Claims management functional
- [ ] Contract-insurance integration working
- [ ] All 4 operational domains minimally viable

---

### Phase 3: Domain Enhancement (Weeks 11-14)

**Objective**: Enhance implemented domains with research-identified improvements.

#### Initiatives

##### 3.1 E-Signature Ceremony (Contracts-Legal)
**Priority**: M1 (Medium)

**Problem**: Current `signatureRef: String?` doesn't capture legal requirements.

**New Model** (from research):
```typescript
interface SignatureEvent {
  id: string;
  contractId: string;
  partyId: string;

  // Legal requirements
  signatureMethod: 'esign' | 'wet_ink' | 'digital_certificate';

  // Intent evidence
  clickwrapAccepted: boolean;
  intentStatement?: string;

  // Consent evidence
  consentCaptureMethod: 'checkbox' | 'typed_name' | 'drawn_signature';
  consentTimestamp: Date;

  // Association evidence
  documentHash: string;  // SHA-256 of document at signing
  documentVersion: number;

  // Context
  ipAddress: string;
  userAgent: string;
  geoLocation?: { latitude: number; longitude: number };

  // Provider details (if using DocuSign, Adobe Sign, etc.)
  provider?: string;
  providerEnvelopeId?: string;
  providerAuditTrail?: string;  // URL to provider's audit trail

  signedAt: Date;
}
```

**Tasks**:
- [ ] Add SignatureEvent model to Prisma schema
- [ ] Update contract signing flow to capture full ceremony
- [ ] Add document hashing at signature time
- [ ] Create audit report endpoint for signature events
- [ ] Update API documentation

**Success Criteria**:
- All four ESIGN Act requirements captured
- Signature audit trail complete for legal review
- Provider integration supported

**Dependencies**: None

**Estimated Effort**: 1 developer, 1 week

---

##### 3.2 Patent Families (IP)
**Priority**: M2 (Medium)

**Problem**: Patents form families through continuations, divisionals, and CIPs. Not tracked.

**Enhancement**:
```typescript
// Add to Patent aggregate
interface PatentFamilyRelation {
  familyId: string;
  parentPatentId?: string;
  relationType: 'continuation' | 'divisional' | 'cip' | 'reissue';
  priorityClaimDate?: Date;
  isTrueDivisional: boolean;  // Restriction-driven vs strategic
}
```

**Tasks**:
- [ ] Add family tracking fields to Patent
- [ ] Create PatentFamily aggregate
- [ ] Add endpoints: linkToFamily, getFamilyTree
- [ ] Update patent creation to optionally link to parent
- [ ] Add family view in queries

**Success Criteria**:
- Patent families can be tracked
- Continuation chains visible
- Priority dates properly handled for CIPs

**Dependencies**: None

**Estimated Effort**: 1 developer, 1 week

---

##### 3.3 Entity Dissolution Workflow
**Priority**: H3 (High)

**Problem**: When an entity is dissolved, what happens to all its operational records?

**Design**:
```yaml
id: entity-dissolution
trigger:
  type: event
  source: entity-governance.entity.dissolved

steps:
  - id: terminate-active-contracts
    domain: contracts-legal
    action: terminateEntityContracts
    input:
      entityId: ${input.entityId}
      reason: "Entity dissolved"

  - id: expire-policies
    domain: insurance
    action: expireEntityPolicies
    input:
      entityId: ${input.entityId}

  - id: transfer-or-abandon-ip
    domain: intellectual-property
    action: handleEntityDissolution
    input:
      entityId: ${input.entityId}
      action: ${input.ipDisposition}  # 'transfer' or 'abandon'
      transferToEntityId: ${input.successorEntityId}

  - id: archive-privacy-records
    domain: data-privacy
    action: archiveEntityRecords
    input:
      entityId: ${input.entityId}

  - id: generate-dissolution-report
    domain: operational
    action: generateDissolutionReport
    dependsOn: [terminate-active-contracts, expire-policies, transfer-or-abandon-ip, archive-privacy-records]
```

**Key Decisions**:
- Contracts terminated (not deleted) with dissolution reason
- Insurance policies expired
- IP either transferred to successor or abandoned
- Privacy records archived (not deleted - legal retention)
- Comprehensive dissolution report generated

**Tasks**:
- [ ] Add dissolution handling to each domain
- [ ] Create workflow definition
- [ ] Add dissolution report generation
- [ ] Test with mock entity dissolution
- [ ] Document process for operators

**Success Criteria**:
- Entity dissolution triggers automatic cleanup
- All domains handle dissolution appropriately
- Audit trail preserved
- Report documents all actions taken

**Dependencies**: All 4 domains implemented

**Estimated Effort**: 1 developer, 2 weeks

---

##### 3.4 Unified Audit Trail
**Priority**: M4 (Medium)

**Problem**: Audit logs exist per domain but no cross-domain correlation.

**Enhancement**:
1. Add `correlationId` to all audit entries
2. Propagate correlation through workflow steps
3. Create cross-domain audit query in gateway

**Tasks**:
- [ ] Add correlationId to audit middleware in all domains
- [ ] Ensure workflow engine propagates correlationId
- [ ] Add cross-domain audit query to gateway
- [ ] Create audit investigation endpoint

**Success Criteria**:
- Single correlationId traces action across domains
- Gateway can query audit by correlationId
- Investigation workflow supported

**Dependencies**: None

**Estimated Effort**: 1 developer, 1 week

---

#### Phase 3 Exit Criteria

- [ ] E-signature captures full legal ceremony
- [ ] Patent families trackable
- [ ] Entity dissolution workflow operational
- [ ] Unified audit trail functional
- [ ] All research-identified critical gaps addressed

---

### Phase 4: Insurance Completion & Production Readiness (Weeks 15-18)

**Objective**: Complete insurance domain and prepare ecosystem for production.

#### Initiatives

##### 4.1 Insurance Product Subdomains
**Priority**: H1 (High)

**Remaining Subdomains**:

1. **Workers' Compensation** (Week 15)
   - State-specific requirements
   - NCCI class codes
   - Experience modification tracking
   - Multi-state coverage

2. **Cyber Insurance** (Week 16)
   - Data breach coverage
   - Network security liability
   - Privacy violation coverage
   - Security control requirements

3. **Professional Liability** (Week 17)
   - E&O policies
   - D&O policies
   - Retroactive date tracking

4. **General Liability** (Week 18)
   - Commercial GL
   - Per-occurrence limits
   - Aggregate limits
   - Additional insured endorsements

**Tasks per Subdomain**:
- [ ] Define Prisma schema
- [ ] Implement service and repository
- [ ] Add REST endpoints
- [ ] Publish domain events
- [ ] Add to compliance mappings

**Success Criteria**:
- All 8 insurance subdomains operational
- Product-specific rules enforced
- State-specific workers' comp handled

**Dependencies**: 2.2 (policy management core)

**Estimated Effort**: 2 developers, 4 weeks

---

##### 4.2 Production Readiness

**Tasks**:
- [ ] Load testing all domains
- [ ] Security audit (OWASP top 10)
- [ ] Disaster recovery testing
- [ ] Runbook documentation
- [ ] Monitoring and alerting setup
- [ ] SLA definition per domain
- [ ] Incident response procedures

**Success Criteria**:
- All domains handle expected load
- No critical security vulnerabilities
- DR procedures tested
- Operations team trained

**Dependencies**: All phases complete

**Estimated Effort**: 1 developer + 1 ops, 2 weeks

---

#### Phase 4 Exit Criteria

- [ ] All insurance subdomains operational
- [ ] Production readiness checklist complete
- [ ] Load tested and secured
- [ ] Operations documentation complete

---

## Success Metrics

### Domain Health

| Domain | Metric | Target |
|--------|--------|--------|
| Contracts-Legal | Uptime | 99.9% |
| Intellectual Property | Uptime | 99.9% |
| Data Privacy | DSAR completion within 30 days | 100% |
| Insurance | Policy renewal on time | 100% |
| Orchestration | Workflow success rate | 99% |

### Business Outcomes

| Outcome | Metric | Target |
|---------|--------|--------|
| Operational Visibility | Entity overview load time | <2 seconds |
| Compliance | Finding resolution time | <14 days |
| Cross-Domain | Workflow completion rate | >95% |
| Audit | End-to-end trace coverage | 100% |

---

## Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Message queue issues | Medium | High | Abstraction layer, dual transport |
| Cross-domain data consistency | Medium | Medium | Saga pattern, compensation |
| Performance at scale | Low | High | Load testing, caching |

### Organizational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Resource constraints | Medium | High | Phased approach, priorities |
| Scope creep | High | Medium | Strict phase exit criteria |
| Knowledge silos | Medium | Medium | Documentation, pair programming |

---

## Dependencies Map

```
Phase 0 (Foundation)
    │
    ├─── Message Queue ─────────────────────┐
    │                                       │
    └─── Service Auth ──┐                   │
                        │                   │
Phase 1 (Privacy)       │                   │
    │                   │                   │
    ├─── Data Privacy ──┼───────────────────┤
    │        │          │                   │
    │        └─── DSAR Workflow             │
    │                                       │
Phase 2 (IP + Insurance Start)              │
    │                                       │
    ├─── Trade Secret ──────────────────────┤
    │                                       │
    ├─── Insurance Core ────────────────────┤
    │        │                              │
    │        └─── Contract-Insurance ───────┤
    │                                       │
Phase 3 (Enhancement)                       │
    │                                       │
    ├─── E-Signature ───────────────────────┤
    ├─── Patent Families ───────────────────┤
    ├─── Entity Dissolution ────────────────┤
    └─── Unified Audit ─────────────────────┤
                                            │
Phase 4 (Completion)                        │
    │                                       │
    ├─── Insurance Products ────────────────┤
    └─── Production Readiness ──────────────┘
```

---

## Timeline Summary

| Phase | Weeks | Focus | Key Deliverables |
|-------|-------|-------|------------------|
| 0 | 1-2 | Foundation | Message queue, service auth |
| 1 | 3-6 | Privacy | Data-privacy domain, DSAR workflow |
| 2 | 7-10 | IP + Insurance | Trade secret, insurance core |
| 3 | 11-14 | Enhancement | E-sig, patent families, dissolution |
| 4 | 15-18 | Completion | Insurance products, production ready |

**Total Duration**: 18 weeks (~4.5 months)

---

## Next Steps

1. **Immediate**: Review and approve this plan
2. **Week 1**: Begin Phase 0 - Message queue selection
3. **Ongoing**: Weekly progress reviews against phase exit criteria
4. **Milestone**: Phase 1 complete = GDPR compliance achievable

---

## References

- `.orchestration/understanding/integration/LIGHT.md` - Accumulated insights
- `.orchestration/understanding/integration/PATH.md` - Territory assessment
- `.orchestration/understanding/coverage/` - Domain coverage maps
- `.orchestration/understanding/curiosities/` - Research questions
- `contracts-legal/docs/research/` - Contract domain research
- `intellectual-property/research/` - IP domain research
