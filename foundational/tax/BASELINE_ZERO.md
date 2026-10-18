# Tax Service: Baseline Zero

> **Established**: 2026-01-30
> **Purpose**: True starting point for tax service development, beyond claimed status

---

## The Purpose

**Mission**: Automate UK tax compliance—from calculation through filing through payment—so organizations never miss a deadline, never miscalculate, and always have audit-ready records.

**The Formula**:
```
Entity Registration (HMRC identifiers)
  → Tax Calculations (CT, VAT, PAYE accurate to the penny)
  → Filing Automation (MTD submissions to HMRC)
  → Deadline Management (never miss, always prepared)
  → Audit Trail (7-year HMRC-compliant records)
```

---

## Baseline Zero: True State

### What ACTUALLY Works (Verified)

| Component | Evidence | Status |
|-----------|----------|--------|
| **Corporation Tax Calculator** | 27 unit tests passing | ✅ Production-ready |
| **VAT Calculator** | 24 unit tests passing | ✅ Production-ready |
| **PAYE/NI Calculator** | 64 unit tests passing | ✅ Production-ready |
| **Tax Registration CRUD** | API routes working | ✅ Functional |
| **CT Period Management** | API routes working | ✅ Functional |
| **VAT Return Management** | API routes working | ✅ Functional |
| **HMRC OAuth Client** | Code complete | ⚠️ Not integration tested |
| **VAT Submission Service** | Code complete | ⚠️ Not sandbox tested |
| **AWS Infrastructure** | 13 Terraform files | ✅ Complete |

### What's ACTUALLY Broken/Missing

| Component | Issue | Impact |
|-----------|-------|--------|
| **PAYE API Routes** | 16 integration tests failing | ❌ Cannot submit FPS/EPS via API |
| **Registration API** | 5 integration tests failing | ❌ CRUD partially broken |
| **RTI Client** | Stub only | ❌ Cannot submit PAYE to HMRC |
| **Database Migrations** | Not generated | ❌ Cannot deploy to fresh DB |
| **Event Integration** | Not tested | ⚠️ Unknown if events flow correctly |
| **Tax Provision Routes** | Not created | No API for provision domain |
| **Tax Calendar Routes** | Not created | No API for calendar domain |
| **Penalty Routes** | Not created | No API for penalties domain |

### The Truth Table

| STATUS.md Claims | Reality | Gap |
|------------------|---------|-----|
| "100% MVP Complete" | ~75% truly functional | 25% broken or missing |
| "40+ endpoints functional" | 26 working, 14 broken | 14 routes need fixing |
| "Integration tests complete" | 21 failing | All need investigation |
| "Database migration setup ✅" | migrations/ empty | Need to generate |
| "HMRC MTD ✅ Complete" | OAuth ready, RTI stub | RTI not implemented |

---

## Inventory: Domain by Domain

### 1. Corporation Tax ✅ PRODUCTION-READY

**Domain Models**:
- `CorporationTaxPeriod`: Full accounting period model
- `CT600Return`: All HMRC boxes (1-615), supplementary pages A-L
- `CT600PreparationService`: Maps period data to return format

**Calculations** (verified by 27 tests):
- Small profits rate (19%) for profits ≤ £50,000
- Main rate (25%) for profits > £250,000
- Marginal relief: `(Upper Limit - Profits) × 3/200`
- Associated companies scaling

**API Endpoints** (working):
```
GET  /api/v1/tax/corporation-tax/periods
GET  /api/v1/tax/corporation-tax/periods/:id
POST /api/v1/tax/corporation-tax/periods
PUT  /api/v1/tax/corporation-tax/periods/:id
POST /api/v1/tax/corporation-tax/periods/:id/calculate
POST /api/v1/tax/corporation-tax/periods/:id/file
POST /api/v1/tax/corporation-tax/periods/:id/pay
POST /api/v1/tax/corporation-tax/periods/:id/ct600  ← NEW
```

**What's Missing**: HMRC iXBRL filing integration (CT600 submission API)

### 2. VAT ✅ PRODUCTION-READY

**Domain Models**:
- `VATReturn`: 9-box MTD format with full validation
- `VATCalculator`: Standard + Flat Rate Scheme support

