# =============================================================================
# Lambda Functions for Deadline Automation
# =============================================================================
# Automated deadline monitoring for DSAR (30-day) and Breach (72-hour) compliance

# -----------------------------------------------------------------------------
# IAM Role for Lambda Functions
# -----------------------------------------------------------------------------

resource "aws_iam_role" "lambda_deadline" {
  count = var.enable_deadline_lambdas ? 1 : 0
  name  = "${local.name_prefix}-lambda-deadline-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "lambda_deadline" {
  count = var.enable_deadline_lambdas ? 1 : 0
  name  = "${local.name_prefix}-lambda-deadline-policy"
  role  = aws_iam_role.lambda_deadline[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.name_prefix}-*:*"
      },
      {
        Sid    = "SNSPublish"
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.dsar_notifications.arn,
          aws_sns_topic.breach_critical.arn
        ]
      },
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = aws_kms_key.data_privacy.arn
      },
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${local.name_prefix}-*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# DSAR Deadline Checker Lambda
# -----------------------------------------------------------------------------

resource "aws_lambda_function" "dsar_deadline_checker" {
  count         = var.enable_deadline_lambdas ? 1 : 0
  function_name = "${local.name_prefix}-dsar-deadline-checker"
  description   = "Checks DSAR deadlines and sends alerts at configured thresholds"
  role          = aws_iam_role.lambda_deadline[0].arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 256

  # Placeholder - actual code would be deployed separately
  filename         = data.archive_file.lambda_placeholder[0].output_path
  source_code_hash = data.archive_file.lambda_placeholder[0].output_base64sha256

  environment {
    variables = {
      SNS_TOPIC_ARN     = aws_sns_topic.dsar_notifications.arn
      ALERT_DAYS        = join(",", var.dsar_deadline_alert_days)
      DATABASE_SECRET   = "${local.name_prefix}-database"
      ENVIRONMENT       = var.environment
    }
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-dsar-deadline-checker"
    Purpose = "DSAR Deadline Monitoring"
  })
}

resource "aws_lambda_permission" "dsar_deadline_eventbridge" {
  count         = var.enable_deadline_lambdas ? 1 : 0
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dsar_deadline_checker[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.dsar_deadline_cron[0].arn
}

# -----------------------------------------------------------------------------
# Breach Escalation Monitor Lambda
# -----------------------------------------------------------------------------

resource "aws_lambda_function" "breach_escalation_monitor" {
  count         = var.enable_deadline_lambdas ? 1 : 0
  function_name = "${local.name_prefix}-breach-escalation-monitor"
  description   = "Monitors breach notification deadlines (72-hour rule)"
  role          = aws_iam_role.lambda_deadline[0].arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 256

  # Placeholder - actual code would be deployed separately
  filename         = data.archive_file.lambda_placeholder[0].output_path
  source_code_hash = data.archive_file.lambda_placeholder[0].output_base64sha256

  environment {
    variables = {
      SNS_TOPIC_ARN      = aws_sns_topic.breach_critical.arn
      ESCALATION_HOURS   = join(",", var.breach_escalation_hours)
      DATABASE_SECRET    = "${local.name_prefix}-database"
      ENVIRONMENT        = var.environment
    }
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-breach-escalation-monitor"
    Purpose = "Breach 72-hour Compliance"
  })
}

resource "aws_lambda_permission" "breach_escalation_eventbridge" {
  count         = var.enable_deadline_lambdas ? 1 : 0
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.breach_escalation_monitor[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.breach_escalation_cron[0].arn
}

# -----------------------------------------------------------------------------
# Consent Expiration Processor Lambda
# -----------------------------------------------------------------------------

resource "aws_lambda_function" "consent_expiration_processor" {
  count         = var.enable_deadline_lambdas ? 1 : 0
  function_name = "${local.name_prefix}-consent-expiration-processor"
  description   = "Processes expired consents and triggers notifications"
  role          = aws_iam_role.lambda_deadline[0].arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory_size   = 256

  # Placeholder - actual code would be deployed separately
  filename         = data.archive_file.lambda_placeholder[0].output_path
  source_code_hash = data.archive_file.lambda_placeholder[0].output_base64sha256

  environment {
    variables = {
      SNS_TOPIC_ARN     = aws_sns_topic.consent_events.arn
      DATABASE_SECRET   = "${local.name_prefix}-database"
      ENVIRONMENT       = var.environment
    }
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-consent-expiration-processor"
    Purpose = "Consent Expiration Management"
  })
}

resource "aws_lambda_permission" "consent_expiration_eventbridge" {
  count         = var.enable_deadline_lambdas ? 1 : 0
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.consent_expiration_processor[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.consent_expiration_cron[0].arn
}

# -----------------------------------------------------------------------------
# Placeholder Lambda Code
# -----------------------------------------------------------------------------

data "archive_file" "lambda_placeholder" {
  count       = var.enable_deadline_lambdas ? 1 : 0
  type        = "zip"
  output_path = "${path.module}/lambda_placeholder.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        console.log('Lambda placeholder - replace with actual implementation');
        console.log('Event:', JSON.stringify(event, null, 2));
        return { statusCode: 200, body: 'OK' };
      };
    EOF
    filename = "index.js"
  }
}
