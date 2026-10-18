################################################################################
# SageMaker Infrastructure for ML Forecasting
################################################################################
#
# Cash flow forecasting with target 5% MAPE at 30-day horizon.
# Components:
# - Feature Store for time-series data
# - Model endpoint for real-time predictions
# - Training pipeline
# - Model registry
#
################################################################################

################################################################################
# Feature Flags
################################################################################

variable "enable_ml_forecasting" {
  type        = bool
  description = "Enable SageMaker ML forecasting infrastructure"
  default     = true
}

variable "sagemaker_instance_type" {
  type        = string
  description = "SageMaker endpoint instance type"
  default     = "ml.t2.medium"
}

variable "sagemaker_instance_count" {
  type        = number
  description = "Number of SageMaker endpoint instances"
  default     = 1
}

################################################################################
# S3 Bucket for Model Artifacts
################################################################################

resource "aws_s3_bucket" "ml_artifacts" {
  count = var.enable_ml_forecasting ? 1 : 0

  bucket = "${local.name_prefix}-ml-artifacts-${local.account_id}"

  tags = merge(local.common_tags, {
    Purpose = "ml-model-artifacts"
  })
}

resource "aws_s3_bucket_versioning" "ml_artifacts" {
  count = var.enable_ml_forecasting ? 1 : 0

  bucket = aws_s3_bucket.ml_artifacts[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ml_artifacts" {
  count = var.enable_ml_forecasting ? 1 : 0

  bucket = aws_s3_bucket.ml_artifacts[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.environment == "prod" ? "aws:kms" : "AES256"
      kms_master_key_id = var.environment == "prod" ? aws_kms_key.sagemaker[0].id : null
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "ml_artifacts" {
  count = var.enable_ml_forecasting ? 1 : 0

  bucket = aws_s3_bucket.ml_artifacts[0].id

  rule {
    id     = "archive-old-models"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "ml_artifacts" {
  count = var.enable_ml_forecasting ? 1 : 0

  bucket = aws_s3_bucket.ml_artifacts[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

################################################################################
# KMS Key for SageMaker (Production)
################################################################################

resource "aws_kms_key" "sagemaker" {
  count = var.enable_ml_forecasting && var.environment == "prod" ? 1 : 0

  description             = "KMS key for SageMaker encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow SageMaker Service"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_kms_alias" "sagemaker" {
  count = var.enable_ml_forecasting && var.environment == "prod" ? 1 : 0

  name          = "alias/${local.name_prefix}-sagemaker"
  target_key_id = aws_kms_key.sagemaker[0].key_id
}

################################################################################
# SageMaker Execution Role
################################################################################

resource "aws_iam_role" "sagemaker_execution" {
  count = var.enable_ml_forecasting ? 1 : 0

  name = "${local.name_prefix}-sagemaker-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "sagemaker_execution" {
  count = var.enable_ml_forecasting ? 1 : 0

  name = "${local.name_prefix}-sagemaker-execution-policy"
  role = aws_iam_role.sagemaker_execution[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          aws_s3_bucket.ml_artifacts[0].arn,
          "${aws_s3_bucket.ml_artifacts[0].arn}/*"
        ]
      },
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
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRAccess"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      {
        Sid    = "FeatureStoreAccess"
        Effect = "Allow"
        Action = [
          "sagemaker:PutRecord",
          "sagemaker:GetRecord",
          "sagemaker:BatchGetRecord"
        ]
        Resource = var.enable_ml_forecasting ? [
          aws_sagemaker_feature_group.cash_flow_features[0].arn
        ] : []
      },
      {
        Sid    = "DynamoDBRead"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.cash_positions.arn,
          "${aws_dynamodb_table.cash_positions.arn}/index/*",
          aws_dynamodb_table.transaction_ledger.arn
        ]
      },
      {
        Sid    = "KMSAccess"
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.environment == "prod" && var.enable_ml_forecasting ? [
          aws_kms_key.sagemaker[0].arn
        ] : []
      }
    ]
  })
}

################################################################################
# SageMaker Feature Group (Feature Store)
################################################################################

resource "aws_sagemaker_feature_group" "cash_flow_features" {
  count = var.enable_ml_forecasting ? 1 : 0

  feature_group_name             = "${local.name_prefix}-cash-flow-features"
  record_identifier_feature_name = "entity_id"
  event_time_feature_name        = "event_time"
  role_arn                       = aws_iam_role.sagemaker_execution[0].arn

  # Feature definitions
  feature_definition {
    feature_name = "entity_id"
    feature_type = "String"
  }

  feature_definition {
    feature_name = "event_time"
    feature_type = "String"
  }

  feature_definition {
    feature_name = "currency"
    feature_type = "String"
  }

  feature_definition {
    feature_name = "current_balance"
    feature_type = "Fractional"
  }

  feature_definition {
    feature_name = "available_balance"
    feature_type = "Fractional"
  }

  feature_definition {
    feature_name = "daily_inflows"
    feature_type = "Fractional"
  }

  feature_definition {
    feature_name = "daily_outflows"
    feature_type = "Fractional"
  }

  feature_definition {
    feature_name = "transaction_count"
    feature_type = "Integral"
  }

  feature_definition {
    feature_name = "avg_transaction_amount"
    feature_type = "Fractional"
  }

  feature_definition {
    feature_name = "day_of_week"
    feature_type = "Integral"
  }

  feature_definition {
    feature_name = "day_of_month"
    feature_type = "Integral"
  }

  feature_definition {
    feature_name = "is_month_end"
    feature_type = "Integral"
  }

  feature_definition {
    feature_name = "rolling_7d_avg_balance"
    feature_type = "Fractional"
  }

  feature_definition {
    feature_name = "rolling_30d_avg_balance"
    feature_type = "Fractional"
  }

  feature_definition {
    feature_name = "balance_volatility_7d"
    feature_type = "Fractional"
  }

  # Online store for real-time inference
  online_store_config {
    enable_online_store = true
  }

  # Offline store for training (S3)
  offline_store_config {
    s3_storage_config {
      s3_uri = "s3://${aws_s3_bucket.ml_artifacts[0].bucket}/feature-store"
    }

    disable_glue_table_creation = false

    data_catalog_config {
      catalog    = "AwsDataCatalog"
      database   = aws_glue_catalog_database.ml_features[0].name
      table_name = "${local.name_prefix}-cash-flow-features"
    }
  }

  tags = merge(local.common_tags, {
    Purpose = "ml-feature-store"
  })
}

################################################################################
# Glue Database for Feature Store
################################################################################

resource "aws_glue_catalog_database" "ml_features" {
  count = var.enable_ml_forecasting ? 1 : 0

  name = replace("${local.name_prefix}_ml_features", "-", "_")

  description = "Database for SageMaker Feature Store tables"
}

################################################################################
# SageMaker Model (Placeholder - deployed via CI/CD)
################################################################################

# Note: Actual model deployment is done via CI/CD pipeline
# This creates the endpoint configuration

resource "aws_sagemaker_endpoint_configuration" "cash_flow_forecast" {
  count = var.enable_ml_forecasting ? 1 : 0

  name = "${local.name_prefix}-cash-flow-forecast"

  production_variants {
    variant_name           = "primary"
    model_name             = "${local.name_prefix}-cash-flow-model"
    initial_instance_count = var.sagemaker_instance_count
    instance_type          = var.sagemaker_instance_type
    initial_variant_weight = 1.0
  }

  # Data capture for model monitoring
  data_capture_config {
    enable_capture              = var.environment == "prod"
    initial_sampling_percentage = 10
    destination_s3_uri          = "s3://${aws_s3_bucket.ml_artifacts[0].bucket}/data-capture"

    capture_options {
      capture_mode = "Input"
    }

    capture_options {
      capture_mode = "Output"
    }

    capture_content_type_header {
      json_content_types = ["application/json"]
    }
  }

  tags = merge(local.common_tags, {
    Purpose = "cash-flow-forecast-endpoint"
  })

  lifecycle {
    create_before_destroy = true
  }
}

################################################################################
# Forecast Prediction Lambda
################################################################################

resource "aws_iam_role" "forecast_lambda" {
  count = var.enable_ml_forecasting ? 1 : 0

  name = "${local.name_prefix}-forecast-lambda"

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

resource "aws_iam_role_policy" "forecast_lambda" {
  count = var.enable_ml_forecasting ? 1 : 0

  name = "${local.name_prefix}-forecast-lambda-policy"
  role = aws_iam_role.forecast_lambda[0].id

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
        Sid    = "SageMakerInvoke"
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ]
        Resource = "arn:aws:sagemaker:${local.region}:${local.account_id}:endpoint/${local.name_prefix}-cash-flow-forecast"
      },
      {
        Sid    = "FeatureStoreRead"
        Effect = "Allow"
        Action = [
          "sagemaker:GetRecord",
          "sagemaker:BatchGetRecord"
        ]
        Resource = var.enable_ml_forecasting ? [
          aws_sagemaker_feature_group.cash_flow_features[0].arn
        ] : []
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
          "${aws_dynamodb_table.cash_positions.arn}/index/*"
        ]
      },
      {
        Sid    = "DynamoDBWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = [
          aws_dynamodb_table.forecasts[0].arn
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
      }
    ]
  })
}

