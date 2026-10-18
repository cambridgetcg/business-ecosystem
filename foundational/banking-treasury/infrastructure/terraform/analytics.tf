################################################################################
# Analytics Infrastructure
################################################################################
#
# QuickSight dashboards and Athena analytics for:
# - Cash position reporting
# - Payment analytics
# - Reconciliation metrics
# - Forecast accuracy tracking
#
################################################################################

################################################################################
# Feature Flags
################################################################################

variable "enable_analytics" {
  type        = bool
  description = "Enable QuickSight and analytics infrastructure"
  default     = true
}

variable "quicksight_admin_user" {
  type        = string
  description = "QuickSight admin user ARN"
  default     = ""
}

################################################################################
# Glue Database for Analytics
################################################################################

resource "aws_glue_catalog_database" "analytics" {
  count = var.enable_analytics ? 1 : 0

  name        = replace("${local.name_prefix}_analytics", "-", "_")
  description = "Analytics database for banking-treasury reporting"
}

################################################################################
# Athena Views for Cash Positions
################################################################################

resource "aws_athena_named_query" "cash_position_daily" {
  count = var.enable_analytics ? 1 : 0

  name        = "${local.name_prefix}-cash-position-daily"
  description = "Daily cash position summary view"
  database    = aws_glue_catalog_database.analytics[0].name
  workgroup   = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"

  query = <<-EOF
    CREATE OR REPLACE VIEW cash_position_daily AS
    SELECT
      entity_id,
      currency,
      DATE(updated_at) as position_date,
      MAX(current_balance) as closing_balance,
      MAX(available_balance) as available_balance,
      SUM(pending_credits) as total_pending_credits,
      SUM(pending_debits) as total_pending_debits,
      COUNT(*) as update_count
    FROM "${aws_glue_catalog_database.analytics[0].name}"."cash_positions"
    GROUP BY entity_id, currency, DATE(updated_at)
    ORDER BY position_date DESC
  EOF
}

resource "aws_athena_named_query" "cash_position_by_currency" {
  count = var.enable_analytics ? 1 : 0

  name        = "${local.name_prefix}-cash-position-by-currency"
  description = "Cash position aggregated by currency"
  database    = aws_glue_catalog_database.analytics[0].name
  workgroup   = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"

  query = <<-EOF
    SELECT
      currency,
      COUNT(DISTINCT entity_id) as entity_count,
      SUM(current_balance) as total_balance,
      SUM(available_balance) as total_available,
      AVG(current_balance) as avg_balance,
      MIN(current_balance) as min_balance,
      MAX(current_balance) as max_balance
    FROM "${aws_glue_catalog_database.analytics[0].name}"."cash_positions"
    WHERE DATE(updated_at) = CURRENT_DATE
    GROUP BY currency
    ORDER BY total_balance DESC
  EOF
}

################################################################################
# Athena Views for Payments
################################################################################

resource "aws_athena_named_query" "payment_summary" {
  count = var.enable_analytics ? 1 : 0

  name        = "${local.name_prefix}-payment-summary"
  description = "Payment summary by status and date"
  database    = aws_glue_catalog_database.analytics[0].name
  workgroup   = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"

  query = <<-EOF
    SELECT
      DATE(updated_at) as payment_date,
      status,
      currency,
      COUNT(*) as payment_count,
      SUM(amount) as total_amount,
      AVG(amount) as avg_amount
    FROM "${aws_glue_catalog_database.analytics[0].name}"."payment_status"
    GROUP BY DATE(updated_at), status, currency
    ORDER BY payment_date DESC, status
  EOF
}

resource "aws_athena_named_query" "payment_processing_times" {
  count = var.enable_analytics ? 1 : 0

  name        = "${local.name_prefix}-payment-processing-times"
  description = "Payment processing time analysis"
  database    = aws_glue_catalog_database.analytics[0].name
  workgroup   = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"

  query = <<-EOF
    SELECT
      DATE(created_at) as payment_date,
      status,
      COUNT(*) as payment_count,
      AVG(
        DATE_DIFF('second',
          CAST(created_at AS TIMESTAMP),
          CAST(COALESCE(completed_at, approved_at, updated_at) AS TIMESTAMP)
        )
      ) / 60.0 as avg_processing_minutes,
      PERCENTILE_APPROX(
        DATE_DIFF('second',
          CAST(created_at AS TIMESTAMP),
          CAST(COALESCE(completed_at, approved_at, updated_at) AS TIMESTAMP)
        ),
        0.95
      ) / 60.0 as p95_processing_minutes
    FROM "${aws_glue_catalog_database.analytics[0].name}"."payment_status"
    WHERE status IN ('completed', 'approved')
    GROUP BY DATE(created_at), status
    ORDER BY payment_date DESC
  EOF
}

