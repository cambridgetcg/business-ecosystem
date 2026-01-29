# Accounting Framework Research

> Research documentation supporting the accounting system's MISSION.md commitments and domain scope.

## Overview

This research collection covers the regulatory requirements, industry standards, and best practices that inform the design and implementation of the accounting system. Each document explores a specific domain, comparing approaches across major accounting frameworks (GAAP, IFRS) and regulatory bodies (SOX, PCAOB).

Additionally, this collection includes research on **AI Model Knowledge Gaps** - systematic exploration of the boundaries and limitations of AI understanding, essential for responsible AI-assisted system development.

---

## Research Documents

### Accounting Domain Research

| # | Document | MISSION.md Alignment | Key Standards |
|---|----------|---------------------|---------------|
| 01 | [Double-Entry Bookkeeping Standards](./01-double-entry-bookkeeping-standards.md) | Core Commitment #1: Financial Integrity | GAAP, IFRS |
| 02 | [Journal Entry Immutability](./02-journal-entry-immutability.md) | Core Commitment #2: Immutability | SOX, PCAOB, COSO |
| 03 | [Fiscal Period Management](./03-fiscal-period-management.md) | Core Commitment #3: Period Controls | IAS 10, IAS 8 |
| 04 | [Audit Trail Requirements](./04-audit-trail-requirements.md) | Core Commitment #4: Full Audit Trail | SOX 302/404, PCAOB AS 1215 |
| 05 | [Chart of Accounts Structure](./05-chart-of-accounts-structure.md) | Domain: Account Management | Industry Practice |
| 06 | [Multi-Currency Accounting](./06-multi-currency-accounting.md) | Domain: Multi-Currency | IAS 21, ASC 830 |
| 07 | [Revenue Recognition](./07-revenue-recognition.md) | Domain: Transaction Recording | ASC 606, IFRS 15 |
| 08 | [Financial Statement Presentation](./08-financial-statement-presentation.md) | Domain: Financial Reporting | IAS 1, IFRS 18 |

### AI Model Knowledge Gap Research

Systematic exploration of AI model limitations, uncertainty boundaries, and areas where understanding is incomplete or unreliable.

| # | Document | Knowledge Dimension | Key Concern |
|---|----------|---------------------|-------------|
| 09 | [Temporal Knowledge Decay](./09-temporal-knowledge-decay.md) | Temporal Boundaries | Knowledge accuracy degrades with time since training |
| 10 | [Epistemic Confidence Calibration](./10-epistemic-confidence-calibration.md) | Confidence Boundaries | Stated confidence doesn't match actual accuracy |
| 11 | [Reasoning Under Uncertainty](./11-reasoning-under-uncertainty.md) | Reasoning Boundaries | Multi-step reasoning compounds errors invisibly |
| 12 | [Cultural and Contextual Blind Spots](./12-cultural-contextual-blind-spots.md) | Cultural Boundaries | Systematic gaps in non-dominant perspectives |
| 13 | [Embodied and Experiential Knowledge](./13-embodied-experiential-knowledge.md) | Experiential Boundaries | Text-based systems lack embodied understanding |
| 14 | [Edge Cases and Distribution Tails](./14-edge-cases-distribution-tails.md) | Distribution Boundaries | Rare scenarios have unreliable handling |
| 15 | [Meta-Cognitive Limitations](./15-meta-cognitive-limitations.md) | Self-Knowledge Boundaries | AI self-reports may not reflect actual processing |
| 16 | [Emergent Capability Boundaries](./16-emergent-capability-boundaries.md) | Capability Boundaries | Abilities emerge unpredictably with scale |

---

## Key Regulatory Bodies

| Body | Jurisdiction | Standards |
|------|--------------|-----------|
| **FASB** | United States | US GAAP (ASC Codification) |
| **IASB** | International | IFRS Standards |
| **PCAOB** | United States | Auditing Standards |
| **SEC** | United States | Reporting Requirements |
| **COSO** | International | Internal Control Framework |
| **COBIT** | International | IT Governance Framework |

