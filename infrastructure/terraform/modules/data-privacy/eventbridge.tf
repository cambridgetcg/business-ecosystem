# =============================================================================
# EventBridge for Data Privacy Events
# =============================================================================
# Cross-service event publishing for privacy events
# Consent, DSAR, Breach, DPIA events propagated to interested services

# -----------------------------------------------------------------------------
# Event Bus
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_bus" "privacy_events" {
  name = "${local.name_prefix}-events"

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-events"
    Purpose = "Privacy Event Bus"
  })
}

# -----------------------------------------------------------------------------
# Event Bus Policy
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_bus_policy" "privacy_events" {
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowAccountAccess"
        Effect    = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action    = "events:PutEvents"
        Resource  = aws_cloudwatch_event_bus.privacy_events.arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Archive for Event Replay
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_archive" "privacy_events" {
  name             = "${local.name_prefix}-archive"
  event_source_arn = aws_cloudwatch_event_bus.privacy_events.arn
  retention_days   = 90

  description = "Archive for privacy events (90-day retention for replay)"
}

# -----------------------------------------------------------------------------
# Event Rules - Consent Events
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "consent_granted" {
  name           = "${local.name_prefix}-consent-granted"
  description    = "Consent granted events"
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name

  event_pattern = jsonencode({
    source      = ["data-privacy"]
    detail-type = ["consent.granted"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "consent_withdrawn" {
  name           = "${local.name_prefix}-consent-withdrawn"
  description    = "Consent withdrawn events - high priority"
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name

  event_pattern = jsonencode({
    source      = ["data-privacy"]
    detail-type = ["consent.withdrawn"]
  })

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Event Rules - DSAR Events
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "dsar_submitted" {
  name           = "${local.name_prefix}-dsar-submitted"
  description    = "DSAR submitted - triggers deadline tracking"
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name

  event_pattern = jsonencode({
    source      = ["data-privacy"]
    detail-type = ["dsar.submitted"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "dsar_completed" {
  name           = "${local.name_prefix}-dsar-completed"
  description    = "DSAR completed events"
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name

  event_pattern = jsonencode({
    source      = ["data-privacy"]
    detail-type = ["dsar.completed"]
  })

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Event Rules - Breach Events
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "breach_detected" {
  name           = "${local.name_prefix}-breach-detected"
  description    = "Breach detected - triggers 72-hour countdown"
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name

  event_pattern = jsonencode({
    source      = ["data-privacy"]
    detail-type = ["breach.detected"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "breach_critical" {
  name           = "${local.name_prefix}-breach-critical"
  description    = "Critical severity breach - immediate escalation"
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name

  event_pattern = jsonencode({
    source      = ["data-privacy"]
    detail-type = ["breach.detected"]
    detail = {
      severity = ["CRITICAL"]
    }
  })

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Event Targets - Route to SNS Topics
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_target" "consent_to_sns" {
  rule           = aws_cloudwatch_event_rule.consent_granted.name
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name
  target_id      = "consent-sns"
  arn            = aws_sns_topic.consent_events.arn
}

resource "aws_cloudwatch_event_target" "consent_withdrawn_to_sns" {
  rule           = aws_cloudwatch_event_rule.consent_withdrawn.name
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name
  target_id      = "consent-withdrawn-sns"
  arn            = aws_sns_topic.consent_events.arn
}

resource "aws_cloudwatch_event_target" "dsar_to_sns" {
  rule           = aws_cloudwatch_event_rule.dsar_submitted.name
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name
  target_id      = "dsar-sns"
  arn            = aws_sns_topic.dsar_notifications.arn
}

resource "aws_cloudwatch_event_target" "breach_to_sns" {
  rule           = aws_cloudwatch_event_rule.breach_detected.name
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name
  target_id      = "breach-sns"
  arn            = aws_sns_topic.breach_critical.arn
}

resource "aws_cloudwatch_event_target" "breach_critical_to_sns" {
  rule           = aws_cloudwatch_event_rule.breach_critical.name
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name
  target_id      = "breach-critical-sns"
  arn            = aws_sns_topic.breach_critical.arn
}

# -----------------------------------------------------------------------------
# Event Targets - Route to Audit Log
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "all_privacy_events" {
  name           = "${local.name_prefix}-all-events-audit"
  description    = "All privacy events for audit logging"
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name

  event_pattern = jsonencode({
    source = ["data-privacy"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "audit_log" {
  rule           = aws_cloudwatch_event_rule.all_privacy_events.name
  event_bus_name = aws_cloudwatch_event_bus.privacy_events.name
  target_id      = "audit-log"
  arn            = aws_cloudwatch_log_group.audit.arn
}

# Allow EventBridge to write to CloudWatch Logs
resource "aws_cloudwatch_log_resource_policy" "eventbridge_to_logs" {
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
        Resource = "${aws_cloudwatch_log_group.audit.arn}:*"
      }
    ]
  })
}
