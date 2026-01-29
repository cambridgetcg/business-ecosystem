# Payment Failure & Recovery Nuances

## Overview

Payment failures are an operational certainty. The difference between competent and exceptional treasury operations lies in understanding failure modes, reason codes, and recovery procedures. This knowledge is rarely documented but essential for maintaining payment success rates above 99%.

---

## The Problem Most Research Ignores

Provider documentation focuses on happy-path payments. Operational reality involves:
- **2-5% of payments requiring intervention** at scale
- **Multiple failure points** (origination, routing, beneficiary)
- **Varying recovery procedures** by rail and jurisdiction
- **Time-sensitive windows** for recalls and returns
- **Financial and regulatory implications** of failed payments

---

## SWIFT Payment Failure Ecosystem

### SWIFT gpi Status Codes

| Code | Meaning | Action Required |
|------|---------|-----------------|
| **ACSP** | Being settled | Monitor progress |
| **PDNG** | Pending | Investigate if prolonged |
| **ACCT** | Accepted | Continue monitoring |
| **RJCT** | Rejected | Immediate remediation |
| **CNCL** | Cancelled | Confirm funds returned |

### Common Rejection Reason Codes

| Code | Meaning | Typical Resolution |
|------|---------|-------------------|
| **AC04** | Account closed | Verify beneficiary details, resend |
| **AM04** | Insufficient funds | Fund source account, retry |
| **BE04** | Missing creditor address | Add address, resubmit |
| **RC01** | Bank identifier incorrect | Correct SWIFT/BIC, retry |
| **ARDT** | Already returned | No action - funds en route back |
| **NOAS** | No response from beneficiary | Escalate via MT199 |
| **NOOR** | Original never received | Trace payment, resubmit |
| **PTNA** | Passed to next agent | Monitor downstream chain |

