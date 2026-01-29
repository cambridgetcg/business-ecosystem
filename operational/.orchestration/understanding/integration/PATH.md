# PATH: Charted vs Uncharted Territories

Map of where patterns exist (charted) vs where new paths must be built (uncharted).

---

## Territory Assessment Legend

| Symbol | Status | Meaning |
|--------|--------|---------|
| `[C]` | Charted | Clear patterns exist, follow them |
| `[P]` | Partially Charted | Patterns exist but need extension |
| `[U]` | Uncharted | No existing pattern, must build path first |

---

## Domain Implementation

### Contracts-Legal Domain
| Area | Status | Notes |
|------|--------|-------|
| Customer contracts | [C] | Full implementation exists |
| Vendor contracts | [C] | Similar to customer |
| Employment agreements | [C] | Implementation exists |
| Contract templates | [C] | Implementation exists |
| Litigation matters | [P] | Exists but discovery models missing |
| Real estate | [C] | Implementation exists |
| Legal operations | [C] | Audit, notifications implemented |
| E-signature ceremony | [U] | Research exists, no implementation |
| Revenue recognition | [U] | Research exists, no models |
| Force majeure | [U] | Research exists, no models |
| Amendment workflow | [U] | Types exist but no differentiation logic |

### Intellectual Property Domain
| Area | Status | Notes |
|------|--------|-------|
| Patent aggregate | [C] | Full DDD implementation |
| Trademark aggregate | [C] | Full DDD implementation |
| Copyright aggregate | [C] | Full implementation |
| License aggregate | [C] | Full implementation |
| Patent families | [U] | Research exists, no models |
| Maintenance fees | [U] | Research exists, no models |
| Trade secrets | [U] | **Critical gap** - no entity at all |
| PCT workflow | [U] | Research exists, no models |
| Madrid international | [U] | Research exists, no models |
| FRAND licensing | [U] | Research exists, no models |

### Data Privacy Domain
| Area | Status | Notes |
|------|--------|-------|
| Consent management | [U] | Documented, not implemented |
| DSAR handling | [U] | Documented, not implemented |
| Breach management | [U] | Documented, not implemented |
| DPIA process | [U] | Documented, not implemented |
| Data inventory | [U] | Documented, not implemented |
| Cross-border transfer | [U] | Documented, not implemented |
| Vendor privacy | [U] | Documented, not implemented |
| Privacy program | [U] | Documented, not implemented |

**Note**: Data privacy is entirely uncharted in implementation. However, contracts-legal and IP provide patterns to follow.

### Insurance Domain
| Area | Status | Notes |
|------|--------|-------|
| Policy management | [U] | Documented, not implemented |
| Claims management | [U] | Documented, not implemented |
| General liability | [U] | Documented, not implemented |
| Professional liability | [U] | Documented, not implemented |
| Property insurance | [U] | Documented, not implemented |
| Workers compensation | [U] | Documented, not implemented |
| Cyber insurance | [U] | Documented, not implemented |
| Product liability | [U] | Documented, not implemented |
| Carrier integration | [U] | Barely documented |
| Broker integration | [U] | Barely documented |

**Note**: Insurance is entirely uncharted in implementation. Patterns from contracts-legal are relevant.

---

## Cross-Domain Patterns

### Orchestration
| Area | Status | Notes |
|------|--------|-------|
| Workflow engine | [C] | Full implementation |
| Workflow definitions | [P] | Entity onboarding exists, others need building |
| Compliance aggregation | [C] | Full implementation |
| Regulatory mappings | [P] | GDPR exists, others need building |
| Reporting service | [C] | Full implementation |
| Report definitions | [P] | Patterns exist, need more reports |
| Gateway aggregation | [C] | Full implementation |
| Health monitoring | [C] | Per-domain health exists |

### Integration Patterns
| Area | Status | Notes |
|------|--------|-------|
| Event publishing | [P] | Pattern clear, queue technology undefined |
| Event subscription | [P] | Pattern clear, implementation varies |
| Cross-domain queries | [C] | Gateway provides unified view |
| Compensation (saga) | [C] | Workflow engine supports it |
| Entity reference | [C] | entityId everywhere |
| Audit trail | [C] | Per-domain audit exists |
| Unified audit | [U] | No cross-domain correlation |
| DSAR across domains | [U] | Not designed |
| Entity dissolution | [U] | Not designed |

