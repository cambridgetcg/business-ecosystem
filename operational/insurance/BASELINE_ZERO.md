# Insurance Service - Baseline Zero

**Established**: 2026-01-30
**Purpose**: Set current state as starting point for development path

---

## Current State (Point Zero)

### Overall Position

| Dimension | State | Evidence |
|-----------|-------|----------|
| **Architecture** | Solid | Clean layered architecture, DDD patterns |
| **Domain Model** | 90% | Policy + Claims fully modeled with Zod |
| **Persistence** | 80% | 15 Prisma tables, proper indexing |
| **API Surface** | 80% | 40+ REST endpoints, full CRUD |
| **Business Logic** | Strong | 33 domain functions, state machines |
| **Testing** | 60% | Unit tests for domain, gaps in services |
| **Integration** | 20% | Event handlers stubbed, not wired |
| **Documentation** | 80% | Mission, status, API docs complete |

**Composite Score**: 75% implemented, 25% remaining

---

## What Exists (Strengths)

### 1. Complete Policy Lifecycle

```
draft → quoted → bound → active → expired/cancelled/renewed
```

- Multi-insurer support (coinsurance, layered programs)
- 12 policy types (D&O, PI, EL, PL, Cyber, Property, BI, etc.)
- UK IPT calculation (12%/20%)
- Premium installment tracking
- Endorsement management
- Document storage structure

### 2. Complete Claims Lifecycle

```
draft → submitted → investigation → approved/denied → settled → closed
```

- Multi-claimant support with solicitor tracking
- Reserve management with history
- Payment tracking (indemnity, expenses, recoveries)
- Activity audit trail
- Litigation and subrogation flags
- Handler assignment

### 3. UK-Specific Compliance

- Employers' Liability £5M minimum validation
- UK policy types aligned with market
- IPT rates correctly implemented
- GBP as default currency

### 4. API Coverage

| Area | Endpoints | Status |
|------|-----------|--------|
| Policy CRUD | 4 | Complete |
| Policy Status Transitions | 5 | Complete |
| Policy Queries | 4 | Complete |
| Claims CRUD | 4 | Complete |
| Claims Status Transitions | 7 | Complete |
| Claims Queries | 5 | Complete |
| Reserve/Payments | 4 | Complete |
| Dashboard | 2 | Complete |

### 5. Domain Logic Functions

**Policy (19 functions)**:
- State checks: `isPolicyActive()`, `canEditPolicy()`, `canBindPolicy()`, etc.
- Calculations: `calculateIPT()`, `getTotalInsuredValue()`
- Validations: `meetsEmployersLiabilityMinimum()`

**Claims (14 functions)**:
- State checks: `isClaimOpen()`, `canApproveClaim()`, `canSettleClaim()`
- Calculations: `calculateTotalIncurred()`, `calculateNetPaid()`
- Validations: `validateClaimPeriod()`

---

## What's Missing (Gaps)

### Critical Gaps (Block Purpose)

| Gap | Impact | Why Critical |
|-----|--------|--------------|
| **Event Publishing** | No ecosystem integration | Can't notify Accounting, Compliance, Entity Governance |
| **Integration Tests** | Can't verify workflows | End-to-end reliability unknown |

### Important Gaps (Limit Value)

| Gap | Impact | Why Important |
|-----|--------|---------------|
| **CoI Generation** | Manual certificate creation | Stated 24-hour response metric impossible |
| **Renewal Scheduling** | No proactive alerts | "Zero lapse" metric impossible |
| **Service Layer Tests** | Logic untested | PolicyService, ClaimsService coverage gaps |

### Enhancement Opportunities

| Opportunity | Benefit |
|-------------|---------|
| Risk assessment integration | Proactive coverage recommendations |
| Broker/carrier API hooks | Automated quote/bind workflow |
| Claims analytics | Loss ratio trending, predictive insights |
| Premium benchmarking | Market comparison data |

---

## Gap Analysis: Mission vs Reality

### Mission Statement Claims