**Source**: [Tommivuori SWIFT GPI Status Codes](https://tommivuori.com/blog/swift-gpi-status-codes-a-1761869920952)

---

## SWIFT Stop & Recall Procedure

### When to Use

1. **Fraud detected** post-submission
2. **Duplicate payment** identified
3. **Incorrect beneficiary** details discovered
4. **Amount error** post-execution

### Process Flow

```
1. Initiate Stop & Recall via Swift gpi portal
        │
        ├──> MT192 sent with cancellation code words
        │
        ├──> Payment automatically stopped in-flight
        │
        ├──> All banks in chain notified via Tracker
        │
        ▼
2. Await Response (varies by stage)
        │
        ├──> If funds not yet credited: Immediate stop
        │
        ├──> If funds credited: Request return (not guaranteed)
        │
        ▼
3. Funds Return (if approved)
        │
        └──> Returned via original payment chain
```

### Key Limitations

- **Traceability window**: 124 days from payment date
- **No guarantee of return** once funds credited to beneficiary
- **Requires cooperation** from all banks in chain
- **Daily fraud status updates** expected for compliance cases

**Source**: [Karboncard SWIFT Reversal](https://www.karboncard.com/blog/can-swift-transfer-be-reversed)

---

## Common Failure Causes by Category

### 1. Data Quality Issues (Most Common)

| Issue | Frequency | Prevention |
|-------|-----------|------------|
| **Wrong account number** | High | Pre-validation, confirmation |
| **Incorrect SWIFT/BIC** | High | BIC directory lookup |
| **Name mismatch** | Medium | Exact match verification |
| **Missing address** | Medium | Structured data enforcement |

### 2. Compliance-Related Rejections

| Issue | Impact | Resolution Time |
|-------|--------|-----------------|
| **Sanctions hit** | Payment blocked | 24-72 hours (with docs) |
| **AML screening flag** | Manual review required | 24-48 hours |
| **Missing purpose code** | Returned | Same-day resend |
| **Regulatory restriction** | May be permanent | Varies by jurisdiction |

### 3. Technical/Operational Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| **Routing error** | Incorrect intermediary | Correct routing, retry |
| **Cut-off miss** | Late submission | Next business day processing |
| **System downtime** | Bank/network issue | Retry when available |
| **Format error** | Non-compliant message | Reformat to standards |

**Source**: [GROF Understanding Rejected Wire Transfers](https://grof.co/sg/blog/why-bank-rejected-wire-transfer)

---

## Regional Failure Nuances

### United States

| Rail | Failure Handling | Return Timeline |
|------|-----------------|-----------------|
| **Fedwire** | Real-time rejection | Immediate |
| **ACH** | Return within 2 days (most) | 2-60 days depending on reason |
| **Same-Day ACH** | Same-day return possible | Same day to 2 days |

**ACH Return Codes (Common)**:
- R01: Insufficient funds
- R02: Account closed
- R03: No account/unable to locate
- R04: Invalid account number
- R10: Customer advises unauthorized

### Europe (SEPA)

| Issue | Timeline |
|-------|----------|
| **Immediate rejection** | Before settlement |
| **Return** | Up to 13 months (consumer dispute) |
| **Recall** | Up to 10 business days |

### UK (Faster Payments)

- Returns typically within 24-48 hours
- Some returns possible up to 13 months for unauthorized transactions

---

## Stablecoin Payment Finality

### Critical Difference from Traditional Rails

**Stablecoin transactions are generally IRREVERSIBLE.**

| Aspect | Traditional | Stablecoin |
|--------|-------------|------------|
| **Reversibility** | Possible (with cooperation) | Generally impossible |
| **Recall window** | Hours to days | None (once confirmed) |
| **Fraud recovery** | Bank assistance available | On-chain only (freeze by issuer) |
| **Dispute resolution** | Established procedures | Limited recourse |

### USDC Issuer Controls

Under the GENIUS Act (2025), issuers must:
- **Freeze** tokens if required by law
- **Burn** tokens in specific circumstances
- **Prevent transfer** for compliance reasons

**However**: This requires issuer action, not sender-initiated recall.

### Circle's Reversibility Exploration

Circle is examining mechanisms for reversible transactions:
- **Fraud/hack recovery** scenarios
- **Maintaining settlement finality** while allowing rollback
- **Controversial in crypto community** (challenges decentralization)

**Source**: [Cointelegraph Circle Reversible Transactions](https://cointelegraph.com/news/circle-examines-reversible-stablecoin-transactions)

---

## Recovery Procedure Framework

### Immediate Actions (0-4 hours)

1. **Identify failure type** from status/reason codes
2. **Determine if funds are in-flight** or returned
3. **Assess urgency** (fraud, time-sensitive, routine)
4. **Initiate appropriate channel** (gpi recall, bank contact, MT199)

### Short-Term Actions (4-24 hours)

1. **Document all actions** for audit trail
2. **Communicate with beneficiary** if appropriate
3. **Prepare corrected payment** if data issue
4. **Escalate if no response** from intermediaries

### Medium-Term Actions (1-7 days)

1. **Follow up on pending recalls**
2. **Track funds location** via gpi Tracker
3. **Coordinate with compliance** if regulatory issue
4. **Update beneficiary master data** to prevent recurrence

---

## Operational Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Payment success rate** | > 99.5% | < 99% |
| **First-time resolution rate** | > 95% | < 90% |
| **Average resolution time** | < 24 hours | > 48 hours |
| **Recall success rate** | > 80% | < 70% |
| **Repeat failure rate** | < 0.1% | > 0.5% |

---

## System Design Implications

### Required Capabilities

1. **Real-time status monitoring** for all payment rails
2. **Automated reason code parsing** and categorization
3. **Escalation workflow engine** with SLA tracking
4. **Recall/return initiation** via API where available
5. **Root cause analysis** for failure patterns
6. **Beneficiary data quality scoring**

### Data Model Considerations

```
PaymentFailure {
  payment_id: string
  failure_timestamp: datetime
  status_code: string
  reason_code: string
  reason_description: string
  failure_stage: enum [ORIGINATION, ROUTING, BENEFICIARY, COMPLIANCE]
  recovery_action: enum [RETRY, RECALL, CORRECT_RESEND, ESCALATE, CLOSE]
  resolution_timestamp: datetime
  funds_location: string  // Where are funds currently?
  root_cause_category: string
}
```

---

## Key Sources

- [SWIFT Best Practice Guidance for Returns](https://www.swift.com/swift-resource/252097/download)
- [SWIFT Cancellation Guidelines](https://www.swift.com/swift-resource/138921/download)
- [CurrencyCloud Payment Investigations FAQ](https://support.currencycloud.com/hc/en-gb/articles/9717671289500-Payment-Investigations-FAQ)
- [TangoPay Failed Transfer Guide](https://tangopay.co.uk/blogs/if-international-bank-transfer-failed)

---

*Research Date: January 2026*
*Gap Addressed: Failure mode handling absent from standard provider documentation*
