# Progress Tracking Terraform Module

This module deploys AWS infrastructure for tracking development progress across the business-ecosystem monorepo.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROGRESS TRACKING INFRASTRUCTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  INGESTION                                                                    │
│  ├── GitHub Actions (on push to STATUS.md/PATH.md)                          │
│  ├── EventBridge Schedule (daily 6 AM UTC)                                  │
│  └── Lambda Function URL (webhook)                                          │
│           │                                                                   │
│           ▼                                                                   │
│  PROCESSING                                                                   │
│  ├── Lambda: progress-sync (fetch from GitHub, parse, store)                │
│  ├── Lambda: progress-analyzer (DynamoDB streams, detect changes)           │
│  ├── Lambda: progress-comparator (S3 events, detect milestones)             │
│  ├── Lambda: progress-reporter (generate weekly/monthly reports)            │
│  └── Lambda: progress-notifier (route to Slack/Email)                       │
│           │                                                                   │
│           ▼                                                                   │
│  STORAGE                                                                      │
│  ├── S3 Bucket (snapshots, reports, history)                                │
│  ├── DynamoDB (live state, milestones, history)                             │
│  └── Timestream (optional: time-series metrics)                             │
│           │                                                                   │
│           ▼                                                                   │
│  NOTIFICATION                                                                 │
│  ├── SNS: milestones (waypoint completions)                                 │
│  ├── SNS: blockers (new blockers detected)                                  │
│  ├── SNS: weekly (weekly report)                                            │
│  └── SNS: alerts (regressions, stale apps)                                  │
│           │                                                                   │
│           ▼                                                                   │
│  VISUALIZATION                                                                │
│  ├── CloudWatch Dashboard                                                    │
│  ├── CloudWatch Alarms                                                       │
│  └── Grafana Integration (optional)                                          │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Usage

```hcl
module "progress_tracking" {
  source = "./modules/progress-tracking"

  environment  = "dev"
  project_name = "ecosystem"
  aws_region   = "us-east-1"

  github_repo   = "myorg/business-ecosystem"
  github_branch = "main"

  notification_email         = "team@example.com"
  enable_slack_notifications = true
  enable_email_notifications = true

  # Optional features
  enable_timestream = false
  enable_quicksight = false

  tags = {
    Team = "platform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| environment | Environment name (dev, staging, prod) | `string` | `"dev"` | no |
| project_name | Project name for resource naming | `string` | `"ecosystem"` | no |
| aws_region | AWS region | `string` | `"us-east-1"` | no |
| github_repo | GitHub repository (owner/repo) | `string` | `""` | yes |
| github_branch | GitHub branch to monitor | `string` | `"main"` | no |
| notification_email | Email address for notifications | `string` | `""` | no |
| slack_webhook_url | Slack webhook URL | `string` | `""` | no |
| enable_slack_notifications | Enable Slack notifications | `bool` | `false` | no |
| enable_email_notifications | Enable email notifications | `bool` | `true` | no |
| daily_sync_schedule | Cron for daily sync (UTC) | `string` | `"cron(0 6 * * ? *)"` | no |
| weekly_report_schedule | Cron for weekly report (UTC) | `string` | `"cron(0 9 ? * MON *)"` | no |
| snapshot_retention_days | Days to retain S3 snapshots | `number` | `90` | no |
| enable_timestream | Enable Timestream metrics | `bool` | `false` | no |
| enable_quicksight | Enable QuickSight integration | `bool` | `false` | no |

## Outputs

| Name | Description |
|------|-------------|
| s3_bucket_name | S3 bucket for progress data |
| dynamodb_table_name | DynamoDB table for live state |
| lambda_sync_url | Webhook URL for triggering sync |
| cloudwatch_dashboard_url | CloudWatch dashboard URL |
| sns_*_topic_arn | SNS topic ARNs for notifications |

## Setup

### 1. Build Lambda Functions

```bash
cd infrastructure/terraform/modules/progress-tracking/lambda
npm install
npm run deploy
```

### 2. Configure Secrets

After deployment, update the secrets in AWS Secrets Manager:

```bash
# GitHub token (for API access)
aws secretsmanager put-secret-value \
  --secret-id ecosystem-progress-dev/github-token \
  --secret-string '{"token":"ghp_xxxx"}'

