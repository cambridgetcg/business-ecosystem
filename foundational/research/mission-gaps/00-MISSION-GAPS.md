# Mission-Critical Understanding Gaps

> Analysis of knowledge gaps that would block successful implementation of the foundational layer's mission and purpose.

## Mission Statement

The foundational layer exists to provide **"what the business IS"**:
- Legal structure (entity-governance)
- Financial foundation (accounting)
- Cash management (banking-treasury)
- Tax compliance (tax)
- Regulatory compliance (compliance)
- Identity verification (kyc-identity)
- Access control (corporate-security)

**Success Criteria** (from Implementation Plan):
- Zero entity-related errors across the ecosystem
- Financial statements producible at any time with full confidence
- No payment failures, reconciliation gaps, or liquidity surprises
- 100% regulatory compliance for entity filings, tax, and AML

## Gap Analysis Methodology

This analysis identifies knowledge gaps by comparing:
1. **What the mission requires** (operational capability)
2. **What current research covers** (documented knowledge)
3. **What implementation needs** (operational HOW, not just conceptual WHAT)

## Gap Categories

### Category 1: Operational "HOW" Gaps
We know WHAT needs to happen but not HOW to operationally implement it.

### Category 2: Edge Case Gaps
Scenarios that will occur but aren't covered - will cause implementation failures.

### Category 3: Technical Integration Gaps
How systems connect, event flows, failure handling not specified.

### Category 4: Compliance Procedure Gaps
Step-by-step regulatory processes not documented.

### Category 5: Industry Standard Gaps
Technical standards and best practices not researched.

### Category 6: Regulatory Change Gaps
Recent/pending regulatory changes not incorporated.

---

## Gap Summary Matrix

| # | Gap | Category | Severity | Blocks Phase | Document |
|---|-----|----------|----------|--------------|----------|
| 01 | Transfer Pricing Operational Mechanics | Operational HOW | CRITICAL | Phase 2, 4 | [01-transfer-pricing-operations.md](./01-transfer-pricing-operations.md) |
| 02 | Cash Pool Interest Calculations | Operational HOW | CRITICAL | Phase 3 | [02-cash-pool-operations.md](./02-cash-pool-operations.md) |
| 03 | Banking De-Risking Response | Operational HOW | HIGH | Phase 3 | [03-derisking-procedures.md](./03-derisking-procedures.md) |
| 04 | BaaS Failure Recovery | Operational HOW | HIGH | Phase 3 | [04-baas-recovery-procedures.md](./04-baas-recovery-procedures.md) |
| 05 | CFC Mid-Year Status Changes | Edge Cases | CRITICAL | Phase 4 | [05-cfc-midyear-changes.md](./05-cfc-midyear-changes.md) |
| 06 | 409A Valuation Triggers | Edge Cases | HIGH | Phase 1 | [06-409a-trigger-procedures.md](./06-409a-trigger-procedures.md) |
| 07 | Cross-Domain Event Choreography | Integration | HIGH | Phase 0, 6 | [07-event-choreography.md](./07-event-choreography.md) |
| 08 | Multi-Jurisdiction Conflict Resolution | Integration | HIGH | Phase 1, 4 | [08-jurisdiction-conflict-resolution.md](./08-jurisdiction-conflict-resolution.md) |
| 09 | Accounting-Banking Reconciliation | Integration | HIGH | Phase 2, 3 | [09-reconciliation-procedures.md](./09-reconciliation-procedures.md) |
| 10 | State Tax Nexus Procedures | Compliance | MEDIUM | Phase 4 | [10-state-tax-nexus.md](./10-state-tax-nexus.md) |
| 11 | Audit Trail Completeness | Standards | MEDIUM | Phase 2 | [11-audit-trail-standards.md](./11-audit-trail-standards.md) |
| 12 | FDIC Synapse Rule Compliance | Regulatory | CRITICAL | Phase 3 | [12-fdic-synapse-rule.md](./12-fdic-synapse-rule.md) |

---

