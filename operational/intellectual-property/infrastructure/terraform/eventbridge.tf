################################################################################
# EventBridge Configuration
################################################################################
#
# Event routing for IP domain events:
# - Patent events (filing, maintenance due, granted, expired)
# - Trademark events (filed, registered, renewal due, opposed)
# - Trade secret events (accessed, disclosed, protection updated)
# - Domain name events (registered, expiring, transferred, disputed)
# - License events (executed, royalty due, terminated)
#
# Routes events to:
# - SNS topics (for external consumers and notifications)
# - CloudWatch Logs (for audit trail)
# - Step Functions (for workflow triggers)
#
################################################################################

################################################################################
# Event Bus
################################################################################

resource "aws_cloudwatch_event_bus" "ip_service" {
  name = "${local.name_prefix}-events"

  tags = local.common_tags
}

# Event bus policy for cross-service communication
resource "aws_cloudwatch_event_bus_policy" "cross_service" {
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

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
        Resource = aws_cloudwatch_event_bus.ip_service.arn
      }
    ]
  })
}

################################################################################
# Event Archive (for replay capability)
################################################################################

resource "aws_cloudwatch_event_archive" "ip_service" {
  count = var.enable_event_archive ? 1 : 0

  name             = "${local.name_prefix}-archive"
  event_source_arn = aws_cloudwatch_event_bus.ip_service.arn
  retention_days   = var.event_archive_retention_days

  description = "Archive of IP service events for replay"
}

################################################################################
# SNS Topics for Event Distribution
################################################################################

# Deadline alerts topic (maintenance fees, renewals, response deadlines)
resource "aws_sns_topic" "deadline_alerts" {
  name = "${local.name_prefix}-deadline-alerts"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = merge(local.common_tags, {
    Purpose = "deadline-alerts"
  })
}

# Critical alerts topic (missed deadlines, security events)
resource "aws_sns_topic" "critical_alerts" {
  name = "${local.name_prefix}-critical-alerts"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = merge(local.common_tags, {
    Purpose = "critical-alerts"
  })
}

# IP events topic (general events for subscribers)
resource "aws_sns_topic" "ip_events" {
  name = "${local.name_prefix}-events"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = merge(local.common_tags, {
    Purpose = "ip-events"
  })
}

# Trade secret access alerts (high security)
resource "aws_sns_topic" "trade_secret_alerts" {
  name = "${local.name_prefix}-trade-secret-alerts"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = merge(local.common_tags, {
    Purpose       = "trade-secret-alerts"
    SecurityLevel = "high"
  })
}

# Cross-service integration topic (for contracts-legal, compliance)
resource "aws_sns_topic" "cross_service" {
  count = var.enable_cross_service_events ? 1 : 0

  name = "${local.name_prefix}-cross-service"

  kms_master_key_id = var.environment == "prod" ? aws_kms_key.sns[0].id : "alias/aws/sns"

  tags = merge(local.common_tags, {
    Purpose = "cross-service-integration"
  })
}

################################################################################
# Email Subscriptions
################################################################################

resource "aws_sns_topic_subscription" "deadline_email" {
  count = var.enable_email_notifications && var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.deadline_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "critical_email" {
  count = var.enable_email_notifications && var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "trade_secret_email" {
  count = var.enable_email_notifications && var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.trade_secret_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

################################################################################
# SNS Topic Policies
################################################################################

resource "aws_sns_topic_policy" "deadline_alerts" {
  arn = aws_sns_topic.deadline_alerts.arn

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
        Resource = aws_sns_topic.deadline_alerts.arn
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
        Sid    = "AllowEventBridge"
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

resource "aws_sns_topic_policy" "trade_secret_alerts" {
  arn = aws_sns_topic.trade_secret_alerts.arn

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
        Resource = aws_sns_topic.trade_secret_alerts.arn
      }
    ]
  })
}

################################################################################
# EventBridge Rules - Patent Events
################################################################################