---

## Technical Infrastructure

| Area | Status | Notes |
|------|--------|-------|
| Hono framework | [C] | Used consistently |
| Prisma ORM | [C] | Contracts-legal, data-privacy, insurance |
| Drizzle ORM | [C] | IP domain |
| Zod validation | [C] | Universal |
| Pino logging | [C] | Universal |
| Vitest testing | [P] | Framework exists, coverage unclear |
| Message queue | [U] | Referenced but not implemented |
| Service auth | [U] | Service-to-service auth undefined |
| Distributed tracing | [P] | Correlation IDs exist, full tracing unclear |
| Caching strategy | [P] | IP has cache, others may need it |

---

## Path-Building Priorities

### Critical (Must Build Path)

1. **Trade Secret Entity** (IP)
   - Why: Major IP type completely missing
   - Path: Create TradeSecret aggregate following Patent/Trademark patterns
   - Blocks: IP licensing for trade secrets

2. **Data Privacy Implementation** (Privacy)
   - Why: Entire domain is scaffold
   - Path: Follow contracts-legal service-repository pattern
   - Blocks: GDPR compliance

3. **Message Queue Selection** (Infrastructure)
   - Why: Events exist but transport undefined
   - Path: Evaluate RabbitMQ vs SNS+SQS vs Kafka
   - Blocks: Production deployment

### High Priority (Build Soon)

4. **Cross-Domain DSAR** (Integration)
   - Why: GDPR requirement spans all domains
   - Path: Design deletion coordination workflow
   - Dependencies: Data privacy implementation

5. **Insurance Implementation** (Insurance)
   - Why: Entire domain is scaffold
   - Path: Start with policy-management, follow contracts-legal patterns
   - Blocks: Insurance compliance

6. **Entity Dissolution Workflow** (Integration)
   - Why: Major lifecycle event unhandled
   - Path: Define workflow, compensation for each domain
   - Dependencies: Workflow engine (exists)

### Medium Priority (Plan For)

7. **E-Signature Ceremony** (Contracts)
   - Why: Legal requirements not captured
   - Path: Create SignatureEvent model per research
   - Dependencies: Research complete

8. **Patent Families** (IP)
   - Why: Parent-child relationships not tracked
   - Path: Add family models per research
   - Dependencies: Research complete

9. **Service-to-Service Auth** (Infrastructure)
   - Why: Internal API security undefined
   - Path: Implement service accounts or mTLS
   - Dependencies: Auth infrastructure

10. **Unified Audit Trail** (Infrastructure)
    - Why: Cross-domain tracing for investigations
    - Path: Add correlation to audit logs, aggregate view
    - Dependencies: Audit logs exist per domain

---

## Charted Territory Decision Tree

When starting new work:

```
Is this work in an implemented domain?
├── YES: Is there similar existing code?
│   ├── YES → CHARTED: Follow existing pattern
│   └── NO: Does research document exist?
│       ├── YES → PARTIALLY CHARTED: Extend with research guidance
│       └── NO → UNCHARTED: Build understanding first
│
└── NO: Is the domain documented?
    ├── YES → UNCHARTED: Build following other domain patterns
    └── NO → UNCHARTED: Define requirements first
```

---

## Recommendations

### When Entering Charted Territory

1. Read existing implementation first
2. Follow established patterns exactly
3. Reuse validation schemas, error classes
4. Maintain naming conventions
5. Add tests matching existing coverage

### When Entering Partially Charted Territory

1. Read existing implementation
2. Read relevant research documents
3. Identify what exists vs what's needed
4. Extend without breaking existing patterns
5. Update research docs with implementation notes

### When Entering Uncharted Territory

1. **STOP** - Don't implement yet
2. Build understanding first (use /deep-understand)
3. Survey similar patterns in other domains
4. Design the path before coding
5. Get feedback on path design
6. Implement with full verification

---

## Summary Statistics

| Status | Count | Percentage |
|--------|-------|------------|
| Charted [C] | 24 | 35% |
| Partially Charted [P] | 12 | 17% |
| Uncharted [U] | 33 | 48% |

**Key Finding**: Nearly half the ecosystem is uncharted territory. The implemented domains (contracts-legal, IP, orchestration) provide patterns, but significant building remains.
