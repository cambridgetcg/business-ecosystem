################################################################################
# Banking-Treasury Infrastructure - Outputs
################################################################################

################################################################################
# Database Outputs
################################################################################

output "database_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "database_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = module.database.service_secret_arns["banking_treasury"]
}

output "database_read_replica_endpoint" {
  description = "RDS read replica endpoint (production only)"
  value       = var.environment == "prod" ? module.database.endpoint : null
  sensitive   = true
}

################################################################################
# Cache Outputs
################################################################################

output "cache_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.cache.primary_endpoint
}

output "cache_reader_endpoint" {
  description = "ElastiCache Redis reader endpoint"
  value       = module.cache.reader_endpoint
}

output "cache_auth_secret_arn" {
  description = "ARN of the Redis auth token secret"
  value       = module.cache.auth_secret_arn
}

################################################################################
# EventBridge Outputs
################################################################################

output "event_bus_name" {
  description = "EventBridge event bus name"
  value       = aws_cloudwatch_event_bus.banking_treasury.name
}

output "event_bus_arn" {
  description = "EventBridge event bus ARN"
  value       = aws_cloudwatch_event_bus.banking_treasury.arn
}

output "sns_topic_arns" {
  description = "SNS topic ARNs for event distribution"
  value = {
    payment_events       = aws_sns_topic.payment_events.arn
    balance_events       = aws_sns_topic.balance_events.arn
    reconciliation_events = aws_sns_topic.reconciliation_events.arn
    critical_alerts      = aws_sns_topic.critical_alerts.arn
  }
}

################################################################################
# Step Functions Outputs
################################################################################

output "payment_workflow_arn" {
  description = "Payment workflow Step Functions state machine ARN"
  value       = var.enable_payment_workflow ? aws_sfn_state_machine.payment_workflow[0].arn : null
}

output "payment_workflow_name" {
  description = "Payment workflow Step Functions state machine name"
  value       = var.enable_payment_workflow ? aws_sfn_state_machine.payment_workflow[0].name : null
}

output "approval_queue_url" {
  description = "SQS queue URL for payment approvals"
  value       = var.enable_payment_workflow ? aws_sqs_queue.payment_approval[0].url : null
}

output "compliance_review_queue_url" {
  description = "SQS queue URL for compliance reviews"
  value       = var.enable_payment_workflow ? aws_sqs_queue.compliance_review[0].url : null
}

################################################################################
# SQS Queue Outputs
################################################################################

output "sqs_queue_urls" {
  description = "SQS queue URLs for payment processing"
  value = {
    payment_processing      = aws_sqs_queue.payment_processing.url
    payment_processing_dlq  = aws_sqs_queue.payment_processing_dlq.url
    payment_execution       = aws_sqs_queue.payment_execution.url
    payment_execution_dlq   = aws_sqs_queue.payment_execution_dlq.url
    balance_updates         = aws_sqs_queue.balance_updates.url
    balance_updates_dlq     = aws_sqs_queue.balance_updates_dlq.url
    reconciliation          = aws_sqs_queue.reconciliation.url
    reconciliation_dlq      = aws_sqs_queue.reconciliation_dlq.url
    bank_statement_import   = aws_sqs_queue.bank_statement_import.url
    bank_statement_import_dlq = aws_sqs_queue.bank_statement_import_dlq.url
  }
}

output "sqs_queue_arns" {
  description = "SQS queue ARNs for IAM policies"
  value = {
    payment_processing    = aws_sqs_queue.payment_processing.arn
    payment_execution     = aws_sqs_queue.payment_execution.arn
    balance_updates       = aws_sqs_queue.balance_updates.arn
    reconciliation        = aws_sqs_queue.reconciliation.arn
    bank_statement_import = aws_sqs_queue.bank_statement_import.arn
  }
}

output "sqs_access_policy_arn" {
  description = "IAM policy ARN for SQS access"
  value       = aws_iam_policy.sqs_access.arn
}

################################################################################
# Audit Outputs
################################################################################

output "audit_bucket_name" {
  description = "S3 bucket name for audit logs"
  value       = var.enable_audit_logging ? aws_s3_bucket.audit_logs[0].id : null
}

output "audit_bucket_arn" {
  description = "S3 bucket ARN for audit logs"
  value       = var.enable_audit_logging ? aws_s3_bucket.audit_logs[0].arn : null
}

output "cloudtrail_arn" {
  description = "CloudTrail ARN"
  value       = var.enable_audit_logging ? aws_cloudtrail.banking_treasury[0].arn : null
}

