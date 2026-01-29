# SAR Filing & AML Operational Nuances

## Overview

AML compliance documentation covers regulatory frameworks and provider selection, but operational nuances—when to file, how to document non-filing decisions, handling false positives, and timing considerations—are rarely addressed. These nuances determine whether compliance is a checkbox exercise or actual risk mitigation.

---

## The Problem Most Research Ignores

Standard documentation covers AML requirements but ignores:
- **When to file vs. when to document non-filing**
- **Threshold interpretation** (CTR proximity, structuring)
- **False positive management** at scale
- **Timing of continuing activity reviews**
- **Documentation sufficiency** standards
- **Practical SAR writing** guidelines

---

## 2025 FinCEN Guidance Updates

### October 2025 FAQ Clarifications

Joint guidance from FinCEN, Federal Reserve, FDIC, NCUA, and OCC:

| Clarification | Previous Understanding | New Guidance |
|---------------|------------------------|--------------|
| **CTR threshold proximity** | File SAR if near $10K | NOT required unless structuring suspected |
| **$5K aggregation** | Always file for $5K+ patterns | Only if designed to evade BSA |
| **Continuing activity reviews** | Required every 90 days | NOT mandatory; rely on risk-based monitoring |
| **Documentation of non-filing** | Extensive required | Brief statement usually sufficient |

**Key Shift**: From blanket compliance to risk-based, efficient reporting.