# Patent maintenance fee due
resource "aws_cloudwatch_event_rule" "patent_maintenance_due" {
  name           = "${local.name_prefix}-patent-maintenance-due"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["Patent.MaintenanceFeeDue"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "patent_maintenance_sns" {
  rule           = aws_cloudwatch_event_rule.patent_maintenance_due.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "deadline-alerts"
  arn            = aws_sns_topic.deadline_alerts.arn
}

# Patent maintenance fee missed (critical)
resource "aws_cloudwatch_event_rule" "patent_maintenance_missed" {
  name           = "${local.name_prefix}-patent-maintenance-missed"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["Patent.MaintenanceFeeMissed"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "patent_maintenance_missed_sns" {
  rule           = aws_cloudwatch_event_rule.patent_maintenance_missed.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "critical-alerts"
  arn            = aws_sns_topic.critical_alerts.arn
}

################################################################################
# EventBridge Rules - Trademark Events
################################################################################

# Trademark renewal due
resource "aws_cloudwatch_event_rule" "trademark_renewal_due" {
  name           = "${local.name_prefix}-trademark-renewal-due"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["Trademark.RenewalDue"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "trademark_renewal_sns" {
  rule           = aws_cloudwatch_event_rule.trademark_renewal_due.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "deadline-alerts"
  arn            = aws_sns_topic.deadline_alerts.arn
}

# Trademark opposition filed (urgent)
resource "aws_cloudwatch_event_rule" "trademark_opposition_filed" {
  name           = "${local.name_prefix}-trademark-opposition"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["Trademark.OppositionFiled"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "trademark_opposition_sns" {
  rule           = aws_cloudwatch_event_rule.trademark_opposition_filed.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "critical-alerts"
  arn            = aws_sns_topic.critical_alerts.arn
}

################################################################################
# EventBridge Rules - Trade Secret Events
################################################################################

# Trade secret accessed
resource "aws_cloudwatch_event_rule" "trade_secret_accessed" {
  name           = "${local.name_prefix}-trade-secret-accessed"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["TradeSecret.Accessed"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "trade_secret_accessed_log" {
  rule           = aws_cloudwatch_event_rule.trade_secret_accessed.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "trade-secret-audit-log"
  arn            = aws_cloudwatch_log_group.trade_secret_access.arn
}

# Trade secret disclosed (critical - potential loss)
resource "aws_cloudwatch_event_rule" "trade_secret_disclosed" {
  name           = "${local.name_prefix}-trade-secret-disclosed"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["TradeSecret.Disclosed"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "trade_secret_disclosed_sns" {
  rule           = aws_cloudwatch_event_rule.trade_secret_disclosed.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "trade-secret-alerts"
  arn            = aws_sns_topic.trade_secret_alerts.arn
}

resource "aws_cloudwatch_event_target" "trade_secret_disclosed_critical" {
  rule           = aws_cloudwatch_event_rule.trade_secret_disclosed.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "critical-alerts"
  arn            = aws_sns_topic.critical_alerts.arn
}

################################################################################
# EventBridge Rules - Domain Name Events
################################################################################

# Domain expiring
resource "aws_cloudwatch_event_rule" "domain_expiring" {
  name           = "${local.name_prefix}-domain-expiring"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["DomainName.Expiring"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "domain_expiring_sns" {
  rule           = aws_cloudwatch_event_rule.domain_expiring.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "deadline-alerts"
  arn            = aws_sns_topic.deadline_alerts.arn
}

# UDRP dispute filed (urgent - 21 day response)
resource "aws_cloudwatch_event_rule" "domain_udrp_filed" {
  name           = "${local.name_prefix}-domain-udrp-filed"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["DomainDispute.Filed"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "domain_udrp_sns" {
  rule           = aws_cloudwatch_event_rule.domain_udrp_filed.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "critical-alerts"
  arn            = aws_sns_topic.critical_alerts.arn
}

################################################################################
# EventBridge Rules - License Events
################################################################################

# License royalty due
resource "aws_cloudwatch_event_rule" "license_royalty_due" {
  name           = "${local.name_prefix}-license-royalty-due"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source      = ["intellectual-property"]
    detail-type = ["License.RoyaltyDue"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "license_royalty_sns" {
  rule           = aws_cloudwatch_event_rule.license_royalty_due.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "deadline-alerts"
  arn            = aws_sns_topic.deadline_alerts.arn
}

# Cross-service: License payment needed → contracts-legal
resource "aws_cloudwatch_event_target" "license_royalty_cross_service" {
  count = var.enable_cross_service_events ? 1 : 0

  rule           = aws_cloudwatch_event_rule.license_royalty_due.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "cross-service"
  arn            = aws_sns_topic.cross_service[0].arn
}

################################################################################
# EventBridge Rules - All Events to Audit Log
################################################################################

# Log all IP events to CloudWatch for audit
resource "aws_cloudwatch_event_rule" "all_events_audit" {
  name           = "${local.name_prefix}-all-events-audit"
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name

  event_pattern = jsonencode({
    source = ["intellectual-property"]
  })

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "all_events_log" {
  rule           = aws_cloudwatch_event_rule.all_events_audit.name
  event_bus_name = aws_cloudwatch_event_bus.ip_service.name
  target_id      = "audit-log"
  arn            = aws_cloudwatch_log_group.ip_audit.arn
}

################################################################################
# IAM for EventBridge → CloudWatch Logs
################################################################################

resource "aws_cloudwatch_log_resource_policy" "eventbridge_logs" {
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
        Resource = [
          "${aws_cloudwatch_log_group.ip_audit.arn}:*",
          "${aws_cloudwatch_log_group.trade_secret_access.arn}:*"
        ]
      }
    ]
  })
}

################################################################################
# IAM for IP Service → EventBridge
################################################################################

resource "aws_iam_role_policy" "ip_eventbridge_access" {
  name = "${local.name_prefix}-eventbridge-access"
  role = aws_iam_role.ip_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = aws_cloudwatch_event_bus.ip_service.arn
      }
    ]
  })
}

# SNS publish access
resource "aws_iam_role_policy" "ip_sns_access" {
  name = "${local.name_prefix}-sns-access"
  role = aws_iam_role.ip_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.deadline_alerts.arn,
          aws_sns_topic.critical_alerts.arn,
          aws_sns_topic.ip_events.arn,
          aws_sns_topic.trade_secret_alerts.arn
        ]
      }
    ]
  })
}