| Claim | Current State | Gap |
|-------|---------------|-----|
| "enables business ecosystem to operate with confidence" | Events not wired | **Critical** |
| "Certificate requests fulfilled within 24 hours" | No CoI generation | **Important** |
| "Zero coverage lapses from missed renewals" | No renewal scheduler | **Important** |
| "All valid claims filed within policy deadlines" | Domain logic exists | Achieved |
| "Complete visibility into coverage" | API + queries exist | Achieved |

### Events: Promised vs Implemented

| Event | Promised | Status |
|-------|----------|--------|
| `Policy.Active` | Yes | **Stubbed** |
| `Policy.Expiring` | Yes | **Not implemented** |
| `Policy.Expired` | Yes | **Stubbed** |
| `Claim.Filed` | Yes | **Stubbed** |
| `Claim.Settled` | Yes | **Stubbed** |
| `COI.Issued` | Yes | **Not implemented** |

---

## Development Opportunities

### Tier 1: Complete the Foundation (Weeks 1-2)

**Goal**: Make the service a working ecosystem citizen

#### 1.1 Event Publishing Infrastructure

```typescript
// Events to implement
PolicyCreated    → Compliance, Entity Governance
PolicyActivated  → Compliance, Accounting
PolicyExpiring   → Risk owners, renewal workflow
ClaimFiled       → Accounting (receivable)
ClaimSettled     → Accounting (payment)
```

**Why first**: Without events, insurance is an island. Other services can't react to policy or claims changes.

#### 1.2 Event Subscription Handlers

```typescript
// Events to consume
ContractSigned           → Review insurance requirements in contract
EntityCreated            → Assess standard coverage needs
SecurityIncidentReported → Evaluate for potential claim
ComplianceCoverageRequired → Flag coverage gap
```

**Why critical**: Insurance needs to react to ecosystem changes.

#### 1.3 Integration Tests

- Database round-trip tests
- API endpoint tests with real Prisma
- Event publishing verification
- Cross-service workflow simulation

---

### Tier 2: Deliver on Promises (Weeks 3-4)

**Goal**: Meet mission statement metrics

#### 2.1 Certificate of Insurance Generation

```
Input: Policy ID, Holder details
Process:
  1. Load policy and coverage
  2. Generate PDF with certificate template
  3. Store in S3
  4. Track in certificates_of_insurance table
  5. Publish COI.Issued event
Output: PDF download URL, certificate record
```

**Target**: 24-hour fulfillment SLA achievable

#### 2.2 Renewal Reminder Scheduling

```
Cron: Daily scan at 06:00
Logic:
  1. Find policies expiring in 30/60/90 days
  2. Check if reminder already sent
  3. Create RenewalReminder record
  4. Publish Policy.Expiring event
  5. (Future: integrate with notification service)
```

**Target**: Zero coverage lapses metric achievable

#### 2.3 Service Layer Tests

- PolicyService: All 17 methods tested
- ClaimsService: All 28 methods tested
- Error paths and edge cases
- Mocked external dependencies

---

### Tier 3: Enhance Value (Weeks 5-8)

**Goal**: Differentiate from basic tracking

#### 3.1 Coverage Gap Analysis

```typescript
interface CoverageGapAnalysis {
  entityId: string;
  requiredCoverages: RequiredCoverage[];  // From Compliance
  activePolicies: Policy[];
  gaps: CoverageGap[];
  recommendations: Recommendation[];
}
```

**Integration**: Compliance → Insurance → Entity Dashboard

#### 3.2 Claims Analytics Dashboard

```typescript
interface ClaimsAnalytics {
  lossRatio: number;           // (losses + expenses) / premiums
  claimFrequency: number;      // claims per policy
  avgClaimDuration: number;    // days from filed to closed
  reserveAccuracy: number;     // actual vs reserved
  trendingByType: ClaimTrend[];
}
```

**Value**: Data-driven risk decisions

#### 3.3 Operational Gateway Integration

```typescript
// Expose to gateway
GET /insurance/metrics/expiring-policies
GET /insurance/metrics/open-claims
GET /insurance/metrics/coverage-summary
GET /insurance/health
```

**Integration**: Gateway aggregates for cross-domain views

---

### Tier 4: Advanced Capabilities (Months 2-3)

**Goal**: Automation and intelligence

