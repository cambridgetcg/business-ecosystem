################################################################################
# SQS Queues for UK Tax Service Async Processing
################################################################################
#
# Queues:
# - ct-calculations: Corporation Tax period calculations
# - vat-returns: VAT return calculations and MTD submissions
# - paye-submissions: PAYE RTI submissions (FPS/EPS)
# - notifications: Tax events and webhook notifications
#
################################################################################

# =============================================================================
# Corporation Tax Calculations Queue
# =============================================================================

resource "aws_sqs_queue" "ct_calculations" {
  name                       = "${var.project_name}-${var.environment}-ct-calculations"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600 # 14 days
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 300 # 5 minutes for CT calculation

  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ct_calculations_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name    = "${var.project_name}-${var.environment}-ct-calculations"
    Purpose = "corporation-tax-processing"
  }
}

resource "aws_sqs_queue" "ct_calculations_dlq" {
  name                      = "${var.project_name}-${var.environment}-ct-calculations-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-ct-calculations-dlq"
    Purpose = "failed-ct-calculations"
  }
}

# =============================================================================
# VAT Returns Queue
# =============================================================================

resource "aws_sqs_queue" "vat_returns" {
  name                       = "${var.project_name}-${var.environment}-vat-returns"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 180 # 3 minutes for VAT calculation

  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.vat_returns_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name    = "${var.project_name}-${var.environment}-vat-returns"
    Purpose = "vat-return-processing"
  }
}

resource "aws_sqs_queue" "vat_returns_dlq" {
  name                      = "${var.project_name}-${var.environment}-vat-returns-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-vat-returns-dlq"
    Purpose = "failed-vat-returns"
  }
}

# =============================================================================
# PAYE Submissions Queue
# =============================================================================

resource "aws_sqs_queue" "paye_submissions" {
  name                       = "${var.project_name}-${var.environment}-paye-submissions"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 120 # 2 minutes for PAYE/NI calculation

  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.paye_submissions_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name    = "${var.project_name}-${var.environment}-paye-submissions"
    Purpose = "paye-rti-processing"
  }
}

resource "aws_sqs_queue" "paye_submissions_dlq" {
  name                      = "${var.project_name}-${var.environment}-paye-submissions-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true

  tags = {
    Name    = "${var.project_name}-${var.environment}-paye-submissions-dlq"
    Purpose = "failed-paye-submissions"
  }
}

# =============================================================================
# Notifications Queue (tax events, webhooks)
# =============================================================================

resource "aws_sqs_queue" "notifications" {
  name                       = "${var.project_name}-${var.environment}-notifications"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 30

  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name    = "${var.project_name}-${var.environment}-notifications"
    Purpose = "tax-event-notifications"
  }
}

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "${var.project_name}-${var.environment}-notifications-dlq"
  message_retention_seconds = 1209600
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
          aws_sqs_queue.ct_calculations.arn,
          aws_sqs_queue.vat_returns.arn,
          aws_sqs_queue.paye_submissions.arn,
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
          aws_sqs_queue.ct_calculations_dlq.arn,
          aws_sqs_queue.vat_returns_dlq.arn,
          aws_sqs_queue.paye_submissions_dlq.arn,
          aws_sqs_queue.notifications_dlq.arn
        ]
      }
    ]
  })
}
