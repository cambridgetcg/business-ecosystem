# Legal & Regulatory Dimension

Understanding of legal concepts, regulatory frameworks, and compliance requirements across the operational ecosystem.

---

## Overview

The operational ecosystem operates at the intersection of multiple legal and regulatory domains. Each operational service must comply with specific regulations while coordinating with others for unified compliance.

---

## Contracts-Legal Domain

### Understanding Level: [S] Solid

**What We Understand**:

#### Contract Law Fundamentals
- **Document Lifecycle**: DRAFT → PENDING_REVIEW → APPROVED → ACTIVE → EXPIRED/TERMINATED
- **Party Management**: Multi-party contracts with role-based signing (BUYER, SELLER, EMPLOYER, etc.)
- **Obligation Tracking**: PAYMENT, DELIVERY, PERFORMANCE, REPORTING types with status tracking
- **Soft Deletes**: Legal defensibility requires never hard-deleting contracts

#### E-Signature Requirements (Research 01)
- **ESIGN Act & UETA**: Four requirements - intent, consent, association, retention
- **Gap Identified**: Current `signatureRef: String?` is insufficient
- **Needed**: `SignatureEvent` model capturing ceremony (hash, consent method, IP/device)

#### Jurisdiction vs Governing Law (Research 02)
- **Distinction**: WHERE disputes heard (jurisdiction) vs WHICH law applies (governing law)
- **Gap Identified**: Only `jurisdiction` field exists
- **Impact**: Contract enforcement depends on this distinction

#### Non-Compete Enforceability (Research 03)
- **Current State**: FTC non-compete ban is DEAD (April 2024)
- **Reality**: State-by-state patchwork - California bans, others vary
- **Gap Identified**: `nonCompeteDays` integer is insufficient
- **Needed**: `RestrictiveCovenant` model with state-specific enforceability

#### Legal Discovery (Research 04)
- **EDRM Framework**: 8 phases (Identification → Preservation → Collection → Processing → Review → Analysis → Production → Presentation)
- **Gap Identified**: `IN_DISCOVERY` status exists but no supporting models
- **Needed**: `LegalHold`, `DiscoveryRequest`, `PrivilegeLog` models
- **Critical**: Holds must be issued at "reasonable anticipation" not after filing

#### Amendment vs Addendum (Research 05)
- **Amendment**: CHANGES existing terms
- **Addendum**: ADDS new terms
- **Gap Identified**: Both in enum but no differentiation logic
- **Needed**: `ContractModification` with type and supersession tracking

#### Revenue Recognition ASC 606 (Research 06)
- **Five-Step Model**: Identify contract → Identify obligations → Determine price → Allocate → Recognize
- **Reality**: Revenue on performance satisfaction, NOT on signing
- **Gap Identified**: No `PerformanceObligation` or `Milestone` models

