# Dimension 42: GDPR Compliance Architecture

**Discovery Source**: Phase 1 Implementation - Data Privacy Domain MVP
**Understanding Level**: ENABLED
**Last Updated**: January 27, 2026

---

## Aha Moment

> GDPR deadlines aren't just data fields to track - they **drive workflow state machines**. The 30-day DSAR deadline and 72-hour breach notification fundamentally shape how the domain model works. Time is a first-class citizen.

---

## What This Is

The architectural patterns for GDPR/CCPA compliance embedded in the data-privacy domain:
- Consent management with lawful basis tracking
- DSAR (Data Subject Access Request) workflow
- Data breach notification workflow
- Processing activity records (GDPR Article 30)

---

## Mental Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GDPR TIME-DRIVEN ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DSAR WORKFLOW (30 days → 90 days max)                                     │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Day 0          Day 30                      Day 90                         │
│    │              │                           │                            │
│    ▼              ▼                           ▼                            │
│  ┌────────┐    ┌─────────────────────────────────────────────┐            │
│  │RECEIVED│───▶│ DEADLINE (can extend once with reason)      │            │
│  └────────┘    └─────────────────────────────────────────────┘            │
│       │                                                                    │
│       ▼                                                                    │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌───────────┐             │
│  │ PENDING_   │─▶│ VERIFIED │─▶│ PROCESSING │─▶│ COMPLETED │             │
│  │ VERIFY     │  └──────────┘  └────────────┘  └───────────┘             │
│  └────────────┘         │              │              │                   │
│        │                │              │              │                   │
│        ▼                ▼              ▼              ▼                   │
│   [Activity]       [Activity]    [Activity]     [Activity]               │
│                                                                            │
│                                                                            │
│  BREACH WORKFLOW (72 hours critical)                                       │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Hour 0                  Hour 72                                           │
│    │                       │                                               │
│    ▼                       ▼                                               │
│  ┌────────────┐    ┌────────────────────────────────────────────┐         │
│  │ DISCOVERED │───▶│ AUTHORITY NOTIFICATION DEADLINE (HARD)     │         │
│  └────────────┘    └────────────────────────────────────────────┘         │
│       │                                                                    │
│       ▼                                                                    │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐               │
│  │ ASSESSING │─▶│ CONTAINED │─▶│ NOTIFYING │─▶│ RESOLVED │               │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘               │
│       │              │              │              │                       │
│       ▼              ▼              ▼              ▼                       │
│  [Activity]     [Activity]    [Activity]     [Activity]                   │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Deadline as State Driver

The deadline field isn't passive - it determines:
- **Compliance status**: On-time vs late vs critical
- **Priority escalation**: Auto-escalate as deadline approaches
- **Audit evidence**: Did we meet legal requirements?

```typescript
// Deadline calculation baked into creation
function calculateDeadline(receivedAt: Date): Date {
  const deadline = new Date(receivedAt);
  deadline.setDate(deadline.getDate() + 30); // GDPR: 30 days
  return deadline;
}

// Extension logic respects max (90 days)
const extendedDeadline = new Date(dsar.receivedAt);
extendedDeadline.setDate(extendedDeadline.getDate() + 90);
```

### 2. Activity Log as Audit Trail

**Critical Insight**: Every state transition creates an Activity record.

```typescript
// State change + Activity in single transaction
await prisma.dSARRequest.update({
  where: { id },
  data: {
    status: 'VERIFIED',
    verifiedAt: new Date(),
    activities: {
      create: {
        type: 'VERIFIED',
        description: `Identity verified via ${method}`,
        performedBy: verifiedBy,
      },
    },
  },
});
```

**Why**: GDPR Article 5(2) - "Accountability principle" requires demonstrable compliance. The activity log IS the evidence.

### 3. Lawful Basis Tracking

GDPR requires knowing WHY you process data:

```prisma
enum LawfulBasis {
  CONSENT              // GDPR Art. 6(1)(a)
  CONTRACT             // GDPR Art. 6(1)(b)
  LEGAL_OBLIGATION     // GDPR Art. 6(1)(c)
  VITAL_INTEREST       // GDPR Art. 6(1)(d)
  PUBLIC_TASK          // GDPR Art. 6(1)(e)
  LEGITIMATE_INTEREST  // GDPR Art. 6(1)(f)
}
```

