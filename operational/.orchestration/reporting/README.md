# Operational Reporting

Cross-operational report definitions and generators.

## Purpose

This directory contains definitions for unified operational reports that aggregate data across all operational domains.

## Report Types

| Report | Description | Frequency |
|--------|-------------|-----------|
| Entity Operations Summary | All operational records for an entity | On-demand |
| Compliance Status Dashboard | Aggregated compliance state | Daily/On-demand |
| Expiration Forecast | Items expiring within N days | Daily |
| Document Inventory | All documents across domains | Weekly |
| Regulatory Calendar | Upcoming regulatory obligations | Monthly |

## Directory Structure

```
reporting/
├── README.md                          # This file
├── definitions/                       # Report definitions
│   ├── entity-operations-summary.yaml
│   ├── compliance-dashboard.yaml
│   ├── expiration-forecast.yaml
│   ├── document-inventory.yaml
│   └── regulatory-calendar.yaml
├── templates/                         # Output templates
│   ├── pdf/
│   ├── excel/
│   └── json/
└── schedules/                         # Scheduled report jobs
    └── daily-reports.yaml
```

## Report Definition Format

```yaml
# Example: expiration-forecast.yaml
id: expiration-forecast
name: Expiration Forecast Report
description: Items expiring within specified time window

parameters:
  - name: entityId
    type: string
    required: true
  - name: daysAhead
    type: number
    default: 90

sources:
  - domain: contracts-legal
    query: getExpiringContracts
  - domain: insurance
    query: getExpiringPolicies
  - domain: intellectual-property
    query: getExpiringIP
  - domain: data-privacy
    query: getExpiringConsents

output:
  sections:
    - title: Critical (7 days)
      filter: daysUntilExpiration <= 7
    - title: Warning (30 days)
      filter: daysUntilExpiration <= 30
    - title: Notice (90 days)
      filter: daysUntilExpiration <= 90

formats:
  - json
  - pdf
  - excel
```

## API Endpoints

Reports are generated via the operational gateway:

```
POST /operational/reports/generate
{
  "reportId": "expiration-forecast",
  "parameters": {
    "entityId": "uuid",
    "daysAhead": 90
  },
  "format": "pdf"
}

GET /operational/reports/{reportId}/status
GET /operational/reports/{reportId}/download
```

## Scheduled Reports

Reports can be scheduled for automatic generation:

```yaml
# daily-reports.yaml
schedules:
  - report: expiration-forecast
    cron: "0 6 * * *"  # Daily at 6 AM
    parameters:
      daysAhead: 30
    distribution:
      - type: email
        recipients: ["legal-ops@company.com"]
      - type: slack
        channel: "#legal-alerts"
```

## Related

- `../../ARCHITECTURE.md` - Aggregated Reporting section
- `../compliance/` - Compliance-specific reports
