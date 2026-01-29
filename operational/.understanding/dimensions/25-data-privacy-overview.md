# Dimension 25: Data Privacy Domain

## What

The data-privacy domain manages data protection obligations across GDPR, CCPA, HIPAA, and other privacy regulations. It handles consent management, data subject rights (DSAR), breach notification, privacy impact assessments, and retention policy enforcement.

**Location**: `/data-privacy`
**Port**: 3012
**Framework**: Hono

**CRITICAL STATUS: SKELETON ONLY - COMPLIANCE RISK**

## Why

Privacy compliance is legally mandated with severe penalties:
- GDPR: Up to 4% of annual global revenue for DSAR failures
- CCPA: $7,500 per intentional violation
- 72-hour breach notification requirement under GDPR

The domain exists to:
- Record and manage data subject consent
- Process access, rectification, erasure, and portability requests
- Handle breach detection, investigation, and notification
- Conduct privacy impact assessments before high-risk processing
- Enforce data retention and deletion policies

## How

### Current State: SKELETON ONLY

**README describes**: 8 subdomains with comprehensive privacy capabilities

**Actual implementation**: Health check and service info only

```typescript
// src/index.ts - This is ALL that exists
const app = new Hono();

app.get('/health', (c) => c.json({
  status: 'healthy',
  service: 'data-privacy',
  timestamp: new Date().toISOString(),
}));

app.get('/', (c) => c.json({
  service: 'data-privacy',
  version: '0.1.0',
  description: 'GDPR/CCPA compliance and privacy management',
  domains: [
    'consent-management', 'data-subject-rights', 'data-inventory',
    'privacy-impact', 'breach-management', 'cross-border-transfer',
    'vendor-privacy', 'privacy-program'
  ]
}));
```

### Core Concepts (NOT IMPLEMENTED)

#### ConsentRecord
```typescript
interface ConsentRecord {
  id: string;
  subjectId: string;           // Data subject identifier
  entityId: string;            // Which legal entity collected consent
  purpose: string;             // Processing purpose
  basis: LawfulBasis;          // CONSENT, CONTRACT, LEGAL_OBLIGATION, etc.
  granted: Date;
  withdrawn?: Date;
  expiresAt?: Date;
  proofReference?: string;     // Link to consent capture evidence
}
```

#### DSARRequest Types

| Type | GDPR Article | Deadline | Complexity |
|------|--------------|----------|------------|
| ACCESS | Art. 15 | 30 days | Medium - data aggregation |
| RECTIFICATION | Art. 16 | 30 days | Low - update records |
| ERASURE | Art. 17 | 30 days | High - cascade deletion |
| PORTABILITY | Art. 20 | 30 days | High - structured export |
| RESTRICTION | Art. 18 | 30 days | Medium - processing freeze |
| OBJECTION | Art. 21 | Immediate | Medium - opt-out |

#### Breach Severity Levels

| Severity | Criteria | Response |
|----------|----------|----------|
| LOW | No sensitive data, <100 affected | Internal documentation |
| MEDIUM | Limited sensitive data, <1000 affected | DPO review required |
| HIGH | Sensitive data, >1000 affected | 72h authority notification |
| CRITICAL | Special category data, mass impact | Authority + all individuals |

### Lawful Basis for Processing

| Basis | Requires Explicit Consent |
|-------|---------------------------|
| CONSENT | Yes |
| CONTRACT | No |
| LEGAL_OBLIGATION | No |
| VITAL_INTEREST | No |
| PUBLIC_TASK | No |
| LEGITIMATE_INTEREST | No (but requires assessment) |

## Where

| Component | Path | Status |
|-----------|------|--------|
| Entry Point | `data-privacy/src/index.ts` | Skeleton only |
| README | `data-privacy/README.md` | Documentation exists |
| Prisma Schema | N/A | **Does not exist** |
| API Routes | N/A | **Not implemented** |
| Tests | N/A | **Not implemented** |

## Connections

**Depends On**:
- entity-governance: Every privacy record has an owner entity
- compliance: Privacy status feeds overall compliance scoring
- corporate-security: Breach detection triggers
- auth: User authentication for DSAR identity verification

**Other Domains Depend On data-privacy**:
- ALL domains: Must verify consent before processing personal data
- contracts-legal: DPA (Data Processing Agreement) status checking

**Should Publish Events**:
- `consent.granted`, `consent.withdrawn`, `consent.expired`
- `dsar.submitted`, `dsar.completed`, `dsar.deadline_approaching`
- `breach.detected`, `breach.confirmed`, `breach.authority_notified`
- `pia.required`, `pia.completed`

## Gap Analysis

| Component | Documented | Implemented | Gap Severity |
|-----------|------------|-------------|--------------|
| Consent Management | Yes | No | **CRITICAL** |
| DSAR Handling | Yes | No | **CRITICAL** |
| Breach Notification | Yes | No | **CRITICAL** |
| Privacy Impact Assessment | Yes | No | HIGH |
| Retention Enforcement | Yes | No | HIGH |
| Processing Activity Register | Yes | No | HIGH |
| Prisma Schema | No | No | **CRITICAL** |
| API Routes | Yes | No | **CRITICAL** |
| Compliance Integration | Yes | No | HIGH |

## Compliance Risk Areas

### HIGH RISK
1. **No DSAR Handling**: Failure to respond within 30 days = fines
2. **No Breach Notification**: 72-hour requirement cannot be met
3. **No Consent Records**: Cannot demonstrate lawful basis

### MEDIUM RISK
4. **No Processing Register**: GDPR Article 30 violation
5. **No DPIA Process**: High-risk processing may be prohibited
6. **No Retention Enforcement**: Storage limitation violation

## Open Questions

### Architecture Questions
1. How do we verify a DSAR requestor is the actual data subject?
2. Where does the data mapping/inventory live?
3. How do we coordinate erasure across 10+ domains?
4. What's the SLA for consent propagation across systems?

### Regulatory Questions
5. Is HIPAA in scope? What PHI is processed?
6. Has CCPA been updated for CPRA (2023)?
7. How are cross-border transfers managed post-Privacy Shield?

### Operational Questions
8. Is there a Data Protection Officer? Who receives notifications?
9. How are 30-day DSAR and 72-hour breach deadlines tracked?
10. How do we prove consent was obtained (consent receipts)?

## Comparison to Other Domains

| Domain | Entity Count | Regulatory Risk | Implementation |
|--------|--------------|-----------------|----------------|
| contracts-legal | ~20 | Medium | **Mature** |
| intellectual-property | ~25 | High (deadlines) | Documented |
| **data-privacy** | ~6 | **Very High** | **Skeleton** |
| insurance | ~40+ | High (state regs) | Stub |

**data-privacy has the highest regulatory risk with near-zero implementation**.

## Recommendations

1. **Prioritize consent management and DSAR** - Immediate regulatory exposure
2. **Design database schema** following contracts-legal pattern
3. **Implement compliance integration** - The orchestration layer expects `DomainComplianceClient`
4. **Create DSAR workflow** with identity verification, data aggregation, deadline tracking
5. **Build breach response** with 72-hour countdown, authority notification templates

---

*Understanding Level: GAP*
*Status: Skeleton with significant compliance risk*
*Priority: CRITICAL - regulatory exposure is immediate*
