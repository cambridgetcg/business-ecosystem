# Nuance Gap Research

> Research documentation addressing gaps and implicit assumptions discovered through systematic analysis of the foundational layer research.

## Overview

This research collection was generated through a "become water" analysis - flowing through existing documentation to find the cracks where understanding is incomplete, assumptions are implicit, and cross-domain integrations are missing.

## Research Documents

| # | Document | Gap Identified In | Key Insight |
|---|----------|-------------------|-------------|
| 01 | [Transfer Pricing Documentation](./01-transfer-pricing-documentation.md) | holding-company-structures | Transfer pricing is NOT optional; documentation requirements are extensive |
| 02 | [Banking De-Risking](./02-banking-derisking.md) | banking-treasury (not addressed) | Banks can terminate relationships - this failure mode needs planning |
| 03 | [Economic Substance Requirements](./03-economic-substance-requirements.md) | holding-company-structures | "Offshore" no longer means "no requirements" - substance laws are real |
| 04 | [CFC/GILTI/PFIC Anti-Deferral](./04-cfc-gilti-pfic-anti-deferral.md) | holding-company-structures | OBBBA 2025 fundamentally changed GILTI - existing documentation outdated |
| 05 | [BaaS Regulatory Risk](./05-baas-regulatory-risk.md) | banking-treasury BaaS research | Synapse collapse exposed critical middleware risks understated in research |
| 06 | [Intercompany Netting & Cash Pooling](./06-intercompany-netting-cash-pooling.md) | Cross-domain gap | Critical treasury tool that touches all three domains simultaneously |
| 07 | [Single-Member LLC Veil Piercing](./07-single-member-llc-veil-piercing.md) | corporate-veil-formalities | SMLLCs face HIGHER piercing risk than multi-member entities |
| 08 | [409A Valuation Nuances](./08-409a-valuation-nuances.md) | cap-table-complexity | Far more complex than "get a valuation" - timing, triggers, penalties |

## Gap Categories

### Implicit Assumptions Exposed

| Assumption Made | Reality |
|-----------------|---------|
| Banking relationships are stable | Banks de-risk; relationships can be terminated |
| BaaS providers are safe | Middleware creates systemic risk (Synapse collapse) |
| Offshore = no requirements | Economic substance laws are enforced |
| 409A = checkbox item | Complex timing, methodology, severe penalties |
| GILTI rules are stable | OBBBA 2025 fundamentally changed calculations |

### Cross-Domain Integration Gaps

```
Entity Governance ←→ Accounting ←→ Banking
         ↑              ↑              ↑
         └──────────────┼──────────────┘
                        │
              MISSING INTEGRATIONS:
              • Transfer pricing
              • Cash pooling
              • Intercompany netting
              • Veil protection evidence
```

### Edge Cases Not Previously Addressed

1. **Banking failure modes** - What happens when relationships terminate
2. **Regulatory changes** - OBBBA 2025 international tax overhaul
3. **Heightened liability** - SMLLC veil piercing risks
4. **Timing complexities** - 409A material event triggers
5. **Substance requirements** - Offshore economic substance compliance

## How These Documents Were Generated

### Phase 1: Deep Understanding
All 27 existing research documents were analyzed across:
- Entity Governance (8 documents)
- Accounting (9 documents)
- Banking-Treasury (10 documents)

### Phase 2: Signal Detection
For each document, the following were identified:
- Implicit assumptions
- Missing edge cases
- Cross-domain interactions
- Shallow areas
- Regulatory nuances glossed over

### Phase 3: Gap Prioritization
Eight critical gaps were selected based on:
- Impact on system design
- Risk of incorrect assumptions
- Cross-domain importance
- Regulatory/compliance implications

### Phase 4: Targeted Research
Web research was conducted for each gap, focusing on:
- 2024-2025 regulatory developments
- Practical implementation requirements
- Penalty and enforcement realities
- Industry best practices

### Phase 5: Documentation
Each finding was documented following the established pattern:
- Knowledge gap identified
- Key findings with visual models
- Cross-domain integration requirements
- Model implications (TypeScript schemas)
- Questions for further research
- Cited sources

## Using This Research

### For System Design
1. Check relevant nuance gap documents before designing features
2. Ensure cross-domain integrations are explicit
3. Don't assume current research is complete - check for gaps

### For Implementation
1. Use the TypeScript schema examples as starting points
2. Implement the cross-domain tracking requirements
3. Build monitoring for the warning signs identified

### For Compliance
1. Verify assumptions against nuance gap findings
2. Update processes for regulatory changes (especially OBBBA 2025)
3. Document decision rationale referencing this research

## Maintenance

This research should be reviewed:
- **Quarterly**: For regulatory updates (especially tax, banking)
- **When incidents occur**: New Synapse-type events, enforcement actions
- **When expanding scope**: New jurisdictions, new business activities

## Related Documentation

- [Entity Governance Research](../entity-governance/research/)
- [Accounting Research](../accounting/docs/research/)
- [Banking-Treasury Research](../banking-treasury/docs/research/)

---

*Research collection created: January 2026*
*Methodology: PP (Purpose Prompter) gap analysis with web research*
