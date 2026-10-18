# Tax Service: Development Path

> **From**: Baseline Zero (2026-01-30)
> **To**: Purpose Realized (Automated UK Tax Compliance)

---

## The Purpose

> **Automate UK tax compliance so organizations never miss a deadline, never miscalculate, and always have audit-ready records.**

---

## Development Opportunities (Prioritized)

### 🔴 TIER 0: Critical Fixes (Blocking Production)

These must be resolved before any forward progress.

#### 0.1 Fix PAYE API Routes

**Problem**: 16 integration tests failing. Route handlers don't return data.

**Location**: `src/api/rest/routes/paye.ts`

**Symptoms**:
- POST endpoints return undefined
- GET endpoints return 400 instead of 200
- Calculation endpoints return undefined

**Likely Root Cause**: Missing `return` or `reply.send()` in route handlers.

**Resolution**:
```typescript
// Before (broken)
fastify.post('/fps', async (request, reply) => {
  const submission = await repository.create(request.body);
  // No return!
});

// After (fixed)
fastify.post('/fps', async (request, reply) => {
  const submission = await repository.create(request.body);
  return reply.status(201).send(submission);
});
```

**Effort**: 2-3 hours
**Validates**: Run `pnpm test` and see all PAYE tests pass

---

#### 0.2 Fix Registration API Routes

**Problem**: 5 integration tests failing for registration CRUD.

**Location**: `src/api/rest/routes/registrations.ts`

**Effort**: 1-2 hours

---

#### 0.3 Generate Database Migrations

**Problem**: `drizzle/migrations/` is empty. Cannot deploy to fresh database.

**Resolution**:
```bash
pnpm db:generate  # Generate migration files from schema
pnpm db:migrate   # Apply migrations (or db:push for dev)
```

**Effort**: 30 minutes

---

#### 0.4 Verify HMRC OAuth Flow

**Problem**: OAuth client code exists but never tested end-to-end.

**Test Scenario**:
1. Start service with HMRC sandbox credentials
2. Hit `GET /api/v1/tax/hmrc/authorize`
3. Complete OAuth flow in browser
4. Verify callback stores token
5. Verify token can make API call

**Effort**: 2-3 hours

---

### 🟠 TIER 1: Complete the Platform

These complete the core tax management capability.

#### 1.1 Tax Provision API Routes

**What Exists**: `src/domain/tax-provision/` with full models and services

**What's Missing**: REST API routes

**Endpoints to Create**:
```
POST   /api/v1/tax/provisions          Create provision
GET    /api/v1/tax/provisions          List provisions
GET    /api/v1/tax/provisions/:id      Get provision
PUT    /api/v1/tax/provisions/:id      Update provision
DELETE /api/v1/tax/provisions/:id      Delete provision

POST   /api/v1/tax/provisions/:id/calculate    Calculate provision
GET    /api/v1/tax/provisions/:id/summary      Get summary text
GET    /api/v1/tax/provisions/:id/disclosure   Get disclosure notes

POST   /api/v1/tax/deferred-tax/positions      Upsert position
GET    /api/v1/tax/deferred-tax/positions      List positions
POST   /api/v1/tax/deferred-tax/rollforward    Calculate rollforward
GET    /api/v1/tax/deferred-tax/summary        Get DT summary
```

**Effort**: 4-6 hours

---

#### 1.2 Tax Calendar API Routes

**What Exists**: `src/domain/tax-calendar/` with full models and services

**What's Missing**: REST API routes

**Endpoints to Create**:
```
POST   /api/v1/tax/calendar/periods              Create calendar period
GET    /api/v1/tax/calendar/periods              List periods
GET    /api/v1/tax/calendar/periods/:id          Get period
POST   /api/v1/tax/calendar/periods/:id/generate Generate deadlines

GET    /api/v1/tax/deadlines                     List deadlines
GET    /api/v1/tax/deadlines/:id                 Get deadline
PUT    /api/v1/tax/deadlines/:id                 Update deadline
POST   /api/v1/tax/deadlines/:id/complete        Mark complete
POST   /api/v1/tax/deadlines/:id/extend          Request extension

GET    /api/v1/tax/deadlines/summary             Get summary
GET    /api/v1/tax/deadlines/month/:year/:month  Get calendar month
GET    /api/v1/tax/deadlines/upcoming            Get upcoming deadlines
POST   /api/v1/tax/deadlines/refresh             Refresh all statuses
```

