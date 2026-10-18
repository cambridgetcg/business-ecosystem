################################################################################
# Deadline Escalation Lambda Function
################################################################################
#
# This configuration provisions the deadline escalation Lambda function:
#
# Resources:
# - Lambda function with IAM role
# - DynamoDB Stream event source mapping
# - CloudWatch Events rules for scheduled checks
# - CloudWatch Log Group
# - SNS topic for Lambda alerts
#
################################################################################

################################################################################
# Lambda IAM Role
################################################################################

resource "aws_iam_role" "deadline_escalation_lambda" {
  count = var.enable_deadline_lambda ? 1 : 0

  name = "${local.name_prefix}-deadline-escalation-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Purpose = "deadline-escalation-lambda"
  })
}

# Basic Lambda execution policy (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "deadline_escalation_basic" {
  count = var.enable_deadline_lambda ? 1 : 0

  role       = aws_iam_role.deadline_escalation_lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB access policy
resource "aws_iam_role_policy" "deadline_escalation_dynamodb" {
  count = var.enable_deadline_lambda ? 1 : 0

  name = "${local.name_prefix}-deadline-escalation-dynamodb"
  role = aws_iam_role.deadline_escalation_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBTableAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          aws_dynamodb_table.ip_deadlines.arn,
          "${aws_dynamodb_table.ip_deadlines.arn}/index/*"
        ]
      },
      {
        Sid    = "DynamoDBStreamAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = [
          "${aws_dynamodb_table.ip_deadlines.arn}/stream/*"
        ]
      }
    ]
  })
}

# SNS publish policy
resource "aws_iam_role_policy" "deadline_escalation_sns" {
  count = var.enable_deadline_lambda ? 1 : 0

  name = "${local.name_prefix}-deadline-escalation-sns"
  role = aws_iam_role.deadline_escalation_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SNSPublishAccess"
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.deadline_alerts.arn,
          aws_sns_topic.critical_alerts.arn
        ]
      }
    ]
  })
}

# KMS access for encrypted resources
resource "aws_iam_role_policy" "deadline_escalation_kms" {
  count = var.enable_deadline_lambda ? 1 : 0

  name = "${local.name_prefix}-deadline-escalation-kms"
  role = aws_iam_role.deadline_escalation_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "KMSDecryptAccess"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [
          aws_kms_key.ip_documents.arn
        ]
      }
    ]
  })
}

################################################################################
# Lambda Function
################################################################################

resource "aws_lambda_function" "deadline_escalation" {
  count = var.enable_deadline_lambda ? 1 : 0

  function_name = "${local.name_prefix}-deadline-escalation"
  description   = "Processes IP deadline changes and triggers escalation notifications"

  role = aws_iam_role.deadline_escalation_lambda[0].arn

  # Using a placeholder for the deployment package
  # In production, this would be replaced with S3 bucket reference or CI/CD upload
  filename         = "${path.module}/lambda/deadline-escalation.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/deadline-escalation.zip")

  handler = "index.handler"
  runtime = "nodejs20.x"

  timeout     = 60
  memory_size = 256

  environment {
    variables = {
      NODE_ENV                      = var.environment
      DEADLINES_TABLE_NAME          = aws_dynamodb_table.ip_deadlines.name
      SNS_DEADLINE_ALERTS_TOPIC     = aws_sns_topic.deadline_alerts.arn
      SNS_CRITICAL_ALERTS_TOPIC     = aws_sns_topic.critical_alerts.arn
      DEFAULT_DAYS_AHEAD            = "90"
      MAX_DEADLINES_PER_INVOCATION  = "100"
      PROCESS_OVERDUE               = "true"
      LOG_LEVEL                     = var.environment == "prod" ? "info" : "debug"
    }
  }

  # VPC configuration (if needed for database access)
  # vpc_config {
  #   subnet_ids         = var.lambda_subnet_ids
  #   security_group_ids = [aws_security_group.lambda.id]
  # }

  # Enable X-Ray tracing
  tracing_config {
    mode = var.environment == "prod" ? "Active" : "PassThrough"
  }

  # Dead letter queue for failed invocations
  dead_letter_config {
    target_arn = aws_sqs_queue.deadline_escalation_dlq[0].arn
  }

  reserved_concurrent_executions = var.environment == "prod" ? 10 : 5

  tags = merge(local.common_tags, {
    Purpose = "deadline-escalation"
  })

  depends_on = [
    aws_iam_role_policy_attachment.deadline_escalation_basic,
    aws_cloudwatch_log_group.deadline_escalation_lambda
  ]
}

################################################################################
# DynamoDB Stream Event Source Mapping
################################################################################

