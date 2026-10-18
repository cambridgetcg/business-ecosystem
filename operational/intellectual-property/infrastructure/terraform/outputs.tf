################################################################################
# Intellectual Property Infrastructure - Outputs
################################################################################

################################################################################
# KMS Keys
################################################################################

output "kms_key_documents_arn" {
  description = "ARN of the KMS key for IP document encryption"
  value       = aws_kms_key.ip_documents.arn
}

output "kms_key_documents_id" {
  description = "ID of the KMS key for IP document encryption"
  value       = aws_kms_key.ip_documents.key_id
}

output "kms_key_trade_secrets_arn" {
  description = "ARN of the KMS key for trade secret encryption"
  value       = aws_kms_key.trade_secrets.arn
}

output "kms_key_trade_secrets_id" {
  description = "ID of the KMS key for trade secret encryption"
  value       = aws_kms_key.trade_secrets.key_id
}

################################################################################
# S3 Buckets
################################################################################

output "s3_bucket_documents_name" {
  description = "Name of the S3 bucket for IP documents"
  value       = aws_s3_bucket.ip_documents.id
}

output "s3_bucket_documents_arn" {
  description = "ARN of the S3 bucket for IP documents"
  value       = aws_s3_bucket.ip_documents.arn
}

output "s3_bucket_trade_secrets_name" {
  description = "Name of the S3 bucket for trade secrets"
  value       = aws_s3_bucket.trade_secrets.id
}

output "s3_bucket_trade_secrets_arn" {
  description = "ARN of the S3 bucket for trade secrets"
  value       = aws_s3_bucket.trade_secrets.arn
}

################################################################################
# DynamoDB Tables
################################################################################

output "dynamodb_deadlines_table_name" {
  description = "Name of the DynamoDB table for IP deadlines"
  value       = aws_dynamodb_table.ip_deadlines.name
}

output "dynamodb_deadlines_table_arn" {
  description = "ARN of the DynamoDB table for IP deadlines"
  value       = aws_dynamodb_table.ip_deadlines.arn
}

output "dynamodb_events_table_name" {
  description = "Name of the DynamoDB table for IP events"
  value       = aws_dynamodb_table.ip_events.name
}

output "dynamodb_events_table_arn" {
  description = "ARN of the DynamoDB table for IP events"
  value       = aws_dynamodb_table.ip_events.arn
}

output "dynamodb_events_stream_arn" {
  description = "ARN of the DynamoDB stream for IP events"
  value       = aws_dynamodb_table.ip_events.stream_arn
}

################################################################################
# EventBridge
################################################################################

output "eventbridge_bus_name" {
  description = "Name of the EventBridge event bus"
  value       = aws_cloudwatch_event_bus.ip_service.name
}

output "eventbridge_bus_arn" {
  description = "ARN of the EventBridge event bus"
  value       = aws_cloudwatch_event_bus.ip_service.arn
}

################################################################################
# SNS Topics
################################################################################

output "sns_deadline_alerts_arn" {
  description = "ARN of the SNS topic for deadline alerts"
  value       = aws_sns_topic.deadline_alerts.arn
}

output "sns_critical_alerts_arn" {
  description = "ARN of the SNS topic for critical alerts"
  value       = aws_sns_topic.critical_alerts.arn
}

output "sns_ip_events_arn" {
  description = "ARN of the SNS topic for general IP events"
  value       = aws_sns_topic.ip_events.arn
}

output "sns_trade_secret_alerts_arn" {
  description = "ARN of the SNS topic for trade secret alerts"
  value       = aws_sns_topic.trade_secret_alerts.arn
}

output "sns_cross_service_arn" {
  description = "ARN of the SNS topic for cross-service events"
  value       = var.enable_cross_service_events ? aws_sns_topic.cross_service[0].arn : null
}

################################################################################
# CloudWatch Log Groups
################################################################################

output "cloudwatch_audit_log_group" {
  description = "Name of the CloudWatch log group for audit logs"
  value       = aws_cloudwatch_log_group.ip_audit.name
}

output "cloudwatch_application_log_group" {
  description = "Name of the CloudWatch log group for application logs"
  value       = aws_cloudwatch_log_group.ip_application.name
}

output "cloudwatch_trade_secret_log_group" {
  description = "Name of the CloudWatch log group for trade secret access"
  value       = aws_cloudwatch_log_group.trade_secret_access.name
}

################################################################################
# IAM
################################################################################

output "iam_service_role_arn" {
  description = "ARN of the IAM role for the IP service"
  value       = aws_iam_role.ip_service.arn
}

output "iam_service_role_name" {
  description = "Name of the IAM role for the IP service"
  value       = aws_iam_role.ip_service.name
}

################################################################################
# Configuration for Application
################################################################################

output "aws_config" {
  description = "AWS configuration for the IP service application"
  value = {
    region = local.region

    s3 = {
      documents_bucket     = aws_s3_bucket.ip_documents.id
      trade_secrets_bucket = aws_s3_bucket.trade_secrets.id
    }

    kms = {
      documents_key_id     = aws_kms_key.ip_documents.key_id
      trade_secrets_key_id = aws_kms_key.trade_secrets.key_id
    }

    dynamodb = {
      deadlines_table = aws_dynamodb_table.ip_deadlines.name
      events_table    = aws_dynamodb_table.ip_events.name
    }

    eventbridge = {
      bus_name = aws_cloudwatch_event_bus.ip_service.name
    }

    sns = {
      deadline_alerts_topic     = aws_sns_topic.deadline_alerts.arn
      critical_alerts_topic     = aws_sns_topic.critical_alerts.arn
      ip_events_topic           = aws_sns_topic.ip_events.arn
      trade_secret_alerts_topic = aws_sns_topic.trade_secret_alerts.arn
    }

    cloudwatch = {
      audit_log_group        = aws_cloudwatch_log_group.ip_audit.name
      application_log_group  = aws_cloudwatch_log_group.ip_application.name
      trade_secret_log_group = aws_cloudwatch_log_group.trade_secret_access.name
    }
  }
}
