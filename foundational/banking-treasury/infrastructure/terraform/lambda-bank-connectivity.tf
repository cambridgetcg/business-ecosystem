################################################################################
# Bank Connectivity Lambda
################################################################################
#
# Bank statement import functionality:
# - SFTP polling for statement files
# - API integration for real-time data
# - S3 trigger for file-based imports
# - Statement parsing (MT940, BAI2, CSV)
#
################################################################################

################################################################################
# IAM Role
################################################################################

resource "aws_iam_role" "bank_connectivity_lambda" {
  name = "${local.name_prefix}-bank-connectivity-lambda"

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

resource "aws_iam_role_policy" "bank_connectivity_lambda" {
  name = "${local.name_prefix}-bank-connectivity-lambda-policy"
  role = aws_iam_role.bank_connectivity_lambda.id

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
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.bank_statements.arn,
          "${aws_s3_bucket.bank_statements.arn}/*"
        ]
      },
      {
        Sid    = "DynamoDB"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.bank_connections.arn,
          "${aws_dynamodb_table.bank_connections.arn}/index/*",
          aws_dynamodb_table.statement_imports.arn,
          "${aws_dynamodb_table.statement_imports.arn}/index/*"
        ]
      },
      {
        Sid    = "SQS"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = [
          aws_sqs_queue.bank_statement_import.arn,
          aws_sqs_queue.reconciliation.arn
        ]
      },
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.bank_credentials.arn
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
        Sid    = "VPCAccess"
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Sid    = "TransferFamily"
        Effect = "Allow"
        Action = [
          "transfer:DescribeServer",
          "transfer:ListServers"
        ]
        Resource = "*"
      }
    ]
  })
}

################################################################################
# Security Group
################################################################################

resource "aws_security_group" "bank_connectivity_lambda" {
  name        = "${local.name_prefix}-bank-connectivity-lambda"
  description = "Security group for bank connectivity Lambda"
  vpc_id      = data.aws_vpc.ecosystem.id

  # SFTP outbound (22)
  egress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SFTP connections"
  }

  # HTTPS for APIs
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for APIs and AWS services"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-bank-connectivity-lambda"
  })
}

################################################################################
# Bank Connection Lambda (SFTP/API Polling)
################################################################################

resource "aws_lambda_function" "bank_statement_fetcher" {
  function_name = "${local.name_prefix}-bank-statement-fetcher"
  description   = "Fetches bank statements via SFTP/API from connected banks"

  filename         = data.archive_file.bank_fetcher_placeholder.output_path
  source_code_hash = data.archive_file.bank_fetcher_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 300
  memory_size      = 512

  role = aws_iam_role.bank_connectivity_lambda.arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.bank_connectivity_lambda.id]
  }

  environment {
    variables = {
      NODE_ENV                  = var.environment
      BANK_CONNECTIONS_TABLE    = aws_dynamodb_table.bank_connections.name
      STATEMENT_IMPORTS_TABLE   = aws_dynamodb_table.statement_imports.name
      BANK_STATEMENTS_BUCKET    = aws_s3_bucket.bank_statements.bucket
      BANK_CREDENTIALS_SECRET   = aws_secretsmanager_secret.bank_credentials.name
      RECONCILIATION_QUEUE_URL  = aws_sqs_queue.reconciliation.url
      EVENT_BUS_NAME            = aws_cloudwatch_event_bus.banking_treasury.name
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "bank-statement-fetcher"
  })
}

# Scheduled polling (every hour)
resource "aws_cloudwatch_event_rule" "bank_statement_poll" {
  name                = "${local.name_prefix}-bank-statement-poll"
  description         = "Poll banks for new statements"
  schedule_expression = "rate(1 hour)"

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "bank_statement_poll" {
  rule      = aws_cloudwatch_event_rule.bank_statement_poll.name
  target_id = "BankStatementFetcher"
  arn       = aws_lambda_function.bank_statement_fetcher.arn

  input = jsonencode({
    action = "poll_all_banks"
  })
}

resource "aws_lambda_permission" "bank_statement_poll" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bank_statement_fetcher.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.bank_statement_poll.arn
}

################################################################################
# S3 Trigger Lambda (File Upload Processing)
################################################################################

