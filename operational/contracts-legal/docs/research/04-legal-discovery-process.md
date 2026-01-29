# Legal Discovery Process

**Gap Identified**: Schema has `IN_DISCOVERY` as a matter status, but no understanding of what discovery actually entails or what data the system should capture.

---

## What Is Discovery

Discovery is the pre-trial phase where parties in litigation exchange:
- Relevant information
- Records and documents
- Evidence related to the case

**Purpose**: Allow both sides to evaluate case strength and build litigation strategy before trial.

**U.S. Distinctive**: The United States has the broadest discovery system in the world, governed by Federal Rules of Civil Procedure (FRCP) since 1938.

---

## Discovery Methods

| Method | Description | Data Need |
|--------|-------------|-----------|
| **Requests for Production** | Demand for documents | Document inventory |
| **Interrogatories** | Written questions requiring written answers | Q&A tracking |
| **Requests for Admission** | Statements the other party must admit or deny | Admission log |
| **Depositions** | Oral testimony under oath | Transcript storage |
| **Subpoenas** | Compel third parties to produce documents/testimony | Third-party tracking |

---

## The EDRM Framework (Electronic Discovery Reference Model)

### 8 Phases of eDiscovery

```
┌────────────────────────────────────────────────────────────────┐
│ 1. IDENTIFICATION                                               │
│    Determine what data must be preserved                        │
│    Interview key stakeholders, review facts                     │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 2. PRESERVATION (Legal Hold)                                    │
│    Safely store data so it remains intact                       │
│    Issue litigation hold notices                                │
│    CRITICAL: Duty begins at "reasonable anticipation"           │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 3. COLLECTION                                                   │
│    Gather data following legal process                          │
│    Preserve metadata (creation dates, audit logs)               │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 4. PROCESSING                                                   │
│    Organize raw data for analysis                               │
│    De-duplicate, index, make searchable                         │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 5. REVIEW                                                       │
│    Determine relevance/responsiveness                           │
│    Identify and protect privilege                               │
│    Flag sensitive info (PII, PHI)                               │
│    Tag "hot" documents                                          │
│    MOST EXPENSIVE PHASE                                         │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 6. ANALYSIS                                                     │
│    Identify patterns and key information                        │
│    Design presentation layout                                   │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 7. PRODUCTION                                                   │
│    Produce ESI per FRCP 34                                      │
│    Format: native, PDF, TIFF with Bates stamps                  │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│ 8. PRESENTATION                                                 │
│    Present evidence to attorneys, judges, juries                │
└────────────────────────────────────────────────────────────────┘
```

---

## Legal Hold (Litigation Hold)

### When Does Duty to Preserve Begin?
**NOT** when lawsuit is filed—when litigation is **"reasonably anticipated"**

### Consequences of Failure
- Spoliation of evidence finding
- Adverse inference jury instructions
- Summary judgment
- Monetary fines
- Other sanctions

---

## Electronically Stored Information (ESI)

Discoverable ESI includes:
- Emails
- Instant messages / chats
- Text messages
- Electronic documents
- Accounting databases
- Voicemail
- Audio and video files
- Metadata
- Social media content
- Website data

---

## Current Schema Gap

```prisma
model LegalMatter {
  status MatterStatus  // Has IN_DISCOVERY but that's it
}

enum MatterStatus {
  IN_DISCOVERY  // What does this actually mean?
}
```

**What We're Missing**:
- Legal hold management
- Custodian tracking (who has relevant data)
- Document production requests/responses
- Privilege log
- Discovery deadlines
- Discovery phase tracking

---

## Recommended Schema Enhancement

