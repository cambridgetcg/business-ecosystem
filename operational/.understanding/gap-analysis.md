# Gap Analysis: What We Don't Understand Yet

This document tracks **known unknowns** - areas where we recognize gaps in understanding or implementation.

**Last Updated**: January 27, 2026 (Phase 1 Implementation Complete)

---

## Critical Gaps (IMMEDIATE ACTION REQUIRED)

### 1. Data-Privacy Domain - ✅ MVP IMPLEMENTED

**What was missing** (now addressed):
- ✅ Database schema (Prisma with 9 models: ConsentRecord, DSARRequest, DataBreach, etc.)
- ✅ Consent management (full CRUD + withdraw + check endpoints)
- ✅ DSAR handling with 30-day deadline tracking and activity logging
- ✅ Breach notification with 72-hour authority notification tracking
- ⚠️ Privacy impact assessments (schema exists, API not yet implemented)

**Implementation Details**:
- Prisma schema: `/operational/data-privacy/prisma/schema.prisma`
- Routes: consent, dsar, breach management + compliance-status aggregation endpoint
- Compliance integration: `/api/v1/compliance-status/:entityId` for gateway aggregation

**Remaining Work**:
- Privacy Impact Assessment API routes
- Retention Policy management
- Data Processor registry
- Event publishing to messaging bus

**Status**: MVP Complete - Core GDPR features implemented
**Dimension**: [25-data-privacy-overview.md](dimensions/25-data-privacy-overview.md)
**Priority**: MEDIUM (remaining features)

---

### 2. Insurance Domain - NO IMPLEMENTATION

**What's missing**:
- No database schema (Prisma not configured)
- No policy management (~40 entity types documented, 0 implemented)
- No claims processing
- No endorsement handling
- No COI generation

**Business Impact**:
- Cannot track corporate insurance portfolio
- Cannot process claims
- Cannot verify coverage for contracts

**Status**: Stub only (health endpoint)
**Dimension**: [20-insurance-overview.md](dimensions/20-insurance-overview.md)
**Priority**: CRITICAL

---

### 3. Trade Secret Entity - REFERENCED BUT MISSING

**What's wrong**:
- License entity accepts `ipType: 'trade_secret'`
- No TradeSecret entity exists to link to
- This is a data integrity issue

**Research says** (from IP research docs):
- Trade secrets need: protection measures tracking, access control, breach logging
- DTSA compliance requires whistleblower documentation
- No expiration (unlike patents/trademarks) makes lifecycle different

**Status**: Entity doesn't exist
**Dimension**: [15-ip-overview.md](dimensions/15-ip-overview.md)
**Priority**: HIGH

---

### 4. Message Queue - ✅ CONNECTED

**What was wrong** (now fixed):
- ✅ RabbitMQSubscriber created in `@ecosystem/messaging`
- ✅ Workflow engine connects to RabbitMQ on startup
- ✅ Event handlers wired to workflow execution
- ✅ Graceful shutdown with queue disconnection

**Implementation Details**:
- `RabbitMQSubscriber` class: `/shared/libs/messaging/src/rabbitmq-subscriber.ts`
- Workflow engine integration: `/operational/.orchestration/engine/src/index.ts`
- Configurable via `RABBITMQ_URL` environment variable

**Remaining Work**:
- Domain services need to publish events to the exchange
- More workflow definitions to subscribe to domain events
- Dead-letter queue handling for failed message processing

**Status**: Infrastructure connected, needs domain publishers
**Dimension**: [31-workflow-orchestration.md](dimensions/31-workflow-orchestration.md)
**Priority**: MEDIUM (operational but needs expansion)

---

## Significant Gaps (SHOULD ADDRESS)

### 5. Compliance Aggregation Uses Mocks

**What's wrong**:
- `MockDomainClient` always returns `status: 'compliant'`
- Real domain compliance endpoints may not exist
- False confidence in compliance status

**Impact**: Cannot actually assess entity compliance across domains.

**To fix**: Implement real `DomainComplianceClient` that calls domain endpoints.

---

### 6. IP Deadline Management Incomplete

