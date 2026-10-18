################################################################################
# EventBridge Configuration
################################################################################
#
# Event routing for banking-treasury domain events:
# - Payment events (initiated, completed, failed)
# - Balance change events
# - Reconciliation events
# - Cash position updates
#
# Routes events to:
# - SNS topics (for external consumers)
# - Step Functions (for workflow triggers)
# - CloudWatch Logs (for debugging/audit)
# - Lambda (for real-time processing)
#
################################################################################

################################################################################
# Event Bus
################################################################################

resource "aws_cloudwatch_event_bus" "banking_treasury" {
  name = "${local.name_prefix}-events"

  tags = local.common_tags
}

# Event bus policy for cross-service communication
resource "aws_cloudwatch_event_bus_policy" "cross_service" {
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEcosystemServices"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "events:PutEvents"
        Resource = aws_cloudwatch_event_bus.banking_treasury.arn
      }
    ]
  })
}

################################################################################
# Event Archive (for replay capability)
################################################################################

resource "aws_cloudwatch_event_archive" "banking_treasury" {
  count = var.enable_event_archive ? 1 : 0

  name             = "${local.name_prefix}-archive"
  event_source_arn = aws_cloudwatch_event_bus.banking_treasury.arn
  retention_days   = var.event_archive_retention_days

  description = "Archive of banking-treasury events for replay"
}

################################################################################
# SNS Topics for Event Distribution
################################################################################

# Payment events topic
resource "aws_sns_topic" "payment_events" {
  name = "${local.name_prefix}-payment-events"

  # Enable encryption
  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = local.common_tags
}

# Balance change events topic
resource "aws_sns_topic" "balance_events" {
  name = "${local.name_prefix}-balance-events"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = local.common_tags
}

# Reconciliation events topic
resource "aws_sns_topic" "reconciliation_events" {
  name = "${local.name_prefix}-reconciliation-events"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = local.common_tags
}

# Critical alerts topic
resource "aws_sns_topic" "critical_alerts" {
  name = "${local.name_prefix}-critical-alerts"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = local.common_tags
}