```prisma
model LegalMatter {
  // ... existing fields
  discoveryInfo        DiscoveryInfo?
  legalHolds           LegalHold[]
  discoveryRequests    DiscoveryRequest[]
  privilegeLog         PrivilegeLogEntry[]
}

model DiscoveryInfo {
  id              String      @id @default(cuid())
  matterId        String      @unique
  matter          LegalMatter @relation(...)
  
  // Timeline
  discoveryOpened DateTime?
  discoveryDeadline DateTime?
  discoveryExtensions Int @default(0)
  
  // Scope
  dateCutoffStart DateTime?
  dateCutoffEnd   DateTime?
  
  // Volume
  documentsIdentified Int?
  documentsReviewed   Int?
  documentsProduced   Int?
  privilegedCount     Int?
  
  // Cost tracking
  reviewCost          Decimal?
  eDiscoveryCost      Decimal?
  vendorName          String?
}

model LegalHold {
  id              String      @id @default(cuid())
  matterId        String
  matter          LegalMatter @relation(...)
  
  // What's on hold
  holdName        String
  description     String
  dataTypes       String[]    // ["email", "slack", "documents"]
  
  // Who's involved
  custodians      String[]    // Employee IDs
  
  // Timeline
  issuedAt        DateTime
  acknowledgedBy  Json?       // { custodianId: acknowledgedAt }
  liftedAt        DateTime?
  liftedBy        String?
  
  // Status
  status          HoldStatus @default(ACTIVE)
}

enum HoldStatus {
  DRAFT
  ACTIVE
  LIFTED
}

model DiscoveryRequest {
  id              String      @id @default(cuid())
  matterId        String
  matter          LegalMatter @relation(...)
  
  // Request details
  type            DiscoveryType
  requestNumber   String      // e.g., "RFP-001"
  issuedBy        String      // "Plaintiff" or "Defendant"
  receivedAt      DateTime
  dueDate         DateTime
  
  // Response
  responseStatus  ResponseStatus @default(PENDING)
  respondedAt     DateTime?
  objections      String[]
  documentsProduced Int?
  
  // Extensions
  extensionRequested Boolean @default(false)
  extendedDueDate   DateTime?
}

enum DiscoveryType {
  REQUEST_FOR_PRODUCTION
  INTERROGATORY
  REQUEST_FOR_ADMISSION
  DEPOSITION_NOTICE
  SUBPOENA
}

enum ResponseStatus {
  PENDING
  IN_PROGRESS
  RESPONDED
  OBJECTED
  EXTENDED
}

model PrivilegeLogEntry {
  id              String      @id @default(cuid())
  matterId        String
  matter          LegalMatter @relation(...)
  
  // Document info
  documentId      String
  batesNumber     String?
  documentDate    DateTime?
  author          String?
  recipients      String[]
  
  // Privilege claim
  privilegeType   PrivilegeType
  description     String
  reviewedBy      String
  reviewedAt      DateTime
}

enum PrivilegeType {
  ATTORNEY_CLIENT
  WORK_PRODUCT
  JOINT_DEFENSE
  COMMON_INTEREST
  DELIBERATIVE_PROCESS
}
```

---

## Key Deadlines to Track

| Deadline | Description |
|----------|-------------|
| Rule 26(f) Conference | Parties meet to plan discovery |
| Discovery Plan Due | 14 days after Rule 26(f) conference |
| Initial Disclosures | Required early disclosures |
| Discovery Cutoff | Last day to conduct discovery |
| Expert Disclosure | Deadline for expert reports |
| Motion Cutoff | Last day to file motions |

---

## Sources

- [What Is E-Discovery? | Proofpoint](https://www.proofpoint.com/us/threat-reference/e-discovery)
- [What Is Discovery in Law? | Everlaw](https://www.everlaw.com/blog/ediscovery-software/what-is-discovery-in-law/)
- [eDiscovery in Legal: A Short Primer | UnitedLex](https://unitedlex.com/insights/ediscovery-in-legal-a-short-primer/)
- [Rule 26 Federal Rules of Civil Procedure | Cornell LII](https://www.law.cornell.edu/rules/frcp/rule_26)
- [Electronic Discovery | Wikipedia](https://en.wikipedia.org/wiki/Electronic_discovery)
