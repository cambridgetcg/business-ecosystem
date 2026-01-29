# Legal Domain Curiosities

Questions that emerged during exploration requiring deeper research.

---

## Contracts-Legal Questions

### E-Signature & Authentication

**Q1**: How do different e-signature providers (DocuSign, Adobe Sign, HelloSign) differ in their audit trail formats, and what's the minimum viable data we need to capture for legal defensibility?

**Why it matters**: Current `signatureRef: String?` is insufficient. Need to design `SignatureEvent` model that works across providers.

**Research needed**: Compare provider APIs, identify common audit trail elements.

---

**Q2**: When does an e-signature become invalid? What events (employee termination, contract amendment, system breach) require re-signing or re-authentication?

**Why it matters**: Signature validity isn't permanent. Need to understand lifecycle implications.

---

### Jurisdiction & Choice of Law

**Q3**: In a multi-entity ecosystem, how do we handle contracts where parties are in different jurisdictions? Does the primary entity's jurisdiction take precedence, or is it negotiated per contract?

**Why it matters**: Single `jurisdiction` field may need to be multiple: governing law, dispute forum, arbitration clause.

**Research needed**: Common multi-jurisdiction patterns in enterprise contract management.

---

**Q4**: How do international arbitration clauses (ICC, AAA, LCIA) interact with governing law? Can you have Swiss arbitration with California governing law?

**Why it matters**: Arbitration is often preferred but the interaction with governing law is complex.

---

### Legal Discovery

**Q5**: What triggers a litigation hold obligation? Is "reasonable anticipation" when a complaint is received, when a demand letter arrives, or when internal investigation starts?

**Why it matters**: Legal holds must be issued at the right time. Too late = spoliation. Too early = operational burden.

**Research needed**: Case law on litigation hold timing.

---

**Q6**: How do we handle privilege in a system that tracks all communications? Are audit logs discoverable? What metadata is protected?

**Why it matters**: Comprehensive audit trails could expose attorney-client privileged communications.

---

### Revenue Recognition

**Q7**: For SaaS contracts with implementation phases, when does revenue recognition begin? At contract signing, go-live, or first payment?

**Why it matters**: ASC 606 has complex rules for distinct performance obligations.

**Research needed**: ASC 606 guidance for technology/SaaS companies.

---

### Restrictive Covenants

**Q8**: Post-FTC ban failure (April 2024), what's the state of non-compete enforceability in the top 10 US states where our entities operate?

**Why it matters**: `nonCompeteDays` integer is meaningless without state context.

**Research needed**: State-by-state non-compete survey (California, Texas, New York, Illinois, etc.)

---

**Q9**: How do non-solicitation and non-disclosure covenants differ in enforceability from non-competes? Are they safer alternatives?

**Why it matters**: If non-competes are risky, alternatives need evaluation.

---

## Intellectual Property Questions

### Patent Prosecution

**Q10**: When a provisional application approaches its 12-month deadline, what's the decision tree for: convert to utility, file continuation, file PCT, or abandon?

**Why it matters**: Critical deadline with strategic implications. No workflow exists.

**Research needed**: Patent prosecution decision frameworks.

---

**Q11**: How does patent term adjustment (PTA) work, and can we calculate expected expiration more accurately than grant + 20 years?

**Why it matters**: Patent term can be extended for USPTO delays. Current model assumes simple 20-year term.

---

### Trade Secrets

**Q12**: What constitutes "reasonable measures" under DTSA for trade secret protection? Is there a checklist we should implement?

**Why it matters**: Trade Secret entity needs protection measures as core data.

**Research needed**: DTSA case law on reasonable measures.

---

**Q13**: How do we track trade secret disclosure during employee departures? What exit interview questions are recommended?

**Why it matters**: Trade secret protection extends to offboarding process.

---

### IP Licensing

**Q14**: How do FRAND licensing terms get determined? Is there a standard royalty rate calculator for standard-essential patents?

**Why it matters**: SEP licensing requires fair terms but "fair" is subjective.

**Research needed**: FRAND determination methodologies.

---

### Copyright

**Q15**: For AI-generated content (code from Copilot, images from DALL-E), who owns the copyright? How should we classify such works?

**Why it matters**: Emerging area with unclear copyright ownership.

**Research needed**: 2024-2025 AI copyright guidance and cases.

---

## Data Privacy Questions

### GDPR Implementation

**Q16**: What's the practical difference between data controller and data processor? When do we act as each, and how does this affect our obligations?

**Why it matters**: Core GDPR concept that affects entire privacy architecture.

---

**Q17**: How do we handle DSAR requests that span multiple systems? If a user requests "all my data," do we need to pull from contracts-legal (if they're a party), IP (if they're an inventor), etc.?

**Why it matters**: Cross-domain data subject requests are complex.

**Research needed**: Multi-system DSAR implementation patterns.

---

### Breach Response

**Q18**: What's the exact timeline for breach notification? GDPR says 72 hours - does that start at detection, confirmation, or assessment completion?

**Why it matters**: Tight timeline requires precise trigger definition.

**Research needed**: GDPR Article 33 guidance and case studies.

---

## Priority Ranking

| Question | Priority | Domain | Complexity |
|----------|----------|--------|------------|
| Q12 | CRITICAL | IP | High |
| Q5 | HIGH | Contracts | Medium |
| Q16 | HIGH | Privacy | Medium |
| Q17 | HIGH | Privacy | High |
| Q1 | HIGH | Contracts | Medium |
| Q10 | MEDIUM | IP | High |
| Q8 | MEDIUM | Contracts | Medium |
| Q18 | MEDIUM | Privacy | Low |
| Q7 | MEDIUM | Contracts | High |
| Q15 | LOW | IP | High |

---

## Next Steps

1. Research DTSA reasonable measures (Q12) - affects Trade Secret entity design
2. Research litigation hold timing (Q5) - affects LegalHold model
3. Investigate cross-domain DSAR patterns (Q17) - affects privacy architecture
