# Understanding Coverage Integration Map

## Purpose

This document maps the current state of understanding across the entity-governance system, identifying:
- What is deeply understood (research coverage)
- What is implemented (code coverage)
- What gaps exist between understanding and implementation
- What curiosity questions remain unanswered

---

## Understanding Dimensions

### Dimension 1: Legal/Regulatory Domain Knowledge

Understanding of laws, regulations, and legal structures that govern business entities.

| Topic | Research Doc | Understanding Level | Key Insights |
|-------|-------------|---------------------|--------------|
| Jurisdiction Complexity | 01 | ENABLED | 4 contexts (formation, qualification, tax nexus, regulatory) are INDEPENDENT |
| LLC Operating Agreements | 02 | ENABLED | LLCs use contractual partnership patterns, NOT corporate patterns |
| Beneficial Ownership/CTA | 03 | ENABLED | Federal requirement, 25% OR substantial control test, 23 exemptions |
| Multi-Jurisdiction Compliance | 07 | ENABLED | Formation state != operating states, separate compliance per qualification |

### Dimension 2: Business Domain Concepts

Core business concepts around entity governance, ownership, and compliance.

| Topic | Research Doc | Understanding Level | Key Insights |
|-------|-------------|---------------------|--------------|
| Entity Type Governance | 04 | ENABLED | Each type has unique governance, formality, and tax characteristics |
| Cap Table Complexity | 05 | ENABLED | Liquidation prefs, anti-dilution, SAFEs/notes, option pools, 409A |
| Corporate Veil Formalities | 06 | ENABLED | Unity of interest + inequitable result test, formality checklist critical |
| Holding Company Structures | 08 | UNDERSTANDS | Tax efficiency (DRD, consolidated), liability isolation, blocker corporations |

---

## Implementation Coverage Matrix

```
                    UNDERSTANDING
                    ────────────────►
                    LOW        HIGH
              ┌──────────┬──────────┐
         HIGH │          │ IDEAL    │
              │          │          │
    IMPL      ├──────────┼──────────┤
              │ RISK     │ GAP      │
         LOW  │ ZONE     │ ZONE     │
              └──────────┴──────────┘

Current State: Most topics in GAP ZONE (high understanding, low implementation)
```

### Gap Analysis by Topic

| Research Topic | Understanding | Implementation | Gap Severity | Schema Extensions Needed |
|----------------|---------------|----------------|--------------|-------------------------|
| 01-jurisdiction-complexity | 95% | 15% | **HIGH** | foreignQualifications, taxNexus, jurisdictionProfiles |
| 02-llc-operating-agreements | 90% | 10% | **HIGH** | operatingAgreements, members, capitalAccounts, managers |
| 03-beneficial-ownership-cta | 95% | 5% | **CRITICAL** | beneficialOwners, boiFilings, ID document fields |
| 04-entity-type-governance | 85% | 20% | **HIGH** | entityGovernanceConfig, partnershipRoles, trustParties |
| 05-cap-table-complexity | 90% | 30% | **MEDIUM** | liquidationPreferences, antiDilutionTerms, convertibleInstruments, optionPools, valuations409a |
| 06-corporate-veil-formalities | 90% | 35% | **MEDIUM** | intercompanyAgreements, intercompanyLoans, veilHealthAssessments |
| 07-multi-jurisdiction | 85% | 20% | **HIGH** | foreignQualifications, qualificationRegisteredAgents |
| 08-holding-structures | 80% | 25% | **MEDIUM** | purposeClassification, taxClassification, taxElections, cfcStatus |

---

## Current Implementation Inventory

### Tables Implemented (schema.ts)

