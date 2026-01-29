# Research Prompt: ISO 20022 Payment Investigation Workflows

## Research Objective

Define the complete payment investigation lifecycle using ISO 20022 messages, including the boundary between automated and human-handled investigations.

## Context

ISO 20022 migration (2025-2027) enables structured data for payment tracking and investigations. Key messages include:
- camt.027 (Claim Non-Receipt)
- camt.028 (Additional Payment Information)
- camt.029 (Resolution of Investigation)
- camt.110/111 (Pre-notification)

However, research identified a gap: Where does structured automation end and unstructured human investigation begin?

## Research Questions

### Section 1: Message Flow Mapping

**Primary question:** What is the complete message flow for each investigation type?

Investigate:
- SWIFT gCCT (Global Customer Credit Transfer) investigation workflows
- ISO 20022 investigation message set (camt family)
- Message triggering conditions
- Expected response times by message type
- End-to-end tracking identifiers (UETR in gpi)

**Desired output:**
- Sequence diagrams for:
  - Missing payment investigation
  - Wrong amount investigation
  - Beneficiary mismatch investigation
  - Compliance hold investigation
- Message field mappings

### Section 2: Automation Boundaries

**Primary question:** Which investigation scenarios can be fully automated vs. require human intervention?

Investigate:
- Bank operations workflows for exception handling
- SWIFT gpi Tracker capabilities and limitations
- Common investigation outcomes by category
- SLA expectations by investigation type

**Desired output:**
- Classification matrix: Investigation type × Automation potential
- Decision tree for escalation triggers
- Automation ceiling analysis

### Section 3: Case Management Integration

**Primary question:** How should structured ISO 20022 data integrate with unstructured investigation records?

Investigate:
- Case management vendor approaches (ServiceNow, Salesforce Service Cloud, specialized banking tools)
- Hybrid data model patterns
- NLP capabilities for unstructured ingestion
- Audit trail requirements

**Desired output:**
- Data model for investigation case record
- Integration architecture diagram
- Knowledge capture workflow

### Section 4: Bank Relationship Dynamics

**Primary question:** How do banks handle investigations on behalf of corporate clients?

Investigate:
- Corporate-to-bank investigation request protocols
- Bank internal escalation processes
- Response time commitments by bank tier
- Fee structures for investigation services

**Desired output:**
- Bank service level comparison
- Communication protocol recommendations
- Escalation path documentation

## Research Methodology

1. **Standards bodies:** ISO 20022 catalogue, SWIFT documentation
2. **Bank documentation:** J.P. Morgan, Citi, HSBC treasury services guides
3. **Vendor analysis:** Case management platforms with ISO 20022 support
4. **Practitioner interviews:** If accessible, treasury operations managers

## Success Criteria

Research is complete when:
- [ ] All investigation message types are mapped
- [ ] Automation vs. human boundary is clearly defined
- [ ] Case management data model is specified
- [ ] Bank expectations are documented
- [ ] Gap from questions/04 is addressed

## Related Files

- docs/integration/questions/04_iso20022_meets_unstructured_investigations.md
- docs/integration/insights/02_iso20022_enables_machine_intelligence.md
- docs/research/nuances/11_PAYMENT_FAILURE_RECOVERY.md
- docs/research/nuances/18_PAYMENT_INQUIRY_PROTOCOLS.md

---

*Research Priority: MEDIUM*
*Estimated Effort: 2 research sessions*
*Dependencies: ISO 20022 message catalogue access*
