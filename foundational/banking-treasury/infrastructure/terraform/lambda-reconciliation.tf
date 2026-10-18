################################################################################
# Automated Reconciliation Lambda
################################################################################
#
# Bank statement reconciliation with target 95%+ auto-match rate.
# Components:
# - Statement processing Lambda
# - Matching engine
# - Exception handling
# - Reconciliation state tables
#
################################################################################

################################################################################
# IAM Role
################################################################################

resource "aws_iam_role" "reconciliation_lambda" {
  name = "${local.name_prefix}-reconciliation-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "reconciliation_lambda" {
  name = "${local.name_prefix}-reconciliation-lambda-policy"
  role = aws_iam_role.reconciliation_lambda.id

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
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:*"
      },
      {
        Sid    = "DynamoDBReadWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.reconciliation_sessions.arn,
          "${aws_dynamodb_table.reconciliation_sessions.arn}/index/*",
          aws_dynamodb_table.reconciliation_matches.arn,
          "${aws_dynamodb_table.reconciliation_matches.arn}/index/*",
          aws_dynamodb_table.reconciliation_exceptions.arn,
          "${aws_dynamodb_table.reconciliation_exceptions.arn}/index/*",
          aws_dynamodb_table.transaction_ledger.arn,
          "${aws_dynamodb_table.transaction_ledger.arn}/index/*"
        ]
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.bank_statements.arn}/*"
        ]
      },
      {
        Sid    = "SQS"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:SendMessage"
        ]
        Resource = [
          aws_sqs_queue.reconciliation.arn,
          aws_sqs_queue.reconciliation_dlq.arn
        ]
      },
      {
        Sid    = "EventBridge"
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = aws_cloudwatch_event_bus.banking_treasury.arn
      },
      {
        Sid    = "SNS"
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.reconciliation_events.arn,
          aws_sns_topic.critical_alerts.arn
        ]
      },
      {
        Sid    = "VPCAccess"
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

################################################################################
# Security Group
################################################################################

resource "aws_security_group" "reconciliation_lambda" {
  name        = "${local.name_prefix}-reconciliation-lambda"
  description = "Security group for reconciliation Lambda"
  vpc_id      = data.aws_vpc.ecosystem.id

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for AWS services"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-reconciliation-lambda"
  })
}

################################################################################
# Reconciliation Lambda
################################################################################

resource "aws_lambda_function" "reconciliation" {
  function_name = "${local.name_prefix}-reconciliation"
  description   = "Automated bank statement reconciliation (target: 95%+ auto-match)"

  filename         = data.archive_file.reconciliation_placeholder.output_path
  source_code_hash = data.archive_file.reconciliation_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 300  # 5 minutes for large statements
  memory_size      = 1024

  role = aws_iam_role.reconciliation_lambda.arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.reconciliation_lambda.id]
  }

  environment {
    variables = {
      NODE_ENV                     = var.environment
      RECONCILIATION_SESSIONS_TABLE = aws_dynamodb_table.reconciliation_sessions.name
      RECONCILIATION_MATCHES_TABLE  = aws_dynamodb_table.reconciliation_matches.name
      RECONCILIATION_EXCEPTIONS_TABLE = aws_dynamodb_table.reconciliation_exceptions.name
      TRANSACTION_LEDGER_TABLE     = aws_dynamodb_table.transaction_ledger.name
      BANK_STATEMENTS_BUCKET       = aws_s3_bucket.bank_statements.bucket
      EVENT_BUS_NAME               = aws_cloudwatch_event_bus.banking_treasury.name
      RECONCILIATION_TOPIC_ARN     = aws_sns_topic.reconciliation_events.arn
      CRITICAL_ALERTS_TOPIC_ARN    = aws_sns_topic.critical_alerts.arn
      MATCH_AMOUNT_TOLERANCE       = tostring(var.reconciliation_amount_tolerance)
      MATCH_DATE_TOLERANCE_DAYS    = tostring(var.reconciliation_date_tolerance_days)
      AUTO_MATCH_THRESHOLD         = tostring(var.reconciliation_auto_match_threshold)
    }
  }

  reserved_concurrent_executions = 10  # Limit concurrent reconciliations

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "reconciliation"
  })
}

# SQS trigger
resource "aws_lambda_event_source_mapping" "reconciliation_sqs" {
  event_source_arn = aws_sqs_queue.reconciliation.arn
  function_name    = aws_lambda_function.reconciliation.arn
  batch_size       = 1  # Process one statement at a time

  enabled = true
}

################################################################################
# Reconciliation DynamoDB Tables
################################################################################

# Sessions table - tracks reconciliation runs
resource "aws_dynamodb_table" "reconciliation_sessions" {
  name         = "${local.name_prefix}-reconciliation-sessions"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "session_id"
  range_key = "account_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "account_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  # GSI: Query by status
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  # GSI: Query by account
  global_secondary_index {
    name            = "account-index"
    hash_key        = "account_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.environment == "prod" ? aws_kms_key.dynamodb[0].arn : null
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-reconciliation-sessions"
    Purpose = "reconciliation-tracking"
  })
}

# Matches table - stores matched transactions
resource "aws_dynamodb_table" "reconciliation_matches" {
  name         = "${local.name_prefix}-reconciliation-matches"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "match_id"
  range_key = "session_id"

  attribute {
    name = "match_id"
    type = "S"
  }

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "statement_transaction_id"
    type = "S"
  }

  attribute {
    name = "internal_transaction_id"
    type = "S"
  }

  # GSI: Query by session
  global_secondary_index {
    name            = "session-index"
    hash_key        = "session_id"
    projection_type = "ALL"
  }

  # GSI: Query by statement transaction
  global_secondary_index {
    name            = "statement-tx-index"
    hash_key        = "statement_transaction_id"
    projection_type = "ALL"
  }

  # GSI: Query by internal transaction
  global_secondary_index {
    name            = "internal-tx-index"
    hash_key        = "internal_transaction_id"
    projection_type = "ALL"
  }

  # TTL for old matches (1 year)
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.environment == "prod" ? aws_kms_key.dynamodb[0].arn : null
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-reconciliation-matches"
    Purpose = "reconciliation-matches"
  })
}

# Exceptions table - stores unmatched/exceptions
resource "aws_dynamodb_table" "reconciliation_exceptions" {
  name         = "${local.name_prefix}-reconciliation-exceptions"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "exception_id"
  range_key = "session_id"

  attribute {
    name = "exception_id"
    type = "S"
  }

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "exception_type"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  # GSI: Query by session
  global_secondary_index {
    name            = "session-index"
    hash_key        = "session_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  # GSI: Query by type
  global_secondary_index {
    name            = "type-index"
    hash_key        = "exception_type"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  # GSI: Query by status (for review queue)
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.environment == "prod" ? aws_kms_key.dynamodb[0].arn : null
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-reconciliation-exceptions"
    Purpose = "reconciliation-exceptions"
  })
}

################################################################################
# Bank Statements S3 Bucket
################################################################################

resource "aws_s3_bucket" "bank_statements" {
  bucket = "${local.name_prefix}-bank-statements-${local.account_id}"

  tags = merge(local.common_tags, {
    Purpose = "bank-statement-storage"
  })
}

resource "aws_s3_bucket_versioning" "bank_statements" {
  bucket = aws_s3_bucket.bank_statements.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bank_statements" {
  bucket = aws_s3_bucket.bank_statements.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.environment == "prod" ? "aws:kms" : "AES256"
      kms_master_key_id = var.environment == "prod" ? aws_kms_key.s3[0].id : null
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "bank_statements" {
  bucket = aws_s3_bucket.bank_statements.id

  rule {
    id     = "archive-processed"
    status = "Enabled"

    filter {
      prefix = "processed/"
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }

  rule {
    id     = "retain-raw"
    status = "Enabled"

    filter {
      prefix = "raw/"
    }

    # Keep raw statements for 7 years (compliance)
    expiration {
      days = 2555
    }
  }
}

resource "aws_s3_bucket_public_access_block" "bank_statements" {
  bucket = aws_s3_bucket.bank_statements.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# KMS key for S3 (production)
resource "aws_kms_key" "s3" {
  count = var.environment == "prod" ? 1 : 0

  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = local.common_tags
}

################################################################################
# Variables
################################################################################

variable "reconciliation_amount_tolerance" {
  type        = number
  description = "Amount tolerance for matching (percentage)"
  default     = 0.01  # 1%
}

variable "reconciliation_date_tolerance_days" {
  type        = number
  description = "Date tolerance for matching (days)"
  default     = 3
}

variable "reconciliation_auto_match_threshold" {
  type        = number
  description = "Confidence threshold for auto-matching (0-1)"
  default     = 0.95
}

################################################################################
# CloudWatch Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "reconciliation_errors" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-reconciliation-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Reconciliation Lambda errors exceeded threshold"

  dimensions = {
    FunctionName = aws_lambda_function.reconciliation.function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "reconciliation_duration" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-reconciliation-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 240000  # 4 minutes (out of 5 minute timeout)
  alarm_description   = "Reconciliation taking too long"

  dimensions = {
    FunctionName = aws_lambda_function.reconciliation.function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

################################################################################
# Placeholder Lambda Code
################################################################################

data "archive_file" "reconciliation_placeholder" {
  type        = "zip"
  output_path = "${path.module}/files/reconciliation-placeholder.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        console.log('Reconciliation Lambda - deploy actual code via CI/CD');
        console.log('Event:', JSON.stringify(event, null, 2));

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Reconciliation placeholder',
            timestamp: new Date().toISOString()
          })
        };
      };
    EOF
    filename = "index.js"
  }
}
