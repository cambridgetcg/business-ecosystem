# Data Privacy

GDPR, CCPA, and data protection compliance management for the business ecosystem.

## Purpose

The `data-privacy` domain manages data protection compliance across the organization, ensuring:

1. **Regulatory Compliance** — GDPR, CCPA, and other privacy regulations
2. **Consent Management** — Tracking and enforcing data subject consent
3. **Data Subject Rights** — Processing access, deletion, and portability requests
4. **Privacy Impact Assessments** — Evaluating privacy risks of processing activities
5. **Breach Management** — Detecting, reporting, and managing data breaches

## Domain Model

```
┌─────────────────────────────────────────────────────────────────┐
│                       DATA-PRIVACY                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │   Consent   │      │  Processing │      │    DSAR     │     │
│  │   Record    │      │  Activity   │      │   Request   │     │
│  │             │      │             │      │             │     │
│  │ - purpose   │      │ - purpose   │      │ - type      │     │
│  │ - basis     │      │ - basis     │      │ - status    │     │
│  │ - granted   │      │ - dataTypes │      │ - deadline  │     │
│  │ - withdrawn │      │ - retention │      │ - response  │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │   Privacy   │      │    Data     │      │  Retention  │     │
│  │   Impact    │      │   Breach    │      │   Policy    │     │
│  │ Assessment  │      │             │      │             │     │
│  │             │      │ - severity  │      │ - dataType  │     │
│  │ - risk      │      │ - affected  │      │ - period    │     │
│  │ - mitigations│     │ - notified  │      │ - basis     │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Entities

| Entity | Purpose |
|--------|---------|
| **ConsentRecord** | Data subject consent for specific processing purposes |
| **ProcessingActivity** | Record of processing activities (GDPR Art. 30) |
| **DSARRequest** | Data Subject Access Request handling |
| **PrivacyImpactAssessment** | DPIA for high-risk processing |
| **DataBreach** | Breach detection, investigation, notification |
| **RetentionPolicy** | Data retention rules and enforcement |

## Lawful Basis for Processing

| Basis | Description | Consent Required |
|-------|-------------|------------------|
| `CONSENT` | Explicit data subject consent | Yes |
| `CONTRACT` | Necessary for contract performance | No |
| `LEGAL_OBLIGATION` | Required by law | No |
| `VITAL_INTEREST` | Protect life | No |
| `PUBLIC_TASK` | Official authority function | No |
| `LEGITIMATE_INTEREST` | Balanced against data subject rights | No |

## Data Subject Rights (GDPR)

| Right | Article | Deadline | Implementation |
|-------|---------|----------|----------------|
| **Access** | Art. 15 | 30 days | DSAR export |
| **Rectification** | Art. 16 | 30 days | Data correction |
| **Erasure** | Art. 17 | 30 days | Deletion cascade |
| **Portability** | Art. 20 | 30 days | JSON/CSV export |
| **Restriction** | Art. 18 | 30 days | Processing freeze |
| **Objection** | Art. 21 | Immediate | Opt-out processing |

## DSAR Request Types

```typescript
type DSARType = 
  | 'ACCESS'           // Right to access personal data
  | 'RECTIFICATION'    // Right to correct inaccurate data
  | 'ERASURE'          // Right to be forgotten
  | 'PORTABILITY'      // Right to data portability
  | 'RESTRICTION'      // Right to restrict processing
  | 'OBJECTION';       // Right to object to processing
```

## Data Breach Severity

| Severity | Criteria | Notification |
|----------|----------|--------------|
| LOW | No sensitive data, <100 affected | Internal only |
| MEDIUM | Limited sensitive data, <1000 affected | DPO review |
| HIGH | Sensitive data, >1000 affected | Supervisory authority (72h) |
| CRITICAL | Special category data, mass impact | Authority + affected individuals |

## Integration Points

### References (Foundational)

- **entity-governance**: Privacy settings per legal entity
- **compliance**: Privacy compliance status feeds overall compliance

### Cross-Operational

- **contracts-legal**: DPA (Data Processing Agreement) management
- **All domains**: Consent checks before data processing

### Events Published

```typescript
// Consent events
'consent.granted'
'consent.withdrawn'
'consent.expired'

// DSAR events
'dsar.submitted'
'dsar.in_progress'
'dsar.completed'
'dsar.deadline_approaching'

// Breach events
'breach.detected'
'breach.confirmed'
'breach.authority_notified'
'breach.subjects_notified'
'breach.closed'

// Compliance events
'pia.required'
'pia.completed'
'retention.expired'
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/consent` | Record consent grant |
| DELETE | `/consent/:id` | Record consent withdrawal |
| GET | `/consent/subject/:subjectId` | Get all consents for subject |
| POST | `/dsar` | Submit DSAR request |
| GET | `/dsar/:id` | Get DSAR status |
| GET | `/dsar/:id/export` | Download DSAR response |
| POST | `/breach` | Report potential breach |
| GET | `/processing-activities` | List processing activities |
| POST | `/pia` | Create Privacy Impact Assessment |

## Regulatory Compliance

| Regulation | Jurisdiction | Key Requirements |
|------------|--------------|------------------|
| **GDPR** | EU/EEA | Consent, DSAR, DPIAs, 72h breach notification |
| **CCPA/CPRA** | California | Right to know, delete, opt-out of sale |
| **LGPD** | Brazil | Similar to GDPR |
| **POPIA** | South Africa | Processing conditions, breach notification |
| **PDPA** | Singapore | Consent, access, correction rights |

## Configuration

```bash
# Environment variables
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/data_privacy

# Notification
DSAR_DEADLINE_DAYS=30
BREACH_NOTIFICATION_HOURS=72
DPO_EMAIL=dpo@company.com

# Retention
DEFAULT_RETENTION_YEARS=7
CONSENT_EXPIRY_YEARS=2

# Integration
COMPLIANCE_SERVICE_URL=http://localhost:3004
```

## Development

```bash
# Start service
pnpm dev --filter=data-privacy

# Run migrations
pnpm --filter=data-privacy db:migrate

# Run tests
pnpm test --filter=data-privacy
```

## Related Documentation

- [operational/README.md](../README.md) - Operational layer overview
- [operational/ARCHITECTURE.md](../ARCHITECTURE.md) - Cross-domain patterns
- [foundational/compliance/README.md](../../foundational/compliance/README.md) - Compliance integration