#### 4.1 Broker/Carrier API Integration

- Quote request automation
- Policy data sync
- Claims status sync
- Document exchange

#### 4.2 Premium Optimization

- Market comparison data
- Renewal pricing analysis
- Experience modification tracking
- Premium allocation optimization

#### 4.3 Predictive Claims

- Early warning indicators
- Reserve adequacy prediction
- Settlement range estimation
- Subrogation opportunity identification

---

## Path to Purpose

### The Mission

> "To protect the organization from financial loss through comprehensive risk transfer, policy management, and claims administration"

### The Journey

```
BASELINE ZERO (Today)
│
│  Working domain model, API, persistence
│  Island - no ecosystem integration
│
├─────────────────────────────────────────────
│
│  TIER 1: Foundation (Critical)
│  ├── Event publishing
│  ├── Event consumption
│  └── Integration tests
│
│  Outcome: Ecosystem citizen
│
├─────────────────────────────────────────────
│
│  TIER 2: Promises (Important)
│  ├── CoI generation
│  ├── Renewal scheduling
│  └── Service tests
│
│  Outcome: Mission metrics achievable
│
├─────────────────────────────────────────────
│
│  TIER 3: Value (Enhancement)
│  ├── Coverage gap analysis
│  ├── Claims analytics
│  └── Gateway integration
│
│  Outcome: Strategic asset
│
├─────────────────────────────────────────────
│
│  TIER 4: Intelligence (Advanced)
│  ├── Broker/carrier APIs
│  ├── Premium optimization
│  └── Predictive claims
│
│  Outcome: Competitive advantage
│
└─────────────────────────────────────────────
                    │
                    ▼
            PURPOSE REALIZED

            Organization protected.
            Coverage visible.
            Claims recovered.
            Confidence established.
```

---

## Immediate Next Actions

### This Week

1. **Wire event publishing** for `PolicyActivated` and `ClaimFiled`
2. **Implement event handler** for `EntityCreated`
3. **Write first integration test** for policy lifecycle

### This Sprint

1. Complete all Tier 1 items
2. Begin CoI generation spike
3. Establish testing patterns for services

### This Month

1. Tier 1 complete
2. Tier 2 complete
3. Operational Gateway endpoints live

---

## Success Criteria

### Tier 1 Complete When

- [ ] Policy events publish to message bus
- [ ] Claims events publish to message bus
- [ ] Entity events consumed and processed
- [ ] Integration tests pass in CI

### Tier 2 Complete When

- [ ] CoI generated and downloadable
- [ ] Renewal reminders sent at 30/60/90 days
- [ ] Service test coverage > 80%

### Mission Metrics Achievable When

- [ ] "100% required coverage visible" → Coverage API + Compliance integration
- [ ] "Zero coverage lapses" → Renewal scheduling active
- [ ] "24-hour CoI response" → Generation automated
- [ ] "All claims tracked" → Full lifecycle in place (Achieved)

---

## Technical Debt Register

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| Event handlers stubbed | High | Medium | Blocking ecosystem value |
| No integration tests | High | Medium | Blocking confidence |
| Service tests missing | Medium | Medium | Risk of regressions |
| CoI generation missing | Medium | Medium | Blocking SLA metric |
| Renewal scheduler missing | Medium | Low | Blocking lapse metric |
| CQRS not implemented | Low | High | Future scalability |
| GraphQL not implemented | Low | Medium | Nice to have |

---

## Dependencies Tracked

### Insurance Depends On

| Service | For | Status |
|---------|-----|--------|
| Entity Governance | Entity context (entityId) | Available |
| Messaging | Event bus | Available |
| Compliance | Coverage requirements | Available |
| Corporate Security | Incident reports | Skeleton |

### Depend on Insurance

| Service | For | Status |
|---------|-----|--------|
| Accounting | Premium/claim postings | Waiting on events |
| Compliance | Coverage status | Waiting on events |
| Operational Gateway | Aggregation | Waiting on endpoints |
| Entity Governance | Coverage dashboard | Waiting on API |

---

*This baseline establishes the current state as "zero" for measuring progress. All development should be measured against this starting point.*

**Next Review**: After Tier 1 completion