resource "aws_lambda_function" "forecast_prediction" {
  count = var.enable_ml_forecasting ? 1 : 0

  function_name = "${local.name_prefix}-forecast-prediction"
  description   = "Generates cash flow forecasts using SageMaker endpoint"

  filename         = data.archive_file.forecast_placeholder.output_path
  source_code_hash = data.archive_file.forecast_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 512

  role = aws_iam_role.forecast_lambda[0].arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.forecast_lambda[0].id]
  }

  environment {
    variables = {
      NODE_ENV               = var.environment
      SAGEMAKER_ENDPOINT     = "${local.name_prefix}-cash-flow-forecast"
      FEATURE_GROUP_NAME     = aws_sagemaker_feature_group.cash_flow_features[0].feature_group_name
      CASH_POSITIONS_TABLE   = aws_dynamodb_table.cash_positions.name
      FORECASTS_TABLE        = aws_dynamodb_table.forecasts[0].name
      EVENT_BUS_NAME         = aws_cloudwatch_event_bus.banking_treasury.name
      FORECAST_HORIZON_DAYS  = "30"
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "forecast-prediction"
  })
}

resource "aws_security_group" "forecast_lambda" {
  count = var.enable_ml_forecasting ? 1 : 0

  name        = "${local.name_prefix}-forecast-lambda"
  description = "Security group for forecast Lambda"
  vpc_id      = data.aws_vpc.ecosystem.id

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS for AWS services"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-forecast-lambda"
  })
}

