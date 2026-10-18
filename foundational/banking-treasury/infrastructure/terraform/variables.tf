################################################################################
# Banking-Treasury Infrastructure - Variables
################################################################################

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for deployment"
  default     = "us-east-1"
}

################################################################################
# EventBridge Configuration
################################################################################

variable "enable_cross_account_events" {
  type        = bool
  description = "Enable cross-account event publishing"
  default     = false
}

variable "event_archive_retention_days" {
  type        = number
  description = "Days to retain events in archive"
  default     = 90
}

################################################################################
# Step Functions Configuration
################################################################################

variable "payment_approval_timeout_hours" {
  type        = number
  description = "Hours to wait for payment approval before timeout"
  default     = 24
}

variable "payment_retry_max_attempts" {
  type        = number
  description = "Maximum retry attempts for failed payments"
  default     = 3
}

variable "payment_retry_interval_seconds" {
  type        = number
  description = "Initial retry interval in seconds"
  default     = 60
}

################################################################################
# Audit Configuration
################################################################################

variable "audit_log_retention_days" {
  type        = number
  description = "Days to retain audit logs in S3"
  default     = 2555  # 7 years for financial compliance

  validation {
    condition     = var.audit_log_retention_days >= 365
    error_message = "Audit logs must be retained for at least 1 year."
  }
}

variable "enable_cloudtrail_insights" {
  type        = bool
  description = "Enable CloudTrail Insights for anomaly detection"
  default     = true
}

################################################################################
# Notification Configuration
################################################################################

variable "alert_email" {
  type        = string
  description = "Email address for critical alerts"
  default     = ""
}

variable "slack_webhook_url" {
  type        = string
  description = "Slack webhook URL for notifications"
  default     = ""
  sensitive   = true
}

################################################################################
# Feature Flags
################################################################################

variable "enable_payment_workflow" {
  type        = bool
  description = "Enable Step Functions payment workflow"
  default     = true
}

variable "enable_audit_logging" {
  type        = bool
  description = "Enable CloudTrail audit logging"
  default     = true
}

variable "enable_event_archive" {
  type        = bool
  description = "Enable EventBridge event archiving"
  default     = true
}

################################################################################
# DynamoDB Configuration
################################################################################

variable "dynamodb_read_capacity" {
  type        = number
  description = "Base read capacity units for DynamoDB tables (provisioned mode)"
  default     = 25
}

variable "dynamodb_write_capacity" {
  type        = number
  description = "Base write capacity units for DynamoDB tables (provisioned mode)"
  default     = 25
}

variable "dynamodb_max_read_capacity" {
  type        = number
  description = "Maximum read capacity for auto-scaling"
  default     = 1000
}

variable "dynamodb_max_write_capacity" {
  type        = number
  description = "Maximum write capacity for auto-scaling"
  default     = 500
}

variable "enable_dynamodb_streams" {
  type        = bool
  description = "Enable DynamoDB Streams for change data capture"
  default     = true
}

################################################################################
# Compliance Configuration
################################################################################

variable "high_risk_countries" {
  type        = string
  description = "Comma-separated list of high-risk country codes"
  default     = "KP,IR,SY,CU,VE,RU,BY"
}

variable "velocity_check_window_mins" {
  type        = number
  description = "Time window in minutes for velocity checks"
  default     = 1440  # 24 hours
}

variable "max_daily_amount_usd" {
  type        = number
  description = "Maximum daily transaction amount in USD before enhanced review"
  default     = 50000
}
