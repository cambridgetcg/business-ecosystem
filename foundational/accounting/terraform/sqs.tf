################################################################################
# SQS Queues for Async Processing
################################################################################
#
# Queues:
# - import-jobs: Processing import files (CSV, Excel)
# - journal-posting: Async journal entry posting for large batches
# - notifications: Audit trail and webhook notifications
#
################################################################################

# =============================================================================
# Import Jobs Queue
# =============================================================================

resource "aws_sqs_queue" "import_jobs" {
  name                       = "${var.project_name}-${var.environment}-import-jobs"
  delay_seconds              = 0
  max_message_size           = 262144  # 256 KB
  message_retention_seconds  = 1209600 # 14 days
  receive_wait_time_seconds  = 20      # Long polling
  visibility_timeout_seconds = 300     # 5 minutes for processing

  # Enable server-side encryption
  sqs_managed_sse_enabled = true

  # Redrive policy to DLQ after 3 failed attempts
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.import_jobs_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name    = "${var.project_name}-${var.environment}-import-jobs"
    Purpose = "async-import-processing"
  }
}

# Dead Letter Queue for failed import jobs
resource "aws_sqs_queue" "import_jobs_dlq" {
  name                      = "${var.project_name}-${var.environment}-import-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-import-jobs-dlq"
    Purpose = "failed-import-jobs"
  }
}

# =============================================================================
# Journal Posting Queue (for large batch postings)
# =============================================================================

resource "aws_sqs_queue" "journal_posting" {
  name                       = "${var.project_name}-${var.environment}-journal-posting"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 86400   # 1 day
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120     # 2 minutes

  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.journal_posting_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name    = "${var.project_name}-${var.environment}-journal-posting"
    Purpose = "async-journal-posting"
  }
}

resource "aws_sqs_queue" "journal_posting_dlq" {
  name                      = "${var.project_name}-${var.environment}-journal-posting-dlq"
  message_retention_seconds = 604800 # 7 days
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-journal-posting-dlq"
    Purpose = "failed-journal-postings"
  }
}

# =============================================================================
# Notifications Queue (audit events, webhooks)
# =============================================================================

resource "aws_sqs_queue" "notifications" {
  name                       = "${var.project_name}-${var.environment}-notifications"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600  # 4 days
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 30

  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name    = "${var.project_name}-${var.environment}-notifications"
    Purpose = "audit-and-webhook-notifications"
  }
}

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "${var.project_name}-${var.environment}-notifications-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-notifications-dlq"
    Purpose = "failed-notifications"
  }
}

# =============================================================================
# IAM Policy for ECS Task to Access SQS
# =============================================================================

resource "aws_iam_role_policy" "ecs_task_sqs" {
  name = "sqs-access"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SQSSendReceive"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          aws_sqs_queue.import_jobs.arn,
          aws_sqs_queue.journal_posting.arn,
          aws_sqs_queue.notifications.arn
        ]
      },
      {
        Sid    = "SQSDLQRead"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl"
        ]
        Resource = [
          aws_sqs_queue.import_jobs_dlq.arn,
          aws_sqs_queue.journal_posting_dlq.arn,
          aws_sqs_queue.notifications_dlq.arn
        ]
      }
    ]
  })
}

# =============================================================================
# CloudWatch Alarms for Queue Monitoring
# =============================================================================

# Import Jobs DLQ has messages (needs attention)
resource "aws_cloudwatch_metric_alarm" "import_dlq_messages" {
  alarm_name          = "${var.project_name}-${var.environment}-import-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Import jobs DLQ has failed messages that need attention"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.import_jobs_dlq.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-import-dlq-alarm"
  }
}

# Import Jobs queue depth high (processing backlog)
resource "aws_cloudwatch_metric_alarm" "import_queue_depth" {
  alarm_name          = "${var.project_name}-${var.environment}-import-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 100
  alarm_description   = "Import jobs queue has high message backlog"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.import_jobs.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-import-queue-depth-alarm"
  }
}

# Journal Posting DLQ has messages
resource "aws_cloudwatch_metric_alarm" "journal_dlq_messages" {
  alarm_name          = "${var.project_name}-${var.environment}-journal-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Journal posting DLQ has failed messages"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.journal_posting_dlq.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-journal-dlq-alarm"
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "import_jobs_queue_url" {
  description = "URL of the import jobs SQS queue"
  value       = aws_sqs_queue.import_jobs.url
}

output "import_jobs_queue_arn" {
  description = "ARN of the import jobs SQS queue"
  value       = aws_sqs_queue.import_jobs.arn
}

output "journal_posting_queue_url" {
  description = "URL of the journal posting SQS queue"
  value       = aws_sqs_queue.journal_posting.url
}

output "notifications_queue_url" {
  description = "URL of the notifications SQS queue"
  value       = aws_sqs_queue.notifications.url
}
