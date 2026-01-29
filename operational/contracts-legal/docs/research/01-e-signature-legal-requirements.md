# E-Signature Legal Requirements

**Gap Identified**: The schema has `signatureRef: String?` but the implementation lacks understanding of what makes an electronic signature legally binding.

---

## Legal Framework

### ESIGN Act (2000) - Federal Law
The Electronic Signatures in Global and National Commerce Act recognizes electronic signatures as legally equivalent to handwritten signatures for interstate and foreign commerce.

### UETA (1999) - State Law
The Uniform Electronic Transactions Act has been adopted by 49 states + D.C. + U.S. Virgin Islands, with state-specific variations.

**Key Point**: UETA governs intrastate transactions; ESIGN preempts if there's a conflict.

---

## Four Requirements for Legal Validity

For an e-signature to be legally binding under both ESIGN and UETA:

| Requirement | Description | Implementation Implication |
|-------------|-------------|---------------------------|
| **Intent to Sign** | Party must intend to sign, same as wet ink | Need to capture explicit consent action |
| **Consent to Electronic Business** | Parties must agree to conduct business electronically | Must present and capture this consent |
| **Association with Record** | Signature must leave a mark (graphical or textual) that can be associated with the record | Store signature data + document hash |
| **Record Retention** | Both parties must be able to access and save the signed document | Ensure immutable storage and access |

---

## Consumer Disclosure Requirements

The signer must be informed of:
- Option to receive documents in non-electronic form
- Right to withdraw consent
- Consequences of withdrawal
- Hardware/software requirements for access
- Right to obtain paper copy after signing

**Implementation Need**: Our notification system should support e-signature consent flows.

---

## What Electronic Signature Means

> "An electronic sound, symbol, or process attached to or logically associated with a contract or other record and executed by a person with the intent to sign."

Courts have found that checkboxes, typed names, email signatures, and even text messages CAN be legally binding signatures—**context is everything**.

---

## Documents That CANNOT Be E-Signed

Excluded from ESIGN Act:
- Wills, codicils, testamentary trusts
- Adoption, divorce, family law matters
- Court orders and official court documents
- Utility service cancellation notices
- Default, foreclosure, eviction notices for primary residence
- Health/life insurance cancellation notices
- Product recall notices

**Implementation Need**: Add document type validation to prevent e-signature on excluded categories.

---

## Current Schema Gap

```prisma
model ContractParty {
  signedAt     DateTime?
  signedBy     String?
  signatureRef String?    // Too vague
}
```

**What We're Missing**:
- Consent capture timestamp
- Consent method (click-through, typed, drawn)
- IP address at signing
- Device/browser fingerprint
- Document hash at time of signature
- Audit trail of signature ceremony

---

## Recommended Schema Enhancement

```prisma
model SignatureEvent {
  id              String   @id @default(cuid())
  contractPartyId String
  contractParty   ContractParty @relation(...)

  // What was signed
  documentHash    String   // SHA-256 of document at signing
  documentVersion Int

  // How it was signed
  signatureType   SignatureType  // TYPED, DRAWN, CLICK, BIOMETRIC
  signatureData   String?        // Base64 of drawn signature if applicable

  // Consent
  consentGiven    Boolean
  consentMethod   String   // "checkbox", "button", "typed_name"
  consentText     String   // The exact disclosure shown

  // Context
  ipAddress       String
  userAgent       String
  deviceId        String?
  geolocation     String?

  // Timestamps
  ceremonyStarted DateTime
  signedAt        DateTime

  // E-signature provider
  providerRef     String?  // DocuSign envelope ID, etc.
  providerData    Json?    // Full provider response
}

enum SignatureType {
  TYPED_NAME
  DRAWN_SIGNATURE
  CLICK_TO_SIGN
  BIOMETRIC
  DIGITAL_CERTIFICATE
}
```

---

## Sources

- [E-Signatures: Legal Requirements](https://www.purduegloballawschool.edu/blog/news/e-signatures-legal-requirements)
- [Electronic signature law in the US: ESIGN Act and UETA](https://juro.com/learn/esign-act-ueta)
- [US electronic signature laws and history | Docusign](https://www.docusign.com/products/electronic-signature/learn/esign-act-ueta)
- [ESIGN & UETA Compliance Guide](https://www.unicornforms.com/blog/esign-ueta-compliance)
- [Difference between ESIGN and UETA | Adobe](https://www.adobe.com/acrobat/business/hub/difference-between-esign-act-vs-ueta.html)