################################################################################
# Athena Views for Reconciliation
################################################################################

resource "aws_athena_named_query" "reconciliation_metrics" {
  count = var.enable_analytics ? 1 : 0

  name        = "${local.name_prefix}-reconciliation-metrics"
  description = "Reconciliation match rate and metrics"
  database    = aws_glue_catalog_database.analytics[0].name
  workgroup   = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"

  query = <<-EOF
    SELECT
      DATE(created_at) as recon_date,
      status,
      COUNT(*) as session_count,
      AVG(metrics.match_rate) as avg_match_rate,
      SUM(metrics.auto_matched) as total_auto_matched,
      SUM(metrics.exceptions) as total_exceptions,
      SUM(metrics.total_statement_transactions) as total_transactions
    FROM "${aws_glue_catalog_database.analytics[0].name}"."reconciliation_sessions"
    GROUP BY DATE(created_at), status
    ORDER BY recon_date DESC
  EOF
}

resource "aws_athena_named_query" "exception_analysis" {
  count = var.enable_analytics ? 1 : 0

  name        = "${local.name_prefix}-exception-analysis"
  description = "Reconciliation exception analysis"
  database    = aws_glue_catalog_database.analytics[0].name
  workgroup   = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"

  query = <<-EOF
    SELECT
      exception_type,
      status,
      COUNT(*) as exception_count,
      DATE(created_at) as exception_date
    FROM "${aws_glue_catalog_database.analytics[0].name}"."reconciliation_exceptions"
    GROUP BY exception_type, status, DATE(created_at)
    ORDER BY exception_date DESC, exception_count DESC
  EOF
}

################################################################################
# Athena Views for Forecasting
################################################################################

resource "aws_athena_named_query" "forecast_accuracy" {
  count = var.enable_analytics && var.enable_ml_forecasting ? 1 : 0

  name        = "${local.name_prefix}-forecast-accuracy"
  description = "Forecast accuracy tracking (MAPE calculation)"
  database    = aws_glue_catalog_database.analytics[0].name
  workgroup   = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"

  query = <<-EOF
    WITH forecast_vs_actual AS (
      SELECT
        f.entity_id,
        f.currency,
        f.forecast_date,
        p.prediction_date,
        p.predicted_balance,
        a.current_balance as actual_balance,
        ABS(p.predicted_balance - a.current_balance) / NULLIF(a.current_balance, 0) as error_pct
      FROM "${aws_glue_catalog_database.analytics[0].name}"."forecasts" f
      CROSS JOIN UNNEST(predictions) AS t(p)
      LEFT JOIN "${aws_glue_catalog_database.analytics[0].name}"."cash_positions" a
        ON f.entity_id = a.entity_id
        AND f.currency = a.currency
        AND DATE(a.updated_at) = DATE(p.prediction_date)
    )
    SELECT
      currency,
      DATE_DIFF('day', CAST(forecast_date AS DATE), CAST(prediction_date AS DATE)) as horizon_days,
      COUNT(*) as sample_count,
      AVG(error_pct) * 100 as mape,
      PERCENTILE_APPROX(error_pct, 0.5) * 100 as median_error_pct,
      PERCENTILE_APPROX(error_pct, 0.95) * 100 as p95_error_pct
    FROM forecast_vs_actual
    WHERE error_pct IS NOT NULL
    GROUP BY currency, DATE_DIFF('day', CAST(forecast_date AS DATE), CAST(prediction_date AS DATE))
    ORDER BY horizon_days
  EOF
}

################################################################################
# Glue Crawler for Analytics Tables
################################################################################