**Source**: [Morrison Foerster FinCEN SAR Guidance](https://www.mofo.com/resources/insights/251014-fincen-streamlines-sar-guidance-new-faqs)

---

## SAR Filing Thresholds

### When SAR is Required

| Trigger | Threshold | Conditions |
|---------|-----------|------------|
| **Known suspicious activity** | $5,000+ | Insider involvement |
| **Suspected suspicious activity** | $5,000+ | Aggregated transactions |
| **No suspect identified** | $25,000+ | Reportable regardless |

### When SAR is NOT Required

| Scenario | FinCEN Position |
|----------|-----------------|
| **Transaction near $10K CTR** | NOT suspicious solely due to amount |
| **$5K aggregation** | Only if evidence of evasion intent |
| **Declined transaction** | Generally not required |
| **False positive** | Document decision, no SAR needed |

**Critical Point**:
> "Financial institutions are not required to file SARs for a transaction or series thereof with a value at or near the $10,000 CTR threshold solely because it meets that amount, unless there is knowledge or suspicion that such transactions are designed specifically to evade BSA reporting requirements."

**Source**: [WilmerHale FinCEN Clarification](https://www.wilmerhale.com/en/insights/client-alerts/20251028-fincen-clarifies-suspicious-activity-reporting-requirements)

---

## Filing Timeline Requirements

### Initial SAR Filing

| Situation | Timeline |
|-----------|----------|
| **Standard suspicious activity** | 30 calendar days from detection |
| **Suspect identified** | 30 days from identification |
| **No suspect, ongoing investigation** | 60 days from detection |

### Continuing Activity SAR

| Previous Guidance | New Guidance (2025) |
|-------------------|---------------------|
| Every 90 days | "As appropriate in line with applicable timelines" |
| Independent reviews required | Risk-based policies acceptable |
| Manual reviews expected | Automated monitoring sufficient |

**Key Change**: No mandatory 90-day cycle; institutions may rely on risk-based internal procedures.

**Source**: [Money Laundering News SAR Guidance](https://www.moneylaunderingnews.com/2025/10/suspicious-activity-reports-what-new-guidance-means-for-financial-institutions/)

---

## Documentation of Non-Filing Decisions

### When Required

Document decision NOT to file when:
- Alert investigated but deemed not suspicious
- Transaction reviewed manually
- Escalation occurred but SAR declined

### Documentation Standard

> "The level of documentation may vary based on the specifics of the activity being reviewed and need not exceed that which is necessary to comply with the institution's internal policies."

> "In most cases, a short, concise statement documenting a financial institution's SAR decision will likely suffice."

**Example Sufficient Documentation**:
```
Alert #12345 - 2025-01-15
Customer: [Name]
Activity: Multiple deposits totaling $9,500
Review Finding: Customer operates cash-intensive retail business.
Deposits consistent with documented business activity.
Prior history shows similar patterns.
Decision: No SAR filing warranted.
Reviewer: [Name]
```

---

## False Positive Management

### The Scale Problem

| Metric | Typical Performance |
|--------|---------------------|
| **Alert-to-SAR ratio** | 100:1 to 500:1 |
| **True positive rate** | 1-5% |
| **False positive cost** | $15-50 per alert investigation |
| **Annual false positive volume** | Millions for large institutions |

### AI/ML Impact

| Capability | Improvement |
|------------|-------------|
| **False positive reduction** | 60-80% |
| **Entity resolution** | Better matching accuracy |
| **Anomaly detection** | Pattern-based identification |
| **Continuous learning** | Models improve over time |

**Source**: [Lucinity Sanctions Screening](https://lucinity.com/blog/sanctions-screening-in-2025-how-financial-institutions-can-keep-up-with-expanding-global-restrictions)

### Best Practices for False Positive Reduction

1. **Tune thresholds** based on customer segments
2. **Implement risk scoring** to prioritize alerts
3. **Use negative lists** for known good customers
4. **Deploy ML models** trained on historical decisions
5. **Regular rule review** to eliminate outdated triggers

---

## Practical SAR Writing

### Required Elements

| Section | Content |
|---------|---------|
| **Subject information** | Name, address, TIN, occupation |
| **Suspicious activity** | What, when, how much, where |
| **Narrative** | Clear, factual description |
| **Supporting documentation** | Referenced by SAR ID |

### Narrative Best Practices

**DO**:
- State facts objectively
- Include specific dates, amounts, accounts
- Describe why activity is suspicious
- Reference supporting documentation
- Use clear, concise language

**DON'T**:
- Speculate about intent
- Include conclusions of criminal activity
- Use emotional language
- Omit key details
- Assume reader has context

### Example Narrative Structure

```
[WHO] On [DATE], [CUSTOMER NAME] (account #XXXX)

[WHAT] conducted [NUMBER] transactions totaling $[AMOUNT]

[HOW] via [METHOD - wire, cash, ACH]

[WHERE] to/from [COUNTERPARTIES/LOCATIONS]

[WHY SUSPICIOUS] This activity is suspicious because:
- [Reason 1]
- [Reason 2]
- [Reason 3]

[CONTEXT] Customer's stated business is [X].
Prior account activity showed [Y].
This activity deviates because [Z].

[ACTIONS TAKEN] Account was [closed/monitored/no action].
```

---

## Treasury Operational Integration

### When Treasury Should Involve Compliance

| Scenario | Action |
|----------|--------|
| **Large/unusual payment request** | Pre-approval review |
| **New counterparty in high-risk jurisdiction** | Enhanced due diligence |
| **Pattern of payments near thresholds** | Structuring assessment |
| **Unusual payment instructions** | Fraud/AML review |
| **Customer urgency pressure** | Red flag indicator |

### Red Flags for Treasury to Monitor

| Category | Indicators |
|----------|------------|
| **Structuring** | Multiple transactions just below thresholds |
| **Layering** | Rapid movement through multiple accounts |
| **Round amounts** | Exact $10K, $9,999, etc. |
| **Geographic** | High-risk country involvement |
| **Velocity** | Unusual transaction frequency |
| **Mismatch** | Activity inconsistent with business purpose |

---

## Recent Enforcement Actions

### Penalties for Context

| Entity | Penalty | Violation | Date |
|--------|---------|-----------|------|
| **OKX** | $500M+ | AML violations, inadequate KYC | Feb 2025 |
| **Monzo** | £21M | AML control failings | Jul 2025 |
| **TD Bank** | $3B | BSA/AML violations | 2024 |
| **de Volksbank** | €22.5M | Late SAR filings, poor risk assessments | Jan 2025 |

**Key Lesson**: Penalties increasingly focus on **systemic failures**, not individual transactions.

**Source**: [Sumsub SAR Guide](https://sumsub.com/blog/suspicious-activity-reports/)

---

## Investment Adviser Rule Update

### 2026 Delay

FinCEN delayed AML/CFT and SAR requirements for:
- Registered Investment Advisers
- Exempt Reporting Advisers

**New Effective Date**: January 1, 2028 (moved from January 1, 2026)

**Impact**: Two additional years for RIAs to prepare compliance programs.

**Source**: [Federal Register - Delay Notice](https://www.federalregister.gov/documents/2026/01/02/2025-24184/delaying-the-effective-date-of-the-anti-money-launderingcountering-the-financing-of-terrorism)

---

## System Design Implications

### Required Capabilities

1. **Alert management system** with workflow and documentation
2. **SAR preparation workflow** with required fields
3. **Decision documentation** for non-filing
4. **Threshold monitoring** with appropriate rules
5. **ML-powered alert scoring** for prioritization
6. **Regulatory reporting** (SAR, CTR, CMIR)
7. **Case management** for investigations

### Data Model Considerations

```
AMLAlert {
  alert_id: string
  trigger_rule: string
  customer_id: string
  transactions: Transaction[]
  total_amount: Money
  risk_score: number
  status: enum [NEW, ASSIGNED, INVESTIGATING, CLOSED_NO_SAR, SAR_FILED]
  assigned_to: string
  created_at: datetime
  decision_timestamp: datetime
  decision_rationale: string
  sar_reference: string?
}

SARFiling {
  sar_id: string
  filing_date: date
  subject_information: SubjectInfo[]
  suspicious_activity_type: enum[]
  amount: Money
  date_range: DateRange
  narrative: string
  supporting_documents: Document[]
  continuing_activity: boolean
  prior_sar_references: string[]
  filing_institution: string
  preparer: string
  reviewer: string
}
```

---

## Key Sources

- [FFIEC BSA/AML Manual](https://bsaaml.ffiec.gov/manual/AssessingComplianceWithBSARegulatoryRequirements/04)
- [FINRA SAR Advisory](https://www.finra.org/rules-guidance/key-topics/aml/advisory-treasury-issues-faq-clarify-sar-requirements)
- [OCC SAR Guidance](https://www.occ.treas.gov/topics/supervision-and-examination/bank-operations/financial-crime/suspicious-activity-reports/index-suspicious-activity-reports.html)
- [Unit21 SAR Dictionary](https://www.unit21.ai/fraud-aml-dictionary/suspicious-activity-report)

---

*Research Date: January 2026*
*Gap Addressed: Operational AML decision-making absent from regulatory framework documentation*
