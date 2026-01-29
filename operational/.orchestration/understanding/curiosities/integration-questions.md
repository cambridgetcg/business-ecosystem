# Integration Domain Curiosities

Questions about cross-domain coordination, business processes, and ecosystem-level patterns.

---

## Cross-Domain Process Questions

### Entity Lifecycle

**Q1**: When a legal entity is dissolved (entity-governance), what happens to all its operational records? Are contracts terminated? Policies cancelled? IP reassigned?

**Why it matters**: Entity dissolution is a major lifecycle event with cross-domain implications.

**Investigation needed**: Define entity dissolution workflow.

---

**Q2**: Can operational domains ever reject an entity? If an entity has credit issues, can contracts-legal refuse to create standard agreements during onboarding?

**Why it matters**: One-way dependency assumption may be too simplistic.

---

### Contract ↔ Insurance

**Q3**: When a contract requires specific insurance coverage (e.g., "vendor must carry $1M liability"), how does insurance domain verify compliance? Is it manual or automated?

**Why it matters**: Contractual insurance requirements are common but enforcement is often manual.

**Investigation needed**: COI verification automation patterns.

---

**Q4**: If an insurance policy lapses mid-contract, what happens? Does it trigger a contract breach workflow? An alert to counterparty?

**Why it matters**: Insurance and contract lifecycles are intertwined.

---

### Contract ↔ IP

**Q5**: When an IP license agreement is signed in contracts-legal, how is it linked to the License entity in IP domain? Manual entry or automatic?

**Why it matters**: Duplication risk if not properly integrated.

**Investigation needed**: Check if license agreement → license entity flow exists.

---

**Q6**: If a patent in a license agreement expires, what happens to the license? Does it automatically terminate or continue (covering remaining IP)?

**Why it matters**: License validity tied to underlying IP status.

---

### Privacy ↔ Everything

**Q7**: When data-privacy receives a deletion request (DSAR erasure), how do we delete data from contracts-legal (if subject is a party), IP (if subject is an inventor), etc.?

**Why it matters**: GDPR right to erasure spans all systems holding personal data.

**Investigation needed**: Cross-domain data deletion coordination.

---

**Q8**: If a contract includes a data processing agreement (DPA), who "owns" the DPA - contracts-legal or data-privacy? Both?

**Why it matters**: Unclear ownership leads to duplication or gaps.

---

### Insurance ↔ Everything

**Q9**: When insurance pays a claim related to a contract dispute (indemnity claim), how is this recorded in contracts-legal? Is there a "insurance recovery" obligation type?

**Why it matters**: Financial flows between insurance and contracts need tracking.

---

**Q10**: Cyber insurance typically requires certain security controls. How does insurance domain verify these are in place? Integration with corporate-security?

**Why it matters**: Coverage validity may depend on security posture.

---

## Compliance Integration

### Multi-Domain Compliance

**Q11**: If GDPR requires both data-privacy compliance (consent, DSAR) AND contracts-legal compliance (DPAs), how is overall GDPR status calculated when one is compliant and one isn't?

**Why it matters**: Regulatory compliance spans domains.

**Investigation needed**: Check compliance aggregator logic for cross-domain regulations.

---

**Q12**: When a compliance finding is opened in one domain (e.g., missing DPA in contracts-legal), should it automatically propagate to related domains (data-privacy)?

**Why it matters**: Compliance issues often have cross-domain implications.

---

### Audit Trail

**Q13**: Is there a unified audit trail across all domains, or are audit logs siloed? Can we trace a single business transaction (like contract execution) across contracts, insurance, compliance?

**Why it matters**: Audit coherence is critical for investigations.

**Investigation needed**: Check if audit logs have correlation IDs that span domains.

---

## Reporting Integration

**Q14**: The reporting service fetches from domain `/reports/{query}` endpoints. Are these endpoints implemented in all domains, or only documented?

**Why it matters**: Reports won't work without domain support.

**Investigation needed**: Check domain implementations for report endpoints.

---

**Q15**: When generating a cross-domain report, what happens if one domain is temporarily unavailable? Does the report fail or show partial data?

**Why it matters**: Resilience patterns for reporting.

---

## Workflow Integration

**Q16**: Can workflows be paused waiting for human approval? If entity-onboarding requires legal review before IP assignments, is that supported?

**Why it matters**: Many business processes have human gates.

**Investigation needed**: Check workflow engine for human task patterns.

---

**Q17**: How do we handle workflow failures after partial completion? If contracts were created but insurance assessment failed, who cleans up?

**Why it matters**: Compensation might not be perfect; manual intervention may be needed.

---

**Q18**: Can external systems trigger workflows? If an external HR system creates an employee, can it trigger employment-agreement creation in contracts-legal?

**Why it matters**: Ecosystem isn't closed; external integration needed.

---

## Foundational Integration

**Q19**: How does entity-governance notify operational domains of entity changes (name change, address update, status change)?

**Why it matters**: Entity data must stay synchronized.

**Investigation needed**: Check if entity-governance emits change events.

---

**Q20**: When accounting needs to reconcile, how does it get data from operational domains? Direct API? Reports? Events?

**Why it matters**: Financial systems need operational data.

---

## Priority Ranking

| Question | Priority | Domains | Complexity |
|----------|----------|---------|------------|
| Q7 | CRITICAL | Privacy + All | High |
| Q1 | HIGH | All | High |
| Q3 | HIGH | Contracts + Insurance | Medium |
| Q11 | HIGH | Compliance + All | Medium |
| Q13 | HIGH | Audit | Medium |
| Q4 | MEDIUM | Contracts + Insurance | Medium |
| Q5 | MEDIUM | Contracts + IP | Medium |
| Q16 | MEDIUM | Workflow | Medium |
| Q19 | MEDIUM | Entity Gov | Low |
| Q8 | LOW | Contracts + Privacy | Low |

---

## Key Integration Patterns Needed

Based on these questions, we need clarity on:

1. **Entity dissolution workflow** - What happens when an entity dies?
2. **Cross-domain deletion** - GDPR erasure spanning systems
3. **Insurance ↔ Contract sync** - Coverage requirements and verification
4. **Unified audit trail** - Cross-domain correlation
5. **Human-in-the-loop workflows** - Approval gates in automation

---

## Next Steps

1. Research GDPR cross-system deletion (Q7) - critical compliance requirement
2. Define entity dissolution workflow (Q1) - major lifecycle event
3. Investigate COI verification automation (Q3) - common business need