# KMS key for SNS encryption (production only)
resource "aws_kms_key" "sns" {
  count = var.environment == "prod" ? 1 : 0

  description             = "KMS key for banking-treasury SNS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRootAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowSNSAccess"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowEventBridgeAccess"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

# Email subscription for alerts (if configured)
resource "aws_sns_topic_subscription" "alert_email" {
  count = var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

################################################################################
# EventBridge Rules - Payment Events
################################################################################

# Payment initiated → SNS + CloudWatch
resource "aws_cloudwatch_event_rule" "payment_initiated" {
  name           = "${local.name_prefix}-payment-initiated"
  description    = "Route payment initiated events"
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  event_pattern = jsonencode({
    source      = ["banking-treasury"]
    detail-type = ["Payment.Initiated"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "payment_initiated_sns" {
  rule           = aws_cloudwatch_event_rule.payment_initiated.name
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name
  target_id      = "payment-events-sns"
  arn            = aws_sns_topic.payment_events.arn

  input_transformer {
    input_paths = {
      paymentId = "$.detail.paymentId"
      amount    = "$.detail.amount"
      currency  = "$.detail.currency"
      source    = "$.source"
      time      = "$.time"
    }
    input_template = <<EOF
{
  "eventType": "Payment.Initiated",
  "paymentId": <paymentId>,
  "amount": <amount>,
  "currency": <currency>,
  "source": <source>,
  "timestamp": <time>
}
EOF
  }
}

# Payment completed → SNS + Accounting integration
resource "aws_cloudwatch_event_rule" "payment_completed" {
  name           = "${local.name_prefix}-payment-completed"
  description    = "Route payment completed events"
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  event_pattern = jsonencode({
    source      = ["banking-treasury"]
    detail-type = ["Payment.Completed"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "payment_completed_sns" {
  rule           = aws_cloudwatch_event_rule.payment_completed.name
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name
  target_id      = "payment-events-sns"
  arn            = aws_sns_topic.payment_events.arn
}

# Payment failed → Critical alerts
resource "aws_cloudwatch_event_rule" "payment_failed" {
  name           = "${local.name_prefix}-payment-failed"
  description    = "Route payment failed events to alerts"
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  event_pattern = jsonencode({
    source      = ["banking-treasury"]
    detail-type = ["Payment.Failed"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "payment_failed_alerts" {
  rule           = aws_cloudwatch_event_rule.payment_failed.name
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name
  target_id      = "critical-alerts"
  arn            = aws_sns_topic.critical_alerts.arn

  input_transformer {
    input_paths = {
      paymentId = "$.detail.paymentId"
      error     = "$.detail.error"
      time      = "$.time"
    }
    input_template = <<EOF
{
  "alert": "PAYMENT_FAILED",
  "severity": "HIGH",
  "paymentId": <paymentId>,
  "error": <error>,
  "timestamp": <time>,
  "action": "Investigate immediately"
}
EOF
  }
}

################################################################################
# EventBridge Rules - Balance Events
################################################################################

resource "aws_cloudwatch_event_rule" "balance_changed" {
  name           = "${local.name_prefix}-balance-changed"
  description    = "Route account balance change events"
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  event_pattern = jsonencode({
    source      = ["banking-treasury"]
    detail-type = ["Account.BalanceChanged"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "balance_changed_sns" {
  rule           = aws_cloudwatch_event_rule.balance_changed.name
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name
  target_id      = "balance-events-sns"
  arn            = aws_sns_topic.balance_events.arn
}

################################################################################
# EventBridge Rules - Reconciliation Events
################################################################################

resource "aws_cloudwatch_event_rule" "reconciliation_completed" {
  name           = "${local.name_prefix}-reconciliation-completed"
  description    = "Route reconciliation completed events"
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  event_pattern = jsonencode({
    source      = ["banking-treasury"]
    detail-type = ["Reconciliation.Completed"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "reconciliation_completed_sns" {
  rule           = aws_cloudwatch_event_rule.reconciliation_completed.name
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name
  target_id      = "reconciliation-events-sns"
  arn            = aws_sns_topic.reconciliation_events.arn
}

# Reconciliation exceptions → Alert if unmatched transactions exceed threshold
resource "aws_cloudwatch_event_rule" "reconciliation_exceptions" {
  name           = "${local.name_prefix}-reconciliation-exceptions"
  description    = "Alert on reconciliation exceptions"
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  event_pattern = jsonencode({
    source      = ["banking-treasury"]
    detail-type = ["Reconciliation.ExceptionsDetected"]
    detail = {
      severity = ["high", "critical"]
    }
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "reconciliation_exceptions_alerts" {
  rule           = aws_cloudwatch_event_rule.reconciliation_exceptions.name
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name
  target_id      = "critical-alerts"
  arn            = aws_sns_topic.critical_alerts.arn
}

################################################################################
# EventBridge Rules - Cash Position Events
################################################################################

resource "aws_cloudwatch_event_rule" "low_balance_alert" {
  name           = "${local.name_prefix}-low-balance-alert"
  description    = "Alert on low account balance"
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  event_pattern = jsonencode({
    source      = ["banking-treasury"]
    detail-type = ["CashPosition.LowBalance"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "low_balance_alerts" {
  rule           = aws_cloudwatch_event_rule.low_balance_alert.name
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name
  target_id      = "critical-alerts"
  arn            = aws_sns_topic.critical_alerts.arn

  input_transformer {
    input_paths = {
      entityId  = "$.detail.entityId"
      accountId = "$.detail.accountId"
      balance   = "$.detail.currentBalance"
      threshold = "$.detail.threshold"
      currency  = "$.detail.currency"
    }
    input_template = <<EOF
{
  "alert": "LOW_BALANCE",
  "severity": "CRITICAL",
  "entityId": <entityId>,
  "accountId": <accountId>,
  "currentBalance": <balance>,
  "threshold": <threshold>,
  "currency": <currency>,
  "action": "Review liquidity position immediately"
}
EOF
  }
}

################################################################################
# CloudWatch Log Group for Event Debugging
################################################################################

resource "aws_cloudwatch_log_group" "events" {
  name              = "/aws/events/${local.name_prefix}"
  retention_in_days = 30

  tags = local.common_tags
}

# Route all events to CloudWatch for debugging
resource "aws_cloudwatch_event_rule" "all_events_log" {
  name           = "${local.name_prefix}-all-events-log"
  description    = "Log all events for debugging"
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name

  event_pattern = jsonencode({
    source = ["banking-treasury"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "all_events_log" {
  rule           = aws_cloudwatch_event_rule.all_events_log.name
  event_bus_name = aws_cloudwatch_event_bus.banking_treasury.name
  target_id      = "cloudwatch-logs"
  arn            = aws_cloudwatch_log_group.events.arn
}

# IAM policy for EventBridge to write to CloudWatch Logs
resource "aws_cloudwatch_log_resource_policy" "eventbridge" {
  policy_name = "${local.name_prefix}-eventbridge-logs"

  policy_document = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.events.arn}:*"
      }
    ]
  })
}

################################################################################
# SNS Topic Policies
################################################################################

resource "aws_sns_topic_policy" "payment_events" {
  arn = aws_sns_topic.payment_events.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.payment_events.arn
      }
    ]
  })
}

resource "aws_sns_topic_policy" "balance_events" {
  arn = aws_sns_topic.balance_events.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.balance_events.arn
      }
    ]
  })
}

resource "aws_sns_topic_policy" "reconciliation_events" {
  arn = aws_sns_topic.reconciliation_events.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.reconciliation_events.arn
      }
    ]
  })
}

resource "aws_sns_topic_policy" "critical_alerts" {
  arn = aws_sns_topic.critical_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.critical_alerts.arn
      }
    ]
  })
}
