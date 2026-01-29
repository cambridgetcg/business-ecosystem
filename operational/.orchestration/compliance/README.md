# Compliance Aggregation

Cross-operational compliance status aggregation and regulatory mappings.

## Purpose

This directory contains definitions for aggregating compliance status across all operational domains, providing a unified view of regulatory obligations.

## Contents

```
compliance/
├── README.md                      # This file
├── regulatory-mappings/           # Maps regulations to domain requirements
│   ├── gdpr.yaml                  # GDPR requirements by domain
│   ├── ccpa.yaml                  # CCPA requirements by domain
│   └── sox.yaml                   # SOX requirements by domain
├── status-aggregators/            # Aggregation logic
│   └── entity-compliance.ts       # Per-entity compliance aggregation
└── reporting-templates/           # Report templates
    └── compliance-dashboard.json  # Dashboard configuration
```

## Regulatory Mappings

Each regulation is mapped to specific requirements across operational domains:

```yaml
# Example: gdpr.yaml
regulation: GDPR
domains:
  data-privacy:
    - lawful-basis-for-processing
    - consent-management
    - data-subject-rights
    - breach-notification
  contracts-legal:
    - data-processing-agreements
    - standard-contractual-clauses
  insurance:
    - cyber-liability-coverage
```

## Status Aggregation

Compliance status is aggregated per entity:

```typescript
interface EntityComplianceStatus {
  entityId: string;
  overallStatus: 'compliant' | 'non-compliant' | 'pending';
  domains: {
    [domain: string]: {
      status: 'compliant' | 'non-compliant' | 'pending' | 'not-applicable';
      regulations: {
        [regulation: string]: {
          status: string;
          lastAssessment: Date;
          nextDue: Date;
          findings: number;
        };
      };
    };
  };
}
```

## Integration

Compliance aggregation:
1. Subscribes to compliance events from all operational domains
2. Maintains materialized view of compliance status
3. Exposes unified query endpoints
4. Generates compliance reports

## Related

- `../workflows/compliance-remediation.yaml` - Remediation workflow
- `../../ARCHITECTURE.md` - Regulatory Framework Integration pattern
