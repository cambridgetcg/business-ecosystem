# Research - Purpose & Mission

## Mission Statement

**To build and maintain deep understanding of the business ecosystem's domains** — capturing research findings, surfacing knowledge gaps, documenting critical insights, and enabling informed implementation decisions through rigorous investigation and synthesis of complex business, regulatory, and technical topics.

---

## The Problem We Solve

### Knowledge Challenge

Building a comprehensive business ecosystem requires understanding domains that:

1. **Span multiple disciplines** - Accounting, tax, banking, compliance, governance each have deep bodies of knowledge
2. **Intersect in complex ways** - Transfer pricing affects accounting, tax, and entity governance simultaneously
3. **Have hidden nuances** - Surface-level understanding misses critical operational details
4. **Evolve with regulations** - Laws and standards change, requiring continuous learning
5. **Require expert knowledge** - Domain expertise needed to implement correctly
6. **Risk implementation failure** - Gaps in understanding lead to incorrect or incomplete solutions

### What This Leads To

- **Implementation blockers** from insufficient understanding
- **Incorrect solutions** from surface-level knowledge
- **Rework cycles** when gaps are discovered late
- **Missed edge cases** not considered during design
- **Integration failures** when cross-domain interactions aren't understood

---

## Our Solution

### What Research Provides

A **structured knowledge repository** that:

1. **Investigates domains** - Deep dives into accounting, tax, banking, compliance, and governance topics
2. **Surfaces insights** - "Aha moments" that shift understanding and inform design
3. **Identifies gaps** - Mission-critical knowledge holes that block implementation
4. **Documents findings** - Researched answers to specific questions with sources
5. **Tracks coverage** - Maps what we understand vs. what we need to learn
6. **Enables decisions** - Provides the knowledge foundation for implementation choices

### How It Works

```
Research Lifecycle
        |
        |---> Domain documentation reviewed
        |---> Understanding coverage assessed
        |---> Gaps and curiosities identified
        |---> Targeted research conducted
        |---> Findings documented with sources
        |---> Insights synthesized into understanding
        |
        v
Knowledge Application
        |
        |---> Implementation planning uses research
        |---> Design decisions reference findings
        |---> Edge cases covered by gap research
        |---> Cross-domain interactions understood
        |---> Ongoing questions feed new research cycles
```

---

## Scope & Boundaries

### In Scope

**Research Insights**
- Meta-cognitive integration of domain understanding
- "Aha moment" documentation that shifts mental models
- Curiosity-driven investigations
- Second-order questions emerging from research

**Mission-Critical Gaps**
- Operational knowledge gaps blocking implementation
- Edge case documentation
- Integration choreography requirements
- Procedure-level how-to knowledge

**Nuance Gaps**
- Targeted research on specific documentation gaps
- Clarification of ambiguous requirements
- Resolution of conflicting information

**Cross-Domain Understanding**
- How domains interact (e.g., transfer pricing + consolidation)
- Jurisdiction conflict resolution
- Event choreography across services

### Research Domains Covered

| Domain | Coverage | Key Research Areas |
|--------|----------|-------------------|
| Entity Governance | 75% | International structures, trust complexity |
| Accounting | 70% | Hedge accounting, FX translation |
| Banking-Treasury | 90% | Trade finance, letters of credit |
| Tax | 75% | State tax specifics, VAT/GST |
| Compliance | 55% | Industry-specific regulations |
| Cross-Domain | 95% | Integration, choreography, conflict resolution |

### Out of Scope

**Not Research's Responsibility:**

- **Implementation code** - Research informs implementation, doesn't create it
- **Operational procedures** - We document what procedures should exist, services implement them
- **Real-time data** - We capture understanding, not live operational data
- **User documentation** - Service READMEs are maintained by services
- **Training materials** - Compliance handles training, we provide knowledge

---

## Repository Structure

```
research/
├── insights/                    # Meta-cognitive integration
│   ├── 00-UNDERSTANDING-MAP.md  # Master coverage assessment
│   ├── 01-*.md through 08-*.md  # Curiosity investigations
│   └── README.md                # Insights overview
│
├── mission-gaps/                # Critical knowledge gaps
│   ├── 00-MISSION-GAPS.md       # Gap inventory
│   ├── 01-*.md through 12-*.md  # Individual gap research
│   └── README.md                # Mission gaps overview
│
└── nuance-gaps/                 # Targeted gap research
    └── [domain-specific gaps]
```

---

## Key Design Principles

### 1. Understanding Before Implementation

Research precedes implementation. We don't build what we don't understand.

### 2. Sources Required

Research findings cite sources. Claims without evidence are hypotheses, not findings.

### 3. Gaps Are First-Class

Unknown unknowns are explicitly tracked. Identifying a gap is a valuable research output.

### 4. Cross-Domain Priority

Integration points between domains receive special attention. Most complexity lives at boundaries.

### 5. Living Documentation

Research is updated as understanding evolves. Stale findings are revised or marked deprecated.

---

## Research Methodology

Following the Purpose Prompter (PP) approach:

1. **Territory Assessment** - Is this charted (documented) or uncharted (needs research)?
2. **Deep Understanding** - Read and synthesize existing documentation
3. **Signal Detection** - Notice "aha" moments and areas of curiosity/confusion
4. **Targeted Research** - Web searches, expert sources for specific questions
5. **Documentation** - Individual findings files with sources

---

## Success Metrics

### Research Metrics
- **Coverage improvement**: Understanding coverage increases over time
- **Gap closure rate**: Mission-critical gaps researched and documented
- **Source quality**: Findings backed by authoritative sources
- **Insight value**: "Aha moments" that change implementation approach

### Implementation Metrics
- **Design quality**: Implementation decisions grounded in research
- **Rework reduction**: Fewer changes from late-discovered gaps
- **Edge case coverage**: Research-identified cases handled in implementation
- **Integration success**: Cross-domain interactions work as researched

---

## Current Research Status

### Key Aha Moments (from insights/)

1. **QBAI Elimination**: OBBBA 2025 removed QBAI reduction from GILTI/NCTI
2. **Middleware as Single Point of Failure**: BaaS middleware creates systemic risk
3. **Physical vs Notional Pooling**: Physical creates IC loans; notional doesn't
4. **409A Penalties on Employees**: 20% penalty falls on employees, not company
5. **Jurisdiction is Four-Dimensional**: Formation, qualification, nexus, regulatory are independent

### Critical Gaps (from mission-gaps/)

| Gap | Severity | Blocks |
|-----|----------|--------|
| Transfer Pricing Operations | CRITICAL | Phase 2, 4 |
| Cash Pool Operations | CRITICAL | Phase 3 |
| CFC Mid-Year Changes | CRITICAL | Phase 4 |
| FDIC Synapse Rule | CRITICAL | Phase 3 |

---

## Conclusion

Research serves as the **knowledge foundation of the business ecosystem**. By rigorously investigating domains, surfacing gaps, and documenting findings, it enables every other service to be built on solid understanding rather than assumptions.

**Our success is measured by the depth of understanding achieved, the gaps identified and closed, and the quality of implementation decisions that research enables.**
