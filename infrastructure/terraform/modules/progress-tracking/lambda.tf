################################################################################
# Progress Tracking Module - Lambda Functions
################################################################################

# Lambda layer for shared dependencies
resource "aws_lambda_layer_version" "dependencies" {
  filename            = "${path.module}/lambda/layers/dependencies.zip"
  layer_name          = "${local.name_prefix}-dependencies"
  compatible_runtimes = ["nodejs20.x"]
  description         = "Shared dependencies for progress tracking lambdas"

  lifecycle {
    create_before_destroy = true
  }
}

# CloudWatch log groups
resource "aws_cloudwatch_log_group" "sync" {
  name              = "/aws/lambda/${local.name_prefix}-sync"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "analyzer" {
  name              = "/aws/lambda/${local.name_prefix}-analyzer"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "comparator" {
  name              = "/aws/lambda/${local.name_prefix}-comparator"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "reporter" {
  name              = "/aws/lambda/${local.name_prefix}-reporter"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "notifier" {
  name              = "/aws/lambda/${local.name_prefix}-notifier"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

################################################################################
# Lambda: Progress Sync
# Syncs STATUS.md files from GitHub to DynamoDB/S3
################################################################################
resource "aws_lambda_function" "sync" {
  function_name = "${local.name_prefix}-sync"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 256

  filename         = "${path.module}/lambda/sync/sync.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/sync/sync.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      ENVIRONMENT      = var.environment
      S3_BUCKET        = aws_s3_bucket.progress.id
      DYNAMODB_TABLE   = aws_dynamodb_table.progress.name
      MILESTONES_TABLE = aws_dynamodb_table.milestones.name
      GITHUB_REPO      = var.github_repo
      GITHUB_BRANCH    = var.github_branch
      SECRET_NAME      = "${local.name_prefix}/github-token"
    }
  }

  depends_on = [aws_cloudwatch_log_group.sync]

  tags = local.common_tags
}

# Function URL for webhook triggers
resource "aws_lambda_function_url" "sync" {
  function_name      = aws_lambda_function.sync.function_name
  authorization_type = "NONE" # Use signature verification in code

  cors {
    allow_origins = ["*"]
    allow_methods = ["POST"]
    allow_headers = ["content-type", "x-hub-signature-256"]
  }
}

# Allow public access to Function URL
resource "aws_lambda_permission" "function_url_public" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.sync.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

################################################################################
# Lambda: Progress Analyzer
# Processes DynamoDB streams, calculates trends
################################################################################
resource "aws_lambda_function" "analyzer" {
  function_name = "${local.name_prefix}-analyzer"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/lambda/analyzer/analyzer.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/analyzer/analyzer.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      ENVIRONMENT       = var.environment
      DYNAMODB_TABLE    = aws_dynamodb_table.progress.name
      MILESTONES_TABLE  = aws_dynamodb_table.milestones.name
      SNS_ALERTS_TOPIC  = aws_sns_topic.alerts.arn
      ENABLE_TIMESTREAM = tostring(var.enable_timestream)
    }
  }

  depends_on = [aws_cloudwatch_log_group.analyzer]

  tags = local.common_tags
}

################################################################################
# Lambda: Progress Comparator
# Compares snapshots, detects milestones
################################################################################
resource "aws_lambda_function" "comparator" {
  function_name = "${local.name_prefix}-comparator"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 256

  filename         = "${path.module}/lambda/comparator/comparator.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/comparator/comparator.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      S3_BUCKET            = aws_s3_bucket.progress.id
      DYNAMODB_TABLE       = aws_dynamodb_table.progress.name
      MILESTONES_TABLE     = aws_dynamodb_table.milestones.name
      SNS_MILESTONES_TOPIC = aws_sns_topic.milestones.arn
      SNS_BLOCKERS_TOPIC   = aws_sns_topic.blockers.arn
    }
  }

  depends_on = [aws_cloudwatch_log_group.comparator]

  tags = local.common_tags
}

# Permission for S3 to invoke comparator
resource "aws_lambda_permission" "s3_invoke_comparator" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.comparator.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.progress.arn
}

################################################################################
# Lambda: Progress Reporter
# Generates weekly/monthly reports
################################################################################
resource "aws_lambda_function" "reporter" {
  function_name = "${local.name_prefix}-reporter"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory_size   = 512

  filename         = "${path.module}/lambda/reporter/reporter.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/reporter/reporter.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      ENVIRONMENT       = var.environment
      S3_BUCKET         = aws_s3_bucket.progress.id
      DYNAMODB_TABLE    = aws_dynamodb_table.progress.name
      MILESTONES_TABLE  = aws_dynamodb_table.milestones.name
      SNS_WEEKLY_TOPIC  = aws_sns_topic.weekly.arn
      NOTIFICATION_EMAIL = var.notification_email
    }
  }

  depends_on = [aws_cloudwatch_log_group.reporter]

  tags = local.common_tags
}

################################################################################
# Lambda: Progress Notifier
# Handles notification routing (Slack, Email)
################################################################################
resource "aws_lambda_function" "notifier" {
  function_name = "${local.name_prefix}-notifier"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 128

  filename         = "${path.module}/lambda/notifier/notifier.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/notifier/notifier.zip")

  layers = [aws_lambda_layer_version.dependencies.arn]

  environment {
    variables = {
      ENVIRONMENT            = var.environment
      SECRET_NAME            = "${local.name_prefix}/slack-webhook"
      ENABLE_SLACK           = tostring(var.enable_slack_notifications)
      ENABLE_EMAIL           = tostring(var.enable_email_notifications)
      NOTIFICATION_EMAIL     = var.notification_email
      FROM_EMAIL             = "progress@${var.project_name}.com"
    }
  }

  depends_on = [aws_cloudwatch_log_group.notifier]

  tags = local.common_tags
}

# SNS subscriptions to notifier
resource "aws_sns_topic_subscription" "milestones_to_notifier" {
  topic_arn = aws_sns_topic.milestones.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.notifier.arn
}

resource "aws_sns_topic_subscription" "blockers_to_notifier" {
  topic_arn = aws_sns_topic.blockers.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.notifier.arn
}

resource "aws_sns_topic_subscription" "weekly_to_notifier" {
  topic_arn = aws_sns_topic.weekly.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.notifier.arn
}

resource "aws_sns_topic_subscription" "alerts_to_notifier" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.notifier.arn
}

# Lambda permissions for SNS
locals {
  sns_topics = {
    milestones = aws_sns_topic.milestones.arn
    blockers   = aws_sns_topic.blockers.arn
    weekly     = aws_sns_topic.weekly.arn
    alerts     = aws_sns_topic.alerts.arn
  }
}

resource "aws_lambda_permission" "sns_invoke_notifier" {
  for_each = toset(["milestones", "blockers", "weekly", "alerts"])

  statement_id  = "AllowSNSInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.notifier.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = local.sns_topics[each.key]
}