output "audit_log_group_name" {
  description = "CloudWatch Log Group for application audit logs"
  value       = var.enable_audit_logging ? aws_cloudwatch_log_group.application_audit[0].name : null
}

output "athena_workgroup_name" {
  description = "Athena workgroup for audit queries"
  value       = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : null
}

output "glue_database_name" {
  description = "Glue database for audit logs"
  value       = var.enable_audit_logging ? aws_glue_catalog_database.audit[0].name : null
}

################################################################################
# DynamoDB Outputs
################################################################################

output "dynamodb_cash_positions_table" {
  description = "DynamoDB table name for cash positions"
  value       = aws_dynamodb_table.cash_positions.name
}

output "dynamodb_cash_positions_arn" {
  description = "DynamoDB table ARN for cash positions"
  value       = aws_dynamodb_table.cash_positions.arn
}

output "dynamodb_cash_positions_stream_arn" {
  description = "DynamoDB Streams ARN for cash positions"
  value       = aws_dynamodb_table.cash_positions.stream_arn
}

output "dynamodb_transaction_ledger_table" {
  description = "DynamoDB table name for transaction ledger"
  value       = aws_dynamodb_table.transaction_ledger.name
}

output "dynamodb_transaction_ledger_arn" {
  description = "DynamoDB table ARN for transaction ledger"
  value       = aws_dynamodb_table.transaction_ledger.arn
}

output "dynamodb_transaction_ledger_stream_arn" {
  description = "DynamoDB Streams ARN for transaction ledger"
  value       = aws_dynamodb_table.transaction_ledger.stream_arn
}

output "dynamodb_payment_status_table" {
  description = "DynamoDB table name for payment status"
  value       = aws_dynamodb_table.payment_status.name
}

output "dynamodb_payment_status_arn" {
  description = "DynamoDB table ARN for payment status"
  value       = aws_dynamodb_table.payment_status.arn
}

output "dynamodb_payment_status_stream_arn" {
  description = "DynamoDB Streams ARN for payment status"
  value       = aws_dynamodb_table.payment_status.stream_arn
}

################################################################################
# Secrets Outputs
################################################################################

output "bank_api_secret_arn" {
  description = "ARN of the bank API credentials secret"
  value       = aws_secretsmanager_secret.bank_api_credentials.arn
}

output "fx_provider_secret_arn" {
  description = "ARN of the FX provider credentials secret"
  value       = aws_secretsmanager_secret.fx_provider.arn
}

################################################################################
# Lambda Outputs
################################################################################

output "lambda_cash_position_processor_arn" {
  description = "Cash position stream processor Lambda ARN"
  value       = var.enable_dynamodb_streams ? aws_lambda_function.cash_position_processor[0].arn : null
}

output "lambda_transaction_processor_arn" {
  description = "Transaction stream processor Lambda ARN"
  value       = var.enable_dynamodb_streams ? aws_lambda_function.transaction_processor[0].arn : null
}

output "lambda_payment_status_processor_arn" {
  description = "Payment status stream processor Lambda ARN"
  value       = var.enable_dynamodb_streams ? aws_lambda_function.payment_status_processor[0].arn : null
}

output "stream_dlq_url" {
  description = "SQS DLQ URL for stream processing failures"
  value       = var.enable_dynamodb_streams ? aws_sqs_queue.stream_dlq[0].url : null
}

################################################################################
# Compliance Outputs
################################################################################

output "compliance_screening_lambda_arn" {
  description = "Compliance screening Lambda ARN"
  value       = aws_lambda_function.compliance_screening.arn
}

output "compliance_rules_table" {
  description = "DynamoDB table for compliance rules"
  value       = aws_dynamodb_table.compliance_rules.name
}

output "compliance_results_table" {
  description = "DynamoDB table for compliance results"
  value       = aws_dynamodb_table.compliance_results.name
}

output "compliance_api_secret_arn" {
  description = "Secrets Manager ARN for compliance API credentials"
  value       = aws_secretsmanager_secret.compliance_api.arn
}

################################################################################
# ML Forecasting Outputs
################################################################################

output "ml_artifacts_bucket" {
  description = "S3 bucket for ML model artifacts"
  value       = var.enable_ml_forecasting ? aws_s3_bucket.ml_artifacts[0].bucket : null
}

output "feature_group_name" {
  description = "SageMaker Feature Group for cash flow features"
  value       = var.enable_ml_forecasting ? aws_sagemaker_feature_group.cash_flow_features[0].feature_group_name : null
}

output "sagemaker_endpoint_config" {
  description = "SageMaker endpoint configuration name"
  value       = var.enable_ml_forecasting ? aws_sagemaker_endpoint_configuration.cash_flow_forecast[0].name : null
}

