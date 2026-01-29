################################################################################
# Progress Tracking Module - Variables
################################################################################

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ecosystem"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "GitHub repository (owner/repo)"
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "GitHub branch to monitor"
  type        = string
  default     = "main"
}

# Notification Configuration
variable "notification_email" {
  description = "Email address for notifications"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_slack_notifications" {
  description = "Enable Slack notifications"
  type        = bool
  default     = false
}

variable "enable_email_notifications" {
  description = "Enable email notifications"
  type        = bool
  default     = true
}

# Schedule Configuration
variable "daily_sync_schedule" {
  description = "Cron expression for daily sync (UTC)"
  type        = string
  default     = "cron(0 6 * * ? *)" # 6 AM UTC daily
}

variable "weekly_report_schedule" {
  description = "Cron expression for weekly report (UTC)"
  type        = string
  default     = "cron(0 9 ? * MON *)" # Monday 9 AM UTC
}

# Retention Configuration
variable "snapshot_retention_days" {
  description = "Days to retain S3 snapshots"
  type        = number
  default     = 90
}

variable "dynamodb_ttl_days" {
  description = "Days to retain DynamoDB history records"
  type        = number
  default     = 365
}

variable "log_retention_days" {
  description = "Days to retain CloudWatch logs"
  type        = number
  default     = 30
}

# Feature Flags
variable "enable_timestream" {
  description = "Enable Timestream for time-series metrics"
  type        = bool
  default     = false
}

variable "enable_quicksight" {
  description = "Enable QuickSight integration"
  type        = bool
  default     = false
}

# Tags
variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}

locals {
  name_prefix = "${var.project_name}-progress-${var.environment}"

  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    Module      = "progress-tracking"
    ManagedBy   = "terraform"
  })
}
