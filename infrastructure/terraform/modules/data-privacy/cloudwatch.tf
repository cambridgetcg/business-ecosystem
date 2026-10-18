# =============================================================================
# CloudWatch Rules and Alarms for Data Privacy
# =============================================================================
# Scheduled rules for deadline monitoring and compliance alarms

# -----------------------------------------------------------------------------
# Scheduled Rules - DSAR Deadline Checker (Daily)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "dsar_deadline_cron" {
  count               = var.enable_deadline_lambdas ? 1 : 0
  name                = "${local.name_prefix}-dsar-deadline-daily"
  description         = "Daily check for approaching DSAR deadlines"
  schedule_expression = "cron(0 8 * * ? *)" # 8 AM UTC daily

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "dsar_deadline_lambda" {
  count     = var.enable_deadline_lambdas ? 1 : 0
  rule      = aws_cloudwatch_event_rule.dsar_deadline_cron[0].name
  target_id = "dsar-deadline-checker"
  arn       = aws_lambda_function.dsar_deadline_checker[0].arn
}

# -----------------------------------------------------------------------------
# Scheduled Rules - Breach Escalation Monitor (Hourly)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "breach_escalation_cron" {
  count               = var.enable_deadline_lambdas ? 1 : 0
  name                = "${local.name_prefix}-breach-escalation-hourly"
  description         = "Hourly check for breach notification deadlines (72-hour rule)"
  schedule_expression = "rate(1 hour)"

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "breach_escalation_lambda" {
  count     = var.enable_deadline_lambdas ? 1 : 0
  rule      = aws_cloudwatch_event_rule.breach_escalation_cron[0].name
  target_id = "breach-escalation-monitor"
  arn       = aws_lambda_function.breach_escalation_monitor[0].arn
}

# -----------------------------------------------------------------------------
# Scheduled Rules - Consent Expiration (Daily)
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "consent_expiration_cron" {
  count               = var.enable_deadline_lambdas ? 1 : 0
  name                = "${local.name_prefix}-consent-expiration-daily"
  description         = "Daily processing of expired consents"
  schedule_expression = "cron(0 2 * * ? *)" # 2 AM UTC daily

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "consent_expiration_lambda" {
  count     = var.enable_deadline_lambdas ? 1 : 0
  rule      = aws_cloudwatch_event_rule.consent_expiration_cron[0].name
  target_id = "consent-expiration-processor"
  arn       = aws_lambda_function.consent_expiration_processor[0].arn
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms - DSAR Compliance
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "dsar_overdue" {
  count               = var.enable_deadline_lambdas ? 1 : 0
  alarm_name          = "${local.name_prefix}-dsar-overdue"
  alarm_description   = "Alert when DSARs are past deadline"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "OverdueDSARCount"
  namespace           = "DataPrivacy"
  period              = 86400 # 24 hours
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.dsar_notifications.arn]
  ok_actions    = [aws_sns_topic.dsar_notifications.arn]

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms - Breach Notification
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "breach_notification_overdue" {
  count               = var.enable_deadline_lambdas ? 1 : 0
  alarm_name          = "${local.name_prefix}-breach-notification-overdue"
  alarm_description   = "CRITICAL: Breach notification deadline exceeded (72-hour rule)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BreachNotificationOverdue"
  namespace           = "DataPrivacy"
  period              = 3600 # 1 hour
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.breach_critical.arn]
  ok_actions    = [aws_sns_topic.breach_critical.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "breach_approaching_deadline" {
  count               = var.enable_deadline_lambdas ? 1 : 0
  alarm_name          = "${local.name_prefix}-breach-deadline-approaching"
  alarm_description   = "Warning: Breach notification deadline approaching"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BreachDeadlineApproaching"
  namespace           = "DataPrivacy"
  period              = 3600 # 1 hour
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.breach_critical.arn]

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms - Lambda Errors
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count               = var.enable_deadline_lambdas ? 1 : 0
  alarm_name          = "${local.name_prefix}-lambda-errors"
  alarm_description   = "Privacy automation Lambda function errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = "${local.name_prefix}-*"
  }

  alarm_actions = [aws_sns_topic.dsar_notifications.arn]

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Dashboard
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "privacy_compliance" {
  dashboard_name = "${local.name_prefix}-compliance"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# Data Privacy Compliance Dashboard"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "DSAR Status"
          region = var.aws_region
          metrics = [
            ["DataPrivacy", "PendingDSARCount", "Environment", var.environment, { label = "Pending" }],
            [".", "OverdueDSARCount", ".", ".", { label = "Overdue", color = "#d62728" }],
            [".", "CompletedDSARCount", ".", ".", { label = "Completed", color = "#2ca02c" }]
          ]
          period = 86400
          stat   = "Maximum"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Breach Status"
          region = var.aws_region
          metrics = [
            ["DataPrivacy", "OpenBreachCount", "Environment", var.environment, { label = "Open" }],
            [".", "BreachNotificationOverdue", ".", ".", { label = "Notification Overdue", color = "#d62728" }],
            [".", "ResolvedBreachCount", ".", ".", { label = "Resolved", color = "#2ca02c" }]
          ]
          period = 3600
          stat   = "Maximum"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 1
        width  = 8
        height = 6
        properties = {
          title  = "Consent Activity"
          region = var.aws_region
          metrics = [
            ["DataPrivacy", "ConsentsGranted", "Environment", var.environment, { label = "Granted", color = "#2ca02c" }],
            [".", "ConsentsWithdrawn", ".", ".", { label = "Withdrawn", color = "#ff7f0e" }],
            [".", "ConsentsExpired", ".", ".", { label = "Expired", color = "#7f7f7f" }]
          ]
          period = 86400
          stat   = "Sum"
        }
      },
      {
        type   = "alarm"
        x      = 0
        y      = 7
        width  = 24
        height = 4
        properties = {
          title  = "Compliance Alarms"
          alarms = var.enable_deadline_lambdas ? [
            aws_cloudwatch_metric_alarm.dsar_overdue[0].arn,
            aws_cloudwatch_metric_alarm.breach_notification_overdue[0].arn,
            aws_cloudwatch_metric_alarm.breach_approaching_deadline[0].arn
          ] : []
        }
      }
    ]
  })
}