```
ENTITY SUBDOMAIN
├── legalEntities           ✓ Basic entity info, simple jurisdiction
└── incorporationDocuments  ✓ Document references

CORPORATE STRUCTURE
└── parentSubsidiaryRelationships  ✓ Basic ownership %, no purpose classification

GOVERNANCE
├── boards                  ✓ Corporate board tracking
├── committees              ✓ Board committees
└── bylaws                  ✓ Corporate bylaws (NOT LLC operating agreements)

SHAREHOLDERS
├── shareholders            ✓ Basic shareholder info (missing BOI fields)
├── shareClasses            ✓ Basic classes (missing liquidation pref types)
├── shareholdings           ✓ Share ownership
└── equityGrants            ✓ Option/RSU grants (missing option pools)

OFFICERS & DIRECTORS
├── directors               ✓ Board members
└── officers                ✓ Company officers

CORPORATE RECORDS
├── meetingMinutes          ✓ Meeting documentation
└── resolutions             ✓ Board/shareholder resolutions

REGISTERED AGENT
└── registeredAgents        ✓ One per entity (missing per-qualification agents)

ANNUAL FILINGS
├── filingRequirements      ✓ Filing rules
└── annualFilings           ✓ Filing tracking
```

### Tables NOT Implemented (from research)

```
MULTI-JURISDICTION (01, 07)
├── foreignQualifications       ✗ Where entity is authorized to do business
├── qualificationRegisteredAgents  ✗ Agent per qualified state
├── qualificationFilingRequirements  ✗ Filings per qualification
├── taxNexus                    ✗ Tax presence by jurisdiction
└── jurisdictionProfiles        ✗ State-specific rules

LLC SUPPORT (02)
├── operatingAgreements         ✗ LLC governing document
├── members                     ✗ LLC owners (not shareholders)
├── capitalAccounts             ✗ LLC economic tracking
├── managers                    ✗ Manager-managed LLC leadership
└── llcSeries                   ✗ Series LLC support

BENEFICIAL OWNERSHIP (03)
├── beneficialOwners            ✗ CTA-required data
├── boiFilings                  ✗ FinCEN filing tracking
└── companyApplicants           ✗ Formation filer tracking

ENTITY TYPE SPECIFIC (04)
├── entityGovernanceConfig      ✗ Type-specific settings
├── partnershipRoles            ✗ GP/LP roles
└── trustParties                ✗ Grantor/trustee/beneficiary

CAP TABLE ADVANCED (05)
├── liquidationPreferences      ✗ Preference mechanics
├── antiDilutionTerms           ✗ Investor protections
├── convertibleInstruments      ✗ SAFEs, notes, warrants
├── optionPools                 ✗ Equity incentive plans
└── valuations409a              ✗ FMV tracking

CORPORATE VEIL (06)
├── intercompanyAgreements      ✗ Related-party contracts
├── intercompanyLoans           ✗ Related-party debt
├── capitalizationHistory       ✗ Capital adequacy tracking
└── veilHealthAssessments       ✗ Formality compliance scoring

HOLDING STRUCTURES (08)
├── taxElections                ✗ Check-the-box, S-Corp elections
├── blockerRelationships        ✗ Tax blocker tracking
└── cfcStatus                   ✗ Foreign corp status
```

---

## Cross-Topic Relationships

### Dependency Graph

```
                    ┌─────────────────────────┐
                    │ 01-jurisdiction-complexity│
                    │ (Foundation for all)     │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│07-multi-juris │     │08-holding-co  │     │03-beneficial  │
│   compliance  │     │  structures   │     │   ownership   │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│04-entity-type │     │05-cap-table   │     │06-corporate   │
│  governance   │◄────│  complexity   │────►│     veil      │
└───────┬───────┘     └───────────────┘     └───────────────┘
        │
        ▼
┌───────────────┐
│02-llc-operat- │
│ing-agreements │
└───────────────┘
```

### Shared Concepts Across Topics

| Concept | Appears In | Significance |
|---------|-----------|--------------|
| **Ownership Percentage** | 03, 05, 08 | CTA threshold (25%), DRD threshold (80%), CFC determination |
| **Jurisdiction** | 01, 07, 08 | Formation, qualification, nexus, international |
| **Entity Type** | 02, 04, 06 | Governance requirements, formalities, tax treatment |
| **Substantial Control** | 03, 04, 06 | CTA test, GP liability, veil piercing |
| **Transfer Pricing** | 06, 08 | Intercompany transactions, holding structures |

