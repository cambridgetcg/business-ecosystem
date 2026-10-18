################################################################################
# SQS Queues for Payment Reliability
################################################################################
#
# Reliable message delivery for payment processing with:
# - Dead Letter Queues (DLQ) for failed messages
# - FIFO queues for ordered processing (optional)
# - Encryption and access policies
# - CloudWatch alarms for monitoring
#
################################################################################

################################################################################
# Payment Processing Queue (Standard)
################################################################################

resource "aws_sqs_queue" "payment_processing" {
  name = "${local.name_prefix}-payment-processing"

  # Message retention: 14 days
  message_retention_seconds = 1209600

  # Visibility timeout: 5 minutes (for processing)
  visibility_timeout_seconds = 300

  # Delay: no delay for immediate processing
  delay_seconds = 0

  # Message size: up to 256 KB
  max_message_size = 262144

  # Long polling for efficiency
  receive_wait_time_seconds = 20

  # Encryption
  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  # Redrive policy (send to DLQ after 3 failed attempts)
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.payment_processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(local.common_tags, {
    Purpose = "payment-processing"
  })
}

resource "aws_sqs_queue" "payment_processing_dlq" {
  name = "${local.name_prefix}-payment-processing-dlq"

  message_retention_seconds  = 1209600  # 14 days
  visibility_timeout_seconds = 300

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  tags = merge(local.common_tags, {
    Purpose = "payment-processing-dlq"
  })
}

# Allow main queue to send to DLQ
resource "aws_sqs_queue_redrive_allow_policy" "payment_processing" {
  queue_url = aws_sqs_queue.payment_processing_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.payment_processing.arn]
  })
}

################################################################################
# Payment Execution Queue (FIFO for ordering)
################################################################################

resource "aws_sqs_queue" "payment_execution" {
  name                        = "${local.name_prefix}-payment-execution.fifo"
  fifo_queue                  = true
  content_based_deduplication = true

  message_retention_seconds  = 1209600
  visibility_timeout_seconds = 300
  receive_wait_time_seconds  = 20

  # FIFO throughput (high throughput mode in production)
  deduplication_scope   = "messageGroup"
  fifo_throughput_limit = var.environment == "prod" ? "perMessageGroupId" : "perQueue"

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.payment_execution_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(local.common_tags, {
    Purpose = "payment-execution-fifo"
  })
}

resource "aws_sqs_queue" "payment_execution_dlq" {
  name                        = "${local.name_prefix}-payment-execution-dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true

  message_retention_seconds  = 1209600
  visibility_timeout_seconds = 300

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  tags = merge(local.common_tags, {
    Purpose = "payment-execution-dlq"
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "payment_execution" {
  queue_url = aws_sqs_queue.payment_execution_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.payment_execution.arn]
  })
}

################################################################################
# Balance Update Queue
################################################################################

resource "aws_sqs_queue" "balance_updates" {
  name = "${local.name_prefix}-balance-updates"

  message_retention_seconds  = 86400  # 1 day
  visibility_timeout_seconds = 60
  receive_wait_time_seconds  = 10

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.balance_updates_dlq.arn
    maxReceiveCount     = 5
  })

  tags = merge(local.common_tags, {
    Purpose = "balance-updates"
  })
}

resource "aws_sqs_queue" "balance_updates_dlq" {
  name = "${local.name_prefix}-balance-updates-dlq"

  message_retention_seconds  = 1209600
  visibility_timeout_seconds = 60

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  tags = merge(local.common_tags, {
    Purpose = "balance-updates-dlq"
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "balance_updates" {
  queue_url = aws_sqs_queue.balance_updates_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.balance_updates.arn]
  })
}

################################################################################
# Reconciliation Queue
################################################################################

resource "aws_sqs_queue" "reconciliation" {
  name = "${local.name_prefix}-reconciliation"

  message_retention_seconds  = 86400
  visibility_timeout_seconds = 600  # 10 min for reconciliation processing
  receive_wait_time_seconds  = 20

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.reconciliation_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(local.common_tags, {
    Purpose = "reconciliation"
  })
}

