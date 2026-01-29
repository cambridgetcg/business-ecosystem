# Trade Secret Protection Requirements

## Research Question
What constitutes "reasonable measures" for trade secret protection? How do DTSA and UTSA requirements work?

## Current Model Gap
The IP service has **no Trade Secret entity at all**. This is a significant gap since trade secrets are a major form of IP protection that:
- Doesn't expire (unlike patents)
- Doesn't require registration (unlike patents/trademarks)
- Can be lost instantly if secrecy is breached
- Requires active "reasonable measures" to maintain

---

## Key Findings

### Trade Secret Definition (DTSA)

Under the Defend Trade Secrets Act (18 U.S.C. § 1836), a **trade secret** must have THREE elements:

1. **Information** - Financial, business, scientific, technical, economic, or engineering information in any form (formulas, patterns, compilations, programs, devices, methods, techniques, processes)

2. **Secret** - Not generally known or readily ascertainable through proper means

3. **Economic Value from Secrecy** - Derives independent economic value from not being known

**Critical**: The owner must have taken **"reasonable measures"** to keep it secret

### The "Reasonable Measures" Standard

**What it means**:
- NOT absolute secrecy (impossible)
- NOT extraordinarily expensive protocols
- IS "meaningful protective measures appropriate for industry and circumstances"
- IS ongoing, demonstrable effort

**2025 Case Law Update** (*Samuel Sherbrooke v. Mayer*, 4th Cir.):
- At pleading stage, simply alleging reasonable measures can be enough
- Employment confidentiality agreement CAN satisfy requirement (contrary to some district courts)
- But at trial, must prove measures were actually implemented

### Categories of Reasonable Measures

#### 1. Contractual Protections
- **NDAs with employees** - CRITICAL (courts have denied protection when missing)
- NDAs with contractors and consultants
- NDAs with business partners and vendors
- Non-compete agreements (where enforceable)
- Assignment of inventions clauses

#### 2. Physical Security
- Restricted access to sensitive areas
- Visitor logs and escorts
- Locked storage for physical documents
- "Confidential" markings on documents
- Clean desk policies

#### 3. Digital Security
- Access controls (need-to-know basis)
- Password protection
- Encryption for sensitive data
- Monitoring and audit logs
- DLP (Data Loss Prevention) tools
- Secure disposal of electronic devices

#### 4. Administrative Measures
- Written confidentiality policies
- Regular employee training
- Exit interviews and procedures
- Departing employee device audits
- Regular security audits
- Document classification system

### The NDA Requirement

NDAs are considered the **cornerstone** of trade secret protection:

**Failed protection example**: In a NY federal court case, an employer was denied injunction because:
- They HAD password-protected systems
- They HAD cybersecurity measures
- But employee NEVER SIGNED an NDA
- Employer failed to address this gap
- = No reasonable measures, no protection

### DTSA Whistleblower Notice Requirement

**Mandatory notice** in any contract restricting trade secret use:

> "An individual may not be held criminally or civilly liable under any federal or state trade secret law for the disclosure of a trade secret that is made in confidence to a federal, state, or local government official, or to an attorney, solely for the purpose of reporting or investigating a suspected violation of law..."

**Penalty for omission**: Forfeit rights to:
- Exemplary damages
- Attorney's fees

### Trade Secret vs Patent Choice

| Factor | Trade Secret | Patent |
|--------|--------------|--------|
| Duration | Potentially forever | 20 years max |
| Cost | Ongoing security costs | Filing/maintenance fees |
| Requirements | Maintain secrecy | Disclose everything |
| Protection | Only against misappropriation | Against all infringers |
| Loss risk | Instant if leaked | Gradual (prior art, invalidity) |
| Reverse engineering | No protection | Full protection |

### Types of Information Often Protected

