################################################################################
# Lambda Functions for DynamoDB Streams Processing
################################################################################
#
# Processes DynamoDB Streams to:
# - Update ElastiCache with latest cash positions
# - Publish change events to EventBridge
# - Trigger real-time notifications
#
################################################################################

################################################################################
# IAM Role for Stream Processors
################################################################################

resource "aws_iam_role" "stream_processor" {
  name = "${local.name_prefix}-stream-processor"

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

resource "aws_iam_role_policy" "stream_processor" {
  name = "${local.name_prefix}-stream-processor-policy"
  role = aws_iam_role.stream_processor.id

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
        Sid    = "DynamoDBStreams"
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = [
          aws_dynamodb_table.cash_positions.stream_arn,
          aws_dynamodb_table.transaction_ledger.stream_arn,
          aws_dynamodb_table.payment_status.stream_arn
        ]
      },
      {
        Sid    = "ElastiCache"
        Effect = "Allow"
        Action = [
          "elasticache:Connect"
        ]
        Resource = "*"
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
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = module.cache.auth_secret_arn
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
        Sid    = "KMS"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.environment == "prod" ? [
          aws_kms_key.dynamodb[0].arn
        ] : []
      }
    ]
  })
}

################################################################################
# Security Group for Lambda
################################################################################

resource "aws_security_group" "stream_processor" {
  name        = "${local.name_prefix}-stream-processor"
  description = "Security group for DynamoDB stream processor Lambda"
  vpc_id      = data.aws_vpc.ecosystem.id

  # Outbound to ElastiCache
  egress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.ecosystem.cidr_block]
    description = "ElastiCache Redis"
  }

  # Outbound to AWS services (HTTPS)
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "AWS APIs"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-stream-processor"
  })
}

################################################################################
# Cash Position Stream Processor
################################################################################

resource "aws_lambda_function" "cash_position_processor" {
  count = var.enable_dynamodb_streams ? 1 : 0

  function_name = "${local.name_prefix}-cash-position-processor"
  description   = "Processes cash position changes from DynamoDB Streams"

  # Placeholder - deploy actual code via CI/CD
  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  role = aws_iam_role.stream_processor.arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.stream_processor.id]
  }

  environment {
    variables = {
      NODE_ENV           = var.environment
      REDIS_HOST         = module.cache.primary_endpoint
      REDIS_AUTH_SECRET  = module.cache.auth_secret_arn
      EVENT_BUS_NAME     = aws_cloudwatch_event_bus.banking_treasury.name
      CACHE_KEY_PREFIX   = "cash-position:"
      CACHE_TTL_SECONDS  = "300"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "cash-position-stream-processor"
  })
}

resource "aws_lambda_event_source_mapping" "cash_position_stream" {
  count = var.enable_dynamodb_streams ? 1 : 0

  event_source_arn  = aws_dynamodb_table.cash_positions.stream_arn
  function_name     = aws_lambda_function.cash_position_processor[0].arn
  starting_position = "LATEST"
  batch_size        = 100
  maximum_batching_window_in_seconds = 5

  # Enable parallel processing
  parallelization_factor = 2

  # Error handling
  maximum_retry_attempts = 3
  maximum_record_age_in_seconds = 60

  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.stream_dlq[0].arn
    }
  }

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT", "MODIFY"]
      })
    }
  }
}

################################################################################
# Transaction Ledger Stream Processor
################################################################################

resource "aws_lambda_function" "transaction_processor" {
  count = var.enable_dynamodb_streams ? 1 : 0

  function_name = "${local.name_prefix}-transaction-processor"
  description   = "Processes transaction entries from DynamoDB Streams"

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  role = aws_iam_role.stream_processor.arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.stream_processor.id]
  }

  environment {
    variables = {
      NODE_ENV           = var.environment
      REDIS_HOST         = module.cache.primary_endpoint
      REDIS_AUTH_SECRET  = module.cache.auth_secret_arn
      EVENT_BUS_NAME     = aws_cloudwatch_event_bus.banking_treasury.name
      CACHE_KEY_PREFIX   = "transaction:"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "transaction-stream-processor"
  })
}