**Insight**: Consent is just ONE of six lawful bases. Many systems wrongly assume "consent = permission to process."

### 4. Breach Severity Assessment

72-hour notification only applies when "risk to rights and freedoms":

```prisma
// Risk assessment drives notification requirement
riskToSubjects       RiskLevel
likelihoodOfHarm     RiskLevel?
authorityNotificationRequired Boolean @default(true)
subjectNotificationRequired   Boolean @default(false)
```

**Decision Tree**:
- High risk → Notify authority AND subjects
- Risk present → Notify authority only
- No risk → Document internally only

---

## Implementation Details

### Location
`/operational/data-privacy/`

### Key Files
```
prisma/schema.prisma          # 9 GDPR-compliant models
src/routes/consent.routes.ts  # Consent CRUD
src/routes/dsar.routes.ts     # DSAR workflow
src/routes/breach.routes.ts   # Breach management
src/routes/index.ts           # Compliance aggregation endpoint
```

### Compliance Status Endpoint

```typescript
// /api/v1/compliance-status/:entityId
{
  entityId: "ent-123",
  domain: "data-privacy",
  status: "compliant" | "at_risk" | "non_compliant",
  issues: [
    "2 DSAR(s) due within 7 days",
    "1 breach pending authority notification"
  ],
  metrics: {
    pendingDsars: 2,
    unresolvedBreaches: 1,
    pendingNotifications: 1
  }
}
```

---

## Curiosities Discovered

### 1. Why 30 Days, Not 1 Month?
GDPR says "one month" but we use 30 days.

**Question**: Is 30 days legally conservative or technically convenient?
**Research Needed**: Legal interpretation of "one month" in GDPR context.

### 2. No Automated Notification
We track notification deadlines but don't send notifications.

**Question**: Is notification outside scope, or a gap?
**Gap Identified**: Report distribution not implemented (Gap #12 in gap-analysis.md)

### 3. Special Category Data
Schema supports special categories (health, biometric, etc.) but no special handling in routes.

**Question**: What additional protections do special categories need?
**Research Needed**: GDPR Article 9 requirements.

### 4. Cross-Border Considerations
`crossBorder` flag exists on breaches but no workflow impact.

**Question**: What different obligations apply to cross-border breaches?
**Research Needed**: Lead supervisory authority rules.

---

## Regulatory References

| Article | Requirement | Implementation |
|---------|-------------|----------------|
| Art. 6 | Lawful basis | `LawfulBasis` enum |
| Art. 7 | Consent conditions | `ConsentRecord` model |
| Art. 15-22 | Subject rights | `DSARRequest` + types |
| Art. 30 | Records of processing | `ProcessingActivity` model |
| Art. 33 | Breach notification (72h) | `DataBreach` + deadline |
| Art. 34 | Subject notification | `subjectNotificationRequired` |
| Art. 35 | Impact assessments | `PrivacyImpactAssessment` model |

---

## Related Patterns

- [25-data-privacy-overview.md](25-data-privacy-overview.md) - Domain overview
- [43-audit-trail-patterns.md](43-audit-trail-patterns.md) - Activity log pattern
- [44-compliance-aggregation.md](44-compliance-aggregation.md) - Cross-domain compliance

---

## Open Questions

1. **Consent Version Tracking**: How to handle consent policy changes?
2. **Retention Enforcement**: Schema tracks policies but doesn't enforce deletion
3. **Processor Management**: DPA tracking exists but no workflow
4. **Multi-Jurisdiction**: GDPR + CCPA + others - how to handle overlapping requirements?

---

## Now You Can

With this understanding, you can:
1. Trace any DSAR through its complete lifecycle
2. Explain why we track deadlines the way we do
3. Add new GDPR requirements to the schema
4. Implement missing workflows (notifications, retention enforcement)
5. Extend to CCPA/other privacy regulations

---

*"GDPR is not about data protection - it's about human dignity in the digital age."*