---

## Priority Recommendations

### Critical (Regulatory Compliance Risk)

1. **Beneficial Ownership / CTA** (03)
   - Federal law requires BOI reporting
   - Penalties: $500/day, up to $10K, criminal liability
   - **Action**: Implement beneficialOwners and boiFilings tables

### High (Core Functionality Gap)

2. **Multi-Jurisdiction Compliance** (01, 07)
   - Entities operate across multiple states
   - Without this, cannot track where entity is legally authorized
   - **Action**: Implement foreignQualifications table

3. **LLC Support** (02)
   - LLCs are most common entity type
   - Current model only fits corporations
   - **Action**: Implement operatingAgreements, members, capitalAccounts

4. **Entity Type Governance** (04)
   - Different types have different requirements
   - Generic handling leads to compliance gaps
   - **Action**: Implement entityGovernanceConfig, partnershipRoles

### Medium (Feature Enhancement)

5. **Cap Table Complexity** (05)
   - Needed for proper investor management
   - **Action**: Implement liquidation preferences, convertibles, 409A

6. **Corporate Veil** (06)
   - Needed for parent-subsidiary protection
   - **Action**: Implement intercompany agreement tracking

7. **Holding Structures** (08)
   - Tax optimization and liability isolation
   - **Action**: Implement tax elections, purpose classification

---

## Curiosity Questions (Research Backlog)

### Multi-Jurisdiction (Dimension: Legal/Regulatory)

1. How do P.L. 86-272 protections interact with economic nexus for income tax?
2. What are the specific "doing business" triggers for the top 10 states?
3. How do domestication/conversion procedures differ by state?
4. What documentation is required for nexus defense in an audit?

### Entity Governance (Dimension: Legal/Regulatory)

5. How do courts treat "informal" S-Corps that missed the 2553 deadline?
6. What is the liability exposure for a GP in an LP structured with an LLC as GP?
7. How do different states treat Series LLCs (especially in non-recognizing states)?
8. What triggers re-evaluation of nonprofit tax-exempt status?

### Business Domain (Dimension: Business Concepts)

9. How do you calculate fully diluted ownership with multiple SAFE caps?
10. What are the 409A implications of a down round with full ratchet?
11. How do distribution waterfalls interact with tax allocations in LLCs?
12. What metrics should trigger automated "veil health" alerts?

### Integration (Dimension: System Design)

13. How should entity-governance integrate with accounting for capital account tracking?
14. Should economic nexus calculation live in entity-governance or tax service?
15. How do we model scenario analysis for exit waterfalls?
16. What triggers should auto-generate BOI update filings?

---

## Research Document Index

| Doc | Title | Primary Dimension | Secondary Dimension |
|-----|-------|-------------------|---------------------|
| 01 | Jurisdiction Complexity | Legal/Regulatory | Multi-Jurisdiction |
| 02 | LLC Operating Agreements | Legal/Regulatory | Entity Types |
| 03 | Beneficial Ownership/CTA | Legal/Regulatory | Business Domain |
| 04 | Entity Type Governance | Legal/Regulatory | Entity Types |
| 05 | Cap Table Complexity | Business Domain | - |
| 06 | Corporate Veil Formalities | Legal/Regulatory | Business Domain |
| 07 | Multi-Jurisdiction Compliance | Legal/Regulatory | Multi-Jurisdiction |
| 08 | Holding Company Structures | Business Domain | Legal/Regulatory |

---

## Understanding Maps Index

| Map | Title | Topics Covered |
|-----|-------|----------------|
| 00 | Integration Map (this doc) | All |
| 01 | Multi-Jurisdiction Complexity | 01, 07 |
| 02 | Legal Entity Types | 02, 04 |
| 03 | Business Domain Concepts | 03, 05, 06, 08 |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-27 | Initial creation - mapped 8 research docs, identified gaps, prioritized work |