resource "aws_lambda_function" "bank_statement_processor" {
  function_name = "${local.name_prefix}-bank-statement-processor"
  description   = "Processes uploaded bank statement files"

  filename         = data.archive_file.bank_processor_placeholder.output_path
  source_code_hash = data.archive_file.bank_processor_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 120
  memory_size      = 512

  role = aws_iam_role.bank_connectivity_lambda.arn

  environment {
    variables = {
      NODE_ENV                  = var.environment
      STATEMENT_IMPORTS_TABLE   = aws_dynamodb_table.statement_imports.name
      BANK_STATEMENTS_BUCKET    = aws_s3_bucket.bank_statements.bucket
      RECONCILIATION_QUEUE_URL  = aws_sqs_queue.reconciliation.url
      EVENT_BUS_NAME            = aws_cloudwatch_event_bus.banking_treasury.name
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "bank-statement-processor"
  })
}

# S3 trigger for uploads
resource "aws_s3_bucket_notification" "bank_statements" {
  bucket = aws_s3_bucket.bank_statements.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.bank_statement_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw/"
    filter_suffix       = ".mt940"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.bank_statement_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw/"
    filter_suffix       = ".bai2"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.bank_statement_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw/"
    filter_suffix       = ".csv"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.bank_statement_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "raw/"
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.bank_statement_s3]
}

resource "aws_lambda_permission" "bank_statement_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bank_statement_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.bank_statements.arn
}

################################################################################
# Bank Connections Table
################################################################################

resource "aws_dynamodb_table" "bank_connections" {
  name         = "${local.name_prefix}-bank-connections"
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "connection_id"

  attribute {
    name = "connection_id"
    type = "S"
  }

  attribute {
    name = "bank_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  # GSI: Query by bank
  global_secondary_index {
    name            = "bank-index"
    hash_key        = "bank_id"
    range_key       = "status"
    projection_type = "ALL"
  }

  # GSI: Query by status
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
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
    Name    = "${local.name_prefix}-bank-connections"
    Purpose = "bank-connection-config"
  })
}

################################################################################
# Statement Imports Table
################################################################################

resource "aws_dynamodb_table" "statement_imports" {
  name         = "${local.name_prefix}-statement-imports"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "import_id"
  range_key = "account_id"

  attribute {
    name = "import_id"
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
    name = "imported_at"
    type = "S"
  }

  # GSI: Query by account
  global_secondary_index {
    name            = "account-index"
    hash_key        = "account_id"
    range_key       = "imported_at"
    projection_type = "ALL"
  }

  # GSI: Query by status
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "imported_at"
    projection_type = "ALL"
  }

  # TTL for old import records (90 days)
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
    Name    = "${local.name_prefix}-statement-imports"
    Purpose = "statement-import-tracking"
  })
}

################################################################################
# Bank Credentials Secret
################################################################################

resource "aws_secretsmanager_secret" "bank_credentials" {
  name_prefix             = "${local.name_prefix}-bank-credentials-"
  description             = "Bank SFTP/API credentials for statement retrieval"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "bank_credentials" {
  secret_id = aws_secretsmanager_secret.bank_credentials.id
  secret_string = jsonencode({
    banks = {
      example_bank = {
        type          = "sftp"
        host          = "sftp.example-bank.com"
        port          = 22
        username      = "REPLACE_ME"
        private_key   = "REPLACE_ME"
        remote_path   = "/statements"
        file_pattern  = "*.mt940"
      }
      another_bank = {
        type          = "api"
        endpoint      = "https://api.another-bank.com/v1/statements"
        api_key       = "REPLACE_ME"
        api_secret    = "REPLACE_ME"
        auth_type     = "oauth2"
      }
    }
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

################################################################################
# CloudWatch Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "statement_fetch_errors" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-statement-fetch-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Bank statement fetcher errors"

  dimensions = {
    FunctionName = aws_lambda_function.bank_statement_fetcher.function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "statement_processor_errors" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-statement-processor-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Bank statement processor errors"

  dimensions = {
    FunctionName = aws_lambda_function.bank_statement_processor.function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

################################################################################
# Placeholder Lambda Code
################################################################################

data "archive_file" "bank_fetcher_placeholder" {
  type        = "zip"
  output_path = "${path.module}/files/bank-fetcher-placeholder.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        console.log('Bank Statement Fetcher - deploy actual code via CI/CD');
        console.log('Event:', JSON.stringify(event, null, 2));

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Bank statement fetcher placeholder',
            action: event.action,
            timestamp: new Date().toISOString()
          })
        };
      };
    EOF
    filename = "index.js"
  }
}

data "archive_file" "bank_processor_placeholder" {
  type        = "zip"
  output_path = "${path.module}/files/bank-processor-placeholder.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        console.log('Bank Statement Processor - deploy actual code via CI/CD');
        console.log('Event:', JSON.stringify(event, null, 2));

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Bank statement processor placeholder',
            records: event.Records?.length || 0,
            timestamp: new Date().toISOString()
          })
        };
      };
    EOF
    filename = "index.js"
  }
}