resource "aws_lambda_event_source_mapping" "transaction_stream" {
  count = var.enable_dynamodb_streams ? 1 : 0

  event_source_arn  = aws_dynamodb_table.transaction_ledger.stream_arn
  function_name     = aws_lambda_function.transaction_processor[0].arn
  starting_position = "LATEST"
  batch_size        = 100
  maximum_batching_window_in_seconds = 1

  maximum_retry_attempts = 3
  maximum_record_age_in_seconds = 60

  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.stream_dlq[0].arn
    }
  }
}

################################################################################
# Payment Status Stream Processor
################################################################################

resource "aws_lambda_function" "payment_status_processor" {
  count = var.enable_dynamodb_streams ? 1 : 0

  function_name = "${local.name_prefix}-payment-status-processor"
  description   = "Processes payment status changes from DynamoDB Streams"

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256

  role = aws_iam_role.stream_processor.arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.stream_processor.id]
  }

  environment {
    variables = {
      NODE_ENV              = var.environment
      REDIS_HOST            = module.cache.primary_endpoint
      REDIS_AUTH_SECRET     = module.cache.auth_secret_arn
      EVENT_BUS_NAME        = aws_cloudwatch_event_bus.banking_treasury.name
      CACHE_KEY_PREFIX      = "payment-status:"
      SNS_PAYMENT_TOPIC_ARN = aws_sns_topic.payment_events.arn
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "payment-status-stream-processor"
  })
}

resource "aws_lambda_event_source_mapping" "payment_status_stream" {
  count = var.enable_dynamodb_streams ? 1 : 0

  event_source_arn  = aws_dynamodb_table.payment_status.stream_arn
  function_name     = aws_lambda_function.payment_status_processor[0].arn
  starting_position = "LATEST"
  batch_size        = 10
  maximum_batching_window_in_seconds = 0  # Process immediately

  maximum_retry_attempts = 3
  maximum_record_age_in_seconds = 60

  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.stream_dlq[0].arn
    }
  }
}

################################################################################
# Dead Letter Queue for Stream Failures
################################################################################

resource "aws_sqs_queue" "stream_dlq" {
  count = var.enable_dynamodb_streams ? 1 : 0

  name = "${local.name_prefix}-stream-dlq"

  message_retention_seconds = 1209600  # 14 days
  visibility_timeout_seconds = 300

  # Encryption
  sqs_managed_sse_enabled = var.environment != "prod"
  kms_master_key_id       = var.environment == "prod" ? aws_kms_key.sqs[0].id : null

  tags = merge(local.common_tags, {
    Purpose = "stream-processing-dlq"
  })
}

# KMS key for SQS (production)
resource "aws_kms_key" "sqs" {
  count = var.environment == "prod" ? 1 : 0

  description             = "KMS key for SQS queues"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = local.common_tags
}

################################################################################
# CloudWatch Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "stream_processor_errors" {
  count = var.enable_dynamodb_streams && var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-stream-processor-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Stream processor Lambda errors exceeded threshold"

  dimensions = {
    FunctionName = aws_lambda_function.cash_position_processor[0].function_name
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]
  ok_actions    = [aws_sns_topic.alerts[0].arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "stream_dlq_messages" {
  count = var.enable_dynamodb_streams && var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-stream-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in stream processing DLQ"

  dimensions = {
    QueueName = aws_sqs_queue.stream_dlq[0].name
  }

  alarm_actions = [aws_sns_topic.alerts[0].arn]

  tags = local.common_tags
}

################################################################################
# Placeholder Lambda Code
################################################################################

data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/files/lambda-placeholder.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        console.log('Placeholder Lambda - deploy actual code via CI/CD');
        console.log('Event:', JSON.stringify(event, null, 2));

        // Process DynamoDB Stream records
        for (const record of event.Records) {
          console.log('Processing record:', record.eventID);
          console.log('Event Name:', record.eventName);
          console.log('DynamoDB:', JSON.stringify(record.dynamodb, null, 2));
        }

        return { statusCode: 200, body: 'OK' };
      };
    EOF
    filename = "index.js"
  }
}
