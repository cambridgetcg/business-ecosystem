# Refined Research Questions

## Overview

This document transforms raw curiosity questions into **focused research prompts** with clear scope, expected deliverables, and priority indicators. These prompts are designed to generate actionable findings.

---

## Research Question Categories

### Category A: Multi-Jurisdiction Complexity

Questions about how entities exist across multiple jurisdictions simultaneously.

---

#### RQ-A1: Foreign Qualification Trigger Matrix

**Raw Curiosity**: What are the specific "doing business" triggers for the top 10 states?

**Refined Research Prompt**:
> Create a comparison matrix of foreign qualification triggers for Delaware, California, New York, Texas, Florida, Nevada, Wyoming, Illinois, New Jersey, and Washington. For each state, identify:
> 1. Statutory definition of "doing business" (with citation)
> 2. Activities that TRIGGER qualification (with thresholds if applicable)
> 3. Explicit safe harbors (activities that do NOT trigger)
> 4. Consequences of doing business without qualification
> 5. Cure process and associated costs

**Expected Deliverable**: State-by-state comparison table with citations to state statutes and secretary of state guidance.

**Priority**: HIGH (needed for foreignQualifications reference data)

**Research Approach**:
- State secretary of state websites
- State business corporation acts / LLC acts
- Legal treatises on foreign qualification

---

#### RQ-A2: Tax Nexus vs Qualification Nexus Interaction

**Raw Curiosity**: How do P.L. 86-272 protections interact with economic nexus for income tax?

**Refined Research Prompt**:
> Analyze the interaction between federal P.L. 86-272 protection and state economic nexus standards post-Wayfair. Specifically:
> 1. Which states have modified their P.L. 86-272 interpretation (especially re: digital activities)?
> 2. Can you have sales tax nexus but be protected from income tax nexus in the same state?
> 3. What activities fall outside P.L. 86-272 protection?
> 4. How do states treat software companies and SaaS businesses under P.L. 86-272?

**Expected Deliverable**: Legal analysis document with state-specific examples and recent enforcement trends.

**Priority**: MEDIUM (important for tax service integration)

**Research Approach**:
- MTC (Multistate Tax Commission) guidance on P.L. 86-272
- State revenue department bulletins (CA FTB, NY Tax Dept)
- Recent court cases on digital nexus

---

#### RQ-A3: Remote Employee Qualification Triggers

**Raw Curiosity**: How do states handle "remote employee only" scenarios post-COVID?

**Refined Research Prompt**:
> Research how states treat remote employees for foreign qualification purposes after COVID-19 changed work patterns. Investigate:
> 1. Which states have issued specific guidance on remote workers?
> 2. Do temporary COVID safe harbors still apply?
> 3. At what employee threshold does remote presence trigger qualification?
> 4. How do states treat employees who relocated during COVID but work for out-of-state companies?

**Expected Deliverable**: State guidance compilation with effective dates and sunset provisions.

**Priority**: HIGH (affects many modern businesses)

**Research Approach**:
- State secretary of state COVID guidance
- State tax department remote work guidance
- Bar association articles on post-COVID nexus

---

### Category B: Entity Type Governance

Questions about how different entity types behave differently.

---

#### RQ-B1: Series LLC Interstate Recognition

**Raw Curiosity**: How do different states treat Series LLCs (especially in non-recognizing states)?

**Refined Research Prompt**:
> Investigate the interstate treatment of Series LLCs when operating across state lines:
> 1. Which states recognize Series LLC liability segregation?
> 2. How do non-recognizing states treat a Series LLC formed in a recognizing state?
> 3. What happens to series-level asset protection in bankruptcy court?
> 4. Can a Series LLC foreign-qualify in a non-recognizing state, and what's the effect?

**Expected Deliverable**: Risk assessment matrix for Series LLC operations across jurisdictions.

**Priority**: MEDIUM (needed for llcSeries table design)

**Research Approach**:
- State LLC statutes comparison
- Delaware Chancery Court Series LLC cases
- Bankruptcy court treatment of series

---

#### RQ-B2: LLC-Taxed-As-S-Corp Mechanics

**Raw Curiosity**: How do hybrid entities (LLC taxed as S-Corp) work in practice?

