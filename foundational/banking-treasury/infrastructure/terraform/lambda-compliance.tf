################################################################################
# Compliance Screening Lambda
################################################################################
#
# Performs compliance checks on payments:
# - Sanctions screening (OFAC, EU, UN lists)
# - AML risk scoring
# - Velocity checks
# - Geographic risk assessment
# - Entity verification
#
################################################################################

################################################################################
# IAM Role
################################################################################

resource "aws_iam_role" "compliance_screening" {
  name = "${local.name_prefix}-compliance-screening"

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

resource "aws_iam_role_policy" "compliance_screening" {
  name = "${local.name_prefix}-compliance-screening-policy"
  role = aws_iam_role.compliance_screening.id

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
        Sid    = "DynamoDBRead"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.cash_positions.arn,
          aws_dynamodb_table.payment_status.arn,
          aws_dynamodb_table.compliance_rules.arn,
          "${aws_dynamodb_table.compliance_rules.arn}/index/*"
        ]
      },
      {
        Sid    = "DynamoDBWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          aws_dynamodb_table.compliance_results.arn
        ]
      },
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.compliance_api.arn
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
        Resource = aws_sns_topic.critical_alerts.arn
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

resource "aws_security_group" "compliance_screening" {
  name        = "${local.name_prefix}-compliance-screening"
  description = "Security group for compliance screening Lambda"
  vpc_id      = data.aws_vpc.ecosystem.id

  # Outbound HTTPS for external compliance APIs
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for compliance APIs and AWS services"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-compliance-screening"
  })
}

################################################################################
# Lambda Function
################################################################################

resource "aws_lambda_function" "compliance_screening" {
  function_name = "${local.name_prefix}-compliance-screening"
  description   = "Performs compliance screening on payments (sanctions, AML, velocity)"

  # Placeholder - deploy actual code via CI/CD
  filename         = data.archive_file.compliance_placeholder.output_path
  source_code_hash = data.archive_file.compliance_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 512

  role = aws_iam_role.compliance_screening.arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.compliance_screening.id]
  }

  environment {
    variables = {
      NODE_ENV                   = var.environment
      COMPLIANCE_RULES_TABLE     = aws_dynamodb_table.compliance_rules.name
      COMPLIANCE_RESULTS_TABLE   = aws_dynamodb_table.compliance_results.name
      PAYMENT_STATUS_TABLE       = aws_dynamodb_table.payment_status.name
      COMPLIANCE_API_SECRET      = aws_secretsmanager_secret.compliance_api.name
      EVENT_BUS_NAME             = aws_cloudwatch_event_bus.banking_treasury.name
      CRITICAL_ALERTS_TOPIC      = aws_sns_topic.critical_alerts.arn
      HIGH_RISK_COUNTRIES        = var.high_risk_countries
      VELOCITY_CHECK_WINDOW_MINS = tostring(var.velocity_check_window_mins)
      MAX_DAILY_AMOUNT_USD       = tostring(var.max_daily_amount_usd)
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "compliance-screening"
  })
}

# Allow Step Functions to invoke
resource "aws_lambda_permission" "compliance_screening_sfn" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.compliance_screening.function_name
  principal     = "states.amazonaws.com"
  source_arn    = var.enable_payment_workflow ? aws_sfn_state_machine.payment_workflow[0].arn : null
}

################################################################################
# Compliance Rules Table
################################################################################

resource "aws_dynamodb_table" "compliance_rules" {
  name         = "${local.name_prefix}-compliance-rules"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "rule_id"
  range_key = "version"

  attribute {
    name = "rule_id"
    type = "S"
  }

  attribute {
    name = "version"
    type = "N"
  }

  attribute {
    name = "rule_type"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  # GSI: Query rules by type
  global_secondary_index {
    name            = "rule-type-index"
    hash_key        = "rule_type"
    range_key       = "status"
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
    Name    = "${local.name_prefix}-compliance-rules"
    Purpose = "compliance-rule-configuration"
  })
}

################################################################################
# Compliance Results Table
################################################################################

resource "aws_dynamodb_table" "compliance_results" {
  name         = "${local.name_prefix}-compliance-results"
  billing_mode = var.environment == "prod" ? "PROVISIONED" : "PAY_PER_REQUEST"

  hash_key  = "payment_id"
  range_key = "check_timestamp"

  read_capacity  = var.environment == "prod" ? 25 : null
  write_capacity = var.environment == "prod" ? 25 : null

  attribute {
    name = "payment_id"
    type = "S"
  }

  attribute {
    name = "check_timestamp"
    type = "S"
  }

  attribute {
    name = "result"
    type = "S"
  }

  attribute {
    name = "entity_id"
    type = "S"
  }

  # GSI: Query results by outcome
  global_secondary_index {
    name            = "result-index"
    hash_key        = "result"
    range_key       = "check_timestamp"
    projection_type = "ALL"

    read_capacity  = var.environment == "prod" ? 10 : null
    write_capacity = var.environment == "prod" ? 10 : null
  }

  # GSI: Query by entity (for velocity checks)
  global_secondary_index {
    name            = "entity-index"
    hash_key        = "entity_id"
    range_key       = "check_timestamp"
    projection_type = "ALL"

    read_capacity  = var.environment == "prod" ? 10 : null
    write_capacity = var.environment == "prod" ? 10 : null
  }

  # TTL for old results (90 days)
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
    Name    = "${local.name_prefix}-compliance-results"
    Purpose = "compliance-screening-results"
  })
}

################################################################################
# Compliance API Credentials Secret
################################################################################

resource "aws_secretsmanager_secret" "compliance_api" {
  name_prefix             = "${local.name_prefix}-compliance-api-"
  description             = "Credentials for external compliance screening APIs"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "compliance_api" {
  secret_id = aws_secretsmanager_secret.compliance_api.id
  secret_string = jsonencode({
    dow_jones_api_key   = "REPLACE_ME"
    world_check_api_key = "REPLACE_ME"
    ofac_api_endpoint   = "https://api.treasury.gov/sanctions"
    internal_aml_api    = "https://aml-service.internal/v1"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

################################################################################
# CloudWatch Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "compliance_failures" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-compliance-screening-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Compliance screening Lambda errors exceeded threshold"

  dimensions = {
    FunctionName = aws_lambda_function.compliance_screening.function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "compliance_duration" {
  count = var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-compliance-screening-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Average"
  threshold           = 25000  # 25 seconds
  alarm_description   = "Compliance screening taking too long"

  dimensions = {
    FunctionName = aws_lambda_function.compliance_screening.function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}

################################################################################
# Placeholder Lambda Code
################################################################################

data "archive_file" "compliance_placeholder" {
  type        = "zip"
  output_path = "${path.module}/files/compliance-placeholder.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        console.log('Compliance Screening Lambda - deploy actual code via CI/CD');
        console.log('Event:', JSON.stringify(event, null, 2));

        // Placeholder response
        const result = {
          paymentId: event.paymentId,
          screening: {
            sanctionsCheck: { passed: true, score: 0, matches: [] },
            amlCheck: { passed: true, riskScore: 'low', flags: [] },
            velocityCheck: { passed: true, dailyTotal: 0, limit: 100000 },
            geographicCheck: { passed: true, riskLevel: 'low' }
          },
          overallResult: 'APPROVED',
          requiresManualReview: false,
          timestamp: new Date().toISOString()
        };

        return result;
      };
    EOF
    filename = "index.js"
  }
}
