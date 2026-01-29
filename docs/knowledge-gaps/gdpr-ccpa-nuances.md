# GDPR vs CCPA Regulatory Nuances

**Research Date**: 2026-01-26  
**Knowledge Gap**: Consent models, cross-border transfers, and implementation differences

---

## Overview

GDPR (EU) and CCPA/CPRA (California) represent fundamentally different philosophies:
- **GDPR**: Opt-in, rights-based, strict cross-border controls
- **CCPA**: Opt-out, disclosure-focused, minimal transfer restrictions

---

## Consent Model Differences

### GDPR: Explicit Opt-In Required

```typescript
interface GDPRConsent {
  // Must be "freely given, specific, informed, and unambiguous"
  consentId: string;
  dataSubjectId: string;
  
  // Each purpose requires separate consent
  purposes: {
    purposeId: string;
    purposeDescription: string;
    granted: boolean;
    grantedAt: Date;
  }[];
  
  // Cannot be assumed from inactivity
  explicitAction: 'checkbox_ticked' | 'button_clicked' | 'toggle_enabled';
  
  // Must be withdrawable at any time
  withdrawnAt?: Date;
}
```

**Key Requirements**:
- Pre-checked boxes are INVALID
- Silence or inactivity ≠ consent
- Each processing purpose requires separate consent
- Must be as easy to withdraw as to grant
- Consent expires (typically 2 years, re-confirm needed)

### CCPA: Opt-Out Framework

```typescript
interface CCPAConsent {
  consumerId: string;
  
  // Businesses can collect by default if they provide opt-out
  saleOfPersonalInfo: {
    optedOut: boolean;
    optOutDate?: Date;
    optOutMethod: 'do_not_sell_link' | 'gpc_signal' | 'direct_request';
  };
  
  // Sensitive data requires opt-in (CPRA addition)
  sensitivePersonalInfo?: {
    categories: string[];
    limitUse: boolean;
  };
  
  // Children require affirmative consent
  isMinor: boolean;
  parentalConsentIfMinor?: boolean;
}
```

**Key Requirements**:
- Collection allowed by default
- Must provide "Do Not Sell My Personal Information" link
- Must honor Global Privacy Control (GPC) signals
- Under 13: Parental consent required for "sale"
- 13-15: Teen's own consent required for "sale"

---

## Cross-Border Data Transfer

### GDPR: Strict Transfer Mechanisms Required

```
┌─────────────────────────────────────────────────────────────┐
│                 GDPR TRANSFER FRAMEWORK                      │
│                                                              │
│  EU Data Controller ──► Transfer to Third Country            │
│                              │                               │
│              ┌───────────────┼───────────────┐              │
│              ▼               ▼               ▼              │
│    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│    │  Adequacy    │ │    SCCs      │ │    BCRs      │      │
│    │  Decision    │ │ (Standard    │ │ (Binding     │      │
│    │              │ │ Contractual  │ │ Corporate    │      │
│    │ Japan, UK,   │ │ Clauses)     │ │ Rules)       │      │
│    │ Canada, etc. │ │              │ │              │      │
│    └──────────────┘ └──────────────┘ └──────────────┘      │
│                              │                               │
│                    + Supplementary Measures                  │
│                    (Encryption, Pseudonymization)            │
│                                                              │
│    Penalty: Up to €20M or 4% global revenue                 │
│    Example: Meta fined €1.2B for US transfers (2023)        │
└─────────────────────────────────────────────────────────────┘
```

**Adequacy Countries** (as of 2025):
- Andorra, Argentina, Canada (commercial), Faroe Islands, Guernsey
- Israel, Isle of Man, Japan, Jersey, New Zealand
- Republic of Korea, Switzerland, UK, Uruguay
- **US**: EU-US Data Privacy Framework (limited companies)

