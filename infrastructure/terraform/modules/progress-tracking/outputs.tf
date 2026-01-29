################################################################################
# Progress Tracking Module - Outputs
################################################################################

# S3
output "s3_bucket_name" {
  description = "Name of the S3 bucket for progress data"
  value       = aws_s3_bucket.progress.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.progress.arn
}

# DynamoDB
output "dynamodb_table_name" {
  description = "Name of the DynamoDB progress table"
  value       = aws_dynamodb_table.progress.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB progress table"
  value       = aws_dynamodb_table.progress.arn
}

output "milestones_table_name" {
  description = "Name of the DynamoDB milestones table"
  value       = aws_dynamodb_table.milestones.name
}

# Lambda Functions
output "lambda_sync_arn" {
  description = "ARN of the sync Lambda function"
  value       = aws_lambda_function.sync.arn
}

output "lambda_sync_url" {
  description = "URL for the sync Lambda function (webhook)"
  value       = aws_lambda_function_url.sync.function_url
}

output "lambda_analyzer_arn" {
  description = "ARN of the analyzer Lambda function"
  value       = aws_lambda_function.analyzer.arn
}

output "lambda_comparator_arn" {
  description = "ARN of the comparator Lambda function"
  value       = aws_lambda_function.comparator.arn
}

output "lambda_reporter_arn" {
  description = "ARN of the reporter Lambda function"
  value       = aws_lambda_function.reporter.arn
}

output "lambda_notifier_arn" {
  description = "ARN of the notifier Lambda function"
  value       = aws_lambda_function.notifier.arn
}

# SNS Topics
output "sns_milestones_topic_arn" {
  description = "ARN of the milestones SNS topic"
  value       = aws_sns_topic.milestones.arn
}

output "sns_blockers_topic_arn" {
  description = "ARN of the blockers SNS topic"
  value       = aws_sns_topic.blockers.arn
}

output "sns_weekly_topic_arn" {
  description = "ARN of the weekly report SNS topic"
  value       = aws_sns_topic.weekly.arn
}

output "sns_alerts_topic_arn" {
  description = "ARN of the alerts SNS topic"
  value       = aws_sns_topic.alerts.arn
}

# CloudWatch
output "cloudwatch_dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.progress.dashboard_name
}

output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.progress.dashboard_name}"
}

# Secrets
output "github_token_secret_arn" {
  description = "ARN of the GitHub token secret"
  value       = aws_secretsmanager_secret.github_token.arn
}

output "slack_webhook_secret_arn" {
  description = "ARN of the Slack webhook secret (if enabled)"
  value       = var.enable_slack_notifications ? aws_secretsmanager_secret.slack_webhook[0].arn : null
}

# Timestream (conditional)
output "timestream_database_name" {
  description = "Name of the Timestream database (if enabled)"
  value       = var.enable_timestream ? aws_timestreamwrite_database.progress[0].database_name : null
}

# IAM
output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.arn
}

# Summary
output "summary" {
  description = "Summary of deployed resources"
  value = {
    environment     = var.environment
    s3_bucket       = aws_s3_bucket.progress.id
    dynamodb_table  = aws_dynamodb_table.progress.name
    webhook_url     = aws_lambda_function_url.sync.function_url
    dashboard_url   = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.progress.dashboard_name}"
    sns_topics = {
      milestones = aws_sns_topic.milestones.arn
      blockers   = aws_sns_topic.blockers.arn
      weekly     = aws_sns_topic.weekly.arn
      alerts     = aws_sns_topic.alerts.arn
    }
  }
}