**Refined Research Prompt**:
> Document the full mechanics of an LLC electing S-Corp taxation:
> 1. Formation and election sequence (state filing → IRS Form 2553)
> 2. How are "reasonable salary" requirements enforced?
> 3. What happens to capital accounts when LLC elects S-Corp?
> 4. Can an LLC taxed as S-Corp do special allocations? (No - single class of stock rule)
> 5. What triggers loss of S-Corp status for an LLC?

**Expected Deliverable**: Step-by-step operational guide with IRS form references.

**Priority**: HIGH (very common structure, need to model correctly)

**Research Approach**:
- IRS instructions for Form 2553
- Tax court cases on reasonable compensation
- CPA guidance on LLC S-Corp elections

---

#### RQ-B3: S-Corp Termination Cascade

**Raw Curiosity**: When S-Corp status is lost, what's the compliance cascade?

**Refined Research Prompt**:
> Map the full compliance cascade when an entity loses S-Corp status (intentionally or inadvertently):
> 1. What events trigger automatic S-Corp termination?
> 2. What notifications must be filed (IRS, state, shareholders)?
> 3. How does termination affect current-year taxation?
> 4. What are the inadvertent termination relief provisions?
> 5. What's the 5-year re-election waiting period?

**Expected Deliverable**: Decision tree for S-Corp termination handling with notification checklist.

**Priority**: MEDIUM (important edge case)

**Research Approach**:
- IRC Section 1362 (S-Corp termination rules)
- IRS Revenue Procedures for inadvertent termination relief
- State-level S-Corp conformity rules

---

### Category C: Beneficial Ownership & Control

Questions about determining who really controls entities.

---

#### RQ-C1: Multi-Tier Beneficial Ownership Calculation

**Raw Curiosity**: How do you calculate effective ownership through multi-tier structures?

**Refined Research Prompt**:
> Develop the algorithm for calculating beneficial ownership through complex structures:
> 1. How does FinCEN calculate ownership through intermediate entities?
> 2. If A owns 60% of B, and B owns 50% of C, does A own 30% of C for BOI purposes?
> 3. How do you handle circular ownership (A owns B owns A)?
> 4. At what tier depth do you stop calculating?
> 5. How do convertible instruments affect the calculation?

**Expected Deliverable**: Calculation algorithm with worked examples and edge case handling.

**Priority**: CRITICAL (needed for BOI compliance)

**Research Approach**:
- FinCEN BOI Final Rule (31 CFR 1010.380)
- FinCEN Small Entity Compliance Guide
- FATF beneficial ownership guidance

---

#### RQ-C2: Substantial Control Detection

**Raw Curiosity**: What documentation proves "substantial control" beyond officer titles?

**Refined Research Prompt**:
> Research how to determine and document substantial control for CTA purposes beyond the automatic senior officer category:
> 1. What evidence indicates "important decision" authority?
> 2. How do you document "appointment/removal authority" over directors?
> 3. What constitutes "any other form of substantial control"?
> 4. How do nominee arrangements affect control determination?
> 5. What about informal control through family relationships or economic pressure?

**Expected Deliverable**: Substantial control indicators checklist with documentation requirements.

**Priority**: HIGH (needed for BOI owner identification)

**Research Approach**:
- FinCEN BOI FAQ documents
- Treasury Department guidance
- Anti-money laundering case studies

---

#### RQ-C3: Convertible Instruments and BOI Thresholds

**Raw Curiosity**: How do convertible instruments affect threshold calculations? Is a SAFE holder at 25% before or after conversion?

**Refined Research Prompt**:
> Clarify how convertible instruments affect beneficial ownership thresholds:
> 1. Does FinCEN count SAFE holders as owners before conversion?
> 2. Do outstanding options count toward 25% threshold?
> 3. How do you calculate ownership when conversion terms are variable (cap OR discount)?
> 4. What about warrants with anti-dilution adjustments?
> 5. When does "right to acquire" become "ownership"?

**Expected Deliverable**: Decision matrix for convertible instrument treatment in BOI calculations.

**Priority**: HIGH (cap table complexity meets BOI)

**Research Approach**:
- FinCEN definition of "ownership interest"
- SEC beneficial ownership rules (compare/contrast)
- Tax code definitions of ownership