# Slack webhook (if enabled)
aws secretsmanager put-secret-value \
  --secret-id ecosystem-progress-dev/slack-webhook \
  --secret-string '{"url":"https://hooks.slack.com/services/xxx"}'
```

### 3. Deploy Infrastructure

```bash
terraform init
terraform plan -target=module.progress_tracking
terraform apply -target=module.progress_tracking
```

### 4. Configure GitHub Actions

Add these secrets to your GitHub repository:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `PROGRESS_SYNC_LAMBDA_URL` (from terraform output)

## Notifications

### Milestone Notifications

Sent when:
- Waypoint completed
- Status promoted (skeleton → active → ready)
- Progress milestone reached (25%, 50%, 75%, 100%)

### Blocker Notifications

Sent when:
- New blocker added to any app

### Alert Notifications

Sent when:
- Progress regression detected (>5% decrease)
- Stale apps detected (active apps with >14 days no activity)
- Sync failures

### Weekly/Monthly Reports

Generated automatically with:
- Progress summary
- Top performers
- Apps needing attention
- Milestone timeline
- Recommendations

## CloudWatch Dashboard

The module creates a CloudWatch dashboard with:
- Overall progress gauge
- Progress by layer (bar chart)
- Status distribution (pie chart)
- Progress trend (30 days)
- Milestones timeline
- Lambda activity
- Recent activity log

Access: AWS Console → CloudWatch → Dashboards → `ecosystem-progress-{env}-dashboard`

## DynamoDB Schema

### Progress Table

| PK | SK | Description |
|----|-------|-------------|
| `ECOSYSTEM` | `STATUS` | Current ecosystem summary |
| `ECOSYSTEM` | `HISTORY#{timestamp}` | Historical snapshots |
| `APP#{path}` | `STATUS` | Current app status |

### GSIs

1. `gsi1-layer-progress`: Query apps by layer, sorted by progress
2. `gsi2-status-activity`: Query apps by status, sorted by last activity

### Milestones Table

| PK | SK | Description |
|----|-------|-------------|
| `APP#{path}` | `MILESTONE#{timestamp}` | Milestone events |
| `APP#{path}` | `EVENT#{timestamp}` | Change events |

## S3 Structure

```
ecosystem-progress-{env}-data/
├── snapshots/
│   ├── 2026/01/29/
│   │   └── ecosystem-status.json
│   └── latest/
│       └── ecosystem-status.json
├── reports/
│   ├── weekly/
│   │   └── 2026-01-29.md
│   └── monthly/
│       └── 2026-01.md
└── history/
    └── progress-history.parquet (if Timestream enabled)
```

## Cost Estimation

| Resource | Estimated Monthly Cost |
|----------|----------------------|
| Lambda (5 functions) | ~$5-10 |
| DynamoDB (on-demand) | ~$5-20 |
| S3 (snapshots) | ~$1-5 |
| SNS | ~$1 |
| CloudWatch | ~$3-5 |
| Secrets Manager | ~$1 |
| **Total** | **~$16-42/month** |

*Costs depend on sync frequency and notification volume.*

## Troubleshooting

### Sync Not Working

1. Check Lambda logs: CloudWatch → Log groups → `/aws/lambda/ecosystem-progress-{env}-sync`
2. Verify GitHub token: Secrets Manager → `ecosystem-progress-{env}/github-token`
3. Test manually: `aws lambda invoke --function-name ecosystem-progress-{env}-sync output.json`

### Missing Notifications

1. Check SNS subscriptions are confirmed
2. Check Lambda notifier logs
3. Verify email/Slack configuration in secrets

### Dashboard Empty

1. Run manual sync to populate data
2. Check DynamoDB table has items
3. Verify CloudWatch namespace: `EcosystemProgress`