resource "aws_iam_role" "glue_crawler" {
  count = var.enable_analytics ? 1 : 0

  name = "${local.name_prefix}-glue-crawler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "glue.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "glue_service" {
  count = var.enable_analytics ? 1 : 0

  role       = aws_iam_role.glue_crawler[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

resource "aws_iam_role_policy" "glue_crawler" {
  count = var.enable_analytics ? 1 : 0

  name = "${local.name_prefix}-glue-crawler-policy"
  role = aws_iam_role.glue_crawler[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.enable_audit_logging ? aws_s3_bucket.audit_logs[0].arn : "*",
          var.enable_audit_logging ? "${aws_s3_bucket.audit_logs[0].arn}/*" : "*",
          var.enable_ml_forecasting ? aws_s3_bucket.ml_artifacts[0].arn : "*",
          var.enable_ml_forecasting ? "${aws_s3_bucket.ml_artifacts[0].arn}/*" : "*"
        ]
      },
      {
        Sid    = "DynamoDB"
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeTable",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.cash_positions.arn,
          aws_dynamodb_table.payment_status.arn,
          aws_dynamodb_table.reconciliation_sessions.arn,
          aws_dynamodb_table.reconciliation_exceptions.arn
        ]
      }
    ]
  })
}

# DynamoDB to Glue table mappings via Data Catalog
resource "aws_glue_catalog_table" "cash_positions" {
  count = var.enable_analytics ? 1 : 0

  name          = "cash_positions"
  database_name = aws_glue_catalog_database.analytics[0].name

  table_type = "EXTERNAL_TABLE"

  parameters = {
    "classification"    = "dynamodb"
    "sourceTable"       = aws_dynamodb_table.cash_positions.name
    "dynamodb.endpoint" = "dynamodb.${local.region}.amazonaws.com"
  }

  storage_descriptor {
    location      = "dynamodb://${aws_dynamodb_table.cash_positions.name}"
    input_format  = "org.apache.hadoop.hive.dynamodb.DynamoDBInputFormat"
    output_format = "org.apache.hadoop.hive.dynamodb.DynamoDBOutputFormat"

    ser_de_info {
      name                  = "dynamodb-serde"
      serialization_library = "org.apache.hadoop.hive.dynamodb.DynamoDBSerDe"
    }

    columns {
      name = "entity_id"
      type = "string"
    }
    columns {
      name = "currency_timestamp"
      type = "string"
    }
    columns {
      name = "currency"
      type = "string"
    }
    columns {
      name = "current_balance"
      type = "double"
    }
    columns {
      name = "available_balance"
      type = "double"
    }
    columns {
      name = "pending_credits"
      type = "double"
    }
    columns {
      name = "pending_debits"
      type = "double"
    }
    columns {
      name = "updated_at"
      type = "string"
    }
  }
}

resource "aws_glue_catalog_table" "payment_status" {
  count = var.enable_analytics ? 1 : 0

  name          = "payment_status"
  database_name = aws_glue_catalog_database.analytics[0].name

  table_type = "EXTERNAL_TABLE"

  parameters = {
    "classification"    = "dynamodb"
    "sourceTable"       = aws_dynamodb_table.payment_status.name
    "dynamodb.endpoint" = "dynamodb.${local.region}.amazonaws.com"
  }

  storage_descriptor {
    location      = "dynamodb://${aws_dynamodb_table.payment_status.name}"
    input_format  = "org.apache.hadoop.hive.dynamodb.DynamoDBInputFormat"
    output_format = "org.apache.hadoop.hive.dynamodb.DynamoDBOutputFormat"

    ser_de_info {
      name                  = "dynamodb-serde"
      serialization_library = "org.apache.hadoop.hive.dynamodb.DynamoDBSerDe"
    }

    columns {
      name = "payment_id"
      type = "string"
    }
    columns {
      name = "status"
      type = "string"
    }
    columns {
      name = "source_account"
      type = "string"
    }
    columns {
      name = "destination_account"
      type = "string"
    }
    columns {
      name = "amount"
      type = "double"
    }
    columns {
      name = "currency"
      type = "string"
    }
    columns {
      name = "initiated_by"
      type = "string"
    }
    columns {
      name = "approved_by"
      type = "string"
    }
    columns {
      name = "approved_at"
      type = "string"
    }
    columns {
      name = "completed_at"
      type = "string"
    }
    columns {
      name = "updated_at"
      type = "string"
    }
  }
}

################################################################################
# QuickSight Data Source (requires manual setup of QuickSight account)
################################################################################

# Note: QuickSight resources require the account to be subscribed to QuickSight
# These are placeholder configurations - enable when QuickSight is set up