# Scheduled trigger for daily forecasts
resource "aws_cloudwatch_event_rule" "daily_forecast" {
  count = var.enable_ml_forecasting ? 1 : 0

  name                = "${local.name_prefix}-daily-forecast"
  description         = "Trigger daily cash flow forecast generation"
  schedule_expression = "cron(0 6 * * ? *)"  # 6 AM UTC daily

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "daily_forecast" {
  count = var.enable_ml_forecasting ? 1 : 0

  rule      = aws_cloudwatch_event_rule.daily_forecast[0].name
  target_id = "ForecastLambda"
  arn       = aws_lambda_function.forecast_prediction[0].arn

  input = jsonencode({
    action = "generate_all_forecasts"
    horizon_days = 30
  })
}

resource "aws_lambda_permission" "daily_forecast" {
  count = var.enable_ml_forecasting ? 1 : 0

  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.forecast_prediction[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_forecast[0].arn
}

################################################################################
# Forecasts Table
################################################################################

resource "aws_dynamodb_table" "forecasts" {
  count = var.enable_ml_forecasting ? 1 : 0

  name         = "${local.name_prefix}-forecasts"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "entity_id"
  range_key = "forecast_date"

  attribute {
    name = "entity_id"
    type = "S"
  }

  attribute {
    name = "forecast_date"
    type = "S"
  }

  attribute {
    name = "currency"
    type = "S"
  }

  attribute {
    name = "generated_at"
    type = "S"
  }

  # GSI: Query by currency
  global_secondary_index {
    name            = "currency-index"
    hash_key        = "currency"
    range_key       = "forecast_date"
    projection_type = "ALL"
  }

  # GSI: Query by generation time
  global_secondary_index {
    name            = "generated-index"
    hash_key        = "entity_id"
    range_key       = "generated_at"
    projection_type = "ALL"
  }

  # TTL for old forecasts (90 days)
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
    Name    = "${local.name_prefix}-forecasts"
    Purpose = "cash-flow-forecasts"
  })
}

################################################################################
# Placeholder Lambda Code
################################################################################

data "archive_file" "forecast_placeholder" {
  type        = "zip"
  output_path = "${path.module}/files/forecast-placeholder.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        console.log('Forecast Lambda - deploy actual code via CI/CD');
        console.log('Event:', JSON.stringify(event, null, 2));

        // Placeholder response
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Forecast generation placeholder',
            action: event.action,
            timestamp: new Date().toISOString()
          })
        };
      };
    EOF
    filename = "index.js"
  }
}

################################################################################
# CloudWatch Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "forecast_errors" {
  count = var.enable_ml_forecasting && var.alert_email != "" ? 1 : 0

  alarm_name          = "${local.name_prefix}-forecast-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Forecast Lambda errors exceeded threshold"

  dimensions = {
    FunctionName = aws_lambda_function.forecast_prediction[0].function_name
  }

  alarm_actions = [aws_sns_topic.critical_alerts.arn]

  tags = local.common_tags
}