**Calculations** (verified by 24 tests):
- 9-box calculation with validation
- Box 6 calculation: Box 1 + Box 4
- Box 8/9 for EU supplies/acquisitions
- Flat Rate Scheme percentages by trade sector

**API Endpoints** (working):
```
GET  /api/v1/tax/vat/returns
GET  /api/v1/tax/vat/returns/:id
POST /api/v1/tax/vat/returns
PUT  /api/v1/tax/vat/returns/:id
POST /api/v1/tax/vat/returns/:id/calculate
POST /api/v1/tax/vat/returns/:id/accept-declaration
POST /api/v1/tax/vat/returns/:id/submit  ← Wired to HMRC client
```

**HMRC Integration**:
- OAuth client: ✅ Complete
- VAT submission service: ✅ Complete
- Sandbox testing: ⚠️ Not verified

### 3. PAYE/NI ⚠️ DOMAIN READY, API BROKEN

**Domain Models**:
- `PAYESubmission`: FPS/EPS RTI models
- `EmployeeTaxRecord`: Employee tax data, YTD tracking
- `P11DRecord`: Benefits in kind (all sections A-N)
- `P11DService`: Car, van, loan, fuel benefit calculations

**Calculations** (verified by 64 tests):
- All 12 NI categories (A, B, C, F, H, I, J, L, M, S, V, Z)
- 2024/25 thresholds: LEL £123/wk, PT £242/wk, UEL £967/wk
- Scottish 5-band system (19%, 20%, 21%, 42%, 47%)
- Welsh rates (same as rUK, prepared for divergence)
- Student loans (Plans 1, 2, 4, Postgraduate)
- K codes and negative tax handling

**API Endpoints** (broken - 16 test failures):
```
❌ GET  /api/v1/tax/paye/fps
❌ POST /api/v1/tax/paye/fps
❌ POST /api/v1/tax/paye/fps/:id/submit
❌ GET  /api/v1/tax/paye/eps
❌ POST /api/v1/tax/paye/eps
❌ POST /api/v1/tax/paye/eps/:id/submit
❌ GET  /api/v1/tax/paye/employees
❌ POST /api/v1/tax/paye/employees
❌ POST /api/v1/tax/paye/calculate/ni
❌ POST /api/v1/tax/paye/calculate/paye
```

**Root Cause**: Route handlers not returning response data (missing `reply.send()` or `return`)

**What's Missing**:
- Fix route handlers
- RTI client implementation (currently stub)
- P11D filing to HMRC

### 4. Tax Provision ✅ DOMAIN READY, NO API

**Domain Models** (NEW - just created):
- `TaxProvision`: Current + deferred tax positions
- `CurrentTaxProvision`: UK CT, overseas tax, credits
- `DeferredTaxProvision`: Temporary differences, recognition
- `UncertainTaxPosition`: UTP provisions (IFRIC 23)
- `TaxRateReconciliation`: ETR reconciliation

**Services**:
- `TaxProvisionCalculator`: Full provision calculation
- `DeferredTaxTracker`: Position tracking over time
- Disclosure generation for notes

**What's Missing**: API routes for provision CRUD and calculations

### 5. Tax Calendar ✅ DOMAIN READY, NO API

**Domain Models** (NEW - just created):
- `TaxDeadline`: 44 deadline types across CT, VAT, PAYE
- `TaxCalendarPeriod`: Period generation with UK deadline rules
- `ReminderConfig`: Notification settings

**Services**:
- `TaxCalendarService`: UK deadline rules built in
  - CT: 12 months filing, 9 months + 1 day payment
  - VAT: 37 days MTD deadline
  - PAYE: 22nd monthly, 6th July P11D
- Deadline status management (upcoming → due_soon → overdue → completed)
- Reminder scheduling

**What's Missing**: API routes for calendar/deadline management

### 6. Penalties ✅ DOMAIN READY, NO API

**Domain Models** (NEW - just created):
- `PenaltyRecord`: Full penalty tracking with appeals
- `VATPenaltyPoint`: New points-based system (Jan 2023+)
- `InterestCalculation`: HMRC late payment interest