**For Non-Adequacy Countries**:
```sql
-- Required data in transfer records
CREATE TABLE gdpr_transfer_records (
  id UUID PRIMARY KEY,
  data_exporter_entity_id UUID NOT NULL,
  data_importer_name VARCHAR(500) NOT NULL,
  destination_country VARCHAR(2) NOT NULL,
  transfer_mechanism VARCHAR(50) NOT NULL,  -- 'SCC', 'BCR', 'DEROGATION'
  scc_version VARCHAR(20),
  supplementary_measures JSONB,  -- encryption, access controls, etc.
  transfer_impact_assessment_id UUID,
  created_at TIMESTAMPTZ NOT NULL
);
```

### CCPA: Disclosure Only

```typescript
interface CCPACrosssBorderDisclosure {
  // No transfer restrictions, just disclosure
  disclosureProvided: boolean;
  categoriesTransferred: string[];
  recipientCountries: string[];
  
  // Included in privacy policy
  privacyPolicyUpdated: Date;
}
```

**Key Difference**: CCPA requires informing consumers about international transfers but doesn't restrict them.

---

## Rights Comparison

| Right | GDPR | CCPA/CPRA |
|-------|------|-----------|
| **Right to Know/Access** | Art. 15 - Detailed access rights | ✓ Right to know what's collected |
| **Right to Delete** | Art. 17 - "Right to be forgotten" | ✓ Right to delete |
| **Right to Portability** | Art. 20 - Machine-readable export | ✓ Similar |
| **Right to Correct** | Art. 16 - Rectification | ✓ CPRA added correction right |
| **Right to Opt-Out of Sale** | N/A (consent-based model) | ✓ Core CCPA right |
| **Right to Limit Sensitive Data** | Special categories protected by default | ✓ CPRA addition |
| **Response Deadline** | 30 days (extendable to 90) | 45 days (extendable to 90) |

---

## Implementation Differences

### Data Subject Request (DSR) Handling

```typescript
// GDPR DSR Handler
async function handleGDPRRequest(request: DSRRequest): Promise<DSRResponse> {
  // Verify identity (strict requirements)
  await verifyIdentity(request.subjectId, {
    method: 'two_factor',  // ID documents often required
    strictVerification: true,
  });
  
  // 30-day deadline
  const deadline = addDays(request.receivedAt, 30);
  
  // Access request: ALL personal data across ALL systems
  if (request.type === 'ACCESS') {
    return {
      personalData: await gatherAllPersonalData(request.subjectId),
      processingPurposes: await getProcessingPurposes(),
      recipients: await getDataRecipients(),
      retentionPeriods: await getRetentionInfo(),
      sourceOfData: await getDataSources(),
      automatedDecisionMaking: await getADMInfo(),
    };
  }
  
  // Erasure: Must propagate to all processors
  if (request.type === 'ERASURE') {
    await deleteFromAllSystems(request.subjectId);
    await notifyProcessors(request.subjectId, 'DELETE');
    await notifyRecipientsOfDeletion(request.subjectId);
  }
}

// CCPA DSR Handler
async function handleCCPARequest(request: DSRRequest): Promise<DSRResponse> {
  // Verify identity (can be less strict)
  await verifyIdentity(request.consumerId, {
    method: 'password_or_security_questions',
    strictVerification: false,
  });
  
  // 45-day deadline
  const deadline = addDays(request.receivedAt, 45);
  
  // Access request: Last 12 months only
  if (request.type === 'ACCESS') {
    return {
      categoriesCollected: await getCategoriesLast12Months(request.consumerId),
      specificPieces: await getSpecificDataLast12Months(request.consumerId),
      sources: await getSourceCategories(),
      businessPurpose: await getPurposeCategories(),
      thirdPartiesSharedWith: await getThirdPartyCategories(),
    };
  }
}
```

### Consent Management Platform (CMP) Requirements

```typescript
interface CMPConfiguration {
  gdpr: {
    // Must show all purposes before processing
    displayMode: 'all_purposes_visible',
    
    // Reject must be as easy as accept
    rejectButtonPlacement: 'same_level_as_accept',
    
    // No dark patterns
    colorScheme: 'equal_prominence',
    
    // Store granular preferences
    granularConsent: true,
  };
  
  ccpa: {
    // Can show after processing starts
    displayMode: 'opt_out_link_visible',
    
    // "Do Not Sell" link in footer
    doNotSellLink: {
      placement: 'website_footer',
      label: 'Do Not Sell or Share My Personal Information',
    },
    
    // Honor GPC browser signal
    honorGPC: true,
  };
}
```