**Effort**: 4-6 hours

---

#### 1.3 Penalty API Routes

**What Exists**: `src/domain/penalties/` with full models and services

**What's Missing**: REST API routes

**Endpoints to Create**:
```
GET    /api/v1/tax/penalties                     List penalties
GET    /api/v1/tax/penalties/:id                 Get penalty
POST   /api/v1/tax/penalties/:id/pay             Record payment
POST   /api/v1/tax/penalties/:id/appeal          File appeal
POST   /api/v1/tax/penalties/:id/excuse          Claim reasonable excuse

POST   /api/v1/tax/penalties/calculate/ct-filing   Calculate CT late filing
POST   /api/v1/tax/penalties/calculate/ct-payment  Calculate CT late payment
POST   /api/v1/tax/penalties/calculate/vat-point   Add VAT penalty point
POST   /api/v1/tax/penalties/calculate/vat-payment Calculate VAT late payment
POST   /api/v1/tax/penalties/calculate/paye        Calculate PAYE late payment
POST   /api/v1/tax/penalties/calculate/interest    Calculate interest

GET    /api/v1/tax/penalties/summary/:entityId     Get penalty summary
GET    /api/v1/tax/penalties/vat-points/:entityId  Get VAT points status
```

**Effort**: 4-6 hours

---

#### 1.4 Complete RTI Client

**What Exists**: `src/infrastructure/hmrc/rti-client.ts` (stub)

**What's Missing**: Actual implementation

**Implementation Required**:
```typescript
export class RTIClient {
  // Submit Full Payment Submission
  async submitFPS(submission: FPSSubmission): Promise<HMRCResponse>

  // Submit Employer Payment Summary
  async submitEPS(submission: EPSSubmission): Promise<HMRCResponse>

  // Check submission status
  async getSubmissionStatus(reference: string): Promise<SubmissionStatus>

  // Get obligations
  async getObligations(taxYear: string): Promise<RTIObligation[]>
}
```

**HMRC RTI API Reference**: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/rti

**Effort**: 2-3 days

---

#### 1.5 VAT Sandbox Integration Test

**What Exists**: VAT submission service with HMRC client

**What's Missing**: Actual sandbox test

**Test Scenario**:
1. Create test VAT return with 9-box data
2. Authenticate via OAuth
3. Submit to HMRC sandbox
4. Verify response contains receipt
5. Query submission status

**Effort**: 4-6 hours

---

### 🟡 TIER 2: HMRC Production

These enable live HMRC submissions.

#### 2.1 Apply for MTD Production Credentials

**Process**:
1. Complete HMRC developer registration
2. Request sandbox access (if not done)
3. Complete sandbox testing requirements
4. Submit production application
5. HMRC security review
6. Receive production credentials

**Timeline**: 2-6 weeks (HMRC dependent)

**Documentation Needed**:
- API usage description
- Security measures documentation
- Data protection statement
- Business registration details

---

#### 2.2 VAT MTD Production Submission

**Prerequisites**:
- Production credentials obtained
- Sandbox testing complete
- Fraud prevention headers implemented
- Token storage secure

**Go-Live Steps**:
1. Switch environment to production
2. Pilot with single entity
3. Monitor for errors
4. Expand to all entities
5. Automate quarterly submission

---

#### 2.3 PAYE RTI Production Submission

**Prerequisites**:
- RTI client implemented
- Production credentials for RTI
- Sandbox testing complete
- FPS/EPS validation complete

**Go-Live Steps**:
1. Pilot FPS with single payroll run
2. Verify HMRC receipt
3. Submit EPS for first period
4. Automate monthly submissions
5. Configure year-end (P60, P11D)

---

#### 2.4 CT600 iXBRL Integration

**What's Needed**: Convert CT600 data to iXBRL format for filing

**Components**:
1. iXBRL template for CT600
2. Data mapping to template
3. Validation against HMRC rules
4. Submission via Companies House/HMRC joint filing

**Effort**: 1 week
**Complexity**: High (iXBRL format is XML-based with taxonomy)

---

### 🟢 TIER 3: Advanced Features

These add significant value but aren't blocking.

#### 3.1 Tax Optimization Engine

**Opportunities**:
- R&D tax credit eligibility detection
- Capital allowances optimization (AIA, pools)
- Loss carry-back/forward modeling
- Group relief optimization
- Patent box applicability