**Services**:
- `PenaltyCalculator`: All UK penalty regimes
  - CT late filing: £100 + £100 + 10% + 10%
  - CT late payment: 5% + 5% + 5%
  - VAT points: 4 points = £200 (quarterly filers)
  - VAT late payment: 15-day grace, 2% + 2% + daily
  - PAYE: 1%/2%/4% escalating
  - Interest: 7.5% HMRC rate

**What's Missing**: API routes for penalty calculations and tracking

---

## Development Opportunities

### Tier 0: Fix What's Broken (BLOCKERS)

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Fix PAYE route handlers | 2h | Unblocks PAYE API | **P0** |
| Fix Registration routes | 1h | Unblocks entity setup | **P0** |
| Generate database migrations | 30min | Unblocks deployment | **P0** |
| Test HMRC OAuth flow | 2h | Validates integration | **P0** |

### Tier 1: Complete the APIs

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Tax Provision routes | 4h | Provision CRUD + calculate | **P1** |
| Tax Calendar routes | 4h | Deadline management | **P1** |
| Penalty routes | 4h | Penalty calculation | **P1** |
| Integrate VAT submission | 4h | Real HMRC sandbox test | **P1** |

### Tier 2: HMRC Production Integration

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| VAT MTD sandbox testing | 1d | Verify submission works | **P2** |
| VAT MTD production creds | 2-4w | HMRC approval process | **P2** |
| RTI client implementation | 2d | PAYE submission to HMRC | **P2** |
| RTI sandbox testing | 1d | Verify FPS/EPS works | **P2** |
| CT600 iXBRL integration | 3d | Corporation tax filing | **P2** |

### Tier 3: Advanced Features

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Tax optimization engine | 1w | R&D credits, loss planning | **P3** |
| Multi-entity consolidation | 1w | Group relief optimization | **P3** |
| Predictive deadline alerts | 2d | AI-powered reminders | **P3** |
| Tax risk scoring | 3d | HMRC enquiry likelihood | **P3** |
| International tax (transfer pricing) | 2w | Cross-border entities | **P3** |

### Tier 4: Enterprise Features

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Real-time tax position dashboard | 1w | CFO visibility | **P4** |
| What-if scenario modeling | 1w | Tax planning tool | **P4** |
| Audit defense preparation | 1w | HMRC enquiry readiness | **P4** |
| API for accountants | 1w | Third-party integration | **P4** |

---

## Path to Purpose Realization

### Phase 1: Foundation Repair (Week 1)

**Objective**: Everything works as claimed

```
Day 1-2: Fix API Routes
├── Debug PAYE route handlers
├── Fix Registration routes
├── Generate and run migrations
└── Verify all 40+ endpoints return correctly

Day 3-4: HMRC Integration Verification
├── Test OAuth flow end-to-end
├── Submit test VAT return to sandbox
├── Document API error handling
└── Create integration tests

Day 5: Event Integration
├── Test tax event publishing
├── Verify entity-governance → tax flow
├── Verify accounting → tax flow
└── Document event contracts
```

**Exit Criteria**:
- 0 failing integration tests
- VAT submission works in HMRC sandbox
- All events flow correctly

### Phase 2: Complete the Platform (Weeks 2-3)

**Objective**: Full tax management capability

```
Week 2: New Domain APIs
├── Tax Provision CRUD routes
├── Tax Calendar management routes
├── Penalty calculation routes
├── Integration tests for all new routes
└── API documentation

Week 3: PAYE Completion
├── Implement RTI client
├── FPS submission to sandbox
├── EPS submission to sandbox
├── P11D filing preparation
└── Full PAYE integration tests
```

**Exit Criteria**:
- All 6 domains have working APIs
- RTI submissions work in sandbox
- 80%+ test coverage

### Phase 3: Production Readiness (Week 4)

**Objective**: Ready for real HMRC submissions

```
Security & Compliance:
├── Security audit of HMRC flows
├── Token storage encryption review
├── Audit trail verification
├── 7-year retention validation
└── Penetration testing

Performance & Reliability:
├── Load testing (10x expected)
├── Failover testing
├── Monitoring alerts tuned
├── Runbooks created
└── Incident procedures documented
```

