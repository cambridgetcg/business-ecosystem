################################################################################
# Progress Tracking Module - CloudWatch Dashboard and Alarms
################################################################################

# Main progress dashboard
resource "aws_cloudwatch_dashboard" "progress" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: Summary metrics
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 6
        height = 4
        properties = {
          title  = "Overall Progress"
          view   = "singleValue"
          region = var.aws_region
          metrics = [
            ["EcosystemProgress", "OverallProgress", "Environment", var.environment]
          ]
          stat   = "Average"
          period = 86400
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 0
        width  = 6
        height = 4
        properties = {
          title  = "Production Ready Apps"
          view   = "singleValue"
          region = var.aws_region
          metrics = [
            ["EcosystemProgress", "ProductionReadyApps", "Environment", var.environment]
          ]
          stat   = "Average"
          period = 86400
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 6
        height = 4
        properties = {
          title  = "Active Blockers"
          view   = "singleValue"
          region = var.aws_region
          metrics = [
            ["EcosystemProgress", "ActiveBlockers", "Environment", var.environment]
          ]
          stat   = "Sum"
          period = 86400
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 0
        width  = 6
        height = 4
        properties = {
          title  = "Milestones This Week"
          view   = "singleValue"
          region = var.aws_region
          metrics = [
            ["EcosystemProgress", "MilestonesCompleted", "Environment", var.environment]
          ]
          stat   = "Sum"
          period = 604800
        }
      },
      # Row 2: Progress by layer
      {
        type   = "metric"
        x      = 0
        y      = 4
        width  = 8
        height = 6
        properties = {
          title  = "Progress by Layer"
          view   = "bar"
          region = var.aws_region
          metrics = [
            ["EcosystemProgress", "LayerProgress", "Environment", var.environment, "Layer", "foundational"],
            ["...", "operational"],
            ["...", "gateway"]
          ]
          stat   = "Average"
          period = 86400
        }
      },
      # Row 2: Status distribution
      {
        type   = "metric"
        x      = 8
        y      = 4
        width  = 8
        height = 6
        properties = {
          title  = "App Status Distribution"
          view   = "pie"
          region = var.aws_region
          metrics = [
            ["EcosystemProgress", "AppsByStatus", "Environment", var.environment, "Status", "ready"],
            ["...", "active"],
            ["...", "skeleton"],
            ["...", "placeholder"]
          ]
          stat   = "Average"
          period = 86400
          setPeriodToTimeRange = true
        }
      },
      # Row 2: Lambda invocations
      {
        type   = "metric"
        x      = 16
        y      = 4
        width  = 8
        height = 6
        properties = {
          title  = "Sync Activity"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", "${local.name_prefix}-sync"],
            [".", "Errors", ".", "."]
          ]
          stat   = "Sum"
          period = 3600
        }
      },
      # Row 3: Progress trend (30 days)
      {
        type   = "metric"
        x      = 0
        y      = 10
        width  = 12
        height = 6
        properties = {
          title  = "Progress Trend (30 Days)"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["EcosystemProgress", "OverallProgress", "Environment", var.environment],
            [".", "LayerProgress", ".", ".", "Layer", "foundational"],
            ["...", "operational"],
            ["...", "gateway"]
          ]
          stat   = "Average"
          period = 86400
        }
      },
      # Row 3: Milestones timeline
      {
        type   = "metric"
        x      = 12
        y      = 10
        width  = 12
        height = 6
        properties = {
          title  = "Milestones Timeline"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["EcosystemProgress", "MilestonesCompleted", "Environment", var.environment]
          ]
          stat   = "Sum"
          period = 86400
        }
      },
      # Row 4: App progress table (using log insights)
      {
        type   = "log"
        x      = 0
        y      = 16
        width  = 24
        height = 6
        properties = {
          title  = "Recent Activity"
          region = var.aws_region
          query  = "SOURCE '/aws/lambda/${local.name_prefix}-sync' | fields @timestamp, @message | filter @message like /Progress updated/ | sort @timestamp desc | limit 20"
        }
      }
    ]
  })
}

################################################################################
# CloudWatch Alarms
################################################################################

# Alarm: Progress regression
resource "aws_cloudwatch_metric_alarm" "progress_regression" {
  alarm_name          = "${local.name_prefix}-progress-regression"
  alarm_description   = "Overall progress decreased by more than 5%"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "OverallProgress"
  namespace           = "EcosystemProgress"
  period              = 86400
  statistic           = "Average"
  threshold           = 0 # Will be dynamically set based on previous value
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# Alarm: Sync failures
resource "aws_cloudwatch_metric_alarm" "sync_failures" {
  alarm_name          = "${local.name_prefix}-sync-failures"
  alarm_description   = "Progress sync Lambda is failing"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = 2
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.sync.function_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# Alarm: Stale apps detected
resource "aws_cloudwatch_metric_alarm" "stale_apps" {
  alarm_name          = "${local.name_prefix}-stale-apps"
  alarm_description   = "Active apps with no activity for 14+ days"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "StaleApps"
  namespace           = "EcosystemProgress"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}

# Alarm: High blocker count
resource "aws_cloudwatch_metric_alarm" "high_blockers" {
  alarm_name          = "${local.name_prefix}-high-blockers"
  alarm_description   = "More than 5 active blockers detected"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ActiveBlockers"
  namespace           = "EcosystemProgress"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [aws_sns_topic.blockers.arn]

  tags = local.common_tags
}
