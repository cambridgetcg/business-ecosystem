################################################################################
# SQS Queues for Compliance Service Async Processing
################################################################################
#
# Queues:
# - findings-processing: Process compliance findings and assessments
# - audit-events: Regulatory audit trail and compliance events
# - notifications: Alert notifications and deadline reminders
#
################################################################################

# =============================================================================
# Findings Processing Queue
# =============================================================================

resource "aws_sqs_queue" "findings_processing" {
  name                       = "${var.project_name}-${var.environment}-findings-processing"
  delay_seconds              = 0
  max_message_size           = 262144  # 256 KB
  message_retention_seconds  = 1209600 # 14 days
  receive_wait_time_seconds  = 20      # Long polling
  visibility_timeout_seconds = 300     # 5 minutes for processing

  # Enable server-side encryption
  sqs_managed_sse_enabled = true

  # Redrive policy to DLQ after 3 failed attempts
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.findings_processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name    = "${var.project_name}-${var.environment}-findings-processing"
    Purpose = "compliance-findings-processing"
  }
}

# Dead Letter Queue for failed findings processing
resource "aws_sqs_queue" "findings_processing_dlq" {
  name                      = "${var.project_name}-${var.environment}-findings-processing-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-findings-processing-dlq"
    Purpose = "failed-findings-processing"
  }
}

# =============================================================================
# Audit Events Queue (for regulatory audit trail)
# =============================================================================

resource "aws_sqs_queue" "audit_events" {
  name                       = "${var.project_name}-${var.environment}-audit-events"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600 # 14 days - audit events retained longer
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120     # 2 minutes

  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.audit_events_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name       = "${var.project_name}-${var.environment}-audit-events"
    Purpose    = "regulatory-audit-trail"
    Compliance = "SOX-GDPR"
  }
}

resource "aws_sqs_queue" "audit_events_dlq" {
  name                      = "${var.project_name}-${var.environment}-audit-events-dlq"
  message_retention_seconds = 1209600 # 14 days
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-audit-events-dlq"
    Purpose = "failed-audit-events"
  }
}

# =============================================================================
# Notifications Queue (deadline alerts, compliance reminders)
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
    Purpose = "compliance-notifications-alerts"
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
          aws_sqs_queue.findings_processing.arn,
          aws_sqs_queue.audit_events.arn,
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
          aws_sqs_queue.findings_processing_dlq.arn,
          aws_sqs_queue.audit_events_dlq.arn,
          aws_sqs_queue.notifications_dlq.arn
        ]
      }
    ]
  })
}

# =============================================================================
# CloudWatch Alarms for Queue Monitoring
# =============================================================================

# Findings DLQ has messages (needs attention)
resource "aws_cloudwatch_metric_alarm" "findings_dlq_messages" {
  alarm_name          = "${var.project_name}-${var.environment}-findings-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Findings processing DLQ has failed messages that need attention"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.findings_processing_dlq.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-findings-dlq-alarm"
  }
}

# Findings queue depth high (processing backlog)
resource "aws_cloudwatch_metric_alarm" "findings_queue_depth" {
  alarm_name          = "${var.project_name}-${var.environment}-findings-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 100
  alarm_description   = "Findings processing queue has high message backlog"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.findings_processing.name
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-findings-queue-depth-alarm"
  }
}

# Audit Events DLQ has messages (critical - compliance data)
resource "aws_cloudwatch_metric_alarm" "audit_dlq_messages" {
  alarm_name          = "${var.project_name}-${var.environment}-audit-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Audit events DLQ has failed messages - CRITICAL for compliance"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.audit_events_dlq.name
  }

  tags = {
    Name       = "${var.project_name}-${var.environment}-audit-dlq-alarm"
    Compliance = "Critical"
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "findings_queue_url" {
  description = "URL of the findings processing SQS queue"
  value       = aws_sqs_queue.findings_processing.url
}

output "findings_queue_arn" {
  description = "ARN of the findings processing SQS queue"
  value       = aws_sqs_queue.findings_processing.arn
}

output "audit_events_queue_url" {
  description = "URL of the audit events SQS queue"
  value       = aws_sqs_queue.audit_events.url
}

output "notifications_queue_url" {
  description = "URL of the notifications SQS queue"
  value       = aws_sqs_queue.notifications.url
}