output "forecast_lambda_arn" {
  description = "Forecast prediction Lambda ARN"
  value       = var.enable_ml_forecasting ? aws_lambda_function.forecast_prediction[0].arn : null
}

output "forecasts_table" {
  description = "DynamoDB table for cash flow forecasts"
  value       = var.enable_ml_forecasting ? aws_dynamodb_table.forecasts[0].name : null
}

################################################################################
# Reconciliation Outputs
################################################################################

output "reconciliation_lambda_arn" {
  description = "Reconciliation Lambda ARN"
  value       = aws_lambda_function.reconciliation.arn
}

output "reconciliation_sessions_table" {
  description = "DynamoDB table for reconciliation sessions"
  value       = aws_dynamodb_table.reconciliation_sessions.name
}

output "reconciliation_matches_table" {
  description = "DynamoDB table for reconciliation matches"
  value       = aws_dynamodb_table.reconciliation_matches.name
}

output "reconciliation_exceptions_table" {
  description = "DynamoDB table for reconciliation exceptions"
  value       = aws_dynamodb_table.reconciliation_exceptions.name
}

output "bank_statements_bucket" {
  description = "S3 bucket for bank statements"
  value       = aws_s3_bucket.bank_statements.bucket
}

################################################################################
# Analytics Outputs
################################################################################

output "analytics_database" {
  description = "Glue database for analytics"
  value       = var.enable_analytics ? aws_glue_catalog_database.analytics[0].name : null
}

output "analytics_reports_lambda_arn" {
  description = "Analytics reports Lambda ARN"
  value       = var.enable_analytics ? aws_lambda_function.analytics_reports[0].arn : null
}

################################################################################
# Bank Connectivity Outputs
################################################################################

output "bank_statement_fetcher_lambda_arn" {
  description = "Bank statement fetcher Lambda ARN"
  value       = aws_lambda_function.bank_statement_fetcher.arn
}

output "bank_statement_processor_lambda_arn" {
  description = "Bank statement processor Lambda ARN"
  value       = aws_lambda_function.bank_statement_processor.arn
}

output "bank_connections_table" {
  description = "DynamoDB table for bank connections"
  value       = aws_dynamodb_table.bank_connections.name
}

output "statement_imports_table" {
  description = "DynamoDB table for statement imports"
  value       = aws_dynamodb_table.statement_imports.name
}

output "bank_credentials_secret_arn" {
  description = "Secrets Manager ARN for bank credentials"
  value       = aws_secretsmanager_secret.bank_credentials.arn
}

################################################################################
# KMS Key Outputs (Production)
################################################################################

output "kms_key_arns" {
  description = "KMS key ARNs (production only)"
  value = var.environment == "prod" ? {
    database = aws_kms_key.database[0].arn
    cache    = aws_kms_key.cache[0].arn
    dynamodb = aws_kms_key.dynamodb[0].arn
    sqs      = var.enable_dynamodb_streams ? aws_kms_key.sqs[0].arn : null
    audit    = var.enable_audit_logging ? aws_kms_key.audit[0].arn : null
    sns      = aws_kms_key.sns[0].arn
  } : null
}

################################################################################
# Summary Output
################################################################################

output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment = var.environment
    region      = local.region
    account_id  = local.account_id

    database = {
      endpoint            = module.database.endpoint
      multi_az            = var.environment == "prod"
      read_replica        = var.environment == "prod"
    }

    cache = {
      endpoint            = module.cache.primary_endpoint
      cluster_mode        = var.environment == "prod"
    }

    eventbridge = {
      event_bus           = aws_cloudwatch_event_bus.banking_treasury.name
      archive_enabled     = var.enable_event_archive
    }

    step_functions = {
      enabled             = var.enable_payment_workflow
      workflow_name       = var.enable_payment_workflow ? aws_sfn_state_machine.payment_workflow[0].name : null
    }

    dynamodb = {
      cash_positions_table      = aws_dynamodb_table.cash_positions.name
      transaction_ledger_table  = aws_dynamodb_table.transaction_ledger.name
      payment_status_table      = aws_dynamodb_table.payment_status.name
      streams_enabled           = var.enable_dynamodb_streams
      billing_mode              = var.environment == "prod" ? "PROVISIONED" : "PAY_PER_REQUEST"
    }

    audit = {
      enabled             = var.enable_audit_logging
      retention_days      = var.audit_log_retention_days
      insights_enabled    = var.enable_cloudtrail_insights
    }
  }
}