- Customer lists and preferences
- Pricing strategies and algorithms
- Manufacturing processes
- Source code (especially proprietary algorithms)
- Business plans and strategies
- Research data and unpublished findings
- Formulas and recipes (e.g., Coca-Cola)
- Negative know-how (what doesn't work)

---

## Domain Model Implications

### Need New Entity: Trade Secret

The current model completely lacks trade secret support. This should be a first-class entity.

### Suggested Schema
```typescript
interface TradeSecret {
  id: string;
  title: string;
  description: string;
  
  // Classification
  category: 'technical' | 'business' | 'financial' | 'customer' | 'process' | 'formula' | 'other';
  sensitivityLevel: 'confidential' | 'highly_confidential' | 'restricted';
  
  // Ownership
  ownerId: string;
  departmentOwner?: string;
  custodian?: string;           // Person responsible for protection
  
  // Dates
  identifiedDate: Date;         // When formally identified as trade secret
  lastReviewDate?: Date;        // Regular reviews recommended
  
  // Status
  status: 'active' | 'disclosed' | 'abandoned' | 'converted_to_patent';
  
  // Economic value basis
  economicValueDescription: string;
  estimatedValue?: number;
  
  // Protection measures (audit trail)
  protectionMeasures: ProtectionMeasure[];
}

interface ProtectionMeasure {
  tradeSecretId: string;
  category: 'contractual' | 'physical' | 'digital' | 'administrative';
  measureType: string;          // "NDA", "Access Control", "Encryption", etc.
  description: string;
  implementedDate: Date;
  lastVerifiedDate?: Date;
  responsibleParty: string;
  status: 'active' | 'inactive' | 'needs_review';
  
  // For contractual measures
  relatedAgreementId?: string;
}

// Track who has access
interface TradeSecretAccess {
  tradeSecretId: string;
  personId: string;
  personType: 'employee' | 'contractor' | 'partner' | 'vendor';
  accessLevel: 'full' | 'partial' | 'view_only';
  grantedDate: Date;
  grantedBy: string;
  revokedDate?: Date;
  ndaId?: string;               // Link to signed NDA
  ndaSignedDate?: Date;
}

// Disclosure/breach events
interface TradeSecretIncident {
  tradeSecretId: string;
  incidentType: 'potential_disclosure' | 'confirmed_disclosure' | 'theft' | 'reverse_engineering';
  discoveredDate: Date;
  description: string;
  responseMeasures: string;
  legalActionTaken: boolean;
  dtfaClaim?: boolean;          // DTSA federal claim
  stateClaim?: boolean;         // UTSA state claim
  outcome?: string;
}

// Whistleblower notice tracking
interface WhistleblowerNotice {
  agreementId: string;
  noticeIncluded: boolean;
  noticeText?: string;
  complianceVerifiedDate?: Date;
  complianceVerifiedBy?: string;
}
```

### Integration with Existing License Entity

Trade secrets can be licensed. Current `License.ipType` includes `'trade_secret'` but there's no `TradeSecret` entity to reference. Need to add:
- Link from License to TradeSecret
- Special license provisions for trade secrets:
  - Confidentiality obligations
  - Return/destruction on termination
  - Audit rights
  - Exclusivity implications

---

## Sources
- [Fourth Circuit Reasonable Efforts Standard 2025 - IPWatchdog](https://ipwatchdog.com/2025/12/02/fourth-circuit-clarifies-reasonable-efforts-standard-dtsa-trade-secret-protection/)
- [Trade Secret Protection 2025 - Ward and Smith](https://www.wardandsmith.com/article/trade-secret-protection-in-2025-what-in-house-counsel-need-to-know)
- [DTSA Notice Provision - Katten](https://katten.com/The-Notice-Provision-of-the-Defend-Trade-Secrets-Act)
- [Explaining DTSA - American Bar Association](https://www.americanbar.org/groups/business_law/resources/business-law-today/2016-september/explaining-the-defend-trade-secrets-act/)
- [18 USC Chapter 90 - Protection of Trade Secrets](https://uscode.house.gov/view.xhtml?path=/prelim@title18/part1/chapter90&edition=prelim)
- [DTSA Five Key Lessons - Pierce Atwood](https://www.pierceatwood.com/alerts/defend-trade-secrets-act-five-key-lessons)

---

## Research Date
2026-01-26