---

### Category D: Corporate Veil & Formalities

Questions about maintaining liability protection.

---

#### RQ-D1: Formality Frequency Standards

**Raw Curiosity**: What's the minimum formality frequency to maintain veil protection? Is there case law on "how many missed meetings = piercing"?

**Refined Research Prompt**:
> Research case law on corporate formality failures and veil piercing:
> 1. Are there cases where X years of missed annual meetings led to piercing?
> 2. What weight do courts give to missing meeting minutes vs missing resolutions?
> 3. Do single-member LLCs have different formality standards?
> 4. How do courts treat retrospective documentation ("we'll do the minutes later")?
> 5. What's the interaction between formality failures and undercapitalization?

**Expected Deliverable**: Case law summary with extracted standards for formality compliance.

**Priority**: MEDIUM (needed for veil health scoring thresholds)

**Research Approach**:
- Delaware Chancery Court piercing cases
- California alter ego case law
- Law review articles on piercing statistics

---

#### RQ-D2: Intercompany Transaction Thresholds

**Raw Curiosity**: What intercompany transaction dollar threshold requires formal agreement?

**Refined Research Prompt**:
> Research best practices and legal requirements for intercompany transaction documentation:
> 1. Is there a dollar threshold below which informal transactions are acceptable?
> 2. What level of documentation satisfies transfer pricing requirements?
> 3. How do IRS advance pricing agreements work?
> 4. What are the consequences of undocumented intercompany loans?
> 5. How do courts treat "economic substance" in related-party transactions?

**Expected Deliverable**: Documentation requirements matrix by transaction type and size.

**Priority**: MEDIUM (needed for intercompanyAgreements table design)

**Research Approach**:
- IRS Section 482 transfer pricing regulations
- OECD Transfer Pricing Guidelines
- Tax court cases on related-party transactions

---

#### RQ-D3: Parent-Subsidiary Separation Evidence

**Raw Curiosity**: What specific evidence demonstrates proper parent-subsidiary separation?

**Refined Research Prompt**:
> Create an evidentiary checklist for parent-subsidiary separation that would withstand litigation:
> 1. What bank account practices demonstrate separation?
> 2. How should board composition overlap be managed?
> 3. What contract signing practices show separate identity?
> 4. How do shared services agreements need to be structured?
> 5. What insurance arrangements indicate separation?

**Expected Deliverable**: Parent-subsidiary separation audit checklist with evidence requirements.

**Priority**: HIGH (multiple entities in ecosystem)

**Research Approach**:
- Enterprise liability case law
- Parent corporation liability treatises
- Corporate governance best practices guides

---

### Category E: Cap Table & Valuation

Questions about equity complexity.

---

#### RQ-E1: SAFE Conversion Fully Diluted Calculation

**Raw Curiosity**: How do you calculate fully diluted ownership with multiple SAFE caps?

**Refined Research Prompt**:
> Develop the calculation methodology for fully diluted ownership with multiple SAFEs:
> 1. How do you model SAFEs with different caps in the same cap table?
> 2. What's the correct order of operations for cap vs discount?
> 3. How do pro-rata rights affect SAFE conversion shares?
> 4. What about SAFEs with MFN (most favored nation) provisions?
> 5. How do you handle post-money SAFEs vs pre-money SAFEs?

**Expected Deliverable**: Calculation algorithm with spreadsheet model for multiple SAFE scenarios.

**Priority**: HIGH (common fundraising structure)

**Research Approach**:
- Y Combinator SAFE documentation
- Carta and Pulley cap table guidance
- VC firm SAFE modeling practices

---

#### RQ-E2: Down Round Anti-Dilution Mechanics

**Raw Curiosity**: What are the 409A implications of a down round with full ratchet?

**Refined Research Prompt**:
> Analyze the interaction between anti-dilution adjustments and 409A valuations:
> 1. If full ratchet anti-dilution triggers, does the 409A value change retroactively?
> 2. How do outstanding options get repriced (or not) in a down round?
> 3. What's the tax treatment for employees whose options are now underwater?
> 4. How does the Section 409A "option repricing" rule interact with anti-dilution?
> 5. What documentation is needed for the adjustment?

