# IP Due Diligence in Mergers & Acquisitions

## Research Question
What should IP due diligence cover in M&A transactions? What are the key risks and deal-breakers? How do equity vs. asset purchases differ for IP?

## Current Model Gap
The IP service does not support:
- Due diligence workflow for evaluating third-party IP portfolios
- Risk scoring for IP assets
- Integration with M&A deal tracking
- IP-specific representations and warranties tracking

---

## Key Findings

### Why IP Due Diligence Matters

**The Rolls Royce Example (1998)**:
When Volkswagen acquired Rolls Royce Motor Cars, they discovered *after closing* that the acquired assets did not include the right to use the "Rolls Royce" trademark. BMW owned it. VW paid over $700M but couldn't use the name.

**Modern IP Value**:
- Intangible assets now represent **90%+ of S&P 500 market value**
- IP often *is* the acquisition target (acqui-hires, technology buys)
- IP defects can destroy deal value

### Core Questions in IP Due Diligence

1. **What IP does the target actually own?**
2. **What third-party IP does it rely on?**
3. **Is the target infringing anyone's IP?**
4. **How will the transaction affect IP rights?**

### Comprehensive IP Due Diligence Checklist

#### 1. Patents

**Ownership Verification**:
- [ ] All patents and applications listed
- [ ] Chain of title documented (assignments recorded at USPTO)
- [ ] Inventor assignments obtained
- [ ] No co-owners with blocking rights

**Status Check**:
- [ ] Maintenance fees current
- [ ] No abandonment or lapse
- [ ] Prosecution status for pending applications
- [ ] Foreign counterparts identified

**Value Assessment**:
- [ ] Claim scope analysis
- [ ] Remaining term
- [ ] Enforcement history
- [ ] Licensing revenue (if any)

**Risk Assessment**:
- [ ] FTO for core products
- [ ] Pending or threatened litigation
- [ ] IPR/PGR challenges
- [ ] Validity concerns

#### 2. Trademarks

**Ownership Verification**:
- [ ] Registrations and applications listed
- [ ] Assignments recorded
- [ ] Use evidence documented
- [ ] No unauthorized licensees

**Status Check**:
- [ ] Registrations in good standing
- [ ] Section 8/9 declarations current
- [ ] Madrid dependencies identified
- [ ] Domain names secured

**Risk Assessment**:
- [ ] Opposition/cancellation proceedings
- [ ] Likelihood of confusion with third-party marks
- [ ] Geographic gaps in protection

#### 3. Copyrights

**Ownership Verification**:
- [ ] Work-for-hire documentation
- [ ] Contractor assignments
- [ ] Registration status
- [ ] Moral rights (international)

**Software-Specific**:
- [ ] Source code ownership clear
- [ ] Open source components identified
- [ ] License compatibility verified
- [ ] SBOM available

#### 4. Trade Secrets

**Protection Verification**:
- [ ] Trade secrets identified and documented
- [ ] NDAs with employees/contractors
- [ ] Protection measures in place
- [ ] Access controls documented

**Risk Assessment**:
- [ ] Departed employees (potential misappropriation)
- [ ] Prior employer IP claims
- [ ] DTSA whistleblower notices in contracts

#### 5. Third-Party Licenses

**Inbound Licenses**:
- [ ] All licenses necessary for business identified
- [ ] Assignability provisions reviewed
- [ ] Change of control triggers identified
- [ ] Consent requirements noted

**Outbound Licenses**:
- [ ] Revenue-generating licenses documented
- [ ] Exclusivity provisions reviewed
- [ ] Termination rights analyzed
- [ ] Sublicense restrictions understood

### Equity vs. Asset Purchase: IP Implications

| Issue | Equity Purchase | Asset Purchase |
|-------|-----------------|----------------|
| **IP transfer** | Automatic (entity owns IP) | Explicit assignment required |
| **Third-party licenses** | Usually flow through | May require consent/assignment |
| **Change of control clauses** | Often triggered | May or may not apply |
| **Liabilities** | Inherited | Can be left behind |
| **Recording requirements** | Minimal | Must record all assignments |

**Key Risk in Asset Deals**:
Anti-assignment clauses in licenses may prevent transfer. Review EVERY material license.

### Change of Control Provisions

Common license terms that trigger on M&A:

1. **Termination rights** - Licensor can terminate on change of control
2. **Consent requirements** - Must get approval for assignment
3. **Renegotiation rights** - Terms may be revisited
4. **Non-assignability** - License cannot transfer at all

**Due Diligence Action**: Flag all change-of-control provisions and assess deal impact.

### Cross-Border Considerations

| Jurisdiction | Key IP Due Diligence Issues |
|--------------|---------------------------|
| **Canada** | No "work for hire" concept; moral rights stay with creator |
| **EU** | Database rights; moral rights |
| **India** | Software not patentable (copyright only) |
| **China** | First-to-file trademark system; technology export controls |
| **Japan** | Employee invention compensation rules |

### IP-Related Deal Terms

**Representations and Warranties**:
- Seller owns all IP free of encumbrances
- No infringement of third-party rights
- All registrations in good standing
- No pending or threatened litigation
- All necessary licenses in place
- No undisclosed IP obligations

**Indemnification**:
- IP infringement claims
- Breach of IP representations
- Third-party license disputes

**Escrow Arrangements**:
- Source code escrow (technology deals)
- IP holdbacks for identified issues

