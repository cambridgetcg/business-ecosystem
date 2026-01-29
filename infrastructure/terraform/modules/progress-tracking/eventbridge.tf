################################################################################
# Progress Tracking Module - EventBridge Schedules
################################################################################

# Daily sync schedule
resource "aws_scheduler_schedule" "daily_sync" {
  name        = "${local.name_prefix}-daily-sync"
  group_name  = "default"
  description = "Daily progress sync from GitHub"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.daily_sync_schedule
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_lambda_function.sync.arn
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      source    = "scheduled"
      action    = "full_sync"
      timestamp = "$${aws.scheduler.scheduled-time}"
    })

    retry_policy {
      maximum_retry_attempts       = 3
      maximum_event_age_in_seconds = 3600
    }
  }

  state = "ENABLED"
}

# Weekly report schedule
resource "aws_scheduler_schedule" "weekly_report" {
  name        = "${local.name_prefix}-weekly-report"
  group_name  = "default"
  description = "Weekly progress report generation"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.weekly_report_schedule
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_lambda_function.reporter.arn
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      source     = "scheduled"
      reportType = "weekly"
      timestamp  = "$${aws.scheduler.scheduled-time}"
    })

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 7200
    }
  }

  state = "ENABLED"
}

# Monthly report schedule
resource "aws_scheduler_schedule" "monthly_report" {
  name        = "${local.name_prefix}-monthly-report"
  group_name  = "default"
  description = "Monthly progress report generation"

  flexible_time_window {
    mode = "OFF"
  }

  # First Monday of each month at 9 AM UTC
  schedule_expression          = "cron(0 9 ? * 2#1 *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_lambda_function.reporter.arn
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      source     = "scheduled"
      reportType = "monthly"
      timestamp  = "$${aws.scheduler.scheduled-time}"
    })

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 7200
    }
  }

  state = "ENABLED"
}

# Stale app check schedule (daily at noon)
resource "aws_scheduler_schedule" "stale_check" {
  name        = "${local.name_prefix}-stale-check"
  group_name  = "default"
  description = "Check for stale/inactive apps"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "cron(0 12 * * ? *)"
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_lambda_function.analyzer.arn
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      source = "scheduled"
      action = "stale_check"
      staleDays = 14
    })

    retry_policy {
      maximum_retry_attempts       = 2
      maximum_event_age_in_seconds = 3600
    }
  }

  state = "ENABLED"
}

# Lambda permissions for EventBridge
resource "aws_lambda_permission" "scheduler_invoke_sync" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.daily_sync.arn
}

resource "aws_lambda_permission" "scheduler_invoke_reporter_weekly" {
  statement_id  = "AllowEventBridgeInvokeWeekly"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reporter.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.weekly_report.arn
}

resource "aws_lambda_permission" "scheduler_invoke_reporter_monthly" {
  statement_id  = "AllowEventBridgeInvokeMonthly"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.reporter.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.monthly_report.arn
}

resource "aws_lambda_permission" "scheduler_invoke_analyzer" {
  statement_id  = "AllowEventBridgeInvokeStaleCheck"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analyzer.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.stale_check.arn
}
