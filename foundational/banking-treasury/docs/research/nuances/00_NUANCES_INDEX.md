# Operational Nuances Research Index

## Overview

This collection addresses the gap between theoretical banking/treasury knowledge and operational execution capability. While the primary research documents (01-09) cover "what providers exist," these nuance documents cover "how things actually work in practice."

---

## The Gap Model

```
PROVIDER DOCUMENTATION          GAP              OPERATIONAL REALITY
┌─────────────────────┐                        ┌─────────────────────┐
│ What features exist │ ────────────────────── │ How to actually use │
│ What rails are      │                        │ What happens when   │
│ available           │                        │ things fail         │
│ What providers      │                        │ How to negotiate    │
│ offer               │                        │ When to escalate    │
└─────────────────────┘                        └─────────────────────┘
                        ↑
                        │
                  NUANCE RESEARCH
                  Fills this gap
```

---

## Document Index

### Timing & Operations

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [10_PAYMENT_TIMING_CUTOFFS.md](./10_PAYMENT_TIMING_CUTOFFS.md) | Cut-off times, settlement windows | Bank-specific deadlines, STP vs non-STP, holiday calendars |
| [18_PAYMENT_FLOAT_OPTIMIZATION.md](./18_PAYMENT_FLOAT_OPTIMIZATION.md) | Float management, working capital | Strategic timing, ZBA, controlled disbursement |

### Failure & Recovery

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [11_PAYMENT_FAILURE_RECOVERY.md](./11_PAYMENT_FAILURE_RECOVERY.md) | Failure modes, recovery | SWIFT gpi codes, recall procedures, stablecoin finality |
| [20_PAYMENT_INQUIRY_ESCALATION.md](./20_PAYMENT_INQUIRY_ESCALATION.md) | Investigations, escalation | MT199 protocols, ISO 20022 transition, response times |

### Multi-Entity Complexity

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [12_INTERCOMPANY_SETTLEMENT.md](./12_INTERCOMPANY_SETTLEMENT.md) | Cash pooling, netting | Transfer pricing, thin cap, BEPS, country restrictions |

### Currency & FX

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [13_FX_EXECUTION_TIMING.md](./13_FX_EXECUTION_TIMING.md) | FX exposure, hedging timing | Execution windows, settlement mismatch, natural hedging |

### Relationship & Negotiation

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [14_BANK_RELATIONSHIP_DYNAMICS.md](./14_BANK_RELATIONSHIP_DYNAMICS.md) | Bank negotiations, relationships | RAROC, BATNA, covenant management, crisis communication |

### Reconciliation

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [15_RECONCILIATION_EDGE_CASES.md](./15_RECONCILIATION_EDGE_CASES.md) | Matching complexity | Partial matches, timing differences, FX variances |

### Compliance Operations

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [16_SAR_COMPLIANCE_OPERATIONS.md](./16_SAR_COMPLIANCE_OPERATIONS.md) | AML operational decisions | Filing thresholds, false positives, 2025 FinCEN guidance |

### Stress & Crisis

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [17_LIQUIDITY_STRESS_MANAGEMENT.md](./17_LIQUIDITY_STRESS_MANAGEMENT.md) | Crisis management | Credit facility draws, pool unwinding, emergency funding |

### Orchestration

| Document | Focus | Key Nuances |
|----------|-------|-------------|
| [19_MULTI_RAIL_ORCHESTRATION.md](./19_MULTI_RAIL_ORCHESTRATION.md) | Dynamic routing | AI-driven selection, failover, stablecoin integration |

---

## Knowledge Framework

### From KNOWS to ENABLED

| Level | Original Research (01-09) | Nuance Research (10-20) |
|-------|---------------------------|------------------------|
| **INFORMED** | What providers exist | - |
| **KNOWS** | How products compare | - |
| **UNDERSTANDS** | Why to choose options | How things actually work |
| **ENABLED** | - | Can execute operations |

### Use Case Mapping