### Red Flags and Deal Breakers

**Potential Deal Breakers**:
- Core technology is licensed, not owned
- Key patent about to expire or challenged
- Undisclosed infringement litigation
- Missing inventor assignments
- Non-assignable critical licenses
- Open source copyleft contamination in proprietary product

**Yellow Flags (Require Remediation)**:
- Incomplete chain of title (can often be fixed)
- Unregistered IP (can be registered)
- Lapsed maintenance (may be revivable)
- Missing NDAs (going forward risk)

### IP Due Diligence Timeline

```
Pre-LOI          LOI Signed       Due Diligence      Signing         Closing
   |                 |                 |                |               |
   v                 v                 v                v               v
High-level     Preliminary        Deep dive        Finalize        Record
IP review      IP inventory      IP audit         R&Ws/indemnity   assignments
               request                            Negotiate        Close gaps
                                                  remediation
```

### Post-Closing IP Integration

- Record all IP assignments
- Update registrations (name/address changes)
- Consolidate IP management
- Integrate into buyer's IP systems
- Notify relevant third parties
- Update insurance coverage

---

## Domain Model Implications

### New Entity: IPDueDiligenceProject

```typescript
interface IPDueDiligenceProject {
  id: string;

  // Deal context
  dealName: string;
  targetCompanyName: string;
  dealType: 'equity_purchase' | 'asset_purchase' | 'merger' | 'joint_venture';
  dealValue?: number;

  // Timeline
  startDate: Date;
  targetClosingDate?: Date;
  actualClosingDate?: Date;
  status: 'in_progress' | 'completed' | 'deal_terminated';

  // Scope
  ipCategories: ('patents' | 'trademarks' | 'copyrights' | 'trade_secrets' | 'licenses')[];
  jurisdictions: string[];

  // Team
  leadAttorney?: string;
  teamMembers?: string[];
  externalCounsel?: string;

  // Findings
  findings: DueDiligenceFinding[];
  overallRiskRating: 'low' | 'medium' | 'high' | 'critical';

  // Documents
  dueDiligenceReportId?: string;
  dataRoomAccess?: string;
}

interface DueDiligenceFinding {
  id: string;
  category: 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'license' | 'litigation' | 'other';
  assetId?: string;              // Reference to specific IP asset if applicable

  // Finding details
  findingType: 'gap' | 'risk' | 'defect' | 'opportunity' | 'information';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  title: string;
  description: string;

  // Impact
  dealImpact: 'deal_breaker' | 'price_adjustment' | 'remediation_required' |
              'risk_allocation' | 'monitoring' | 'none';
  estimatedValueImpact?: number;

  // Remediation
  remediationRequired: boolean;
  remediationPlan?: string;
  remediationDeadline?: Date;
  remediationResponsibility: 'buyer' | 'seller' | 'both';
  remediationStatus?: 'pending' | 'in_progress' | 'completed' | 'waived';

  // Documentation
  supportingDocumentIds?: string[];
  notes?: string;
}
```

### New Entity: ChangeOfControlProvision

```typescript
interface ChangeOfControlProvision {
  id: string;
  licenseId: string;            // Reference to license agreement

  // Trigger definition
  triggerType: 'change_of_control' | 'assignment' | 'merger' | 'sale_of_assets';
  triggerThreshold?: string;    // e.g., ">50% ownership change"

  // Consequences
  consequence: 'termination_right' | 'consent_required' | 'renegotiation' |
               'automatic_termination' | 'fee_increase' | 'other';
  consequenceDetails: string;

  // Materiality
  businessCriticality: 'critical' | 'important' | 'moderate' | 'low';
  revenueAtRisk?: number;

  // Status (in context of a deal)
  consentObtained?: boolean;
  consentDate?: Date;
  waiverObtained?: boolean;
}
```

### Integration Points

- **License entity**: Flag change-of-control provisions
- **Patent/Trademark entities**: Track chain of title for due diligence
- **Valuation**: Feed into deal pricing
- **Litigation**: Surface pending IP disputes

---

## Sources
- [IP Due Diligence in M&A - ABA](https://www.americanbar.org/groups/business_law/resources/business-law-today/2023-april/intellectual-property-due-diligence-mergers-acquisitions/)
- [Critical IP Issues in M&A - KPPB Law](https://www.kppblaw.com/does-your-ma-due-diligence-cover-critical-ip-issues/)
- [Patent Due Diligence - Proskauer](https://www.proskauer.com/blog/the-crucial-role-of-patent-due-diligence-in-mergers-and-acquisitions-spotting-patent-litigation-risks-before-closing-a-deal)
- [IP Due Diligence Considerations - Venable](https://www.venable.com/insights/publications/ip-quick-bytes/intellectual-property-due-diligence-considerations)
- [IP Due Diligence - Ansarada](https://www.ansarada.com/due-diligence/intellectual-property)
- [IP Drives M&A - Lexology](https://www.lexology.com/library/detail.aspx?g=99f79088-c807-472f-8870-0e038737bede)
- [Top IP Issues in M&A - Gibson Dunn](https://www.gibsondunn.com/top-intellectual-property-issues-to-think-about-in-ma-deals/)
- [IP Protection in M&A - Chambers](https://chambers.com/articles/protecting-intellectual-property-in-ma-transactions-why-conduct-a-proper-due-diligence)

---

## Research Date
2026-01-27