resource "aws_sqs_queue" "reconciliation_dlq" {
  name = "${local.name_prefix}-reconciliation-dlq"

  message_retention_seconds  = 1209600
  visibility_timeout_seconds = 600

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  tags = merge(local.common_tags, {
    Purpose = "reconciliation-dlq"
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "reconciliation" {
  queue_url = aws_sqs_queue.reconciliation_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.reconciliation.arn]
  })
}

################################################################################
# Bank Statement Import Queue
################################################################################

resource "aws_sqs_queue" "bank_statement_import" {
  name = "${local.name_prefix}-bank-statement-import"

  message_retention_seconds  = 86400
  visibility_timeout_seconds = 900  # 15 min for statement processing
  receive_wait_time_seconds  = 20

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.bank_statement_import_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(local.common_tags, {
    Purpose = "bank-statement-import"
  })
}

resource "aws_sqs_queue" "bank_statement_import_dlq" {
  name = "${local.name_prefix}-bank-statement-import-dlq"

  message_retention_seconds  = 1209600
  visibility_timeout_seconds = 900

  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  tags = merge(local.common_tags, {
    Purpose = "bank-statement-import-dlq"
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "bank_statement_import" {
  queue_url = aws_sqs_queue.bank_statement_import_dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.bank_statement_import.arn]
  })
}

################################################################################
# IAM Policy for SQS Access
################################################################################

resource "aws_iam_policy" "sqs_access" {
  name        = "${local.name_prefix}-sqs-access"
  description = "Policy for accessing banking-treasury SQS queues"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SendToQueues"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:SendMessageBatch"
        ]
        Resource = [
          aws_sqs_queue.payment_processing.arn,
          aws_sqs_queue.payment_execution.arn,
          aws_sqs_queue.balance_updates.arn,
          aws_sqs_queue.reconciliation.arn,
          aws_sqs_queue.bank_statement_import.arn
        ]
      },
      {
        Sid    = "ReceiveFromQueues"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:DeleteMessageBatch",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          aws_sqs_queue.payment_processing.arn,
          aws_sqs_queue.payment_execution.arn,
          aws_sqs_queue.balance_updates.arn,
          aws_sqs_queue.reconciliation.arn,
          aws_sqs_queue.bank_statement_import.arn
        ]
      },
      {
        Sid    = "DLQAccess"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.payment_processing_dlq.arn,
          aws_sqs_queue.payment_execution_dlq.arn,
          aws_sqs_queue.balance_updates_dlq.arn,
          aws_sqs_queue.reconciliation_dlq.arn,
          aws_sqs_queue.bank_statement_import_dlq.arn
        ]
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.environment == "prod" ? [aws_kms_key.sqs[0].arn] : []
      }
    ]
  })

  tags = local.common_tags
}

################################################################################
# CloudWatch Alarms for DLQs
################################################################################

resource "aws_cloudwatch_metric_alarm" "payment_processing_dlq" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-payment-processing-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in payment processing DLQ"

  dimensions = {
    QueueName = aws_sqs_queue.payment_processing_dlq.name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "payment_execution_dlq" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-payment-execution-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in payment execution DLQ"

  dimensions = {
    QueueName = aws_sqs_queue.payment_execution_dlq.name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "reconciliation_dlq" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-reconciliation-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in reconciliation DLQ"

  dimensions = {
    QueueName = aws_sqs_queue.reconciliation_dlq.name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

################################################################################
# Queue Age Monitoring (for SLA compliance)
################################################################################

resource "aws_cloudwatch_metric_alarm" "payment_processing_age" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-payment-processing-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ApproximateAgeOfOldestMessage"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 300  # 5 minutes
  alarm_description   = "Payment processing queue has old messages"

  dimensions = {
    QueueName = aws_sqs_queue.payment_processing.name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}