#### Force Majeure (Research 07)
- **COVID Lesson**: Specific language matters ("pandemic" survived, "Acts of God" didn't)
- **Gap Identified**: Not modeled at all
- **Needed**: `ForceMajeure` and `ForceMajeureEvent` models

#### Material Breach (Research 08)
- **Distinction**: Material breach vs substantial performance vs breach with cure opportunity
- **Gap Identified**: Clean status transitions assumed
- **Needed**: `BreachAllegation` and `CureAttempt` models

---

## Intellectual Property Domain

### Understanding Level: [S] Solid

**What We Understand**:

#### Patent Law
- **Types**: Utility, Design, Plant, Reissue
- **Lifecycle**: Draft → Provisional → Pending → Published → Granted → Expired/Abandoned
- **Key Dates**: Filing, Priority, Publication, Grant, Expiration

#### Patent Families (Research 01)
- **Continuation**: Same priority, continuing prosecution
- **Divisional**: Restriction-driven split
- **CIP**: Continuation-in-part with new matter (split priority)
- **Gap Identified**: No `familyId`, `parentPatentId`, `continuationType`
- **2025 Fees**: $2,700-$4,000 surcharge for late continuations

#### PCT International Filing (Research 02)
- **Timeline**: 21-month publication, 30-month national phase
- **Gap Identified**: No PCT workflow distinction
- **Needed**: `isPCTApplication`, `pctPublicationNumber`, `nationalPhaseDeadline`

#### Patent Maintenance Fees (Research 03)
- **Schedule**: 3.5, 7.5, 11.5 years post-grant
- **Entity Sizes**: Small (50%), Micro (25%)
- **Gap Identified**: No fee tracking, no lapse distinction
- **Needed**: `MaintenanceFee` table, `entitySize`, `lapseReason`

#### Trademark Law
- **Types**: Word, Design, Combined, Sound, Color, 3D
- **Classification**: Nice Classification for goods/services
- **Lifecycle**: Draft → Pending → Published → Opposed → Registered → Expired

#### Trademark Use Requirements (Research 04)
- **Section 8**: Use declaration at years 5-6 and 9-10
- **Section 9**: Renewal every 10 years
- **Gap Identified**: No declaration tracking
- **Needed**: `Section8Status`, `useStatusPerClass[]`, specimen storage

#### Madrid Protocol (Research 05)
- **IR System**: Single filing for multiple countries
- **Dependency Period**: 18 months - central attack vulnerability
- **Gap Identified**: No international registration tracking
- **Needed**: `isMadridRegistration`, `madridIRNumber`, `dependencyPeriodExpiryDate`

#### Copyright Law
- **Duration**: Life + 70 years (individual), 95 years from publication (work for hire)
- **Work Types**: Literary, Musical, Audiovisual, Software, etc.
- **Gap Identified**: Duration not auto-calculated (Research 06)

#### FRAND & Compulsory Licensing (Research 07)
- **SEPs**: Standard Essential Patents require FRAND licensing
- **March-in Rights**: Government can compel licensing for federally-funded research
- **Gap Identified**: No `isSEP`, `frandObligation`, `federalFundingSource`

#### Trade Secrets (Research 08) - CRITICAL GAP
- **DTSA**: Requires whistleblower notice, "reasonable measures"
- **Protection**: Indefinite if secret maintained
- **Gap Identified**: NO Trade Secret entity exists at all
- **Needed**: Complete `TradeSecret` entity with protection measures, access logs

---

## Data Privacy Domain

### Understanding Level: [~] Surface

**What We Understand**:

#### Regulatory Framework
| Regulation | Jurisdiction | Key Requirements |
|-----------|--------------|------------------|
| GDPR | EU/EEA | Consent, DSAR (30-day), DPIAs, breach (72h) |
| CCPA/CPRA | California | Right to know, delete, opt-out |
| LGPD | Brazil | GDPR-like requirements |
| POPIA | South Africa | Processing conditions |
| PDPA | Singapore | Consent, access, correction |

#### Lawful Basis (GDPR Article 6)
- CONSENT, CONTRACT, LEGAL_OBLIGATION, VITAL_INTEREST, PUBLIC_TASK, LEGITIMATE_INTEREST

#### Data Subject Rights
- ACCESS, RECTIFICATION, ERASURE, PORTABILITY, RESTRICTION, OBJECTION
- 30-day response deadline

#### Gap Areas
- Implementation not yet built (scaffold only)
- Consent capture mechanism unknown
- DPIA process undefined
- Breach workflow not detailed
- DSAR handling process unclear

---

## Insurance Domain

### Understanding Level: [~] Surface

**What We Understand**:

#### Coverage Types
| Type | Purpose |
|------|---------|
| General Liability | Commercial GL coverage |
| Professional Liability | E&O, D&O, EPLI, Fiduciary |
| Property | Asset and business interruption |
| Workers' Compensation | Employee injury, state-mandated |
| Cyber | Data breach, network security |
| Product Liability | Defects and recalls |

#### Workers' Compensation Specifics
- State-by-state requirements
- NCCI classification codes
- Experience modification rates
- Payroll audits

#### Gap Areas
- Implementation not yet built (scaffold only)
- Carrier integration undefined
- Claims workflow not detailed
- Policy renewal automation unclear

---

## Cross-Domain Compliance

### Understanding Level: [S] Solid

**What We Understand**:

#### Compliance Aggregation
- Regulatory mappings define domain-specific requirements
- Status calculation: non-compliant if ANY domain fails
- Findings tracked with severity (critical/high/medium/low)

#### Regulatory Mappings (Example: GDPR)
```yaml
domains:
  - data-privacy: lawful-basis, consent, DSAR, breach-notification
  - contracts-legal: DPAs, SCCs
  - insurance: cyber-liability, data-breach coverage
```

---

## Key Legal Insights

1. **Legal defensibility requires audit trails** - Soft deletes, version history, signature ceremonies
2. **Jurisdiction complexity is underestimated** - Governing law vs forum vs arbitration
3. **Regulatory overlap is common** - Same data touches GDPR, contracts, insurance
4. **State-level variation matters** - Non-competes, workers' comp, data privacy
5. **Temporal aspects are critical** - Deadlines (72h breach, 30-day DSAR), maintenance windows, renewal periods
