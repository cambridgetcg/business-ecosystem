# Knowledge Gap Research Index

Research documents identifying and exploring nuances not fully understood in the initial contracts-legal implementation.

---

## Methodology: "Become Water"

These gaps were identified by examining the implementation with fresh eyes, asking: *Where does the code make assumptions? Where are terms used without deep understanding? Where does the model feel borrowed rather than truly comprehended?*

---

## Research Documents

| # | Topic | Gap Signal | Key Finding |
|---|-------|-----------|-------------|
| 01 | [E-Signature Legal Requirements](./01-e-signature-legal-requirements.md) | `signatureRef: String?` too vague | Four legal requirements (intent, consent, association, retention) must be captured |
| 02 | [Jurisdiction vs Governing Law](./02-jurisdiction-vs-governing-law.md) | Only `jurisdiction` modeled | Two distinct concepts: WHERE disputes heard vs WHICH law applies |
| 03 | [Non-Compete Enforceability](./03-non-compete-enforceability.md) | `nonCompeteDays` as simple int | Enforceability varies by state; FTC ban is dead; need full covenant modeling |
| 04 | [Legal Discovery Process](./04-legal-discovery-process.md) | `IN_DISCOVERY` status undefined | EDRM 8-phase process; legal holds critical; massive data implications |
| 05 | [Amendment vs Addendum](./05-amendment-vs-addendum.md) | Both in enum, undifferentiated | Amendment CHANGES terms; Addendum ADDS terms; different use cases |
| 06 | [Revenue Recognition (ASC 606)](./06-revenue-recognition-asc606.md) | "signed → revenue" oversimplified | Revenue on PERFORMANCE OBLIGATION satisfaction, not signing |
| 07 | [Force Majeure Clauses](./07-force-majeure-clauses.md) | Not modeled at all | COVID-19 exposed gap; need structured FM clause and event tracking |
| 08 | [Material Breach vs Substantial Performance](./08-material-breach-substantial-performance.md) | Clean status transitions assumed | Contracts exist in murky middle ground; need breach/cure tracking |

---

## Schema Enhancement Summary

Each document proposes specific Prisma schema enhancements. Key additions needed:

### New Models
- `SignatureEvent` - Full e-signature ceremony tracking
- `ForceMajeureClause` - Structured FM provision extraction
- `ForceMajeureEvent` - FM invocation tracking
- `PerformanceObligation` - ASC 606 compliance
- `Milestone` - Revenue recognition milestones
- `DiscoveryInfo` - eDiscovery tracking
- `LegalHold` - Litigation hold management
- `DiscoveryRequest` - Request/response tracking
- `PrivilegeLogEntry` - Privilege claims
- `ContractModification` - Amendment/addendum tracking
- `RestrictiveCovenant` - Non-compete/non-solicit with enforceability
- `PerformanceIssue` - Performance deficiency tracking
- `BreachAllegation` - Breach claim management
- `CureAttempt` - Cure period tracking

### Contract Model Additions
- `governingLaw`, `governingLawCountry`
- `forumSelection`, `forumSelectionType`
- `arbitrationClause`, `arbitrationRules`, `arbitrationSeat`
- `revenueRecognitionMethod`

---

## Implementation Priority

### Critical (Legal Compliance)
1. E-Signature requirements (liability risk)
2. Force majeure tracking (operational risk)
3. Legal discovery/hold management (litigation risk)

### High (Business Value)
4. Revenue recognition integration (accounting compliance)
5. Breach/performance tracking (dispute management)
6. Amendment/addendum workflow (contract hygiene)

### Medium (Enhanced Functionality)
7. Non-compete enforceability analysis
8. Jurisdiction/governing law structured capture

---

## Sources

All research documents include source citations from:
- Legal information institutes (Cornell LII, etc.)
- Major law firms (Norton Rose Fulbright, Gibson Dunn, Paul Weiss, etc.)
- Professional organizations (ABA, FASB, etc.)
- Industry guidance (DocuSign, Adobe, etc.)

---

## Next Steps

1. Review with legal counsel for accuracy
2. Prioritize schema enhancements
3. Plan implementation phases
4. Update service layer to support new models
5. Add validation rules for new business logic