---

## Framework Comparison Summary

### Rules-Based vs Principles-Based

| Aspect | US GAAP | IFRS |
|--------|---------|------|
| **Approach** | Rules-based (detailed guidance) | Principles-based (professional judgment) |
| **Inventory** | LIFO permitted | LIFO prohibited |
| **Development costs** | Generally expensed | Capitalize if criteria met |
| **Revaluation** | Generally not permitted | Permitted |
| **Impairment reversal** | Not permitted | Required if indicators |

### Convergence Status

GAAP and IFRS have converged significantly on:
- Revenue recognition (ASC 606 / IFRS 15)
- Lease accounting (ASC 842 / IFRS 16)
- Financial instruments (partial)

Key differences remain in:
- Inventory valuation methods
- Impairment models
- Development cost treatment

---

## How to Use This Research

### For System Design
1. Start with the relevant research document
2. Identify mandatory requirements vs best practices
3. Note jurisdictional differences
4. Design for the most restrictive requirement
5. Make standard-specific behavior configurable

### For Implementation
1. Reference specific sections for validation rules
2. Use provided data models as starting points
3. Follow the best practices sections
4. Ensure audit trail requirements are met

### For Compliance
1. Verify implementation against regulatory requirements
2. Document design decisions with regulatory references
3. Maintain traceability to these research documents
4. Update research as standards evolve

---

## Maintenance

This research should be reviewed and updated:
- **Annually**: For standard updates and amendments
- **When standards change**: Major revisions (e.g., IFRS 18 in 2027)
- **When expanding scope**: New jurisdictions or domains

---

## References

### Primary Sources
- [FASB Accounting Standards Codification](https://asc.fasb.org/)
- [IFRS Standards](https://www.ifrs.org/issued-standards/)
- [PCAOB Auditing Standards](https://pcaobus.org/oversight/standards)
- [SEC EDGAR](https://www.sec.gov/edgar)

### Secondary Sources
- [EY GAAP/IFRS Comparison](https://www.ey.com/en_us/technical/accountinglink)
- [Deloitte IAS Plus](https://www.iasplus.com/)
- [PwC Viewpoint](https://viewpoint.pwc.com/)
- [KPMG Insights](https://kpmg.com/xx/en/what-we-do/services/audit.html)

---

## AI Knowledge Gap Research: Summary

The AI Knowledge Gap research collection (documents 09-16) identifies eight dimensions where AI model understanding has structural limitations:

### The Knowledge Gap Hierarchy

```
WHAT AI MODELS KNOW
        │
        ├── Temporal ────────── Knowledge frozen at training cutoff
        │                       (degrades over time)
        │
        ├── Epistemic ───────── Confidence ≠ Accuracy
        │                       (sounds certain when wrong)
        │
        ├── Reasoning ───────── Multi-step errors compound
        │                       (long chains unreliable)
        │
        ├── Cultural ────────── Dominant perspectives overrepresented
        │                       (blind spots are invisible)
        │
        ├── Experiential ────── Description ≠ Understanding
        │                       (no embodied grounding)
        │
        ├── Distributional ───── Common cases ≠ Edge cases
        │                       (tails handled poorly)
        │
        ├── Meta-cognitive ───── Self-reports ≠ Actual state
        │                       (introspection unreliable)
        │
        └── Emergent ─────────── Capabilities are unpredictable
                                (boundaries are fuzzy)
```

### How to Use This Research

**For AI-Assisted Development:**
1. Reference relevant knowledge gap documents when using AI assistance
2. Apply appropriate skepticism based on which gaps may apply
3. Verify AI outputs in areas with known limitations
4. Design human checkpoints for high-stakes decisions

**For System Design:**
1. Don't rely on AI for tasks in gap areas without verification
2. Build monitoring for temporal decay of AI recommendations
3. Include diverse perspectives beyond AI's training distribution
4. Plan for edge cases AI may not handle well

---

*Research collection created: January 2026*
*Last updated: January 2026*
*AI Knowledge Gap research added: January 2026*