**What's missing**:
- No patent maintenance fee tracking
- No trademark Section 8/9 filing tracking
- No PCT deadline tracking
- Mission states "100% deadline compliance" but infrastructure gaps exist

**Research identifies** (from IP research docs):
- Patent maintenance fees at 3.5, 7.5, 11.5 years with grace periods
- Trademark declarations at years 5-6 and 9-10
- PCT national entry at 30-31 months

**Dimension**: [15-ip-overview.md](dimensions/15-ip-overview.md)

---

### 7. Routes Bypass CQRS Handlers (IP Domain)

**What's wrong**:
- IP domain has well-architected CQRS with command/query handlers
- API routes create repositories directly, not using handlers
- Events might not be published
- Validation duplicated

```typescript
// Current (wrong)
app.post('/', async (c) => {
  const repository = new PatentRepository(db);
  // ...
});

// Should be
app.post('/', async (c) => {
  const handler = new PatentCommandHandler(repository, eventPublisher);
  // ...
});
```

**Dimension**: [40-cqrs-ip-domain.md](dimensions/40-cqrs-ip-domain.md)

---

### 8. Authorization Model Not Implemented

**What's missing**:
- Gateway has no authentication/authorization middleware
- Entity-level permissions documented but not enforced
- Cross-operational queries assume caller is authorized

**Mentioned in**:
- ARCHITECTURE.md: `OperationalPermission` interface
- Gateway README: No auth section

**Impact**: Security vulnerability - any caller can access any entity's data.

---

### 9. No Tests Anywhere

**What's missing**:
- Vitest configured in contracts-legal
- Zero test files found in any domain
- No integration tests for cross-domain flows
- No contract tests between services

**Impact**:
- No regression protection
- No documentation-as-tests
- Refactoring is risky

---

## Knowledge Gaps (SHOULD RESEARCH)

### 10. contract-lifecycle Subdomain Stub

contracts-legal has 8 subdomains listed. `contract-lifecycle` is a stub with only constants exported.

**Questions**:
- What was intended to go here?
- Is it cross-cutting lifecycle operations?
- Should it be removed or implemented?

---

### 11. Research Recommendations Not Implemented

Both contracts-legal and IP have research documents with specific Prisma schema improvements:

**contracts-legal research gaps**:
- E-signature legal requirements (doc 01)
- Jurisdiction vs governing law (doc 02)
- Force majeure clauses (doc 07)
- Material breach tracking (doc 08)

**IP research gaps**:
- Patent families and continuations (doc 01)
- PCT workflow (doc 02)
- Maintenance fees (doc 03)
- FRAND licensing (doc 07)

These are actionable specifications, not vague ideas.

---

### 12. Report Distribution Not Implemented

**What's missing**:
- Reporting service generates reports
- TODO: "Handle distribution (email, slack, webhook)"
- Scheduled reports generate but go nowhere

---

## Gap Closure Tracking

| Gap | Severity | Status | Dimension | Closed Date |
|-----|----------|--------|-----------|-------------|
| Data-privacy domain | CRITICAL | **MVP Complete** | 25 | 2026-01-27 |
| Insurance domain | CRITICAL | Open | 20 | - |
| Trade Secret entity | HIGH | Open | 15 | - |
| Message queue | HIGH | **Connected** | 31 | 2026-01-27 |
| Compliance mocks | HIGH | Partial (data-privacy has real endpoint) | 31 | - |
| IP deadlines | HIGH | Open | 15 | - |
| CQRS route wiring | MEDIUM | Open | 40 | - |
| Authorization | MEDIUM | Open | 30 | - |
| Testing | MEDIUM | Open | - | - |
| contract-lifecycle | LOW | Open | 10 | - |
| Research impl | LOW | Open | - | - |
| Report distribution | LOW | Open | 31 | - |

---

## How to Close a Gap

1. **Explore**: Use `/deep-understand` on the relevant area
2. **Document**: Create or update a dimension file in `dimensions/`
3. **Update Coverage**: Modify `coverage-map.md`
4. **Mark Closed**: Update the tracking table above
5. **Note Curiosities**: Add any new questions to `curiosities.md`

---

*"The only true wisdom is in knowing you know nothing." — Socrates*
