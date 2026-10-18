# =============================================================================
# Data Privacy Module Variables
# =============================================================================

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"
}

variable "project_name" {
  type        = string
  description = "Project name for resource naming"
  default     = "ecosystem"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# Audit Configuration
# -----------------------------------------------------------------------------

variable "audit_log_retention_days" {
  type        = number
  description = "Days to retain CloudWatch audit logs before streaming to S3"
  default     = 30
}

variable "audit_s3_retention_days" {
  type        = number
  description = "Days to retain audit logs in S3 before deletion (GDPR: 7 years = 2555)"
  default     = 2555
}

variable "audit_glacier_transition_days" {
  type        = number
  description = "Days before transitioning audit logs to Glacier"
  default     = 365
}

variable "audit_deep_archive_transition_days" {
  type        = number
  description = "Days before transitioning audit logs to Deep Archive"
  default     = 730
}

# -----------------------------------------------------------------------------
# Event Configuration
# -----------------------------------------------------------------------------

variable "enable_eventbridge" {
  type        = bool
  description = "Enable EventBridge for event publishing"
  default     = true
}

variable "enable_sns_notifications" {
  type        = bool
  description = "Enable SNS notifications for privacy events"
  default     = true
}

# -----------------------------------------------------------------------------
# Lambda Configuration
# -----------------------------------------------------------------------------

variable "enable_deadline_lambdas" {
  type        = bool
  description = "Enable Lambda functions for deadline monitoring"
  default     = true
}

variable "dsar_deadline_alert_days" {
  type        = list(number)
  description = "Days before DSAR deadline to send alerts"
  default     = [5, 3, 1]
}

variable "breach_escalation_hours" {
  type        = list(number)
  description = "Hours before breach notification deadline to escalate"
  default     = [48, 24, 4]
}

# -----------------------------------------------------------------------------
# Notification Configuration
# -----------------------------------------------------------------------------

variable "notification_email" {
  type        = string
  description = "Email for privacy compliance notifications"
  default     = ""
}

variable "slack_webhook_url" {
  type        = string
  description = "Slack webhook URL for notifications"
  default     = ""
  sensitive   = true
}

variable "enable_email_notifications" {
  type        = bool
  description = "Enable email notifications"
  default     = true
}

variable "enable_slack_notifications" {
  type        = bool
  description = "Enable Slack notifications"
  default     = false
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  type        = map(string)
  description = "Additional tags for resources"
  default     = {}
}

# -----------------------------------------------------------------------------
# Locals
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-data-privacy-${var.environment}"

  common_tags = merge(var.tags, {
    Environment = var.environment
    Project     = var.project_name
    Service     = "data-privacy"
    ManagedBy   = "terraform"
  })
}
