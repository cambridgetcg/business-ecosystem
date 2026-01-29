# =============================================================================
# Progress Tracking Infrastructure
# =============================================================================
# Tracks development progress across the ecosystem using:
# - S3 for snapshots and reports
# - DynamoDB for live state and milestones
# - Lambda for sync, analysis, and notifications
# - SNS for alerts and reports
# - CloudWatch for dashboards and alarms

variable "github_repo" {
  type        = string
  description = "GitHub repository in format owner/repo"
  default     = "your-org/business-ecosystem"  # Update with actual repo
}

variable "notification_email" {
  type        = string
  description = "Email for progress notifications"
  default     = ""  # Set via TF_VAR_notification_email
}

variable "enable_slack_notifications" {
  type        = bool
  description = "Enable Slack notifications"
  default     = false
}

module "progress_tracking" {
  source = "../../modules/progress-tracking"

  environment  = "dev"
  project_name = "ecosystem"
  aws_region   = var.aws_region

  github_repo   = var.github_repo
  github_branch = "main"

  notification_email         = var.notification_email
  enable_slack_notifications = var.enable_slack_notifications
  enable_email_notifications = var.notification_email != ""

  # Cost optimization for dev
  enable_timestream = false
  enable_quicksight = false

  # More frequent sync for dev testing
  daily_sync_schedule   = "cron(0 6 * * ? *)"  # 6 AM UTC daily
  weekly_report_schedule = "cron(0 9 ? * MON *)"  # 9 AM UTC Monday

  snapshot_retention_days = 30  # Shorter retention for dev

  tags = {
    Component = "progress-tracking"
    Tier      = "infrastructure"
  }
}

# =============================================================================
# Progress Tracking Outputs
# =============================================================================

output "progress_s3_bucket" {
  description = "S3 bucket for progress data"
  value       = module.progress_tracking.s3_bucket_name
}

output "progress_dynamodb_table" {
  description = "DynamoDB table for progress state"
  value       = module.progress_tracking.dynamodb_table_name
}

output "progress_sync_url" {
  description = "Lambda URL for triggering progress sync"
  value       = module.progress_tracking.lambda_sync_url
  sensitive   = true
}

output "progress_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = module.progress_tracking.cloudwatch_dashboard_url
}

output "progress_sns_topics" {
  description = "SNS topic ARNs for notifications"
  value = {
    milestones = module.progress_tracking.sns_milestones_topic_arn
    blockers   = module.progress_tracking.sns_blockers_topic_arn
    weekly     = module.progress_tracking.sns_weekly_topic_arn
    alerts     = module.progress_tracking.sns_alerts_topic_arn
  }
}