# Enable streams on the deadlines table
resource "aws_dynamodb_table" "ip_deadlines_stream" {
  # This is managed by the existing ip_deadlines table in main.tf
  # Just ensuring stream is enabled - see main.tf for full table definition
  count = 0 # Placeholder - stream is enabled on main table
}

resource "aws_lambda_event_source_mapping" "deadline_stream" {
  count = var.enable_deadline_lambda ? 1 : 0

  event_source_arn  = aws_dynamodb_table.ip_deadlines.stream_arn
  function_name     = aws_lambda_function.deadline_escalation[0].arn
  starting_position = "LATEST"

  # Batch configuration
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  parallelization_factor             = 2

  # Error handling
  maximum_retry_attempts                 = 3
  maximum_record_age_in_seconds          = 3600
  bisect_batch_on_function_error         = true
  function_response_types                = ["ReportBatchItemFailures"]

  # Destination for failed records
  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.deadline_escalation_dlq[0].arn
    }
  }

  filter_criteria {
    filter {
      # Only process INSERT and MODIFY events for pending deadlines
      pattern = jsonencode({
        eventName = ["INSERT", "MODIFY"]
      })
    }
  }

  depends_on = [
    aws_iam_role_policy.deadline_escalation_dynamodb
  ]
}

################################################################################
# CloudWatch Events Rules for Scheduled Checks
################################################################################

# Hourly check for critical deadlines (within 7 days)
resource "aws_cloudwatch_event_rule" "deadline_check_hourly" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  name                = "${local.name_prefix}-deadline-check-hourly"
  description         = "Hourly check for critical IP deadlines"
  schedule_expression = "rate(1 hour)"
  state               = "ENABLED"

  tags = merge(local.common_tags, {
    Purpose = "deadline-scheduled-check"
  })
}

resource "aws_cloudwatch_event_target" "deadline_check_hourly" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  rule      = aws_cloudwatch_event_rule.deadline_check_hourly[0].name
  target_id = "deadline-escalation-hourly"
  arn       = aws_lambda_function.deadline_escalation[0].arn

  input = jsonencode({
    "detail-type" : "Scheduled Event",
    "source" : "aws.events",
    "detail" : {
      "checkType" : "hourly",
      "daysAhead" : 7,
      "maxDeadlines" : 50
    }
  })
}

resource "aws_lambda_permission" "deadline_check_hourly" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  statement_id  = "AllowCloudWatchHourlyInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.deadline_escalation[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.deadline_check_hourly[0].arn
}

# Daily check for upcoming deadlines (within 90 days)
resource "aws_cloudwatch_event_rule" "deadline_check_daily" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  name                = "${local.name_prefix}-deadline-check-daily"
  description         = "Daily check for upcoming IP deadlines"
  schedule_expression = "cron(0 8 * * ? *)" # 8 AM UTC daily
  state               = "ENABLED"

  tags = merge(local.common_tags, {
    Purpose = "deadline-scheduled-check"
  })
}

resource "aws_cloudwatch_event_target" "deadline_check_daily" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  rule      = aws_cloudwatch_event_rule.deadline_check_daily[0].name
  target_id = "deadline-escalation-daily"
  arn       = aws_lambda_function.deadline_escalation[0].arn

  input = jsonencode({
    "detail-type" : "Scheduled Event",
    "source" : "aws.events",
    "detail" : {
      "checkType" : "daily",
      "daysAhead" : 90,
      "maxDeadlines" : 100
    }
  })
}

resource "aws_lambda_permission" "deadline_check_daily" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  statement_id  = "AllowCloudWatchDailyInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.deadline_escalation[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.deadline_check_daily[0].arn
}

# Weekly comprehensive check
resource "aws_cloudwatch_event_rule" "deadline_check_weekly" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  name                = "${local.name_prefix}-deadline-check-weekly"
  description         = "Weekly comprehensive IP deadline report"
  schedule_expression = "cron(0 9 ? * MON *)" # 9 AM UTC every Monday
  state               = "ENABLED"

  tags = merge(local.common_tags, {
    Purpose = "deadline-scheduled-check"
  })
}

resource "aws_cloudwatch_event_target" "deadline_check_weekly" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  rule      = aws_cloudwatch_event_rule.deadline_check_weekly[0].name
  target_id = "deadline-escalation-weekly"
  arn       = aws_lambda_function.deadline_escalation[0].arn

  input = jsonencode({
    "detail-type" : "Scheduled Event",
    "source" : "aws.events",
    "detail" : {
      "checkType" : "weekly",
      "daysAhead" : 180,
      "maxDeadlines" : 200
    }
  })
}