**Exit Criteria**:
- Security audit passed
- Load tested to 10x capacity
- Production monitoring active

### Phase 4: HMRC Production (Weeks 5-8)

**Objective**: Live HMRC filing

```
Application Process:
├── Apply for MTD production credentials
├── HMRC compliance review
├── API security review
├── Sandbox certification
└── Production access granted

Rollout:
├── Pilot with 1-2 entities
├── Verify production submissions
├── Monitor for issues
├── Expand to all entities
└── Full automation active
```

**Exit Criteria**:
- VAT returns filing live
- PAYE RTI submissions live
- Zero manual HMRC intervention needed

---

## Success Metrics

### Technical Health

| Metric | Current | Week 1 | Week 4 | Production |
|--------|---------|--------|--------|------------|
| Unit tests passing | 115 | 115 | 150+ | 200+ |
| Integration tests passing | 0 | 21 | 50+ | 80+ |
| API endpoints working | 26/40 | 40/40 | 60+ | 60+ |
| Test coverage | 60% | 70% | 80% | 85%+ |
| HMRC sandbox submissions | 0 | 5+ | 50+ | 100+ |

### Business Value

| Metric | Target |
|--------|--------|
| VAT return preparation time | < 5 minutes |
| PAYE RTI submission time | < 2 minutes |
| Tax provision calculation time | < 30 seconds |
| Missed deadline rate | 0% |
| HMRC penalty rate | 0% |
| Audit preparation time | < 1 hour |

### Purpose Realization Checklist

- [ ] **Registration**: Entity can register for all UK taxes via API
- [ ] **Calculation**: All tax calculations accurate to the penny
- [ ] **Filing**: VAT/PAYE/CT submissions automated to HMRC
- [ ] **Deadlines**: Never miss a deadline (proactive alerts)
- [ ] **Payments**: Clear visibility of amounts due and paid
- [ ] **Audit**: 7-year records instantly retrievable
- [ ] **Penalties**: Zero penalties through compliance automation

---

## Resource Requirements

### Development Effort

| Phase | Duration | Focus |
|-------|----------|-------|
| Foundation Repair | 1 week | Fix routes, verify HMRC |
| Platform Completion | 2 weeks | New APIs, RTI client |
| Production Readiness | 1 week | Security, performance |
| HMRC Production | 4 weeks | Credential approval, rollout |

### External Dependencies

| Dependency | Status | Action Required |
|------------|--------|-----------------|
| HMRC MTD Credentials | Sandbox only | Apply for production |
| Companies House Link | Not integrated | For confirmation statement validation |
| Accounting Events | Defined | Test integration |
| Entity Governance Events | Defined | Test integration |

---

## The Reality Check

### What the STATUS.md Says
```
Overall Progress: 100%
Status: MVP Complete
Blockers: None
```

### What Actually Works
```
Domain Models: 100% ✅
Calculations: 100% ✅
CT/VAT API: 100% ✅
PAYE API: 0% ❌ (broken)
HMRC Integration: 50% ⚠️ (foundation only)
Event Integration: ? (untested)
```

### The Honest Assessment

**Strengths**:
- Excellent domain modeling
- Calculations are bulletproof (115 tests)
- AWS infrastructure is complete
- HMRC OAuth foundation is solid

**Gaps**:
- PAYE routes need debugging
- No integration testing validates real flows
- RTI submission is a stub
- New domains (provision, calendar, penalties) need APIs

**Path Forward**:
1. Fix what's broken (1 week)
2. Complete what's missing (2 weeks)
3. Harden for production (1 week)
4. Go live with HMRC (4 weeks)

---

## Conclusion

The Tax Service has **strong bones but incomplete wiring**. The domain models and calculations are production-ready. The infrastructure is complete. But the API layer has gaps that must be fixed before the service can fulfill its purpose.

**Zero Point**: 75% truly functional
**Target**: 100% production-ready with live HMRC integration
**Gap**: Fix routes, complete APIs, implement RTI, test everything
**Timeline**: 8 weeks to live HMRC filing

The purpose—**automated UK tax compliance**—is achievable. The path is clear. The work begins now.

---

*Baseline established: 2026-01-30*
*Next milestone: Foundation Repair complete (Week 1)*
