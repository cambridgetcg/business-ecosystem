# =============================================================================
# SNS Topics for Data Privacy Notifications
# =============================================================================
# Event-driven notifications for privacy compliance

# -----------------------------------------------------------------------------
# Consent Events Topic
# -----------------------------------------------------------------------------

resource "aws_sns_topic" "consent_events" {
  name              = "${local.name_prefix}-consent-events"
  kms_master_key_id = aws_kms_key.data_privacy.id

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-consent-events"
    Purpose = "Consent Event Notifications"
  })
}

resource "aws_sns_topic_policy" "consent_events" {
  arn = aws_sns_topic.consent_events.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridge"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.consent_events.arn
      },
      {
        Sid    = "AllowAccountPublish"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.consent_events.arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# DSAR Notifications Topic
# -----------------------------------------------------------------------------

resource "aws_sns_topic" "dsar_notifications" {
  name              = "${local.name_prefix}-dsar-notifications"
  kms_master_key_id = aws_kms_key.data_privacy.id

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-dsar-notifications"
    Purpose = "DSAR Deadline Notifications"
  })
}

resource "aws_sns_topic_policy" "dsar_notifications" {
  arn = aws_sns_topic.dsar_notifications.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridge"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.dsar_notifications.arn
      },
      {
        Sid    = "AllowLambda"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.dsar_notifications.arn
      },
      {
        Sid    = "AllowAccountPublish"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.dsar_notifications.arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Breach Critical Topic
# -----------------------------------------------------------------------------

resource "aws_sns_topic" "breach_critical" {
  name              = "${local.name_prefix}-breach-critical"
  kms_master_key_id = aws_kms_key.data_privacy.id

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-breach-critical"
    Purpose = "Critical Breach Notifications"
  })
}

resource "aws_sns_topic_policy" "breach_critical" {
  arn = aws_sns_topic.breach_critical.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridge"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.breach_critical.arn
      },
      {
        Sid    = "AllowLambda"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.breach_critical.arn
      },
      {
        Sid    = "AllowAccountPublish"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.breach_critical.arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Email Subscriptions (optional)
# -----------------------------------------------------------------------------

resource "aws_sns_topic_subscription" "dsar_email" {
  count     = var.enable_email_notifications && var.notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.dsar_notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

resource "aws_sns_topic_subscription" "breach_email" {
  count     = var.enable_email_notifications && var.notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.breach_critical.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# -----------------------------------------------------------------------------
# Slack Integration (optional via Lambda)
# -----------------------------------------------------------------------------

# Placeholder for Slack webhook integration
# Would require a Lambda function to transform SNS messages to Slack format
# resource "aws_sns_topic_subscription" "slack_webhook" {
#   count     = var.enable_slack_notifications ? 1 : 0
#   topic_arn = aws_sns_topic.breach_critical.arn
#   protocol  = "lambda"
#   endpoint  = aws_lambda_function.slack_notifier[0].arn
# }