## Implementation Impact Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              IMPLEMENTATION PHASES vs BLOCKING GAPS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 0: Foundation & Shared Contracts                                    │
│  ├─ BLOCKED BY: Event choreography (Gap #07)                               │
│  └─ Status: Cannot start without understanding event ordering              │
│                                                                             │
│  PHASE 1: Entity Governance Completion                                     │
│  ├─ BLOCKED BY: 409A triggers (Gap #06)                                    │
│  ├─ BLOCKED BY: Jurisdiction conflict resolution (Gap #08)                 │
│  └─ Status: Can start schema, but services need gap research               │
│                                                                             │
│  PHASE 2: Accounting System                                                │
│  ├─ BLOCKED BY: Transfer pricing mechanics (Gap #01)                       │
│  ├─ BLOCKED BY: Audit trail standards (Gap #11)                            │
│  ├─ BLOCKED BY: Reconciliation procedures (Gap #09)                        │
│  └─ Status: Cannot build intercompany without TP procedures                │
│                                                                             │
│  PHASE 3: Banking-Treasury Expansion                                       │
│  ├─ BLOCKED BY: Cash pool operations (Gap #02)                             │
│  ├─ BLOCKED BY: De-risking procedures (Gap #03)                            │
│  ├─ BLOCKED BY: BaaS recovery (Gap #04)                                    │
│  ├─ BLOCKED BY: FDIC Synapse Rule (Gap #12)                                │
│  └─ Status: Cannot operate treasury without procedures                     │
│                                                                             │
│  PHASE 4: Tax Service                                                      │
│  ├─ BLOCKED BY: CFC mid-year changes (Gap #05)                             │
│  ├─ BLOCKED BY: Transfer pricing mechanics (Gap #01)                       │
│  ├─ BLOCKED BY: State nexus procedures (Gap #10)                           │
│  └─ Status: Cannot calculate international tax without gap research        │
│                                                                             │
│  PHASE 5: Compliance Service                                               │
│  ├─ PARTIAL: Can build BOI/CTA with existing research                      │
│  └─ Status: Can proceed with current knowledge                             │
│                                                                             │
│  PHASE 6: Cross-Domain Integration                                         │
│  ├─ BLOCKED BY: All integration gaps (#07, #08, #09)                       │
│  └─ Status: Depends on completing other phases cleanly                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Research Priority Sequence

Based on implementation dependencies, gaps should be researched in this order:

### Priority 1: Must Complete Before Phase 0
1. **Event Choreography** (#07) - Required for all cross-domain communication
2. **Jurisdiction Conflict Resolution** (#08) - Required for entity-centric design

### Priority 2: Must Complete Before Phase 2
3. **Transfer Pricing Operations** (#01) - Required for intercompany accounting
4. **Audit Trail Standards** (#11) - Required for journal entry design

### Priority 3: Must Complete Before Phase 3
5. **Cash Pool Operations** (#02) - Required for treasury automation
6. **De-Risking Procedures** (#03) - Required for banking continuity
7. **BaaS Recovery** (#04) - Required for operational resilience
8. **FDIC Synapse Rule** (#12) - Required for regulatory compliance

### Priority 4: Must Complete Before Phase 4
9. **CFC Mid-Year Changes** (#05) - Required for tax calculations
10. **State Tax Nexus** (#10) - Required for multi-state compliance

### Priority 5: Complete During Implementation
11. **409A Trigger Procedures** (#06) - Can develop alongside Phase 1
12. **Reconciliation Procedures** (#09) - Can develop alongside Phase 2/3

---

## Gap Research Template

Each gap document follows this structure:

```markdown
# Gap Title

## Gap Identification

**Category**: [Operational HOW | Edge Cases | Integration | Compliance | Standards | Regulatory]
**Severity**: [CRITICAL | HIGH | MEDIUM]
**Blocks Implementation Phase(s)**: [List]

## Current State

What we know from existing research...

## What's Missing

Specific knowledge gaps that prevent implementation...

## Research Questions

1. Question 1...
2. Question 2...

## Research Findings

[Populated after research]

## Implementation Implications

How findings affect system design...

## Schema/Code Implications

TypeScript/Python implications...

## Sources

- [Source 1](url)
- [Source 2](url)

---

*Research conducted: [Date]*
*Gap identified in: [Source document]*
```

---

## Related Documentation

- [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) - The plan these gaps block
- [00-UNDERSTANDING-MAP.md](../insights/00-UNDERSTANDING-MAP.md) - Current understanding coverage
- [nuance-gaps/README.md](../nuance-gaps/README.md) - Previous gap analysis

---

*Gap analysis created: January 2026*
*Methodology: Mission-requirement vs current-knowledge comparison*
*Next step: Research each gap and document findings individually*
