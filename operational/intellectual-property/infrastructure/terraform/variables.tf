################################################################################
# Intellectual Property Infrastructure - Variables
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

variable "enable_event_archive" {
  type        = bool
  description = "Enable EventBridge event archiving"
  default     = true
}

variable "event_archive_retention_days" {
  type        = number
  description = "Days to retain events in archive"
  default     = 90
}

################################################################################
# Deadline Configuration
################################################################################

variable "deadline_alert_days" {
  type        = list(number)
  description = "Days before deadline to send alerts"
  default     = [90, 60, 30, 14, 7, 3, 1]
}

variable "enable_deadline_scheduler" {
  type        = bool
  description = "Enable EventBridge Scheduler for deadline checking"
  default     = true
}

################################################################################
# Audit Configuration
################################################################################

variable "audit_log_retention_cloudwatch" {
  type        = number
  description = "Days to retain audit logs in CloudWatch"
  default     = 90

  validation {
    condition     = var.audit_log_retention_cloudwatch >= 30
    error_message = "Audit logs must be retained for at least 30 days in CloudWatch."
  }
}

variable "audit_log_retention_s3" {
  type        = number
  description = "Days to retain audit logs in S3 (long-term)"
  default     = 2555 # 7 years for compliance

  validation {
    condition     = var.audit_log_retention_s3 >= 365
    error_message = "Audit logs must be retained for at least 1 year in S3."
  }
}

variable "application_log_retention_days" {
  type        = number
  description = "Days to retain application logs"
  default     = 30
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

variable "enable_email_notifications" {
  type        = bool
  description = "Enable email notifications via SNS"
  default     = true
}

################################################################################
# S3 Document Storage Configuration
################################################################################

variable "enable_s3_intelligent_tiering" {
  type        = bool
  description = "Enable S3 Intelligent-Tiering for automatic cost optimization"
  default     = false
}

variable "patent_retention_years" {
  type        = number
  description = "Years to retain patent documents"
  default     = 20
}

variable "trademark_retention_years" {
  type        = number
  description = "Years to retain trademark documents"
  default     = 14
}

variable "domain_retention_years" {
  type        = number
  description = "Years to retain domain name documents"
  default     = 10
}

################################################################################
# DynamoDB Configuration
################################################################################

variable "dynamodb_billing_mode" {
  type        = string
  description = "DynamoDB billing mode (PAY_PER_REQUEST or PROVISIONED)"
  default     = "PAY_PER_REQUEST"

  validation {
    condition     = contains(["PAY_PER_REQUEST", "PROVISIONED"], var.dynamodb_billing_mode)
    error_message = "Billing mode must be PAY_PER_REQUEST or PROVISIONED."
  }
}

################################################################################
# Feature Flags
################################################################################

variable "enable_trade_secret_mfa_delete" {
  type        = bool
  description = "Enable MFA delete on trade secrets bucket (requires manual AWS CLI setup)"
  default     = false
}

variable "enable_cross_service_events" {
  type        = bool
  description = "Enable cross-service event publishing to other ecosystem services"
  default     = true
}

variable "enable_step_functions" {
  type        = bool
  description = "Enable Step Functions for IP workflows"
  default     = true
}

variable "enable_deadline_lambda" {
  type        = bool
  description = "Enable Lambda for deadline evaluation"
  default     = true
}
