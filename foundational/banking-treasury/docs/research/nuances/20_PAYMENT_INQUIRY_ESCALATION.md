# Payment Inquiry & Escalation Nuances

## Overview

When payments don't arrive as expected, the investigation process is rarely documented. Understanding MT199 communications, escalation pathways, and the transition to ISO 20022 exception handling is essential for efficient payment operations.

---

## The Problem Most Research Ignores

Standard documentation covers payment initiation but ignores:
- **Investigation request protocols** (MT199, MT199)
- **Escalation pathways** within and across banks
- **Response time expectations** by inquiry type
- **ISO 20022 migration** impact on investigations
- **Fraud vs. operational** inquiry differentiation
- **Documentation requirements** for inquiries

---

## Current State: MT199 Dominance

### What MT199 Is

> "Today, the MT199, a free-text message, is used for everything from payment tracing to casual inquiries. It's a catch-all. Banks send an MT199 whenever they need to ask about a payment issue, confirm details, or just check in."

**Source**: [Red Compass Labs ISO 20022 E&I](https://www.redcompasslabs.com/insights/iso-20022-exceptions-and-investigations-ei/)

### The Problem

| Issue | Impact |
|-------|--------|
| **Unstructured text** | 70%+ of E&I messages are free-form |
| **Manual processing** | Average 5-10 manual interventions per case |
| **Language barriers** | Cross-border communication challenges |
| **Error-prone** | High risk of misinterpretation |
| **Slow resolution** | Days to weeks for complex cases |

**Source**: [SWIFT E&I Guidelines](https://www.swift.com/sites/default/files/documents/swift_pmpg_guidelines_exceptionsandinvestigations.pdf)

---

## Types of Payment Inquiries

### Classification Framework

| Type | Urgency | Response Expectation |
|------|---------|---------------------|
| **Fraud/compliance** | Critical | Daily status updates |
| **Regulatory** | High | Same-day acknowledgment |
| **Missing payment** | Medium | 24-48 hours initial response |
| **Discrepancy** | Medium | 48-72 hours |
| **Information request** | Low | 3-5 business days |

### Inquiry Prioritization

> "Today in many cases inquiries are treated on a first in first out basis. However, the increase in regulatory related inquiries and the desire to improve fraud detection require some inquiry types to be treated with higher priority."

**Key Point**: Fraud and compliance cases should bypass normal queue.

---

## MT199 Communication Best Practices

### Current Approach (Until ISO 20022 Transition)

| Element | Best Practice |
|---------|---------------|
| **Reference** | Include UETR for gpi payments |
| **Description** | Clear, factual, specific |
| **Request** | Explicit action requested |
| **Deadline** | State required response time |
| **Contact** | Direct contact for follow-up |

### Example MT199 Structure

```
:20: Reference
:21: Related Reference (original payment)
:79: Narrative

REQUEST TYPE: TRACE
UETR: [unique end-to-end reference]
ORIGINAL PAYMENT: [date, amount, parties]

ISSUE: Payment not received by beneficiary as of [date]

REQUESTED ACTION: Please confirm current status and
expected credit date.

RESPONSE DEADLINE: [date]

CONTACT: [name, email, phone]
```

---

## ISO 20022 Transition (2025-2027)

### Timeline

| Date | Milestone |
|------|-----------|
| **November 2025** | Inflow translation available (camt.110 to MT199) |
| **November 2026** | All institutions receive camt.110 via Case Management |
| **November 2027** | Mandatory ISO 20022 only (camt.110/111) |

### New Message Types

| Message | Purpose |
|---------|---------|
| **camt.110** | Investigation request |
| **camt.111** | Investigation response |
| **camt.029** | Resolution status |
| **camt.056** | Cancellation request |
| **camt.087** | Claim request |

### Benefits of Structured Messaging

| Benefit | Impact |
|---------|--------|
| **Machine-readable** | Automation-ready |
| **Standardized fields** | Consistent interpretation |
| **Faster routing** | Automatic categorization |
| **Better analytics** | Pattern identification |
| **Reduced errors** | No free-text ambiguity |

**Source**: [J.P. Morgan ISO 20022 FAQ](https://www.jpmorgan.com/insights/payments/fx-cross-border/iso-20022-faqs)

---

## Bank Communication Channels

### J.P. Morgan Approach

> "While J.P. Morgan supports the effort to evolve inquiry processing to structured messaging via Swift's centralized service capability, they anticipate it will take significant time to evolve away from the MTn99 series."

> "The current mode of communication will remain unchanged. J.P. Morgan will continue to contact clients through existing channels, such as email or MT199."

### Channel Selection

| Situation | Recommended Channel |
|-----------|---------------------|
| **Routine inquiry** | Email, online portal |
| **Urgent/fraud** | Phone + MT199 |
| **gpi payment** | gpi Tracker + MT199 |
| **Formal investigation** | MT199 (formal record) |
| **Status update** | Online portal |

---

## Escalation Pathways

### Internal Escalation

```
Level 1: Operations Team
│        (First response, 24 hours)
│
├──> Resolved → Close
│
├──> Unresolved → Level 2
         │
Level 2: Operations Manager
│        (48 hours)
│
├──> Resolved → Close
│
├──> Unresolved → Level 3
         │
Level 3: Relationship Manager
│        (72 hours)
│
├──> Resolved → Close
│
├──> Unresolved → Level 4
         │
Level 4: Bank Management
         (Formal escalation)
```

### External Escalation

| Step | Action | Timing |
|------|--------|--------|
| **1** | Standard inquiry via MT199 | Day 0 |
| **2** | Follow-up if no response | Day 3 |
| **3** | Escalate to RM | Day 5 |
| **4** | Formal complaint | Day 10 |
| **5** | Regulatory complaint | Day 30+ |

---

## SWIFT Case Management

### gpi Stop & Recall Service

> "Swift's gSRP (gpi Stop & Recall Product) relies on the use of the MT192 with code words to facilitate the cancellation of payments."

### Traceability Window

- **Standard inquiries**: 124 days from payment date
- **Fraud cases**: Expedited handling, longer retention
- **Regulatory**: As required by regulation

### Status Tracking

| Status | Meaning |
|--------|---------|
| **ACSP** | Being processed |
| **PDNG** | Pending |
| **RJCT** | Rejected |
| **CNCL** | Cancelled |
| **ACSC** | Accepted and settled |

**Source**: [SWIFT Case Management](https://www.swift.com/news-events/news/cracking-case-how-were-simplifying-payment-exceptions-and-investigations)

---

## Documentation Requirements

### What to Document

| Element | Importance |
|---------|------------|
| **Inquiry timestamp** | Audit trail |
| **All communications** | Evidence of efforts |
| **Actions taken** | Due diligence proof |
| **Response times** | SLA tracking |
| **Resolution** | Closure documentation |

### Retention Requirements

| Jurisdiction | Retention Period |
|--------------|------------------|
| **US (BSA)** | 5 years |
| **EU (AML)** | 5 years after relationship ends |
| **UK** | 5 years |
| **SWIFT records** | 124 days in gpi Tracker |

---

## Fraud vs. Operational Inquiries

### Key Differences

| Aspect | Fraud | Operational |
|--------|-------|-------------|
| **Urgency** | Critical | Standard |
| **Escalation** | Immediate | Normal process |
| **Documentation** | Enhanced | Standard |
| **Regulatory notification** | May be required | Rarely |
| **Status updates** | Daily | As needed |

### Fraud Inquiry Protocol

> "For fraud and compliance related cases a status update message should be sent daily."

**Source**: [SWIFT E&I Guidelines](https://www.swift.com/sites/default/files/documents/swift_pmpg_guidelines_exceptionsandinvestigations.pdf)

---

## Response Time Expectations

### Industry Standards

| Inquiry Type | Initial Response | Resolution Target |
|--------------|------------------|-------------------|
| **Fraud/AML** | Same day | 24-48 hours |
| **Missing payment** | 24 hours | 3-5 business days |
| **Discrepancy** | 48 hours | 5-10 business days |
| **Information** | 72 hours | 10-15 business days |

### Measurement Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **First response time** | < 24 hours | > 48 hours |
| **Average resolution time** | < 5 days | > 10 days |
| **Escalation rate** | < 20% | > 30% |
| **Reopened cases** | < 5% | > 10% |

---

## System Design Implications

### Required Capabilities

1. **Inquiry ticket system** with categorization
2. **MT199/ISO 20022 message generation**
3. **gpi Tracker integration** for SWIFT payments
4. **Escalation workflow** with SLA tracking
5. **Document management** for evidence retention
6. **Reporting** on inquiry patterns and resolution
7. **Bank contact database** with escalation paths

### Data Model Considerations

```
PaymentInquiry {
  inquiry_id: string
  payment_id: string
  inquiry_type: enum [TRACE, DISCREPANCY, FRAUD, COMPLIANCE, INFO]
  priority: enum [CRITICAL, HIGH, MEDIUM, LOW]
  status: enum [OPEN, PENDING_RESPONSE, ESCALATED, RESOLVED]
  created_at: datetime
  sla_deadline: datetime
  escalation_level: number
  communications: Communication[]
  resolution: Resolution?
}

Communication {
  timestamp: datetime
  direction: enum [OUTBOUND, INBOUND]
  channel: enum [MT199, EMAIL, PHONE, PORTAL, CAMT]
  counterparty: string
  message_reference: string
  content_summary: string
  response_required: boolean
  response_deadline: datetime?
}

Resolution {
  resolved_at: datetime
  outcome: enum [PAYMENT_CONFIRMED, PAYMENT_RETURNED, PAYMENT_REISSUED, INFO_PROVIDED, FRAUD_CONFIRMED]
  resolution_notes: string
  root_cause: string
  prevented_future: boolean
}
```

---

## Key Sources

- [SWIFT E&I Guidelines](https://www.swift.com/sites/default/files/documents/swift_pmpg_guidelines_exceptionsandinvestigations.pdf)
- [SWIFT Case Management Simplification](https://www.swift.com/news-events/news/cracking-case-how-were-simplifying-payment-exceptions-and-investigations)
- [Red Compass Labs ISO 20022 E&I](https://www.redcompasslabs.com/insights/iso-20022-exceptions-and-investigations-ei/)
- [J.P. Morgan ISO 20022 FAQ](https://www.jpmorgan.com/insights/payments/fx-cross-border/iso-20022-faqs)

---

*Research Date: January 2026*
*Gap Addressed: Investigation and escalation procedures absent from payment rail documentation*
