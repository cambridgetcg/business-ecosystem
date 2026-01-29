# Domain Name Disputes: UDRP and ACPA

## Research Question
How are domain name disputes resolved? What is the UDRP process vs. ACPA litigation? What constitutes bad faith in domain registrations?

## Current Model Gap
The IP service README mentions **Domain Names** as a core subdomain with planned entities for UDRP proceedings and cybersquatting claims, but:
- No domain name entity is implemented
- No dispute resolution workflow exists
- No tracking of bad faith factors
- No integration between trademark monitoring and domain disputes

---

## Key Findings

### Two Main Resolution Mechanisms

| Mechanism | Type | Jurisdiction | Remedies | Cost | Timeline |
|-----------|------|--------------|----------|------|----------|
| **UDRP** | Arbitration | International (ICANN) | Transfer or cancellation only | $1,300-$1,500 | 2-3 months |
| **ACPA** | Federal lawsuit | United States | Transfer + damages up to $100,000 | $20,000-$1,000,000 | 6-24 months |

### UDRP (Uniform Domain-Name Dispute Resolution Policy)

UDRP is a contractually-based, expedited online procedure administered by ICANN. It applies to all generic TLDs (.com, .org, .net, etc.).

#### Three Required Elements
To succeed in UDRP, complainant must prove **all three**:

1. **Identical or Confusingly Similar** - Domain name is identical or confusingly similar to a trademark in which complainant has rights

2. **No Rights or Legitimate Interests** - Registrant has no rights or legitimate interests in the domain name

3. **Bad Faith Registration and Use** - Domain was registered AND is being used in bad faith

#### Bad Faith Indicators (UDRP)
- Registered primarily to sell to trademark owner at inflated price
- Pattern of blocking trademark owners from reflecting marks in domains
- Registered to disrupt competitor's business
- Creating likelihood of confusion for commercial gain

#### UDRP Advantages
- Conducted entirely via email
- No discovery, testimony, or hearings
- Straightforward filing requirements
- **~75% success rate** for complainants
- Fast resolution (2-3 months)

#### UDRP Limitations
- **No monetary damages** - only transfer or cancellation
- Registrant can appeal to federal court within 10 days
- Does not prevent future re-registration by others

### ACPA (Anticybersquatting Consumer Protection Act)

ACPA is a U.S. federal law (15 U.S.C. Section 1125(d)) allowing trademark owners to sue cybersquatters for damages.

#### ACPA Requirements
Plaintiff must prove:
1. Plaintiff owns a **distinctive or famous mark**
2. Defendant's domain is **identical or confusingly similar**
3. Defendant acted with **bad faith intent to profit**

#### Nine Bad Faith Factors (ACPA)
Courts consider (not exhaustive):
1. Defendant's trademark or IP rights in the domain
2. Whether domain contains defendant's legal name
3. Prior use of domain for bona fide offering
4. Bona fide noncommercial or fair use
5. Intent to divert consumers for commercial gain
6. Offer to sell domain to mark owner without prior use
7. Provision of false contact information when registering
8. Acquisition of multiple domains corresponding to marks
9. Distinctiveness and fame of the mark

#### ACPA Remedies
- Domain transfer or cancellation
- **Statutory damages**: $1,000 to $100,000 per domain
- Actual damages and profits
- Attorney's fees (in exceptional cases)

### URS (Uniform Rapid Suspension)

A faster, cheaper alternative for **clear-cut** cases:
- Filing fee: ~$375
- Decision in ~20 days
- Only remedy: domain **suspension** (not transfer)
- Higher burden of proof than UDRP
- Best for obvious, blatant cybersquatting

### Choosing the Right Mechanism

| Situation | Recommended |
|-----------|-------------|
| Want domain transfer quickly | UDRP |
| Clear cybersquatting, want suspension | URS |
| Seeking monetary damages | ACPA |
| Serial cybersquatter causing harm | ACPA |
| Domain in non-US registry | UDRP |
| Need precedential decision | ACPA |

### 2024-2025 Updates

**UDRP Rule Changes (August 2025)**:
- Updated rules effective August 21, 2025
- Changes reflect Registration Data Policy requirements
- Modified procedures for accessing registrant data

---

## Domain Model Implications

### Missing Entity: DomainName

```typescript
interface DomainName {
  id: string;
  domainName: string;           // "example.com"
  tld: string;                  // "com"

  // Ownership
  ownerId: string;
  registrarName: string;
  registrationDate: Date;
  expirationDate: Date;

  // Status
  status: 'active' | 'expired' | 'suspended' | 'transferred' | 'cancelled';

  // Related trademark (if defensive registration)
  relatedTrademarkId?: string;
  registrationPurpose: 'primary' | 'defensive' | 'product' | 'campaign';

  // Dispute tracking
  hasActiveDispute: boolean;
}
```

### Missing Entity: DomainDispute

```typescript
interface DomainDispute {
  id: string;
  domainNameId: string;

  // Dispute type
  mechanism: 'udrp' | 'urs' | 'acpa' | 'other';
  provider?: string;           // WIPO, NAF, etc. for UDRP
  caseNumber: string;

  // Parties
  complainantId: string;       // Usually us
  respondentName: string;

  // Basis
  relatedTrademarkId: string;  // Our trademark being infringed
  badFaithFactors: BadFaithFactor[];

  // Timeline
  filedDate: Date;
  responseDeadline?: Date;
  decisionDate?: Date;

  // Outcome
  status: 'filed' | 'pending_response' | 'pending_decision' | 'decided' | 'appealed';
  outcome?: 'transfer' | 'cancellation' | 'suspension' | 'denied' | 'settled';
  damagesAwarded?: number;     // For ACPA

  // Documents
  complaintDocumentId?: string;
  decisionDocumentId?: string;
}

interface BadFaithFactor {
  factorType: 'sale_intent' | 'pattern_blocking' | 'competitor_disruption' |
              'confusion_commercial' | 'false_contact' | 'no_legitimate_use';
  description: string;
  evidenceIds: string[];
}
```

### Integration Points

- **Trademark entity**: Link disputes to the trademark being protected
- **Watch service**: Automated domain monitoring for similar registrations
- **Enforcement workflow**: Escalation path from monitoring to dispute

---

## Sources
- [ICANN UDRP Policy](https://www.icann.org/en/contracted-parties/consensus-policies/uniform-domain-name-dispute-resolution-policy/uniform-domain-name-dispute-resolution-policy-01-01-2020-en)
- [Overview of Domain Name Dispute Resolution - Cohen IP](https://patentlawip.com/blog/overview-of-domain-name-dispute-resolution-mechanisms-udrp-urs-and-federal-court-litigation/)
- [UDRP vs ACPA - ESQwire](https://esqwire.com/anticybersquatting-consumer-protection-act-vs-udrp/)
- [ACPA vs UDRP - Revision Legal](https://revisionlegal.com/internet-law/cybersquatting-lawyer/anti-cybersquatting-consumer-protection-act-vs-udrp/)
- [Cybersquatting and Brand Protection - UpCounsel](https://www.upcounsel.com/cybersquatting)
- [Fenwick UDRP vs ACPA Comparison](https://assets.fenwick.com/legacy/FenwickDocuments/UDRP_Versus_ACPA.pdf)

---

## Research Date
2026-01-27