# resource "aws_quicksight_data_source" "athena" {
#   count = var.enable_analytics && var.quicksight_admin_user != "" ? 1 : 0
#
#   data_source_id = "${local.name_prefix}-athena"
#   name           = "Banking Treasury Analytics"
#   type           = "ATHENA"
#
#   parameters {
#     athena_parameters {
#       work_group = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"
#     }
#   }
#
#   permission {
#     actions = [
#       "quicksight:DescribeDataSource",
#       "quicksight:DescribeDataSourcePermissions",
#       "quicksight:PassDataSource",
#       "quicksight:UpdateDataSource",
#       "quicksight:DeleteDataSource",
#       "quicksight:UpdateDataSourcePermissions"
#     ]
#     principal = var.quicksight_admin_user
#   }
# }

################################################################################
# Analytics Lambda for Scheduled Reports
################################################################################

resource "aws_iam_role" "analytics_lambda" {
  count = var.enable_analytics ? 1 : 0

  name = "${local.name_prefix}-analytics-lambda"

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

resource "aws_iam_role_policy" "analytics_lambda" {
  count = var.enable_analytics ? 1 : 0

  name = "${local.name_prefix}-analytics-lambda-policy"
  role = aws_iam_role.analytics_lambda[0].id

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
        Sid    = "Athena"
        Effect = "Allow"
        Action = [
          "athena:StartQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:GetNamedQuery"
        ]
        Resource = "*"
      },
      {
        Sid    = "Glue"
        Effect = "Allow"
        Action = [
          "glue:GetDatabase",
          "glue:GetTable",
          "glue:GetTables"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3Results"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:GetBucketLocation"
        ]
        Resource = var.enable_audit_logging ? [
          "${aws_s3_bucket.audit_logs[0].arn}/athena-results/*"
        ] : ["*"]
      },
      {
        Sid    = "SNS"
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.reconciliation_events.arn
      },
      {
        Sid    = "SES"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_lambda_function" "analytics_reports" {
  count = var.enable_analytics ? 1 : 0

  function_name = "${local.name_prefix}-analytics-reports"
  description   = "Generates and distributes scheduled analytics reports"

  filename         = data.archive_file.analytics_placeholder.output_path
  source_code_hash = data.archive_file.analytics_placeholder.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 300
  memory_size      = 512

  role = aws_iam_role.analytics_lambda[0].arn

  environment {
    variables = {
      NODE_ENV              = var.environment
      ATHENA_DATABASE       = aws_glue_catalog_database.analytics[0].name
      ATHENA_WORKGROUP      = var.enable_audit_logging ? aws_athena_workgroup.audit[0].name : "primary"
      ATHENA_OUTPUT_BUCKET  = var.enable_audit_logging ? aws_s3_bucket.audit_logs[0].bucket : ""
      SNS_TOPIC_ARN         = aws_sns_topic.reconciliation_events.arn
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = merge(local.common_tags, {
    Function = "analytics-reports"
  })
}

# Daily report schedule
resource "aws_cloudwatch_event_rule" "daily_report" {
  count = var.enable_analytics ? 1 : 0

  name                = "${local.name_prefix}-daily-analytics-report"
  description         = "Trigger daily analytics report generation"
  schedule_expression = "cron(0 7 * * ? *)"  # 7 AM UTC daily

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "daily_report" {
  count = var.enable_analytics ? 1 : 0

  rule      = aws_cloudwatch_event_rule.daily_report[0].name
  target_id = "AnalyticsLambda"
  arn       = aws_lambda_function.analytics_reports[0].arn

  input = jsonencode({
    reportType = "daily_summary"
    period     = "yesterday"
  })
}

resource "aws_lambda_permission" "daily_report" {
  count = var.enable_analytics ? 1 : 0

  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.analytics_reports[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_report[0].arn
}

################################################################################
# Placeholder Lambda Code
################################################################################

data "archive_file" "analytics_placeholder" {
  type        = "zip"
  output_path = "${path.module}/files/analytics-placeholder.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        console.log('Analytics Report Lambda - deploy actual code via CI/CD');
        console.log('Event:', JSON.stringify(event, null, 2));

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Analytics report placeholder',
            reportType: event.reportType,
            timestamp: new Date().toISOString()
          })
        };
      };
    EOF
    filename = "index.js"
  }
}
