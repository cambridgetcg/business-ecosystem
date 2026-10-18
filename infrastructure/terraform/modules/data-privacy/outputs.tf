# =============================================================================
# Data Privacy Module Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# KMS
# -----------------------------------------------------------------------------

output "kms_key_id" {
  description = "ID of the data privacy KMS key"
  value       = aws_kms_key.data_privacy.key_id
}

output "kms_key_arn" {
  description = "ARN of the data privacy KMS key"
  value       = aws_kms_key.data_privacy.arn
}

output "kms_key_alias" {
  description = "Alias of the data privacy KMS key"
  value       = aws_kms_alias.data_privacy.name
}

# -----------------------------------------------------------------------------
# S3 Buckets
# -----------------------------------------------------------------------------

output "audit_bucket_name" {
  description = "Name of the audit S3 bucket"
  value       = aws_s3_bucket.audit.id
}

output "audit_bucket_arn" {
  description = "ARN of the audit S3 bucket"
  value       = aws_s3_bucket.audit.arn
}

output "dsar_exports_bucket_name" {
  description = "Name of the DSAR exports S3 bucket"
  value       = aws_s3_bucket.dsar_exports.id
}

output "dsar_exports_bucket_arn" {
  description = "ARN of the DSAR exports S3 bucket"
  value       = aws_s3_bucket.dsar_exports.arn
}

output "athena_results_bucket_name" {
  description = "Name of the Athena results S3 bucket"
  value       = aws_s3_bucket.athena_results.id
}

# -----------------------------------------------------------------------------
# Kinesis Firehose
# -----------------------------------------------------------------------------

output "firehose_delivery_stream_name" {
  description = "Name of the Kinesis Firehose delivery stream"
  value       = aws_kinesis_firehose_delivery_stream.audit.name
}

output "firehose_delivery_stream_arn" {
  description = "ARN of the Kinesis Firehose delivery stream"
  value       = aws_kinesis_firehose_delivery_stream.audit.arn
}

# -----------------------------------------------------------------------------
# CloudWatch
# -----------------------------------------------------------------------------

output "audit_log_group_name" {
  description = "Name of the CloudWatch audit log group"
  value       = aws_cloudwatch_log_group.audit.name
}

output "audit_log_group_arn" {
  description = "ARN of the CloudWatch audit log group"
  value       = aws_cloudwatch_log_group.audit.arn
}

# -----------------------------------------------------------------------------
# Glue
# -----------------------------------------------------------------------------

output "glue_database_name" {
  description = "Name of the Glue catalog database"
  value       = aws_glue_catalog_database.audit.name
}

output "glue_audit_table_name" {
  description = "Name of the Glue audit events table"
  value       = aws_glue_catalog_table.audit_events.name
}

# -----------------------------------------------------------------------------
# Athena
# -----------------------------------------------------------------------------

output "athena_workgroup_name" {
  description = "Name of the Athena workgroup"
  value       = aws_athena_workgroup.audit.name
}

# -----------------------------------------------------------------------------
# EventBridge
# -----------------------------------------------------------------------------

output "event_bus_name" {
  description = "Name of the privacy events EventBridge bus"
  value       = aws_cloudwatch_event_bus.privacy_events.name
}

output "event_bus_arn" {
  description = "ARN of the privacy events EventBridge bus"
  value       = aws_cloudwatch_event_bus.privacy_events.arn
}

# -----------------------------------------------------------------------------
# SNS Topics
# -----------------------------------------------------------------------------

output "sns_consent_topic_arn" {
  description = "ARN of the consent events SNS topic"
  value       = aws_sns_topic.consent_events.arn
}

output "sns_dsar_topic_arn" {
  description = "ARN of the DSAR notifications SNS topic"
  value       = aws_sns_topic.dsar_notifications.arn
}

output "sns_breach_topic_arn" {
  description = "ARN of the breach critical SNS topic"
  value       = aws_sns_topic.breach_critical.arn
}

# -----------------------------------------------------------------------------
# Lambda Functions
# -----------------------------------------------------------------------------

output "lambda_dsar_deadline_arn" {
  description = "ARN of the DSAR deadline checker Lambda"
  value       = var.enable_deadline_lambdas ? aws_lambda_function.dsar_deadline_checker[0].arn : null
}

output "lambda_breach_escalation_arn" {
  description = "ARN of the breach escalation monitor Lambda"
  value       = var.enable_deadline_lambdas ? aws_lambda_function.breach_escalation_monitor[0].arn : null
}

output "lambda_consent_expiration_arn" {
  description = "ARN of the consent expiration processor Lambda"
  value       = var.enable_deadline_lambdas ? aws_lambda_function.consent_expiration_processor[0].arn : null
}

# -----------------------------------------------------------------------------
# CloudWatch Dashboard
# -----------------------------------------------------------------------------

output "dashboard_name" {
  description = "Name of the CloudWatch compliance dashboard"
  value       = aws_cloudwatch_dashboard.privacy_compliance.dashboard_name
}

# -----------------------------------------------------------------------------
# Environment Configuration (for application use)
# -----------------------------------------------------------------------------

output "app_config" {
  description = "Configuration values for the data-privacy application"
  value = {
    aws_region             = var.aws_region
    kms_key_alias          = aws_kms_alias.data_privacy.name
    audit_bucket           = aws_s3_bucket.audit.id
    dsar_exports_bucket    = aws_s3_bucket.dsar_exports.id
    audit_log_group        = aws_cloudwatch_log_group.audit.name
    athena_workgroup       = aws_athena_workgroup.audit.name
    athena_database        = aws_glue_catalog_database.audit.name
    event_bus              = aws_cloudwatch_event_bus.privacy_events.name
    sns_consent_topic      = aws_sns_topic.consent_events.arn
    sns_dsar_topic         = aws_sns_topic.dsar_notifications.arn
    sns_breach_topic       = aws_sns_topic.breach_critical.arn
  }
  sensitive = false
}