**Implementation**:
```typescript
interface TaxOptimizationSuggestion {
  type: 'r_and_d' | 'capital_allowances' | 'loss_relief' | 'group_relief' | 'patent_box';
  potentialSaving: string;
  confidence: 'high' | 'medium' | 'low';
  description: string;
  requirements: string[];
  nextSteps: string[];
}

async function analyzeOptimizations(entityId: string): Promise<TaxOptimizationSuggestion[]>
```

---

#### 3.2 Multi-Entity Tax Consolidation

**Capabilities**:
- Group relief surrender/claim matching
- Intercompany transaction tracking
- Transfer pricing documentation
- Consolidated tax position reporting

---

#### 3.3 Predictive Deadline Alerts

**Features**:
- ML-based workload prediction
- Smart reminder scheduling
- Bottleneck identification
- Capacity planning suggestions

---

#### 3.4 Tax Risk Scoring

**Algorithm Factors**:
- Filing history (late filings increase risk)
- Adjustment history
- Industry comparison
- Claim complexity
- HMRC enquiry triggers

**Output**: Risk score 1-100 with specific concerns

---

### 🔵 TIER 4: Enterprise Features

These are for large-scale deployments.

#### 4.1 Real-Time Tax Position Dashboard

**Visualizations**:
- Tax liability waterfall
- Deadline timeline
- Payment schedule
- Effective tax rate trends
- Provision vs actual analysis

---

#### 4.2 What-If Scenario Modeling

**Scenarios**:
- "What if we make this acquisition?"
- "What if we change accounting period?"
- "What if we surrender loss to subsidiary?"
- "What if we claim R&D on this project?"

---

#### 4.3 Audit Defense Preparation

**Features**:
- HMRC enquiry checklist
- Document preparation guide
- Timeline tracking
- Correspondence management
- Risk assessment by claim type

---

#### 4.4 Third-Party API for Accountants

**Capabilities**:
- Bulk data import/export
- Calculation-only mode
- White-label embedding
- Webhook notifications
- Multi-client dashboard

---

## Implementation Sequence

```
Week 1: Foundation Repair
├── Day 1: Fix PAYE routes (16 tests)
├── Day 2: Fix Registration routes (5 tests)
├── Day 3: Generate migrations, verify DB
├── Day 4: Test HMRC OAuth flow
└── Day 5: Submit test VAT return to sandbox

Week 2: New API Routes
├── Day 1-2: Tax Provision routes + tests
├── Day 3-4: Tax Calendar routes + tests
└── Day 5: Penalty routes + tests

Week 3: PAYE Completion
├── Day 1-2: Implement RTI client
├── Day 3: FPS sandbox testing
├── Day 4: EPS sandbox testing
└── Day 5: Integration tests

Week 4: Production Prep
├── Day 1-2: Security review
├── Day 3: Performance testing
├── Day 4: Documentation
└── Day 5: Production checklist

Weeks 5-8: HMRC Production
├── Week 5: Apply for credentials
├── Week 6: Complete sandbox certification
├── Week 7: Receive credentials
└── Week 8: Go-live VAT + PAYE
```

---

## Success Milestones

| Milestone | Target Date | Validation |
|-----------|-------------|------------|
| All tests passing | Week 1 | `pnpm test` = 0 failures |
| VAT sandbox working | Week 1 | HMRC receipt received |
| All APIs complete | Week 2 | 60+ endpoints functional |
| RTI sandbox working | Week 3 | FPS/EPS receipts received |
| Security approved | Week 4 | Security audit passed |
| VAT production live | Week 6 | Real return filed |
| PAYE production live | Week 8 | Real FPS submitted |

---

## The Promise

When this path is complete:

✅ **Registration**: Entities register for all UK taxes in one API call
✅ **Calculation**: Every calculation is accurate, tested, and auditable
✅ **Filing**: VAT, PAYE, and CT file automatically to HMRC
✅ **Deadlines**: Smart alerts ensure nothing is ever missed
✅ **Penalties**: Zero penalties through proactive compliance
✅ **Audit**: Complete 7-year records instantly retrievable
✅ **Optimization**: AI suggests tax-saving opportunities

**The purpose is realized**: Automated UK tax compliance.

---

*Path defined: 2026-01-30*
*First milestone: All tests passing (Week 1)*