---

## Unified Compliance Strategy

### 80-90% Overlap

Building for GDPR compliance largely covers CCPA requirements:

```typescript
interface UnifiedPrivacyRecord {
  // Common fields
  subjectId: string;
  dataCategories: string[];
  processingPurposes: string[];
  retentionPeriod: string;
  
  // GDPR-specific
  gdpr?: {
    legalBasis: 'CONSENT' | 'CONTRACT' | 'LEGAL_OBLIGATION' | 'VITAL_INTEREST' | 'PUBLIC_TASK' | 'LEGITIMATE_INTEREST';
    consentRecord?: ConsentRecord;
    transferMechanism?: 'ADEQUACY' | 'SCC' | 'BCR';
  };
  
  // CCPA-specific
  ccpa?: {
    soldOrShared: boolean;
    optOutStatus: boolean;
    financialIncentiveDisclosure?: string;
  };
}
```

### Jurisdiction Detection

```typescript
function determineApplicableRegulations(user: User): Regulation[] {
  const regulations: Regulation[] = [];
  
  // GDPR: EU/EEA residents OR processing in EU
  if (isEUResident(user) || isProcessingInEU()) {
    regulations.push('GDPR');
  }
  
  // CCPA: California residents + business thresholds
  if (isCaliforniaResident(user) && meetsCCPAThresholds()) {
    regulations.push('CCPA');
  }
  
  // Additional regulations
  if (isBrazilResident(user)) regulations.push('LGPD');
  if (isSingaporeResident(user)) regulations.push('PDPA');
  
  return regulations;
}
```

---

## Penalty Comparison

| Aspect | GDPR | CCPA/CPRA |
|--------|------|-----------|
| **Maximum Fine** | €20M or 4% global revenue | ~$7,988 per intentional violation |
| **Per-Record Damages** | N/A | $107-$799 per consumer (data breach) |
| **Enforcement** | Data Protection Authorities | California AG + Private right of action |
| **Class Actions** | Limited | Yes (data breach only) |

---

## Application to Business Ecosystem

### Data Privacy Domain Updates

```typescript
// Enhanced consent record for dual compliance
interface EnhancedConsentRecord {
  id: string;
  subjectId: string;
  entityId: string;
  
  // GDPR fields
  gdprCompliant: {
    explicitOptIn: boolean;
    purposeSpecific: boolean;
    freelyGiven: boolean;
    informedBasis: string;  // Link to privacy notice version
    withdrawableAt: Date | null;
  };
  
  // CCPA fields
  ccpaCompliant: {
    saleOptOut: boolean;
    shareOptOut: boolean;
    limitSensitiveUse: boolean;
    gpcHonored: boolean;
  };
  
  // Jurisdiction
  applicableRegulations: ('GDPR' | 'CCPA' | 'LGPD' | 'PDPA')[];
}
```

---

## Sources

- [Cooley - Cross-Border Data Transfers: PIPL vs. GDPR vs. CCPA](https://cdp.cooley.com/cross-border-data-transfers-pipl-vs-gdpr-vs-ccpa/)
- [Reform.app - GDPR vs. CCPA Cross-Border Compliance](https://www.reform.app/blog/gdpr-vs-ccpa-cross-border-data-compliance-compared)
- [SecurePrivacy - Cross Border Data Transfers 2025 Guide](https://secureprivacy.ai/blog/cross-border-data-transfers-2025-guide)
- [Usercentrics - CCPA vs GDPR Differences and Similarities](https://usercentrics.com/knowledge-hub/ccpa-vs-gdpr/)
- [ComplyDog - GDPR vs CCPA Comparison Guide](https://complydog.com/blog/gdpr-vs-ccpa-privacy-law-comparison-guid)