resource "aws_lambda_permission" "deadline_check_weekly" {
  count = var.enable_deadline_lambda && var.enable_deadline_scheduler ? 1 : 0

  statement_id  = "AllowCloudWatchWeeklyInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.deadline_escalation[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.deadline_check_weekly[0].arn
}

################################################################################
# CloudWatch Log Group
################################################################################

resource "aws_cloudwatch_log_group" "deadline_escalation_lambda" {
  count = var.enable_deadline_lambda ? 1 : 0

  name              = "/aws/lambda/${local.name_prefix}-deadline-escalation"
  retention_in_days = var.application_log_retention_days

  kms_key_id = aws_kms_key.ip_documents.arn

  tags = merge(local.common_tags, {
    Purpose = "lambda-logging"
  })
}

################################################################################
# Dead Letter Queue
################################################################################

resource "aws_sqs_queue" "deadline_escalation_dlq" {
  count = var.enable_deadline_lambda ? 1 : 0

  name = "${local.name_prefix}-deadline-escalation-dlq"

  message_retention_seconds = 1209600 # 14 days
  receive_wait_time_seconds = 20

  # Enable server-side encryption
  sqs_managed_sse_enabled = true

  tags = merge(local.common_tags, {
    Purpose = "deadline-escalation-dlq"
  })
}

# DLQ policy for Lambda
resource "aws_iam_role_policy" "deadline_escalation_dlq" {
  count = var.enable_deadline_lambda ? 1 : 0

  name = "${local.name_prefix}-deadline-escalation-dlq"
  role = aws_iam_role.deadline_escalation_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SQSSendToDeadLetterQueue"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.deadline_escalation_dlq[0].arn
      }
    ]
  })
}

################################################################################
# SNS Topics (referenced from eventbridge.tf or defined here)
################################################################################

# Deadline alerts SNS topic
resource "aws_sns_topic" "deadline_alerts" {
  name = "${local.name_prefix}-deadline-alerts"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : null

  tags = merge(local.common_tags, {
    Purpose = "deadline-alerts"
  })
}

# Critical alerts SNS topic
resource "aws_sns_topic" "critical_alerts" {
  name = "${local.name_prefix}-critical-alerts"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : null

  tags = merge(local.common_tags, {
    Purpose = "critical-alerts"
  })
}

# Email subscription for critical alerts (if configured)
resource "aws_sns_topic_subscription" "critical_alerts_email" {
  count = var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

################################################################################
# CloudWatch Alarms
################################################################################

# Lambda error alarm
resource "aws_cloudwatch_metric_alarm" "deadline_escalation_errors" {
  count = var.enable_deadline_lambda && var.environment == "prod" ? 1 : 0

  alarm_name          = "${local.name_prefix}-deadline-escalation-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Deadline escalation Lambda has excessive errors"

  dimensions = {
    FunctionName = aws_lambda_function.deadline_escalation[0].function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.deadline_alerts.arn]

  tags = local.common_tags
}

# Lambda throttling alarm
resource "aws_cloudwatch_metric_alarm" "deadline_escalation_throttles" {
  count = var.enable_deadline_lambda && var.environment == "prod" ? 1 : 0

  alarm_name          = "${local.name_prefix}-deadline-escalation-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Deadline escalation Lambda is being throttled"

  dimensions = {
    FunctionName = aws_lambda_function.deadline_escalation[0].function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

# DLQ message alarm
resource "aws_cloudwatch_metric_alarm" "deadline_escalation_dlq_messages" {
  count = var.enable_deadline_lambda && var.environment == "prod" ? 1 : 0

  alarm_name          = "${local.name_prefix}-deadline-escalation-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in deadline escalation dead letter queue"

  dimensions = {
    QueueName = aws_sqs_queue.deadline_escalation_dlq[0].name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

################################################################################
# Outputs
################################################################################

output "deadline_escalation_lambda_arn" {
  description = "ARN of the deadline escalation Lambda function"
  value       = var.enable_deadline_lambda ? aws_lambda_function.deadline_escalation[0].arn : null
}

output "deadline_escalation_lambda_name" {
  description = "Name of the deadline escalation Lambda function"
  value       = var.enable_deadline_lambda ? aws_lambda_function.deadline_escalation[0].function_name : null
}

output "deadline_alerts_topic_arn" {
  description = "ARN of the deadline alerts SNS topic"
  value       = aws_sns_topic.deadline_alerts.arn
}

output "critical_alerts_topic_arn" {
  description = "ARN of the critical alerts SNS topic"
  value       = aws_sns_topic.critical_alerts.arn
}

output "deadline_escalation_dlq_arn" {
  description = "ARN of the deadline escalation dead letter queue"
  value       = var.enable_deadline_lambda ? aws_sqs_queue.deadline_escalation_dlq[0].arn : null
}