| Scenario | Primary Research | Nuance Research |
|----------|------------------|-----------------|
| "Which bank should we use?" | 01, 02, 04 | 14 (negotiation) |
| "Payment didn't arrive" | 05, 06 | 11, 20 (recovery, escalation) |
| "Setting up cash pool" | 08 | 12 (tax/regulatory nuances) |
| "FX hedge timing" | 06 | 13 (execution nuances) |
| "Reconciliation failing" | - | 15 (edge cases) |
| "AML alert triggered" | 09 | 16 (operational decisions) |
| "Credit facility draw" | - | 17 (stress procedures) |
| "Route optimization" | 05, 06 | 19 (orchestration logic) |

---

## Research Methodology

### Sources

| Source Type | Examples | Value |
|-------------|----------|-------|
| **Regulatory guidance** | FinCEN, FCA, SWIFT | Authoritative requirements |
| **Industry research** | McKinsey, PwC, Moody's | Market trends and statistics |
| **Provider documentation** | J.P. Morgan, Stripe, Circle | Implementation details |
| **Trade publications** | PYMNTS, Treasury Management International | Practitioner perspectives |
| **Market data** | BIS, Federal Reserve | Quantitative evidence |

### Gap Identification Process

1. **Read existing research** (01-09)
2. **Identify what's missing** ("What questions aren't answered?")
3. **Search for operational nuances** (How does X actually work?)
4. **Document findings** with sources
5. **Extract system implications** (What does this mean for implementation?)

---

## System Design Implications Summary

### Data Model Additions Needed

| From Document | New Entities |
|---------------|-------------|
| 10 (Timing) | PaymentWindow, HolidayCalendar |
| 11 (Failure) | PaymentFailure, RecoveryAction |
| 12 (Intercompany) | IntercompanyAgreement, ThinCapMonitor |
| 13 (FX) | FXExposure, HedgePolicy |
| 14 (Bank Relations) | BankRelationship, BankPerformance |
| 15 (Reconciliation) | ReconciliationRule, ReconciliationException |
| 16 (SAR) | AMLAlert, SARFiling |
| 17 (Liquidity) | CreditFacility, LiquidityStressScenario |
| 18 (Float) | PaymentSchedulingRule, FloatPerformance |
| 19 (Orchestration) | PaymentRail, RoutingDecision |
| 20 (Inquiry) | PaymentInquiry, Communication |

### Capability Requirements

| Category | Required Capabilities |
|----------|----------------------|
| **Timing** | Cut-off monitoring, holiday calendars, STP tracking |
| **Recovery** | Status monitoring, recall initiation, escalation workflow |
| **Intercompany** | Netting engine, arm's length rate calculation, thin cap monitoring |
| **FX** | Exposure aggregation, hedge accounting, execution window tracking |
| **Relationships** | Fee tracking, covenant monitoring, performance benchmarking |
| **Reconciliation** | Multi-criteria matching, tolerance configuration, exception workflow |
| **Compliance** | Alert management, SAR preparation, decision documentation |
| **Liquidity** | Facility tracking, stress modeling, alert engine |
| **Float** | Payment scheduling, rail selection, discount analysis |
| **Orchestration** | Dynamic routing, failover automation, analytics |
| **Inquiry** | Ticket management, MT199/ISO 20022 generation, SLA tracking |

---

## Maintenance Schedule

| Activity | Frequency | Trigger |
|----------|-----------|---------|
| **Review all nuance docs** | Quarterly | Calendar |
| **Update regulatory changes** | As needed | Regulatory announcement |
| **Validate market data** | Semi-annually | Market shifts |
| **Test operational procedures** | Annually | Audit requirement |

---

## Contributing

When adding new nuance research:

1. **Identify the gap** - What operational question isn't answered?
2. **Search authoritative sources** - Regulatory, industry, provider
3. **Document with citations** - Every claim needs a source
4. **Extract system implications** - How does this affect implementation?
5. **Update this index** - Add new document to appropriate category

---

*Research Date: January 2026*
*Methodology: Gap analysis of existing research + targeted web research*
*Purpose: Bridge theoretical knowledge and operational execution capability*