**Expected Deliverable**: Down round handling guide with tax and equity implications.

**Priority**: MEDIUM (market conditions may create more down rounds)

**Research Approach**:
- IRS Section 409A regulations
- Accounting treatment (ASC 718)
- Startup lawyer guidance on down rounds

---

### Category F: System Integration

Questions about how entity-governance connects to other services.

---

#### RQ-F1: Capital Account Accounting Integration

**Raw Curiosity**: How should entity-governance integrate with accounting for capital account tracking?

**Refined Research Prompt**:
> Design the integration between entity-governance capital accounts and accounting service:
> 1. Who is the system of record for capital account balances?
> 2. How do allocation calculations flow (entity-governance → accounting)?
> 3. What events trigger capital account updates?
> 4. How do you reconcile entity-governance capital accounts with tax K-1s?
> 5. What audit trail is needed for allocation decisions?

**Expected Deliverable**: Integration architecture document with event flows and data ownership.

**Priority**: HIGH (needed for LLC support Phase 2)

**Research Approach**:
- Partnership accounting standards (ASC 810)
- Tax partnership allocation rules (Section 704)
- Existing accounting service architecture

---

#### RQ-F2: Economic Nexus Calculation Ownership

**Raw Curiosity**: Should economic nexus calculation live in entity-governance or tax service?

**Refined Research Prompt**:
> Determine the correct service ownership for economic nexus calculations:
> 1. What data is needed for nexus calculation? (sales by state, employee locations, property)
> 2. Where does that data originate? (sales = finance, employees = HR, property = asset mgmt)
> 3. What's the calculation frequency? (real-time vs periodic)
> 4. Who consumes the result? (tax service for filing, entity-governance for compliance tracking)
> 5. What's the latency requirement?

**Expected Deliverable**: Service responsibility matrix with data flow diagram.

**Priority**: MEDIUM (needed for multi-jurisdiction implementation)

**Research Approach**:
- Existing service boundaries in ecosystem
- Data ownership principles
- Similar calculations in other services

---

## Research Execution Priority

### Immediate (Phase 0-1 Dependencies)

| ID | Question | Blocks |
|----|----------|--------|
| RQ-A1 | Foreign Qualification Triggers | Phase 0 jurisdiction profiles |
| RQ-C1 | Multi-Tier Ownership Calculation | Phase 1 BOI implementation |
| RQ-C2 | Substantial Control Detection | Phase 1 BOI implementation |
| RQ-C3 | Convertible Instruments & BOI | Phase 1 BOI edge cases |

### Near-Term (Phase 2 Dependencies)

| ID | Question | Blocks |
|----|----------|--------|
| RQ-A3 | Remote Employee Triggers | Phase 2 foreign qualification |
| RQ-B1 | Series LLC Recognition | Phase 2 LLC support |
| RQ-B2 | LLC-as-S-Corp Mechanics | Phase 2 entity type config |
| RQ-D3 | Parent-Sub Separation | Phase 2 multi-entity |
| RQ-F1 | Capital Account Integration | Phase 2 LLC capital accounts |

### Deferred (Phase 3+ Dependencies)

| ID | Question | Blocks |
|----|----------|--------|
| RQ-A2 | Tax Nexus Interaction | Phase 3 tax integration |
| RQ-B3 | S-Corp Termination | Phase 3 tax election tracking |
| RQ-D1 | Formality Frequency | Phase 3 veil health scoring |
| RQ-D2 | Intercompany Thresholds | Phase 3 intercompany tracking |
| RQ-E1 | SAFE Conversion Calc | Phase 3 cap table complexity |
| RQ-E2 | Down Round Mechanics | Phase 3 cap table complexity |
| RQ-F2 | Nexus Calc Ownership | Phase 3 service integration |

---

## Research Output Template

Each research question should produce a finding document in `research-findings/` with this structure:

```markdown
# Research Finding: [Topic]

## Question
[The refined research question]

## Summary
[2-3 sentence answer]

## Detailed Findings
[Full research results]

## Sources
[Citations with links]

## Implications for Entity-Governance
[How this affects implementation]

## Open Questions
[What this research revealed we still don't know]
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-27 | Initial creation - refined 16 research questions from curiosity areas |
