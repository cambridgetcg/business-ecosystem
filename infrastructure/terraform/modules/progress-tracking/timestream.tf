################################################################################
# Progress Tracking Module - Timestream (Optional)
################################################################################

# Timestream database
resource "aws_timestreamwrite_database" "progress" {
  count = var.enable_timestream ? 1 : 0

  database_name = "${local.name_prefix}-metrics"

  tags = local.common_tags
}

# Timestream table for progress metrics
resource "aws_timestreamwrite_table" "progress_metrics" {
  count = var.enable_timestream ? 1 : 0

  database_name = aws_timestreamwrite_database.progress[0].database_name
  table_name    = "progress_metrics"

  retention_properties {
    memory_store_retention_period_in_hours  = 24
    magnetic_store_retention_period_in_days = 365
  }

  magnetic_store_write_properties {
    enable_magnetic_store_writes = true
  }

  schema {
    composite_partition_key {
      enforcement_in_record = "REQUIRED"
      name                  = "app"
      type                  = "DIMENSION"
    }
  }

  tags = local.common_tags
}

# Timestream table for milestone events
resource "aws_timestreamwrite_table" "milestone_events" {
  count = var.enable_timestream ? 1 : 0

  database_name = aws_timestreamwrite_database.progress[0].database_name
  table_name    = "milestone_events"

  retention_properties {
    memory_store_retention_period_in_hours  = 24
    magnetic_store_retention_period_in_days = 730 # 2 years
  }

  magnetic_store_write_properties {
    enable_magnetic_store_writes = true
  }

  tags = local.common_tags
}

# Scheduled query for daily aggregations
resource "aws_timestreamquery_scheduled_query" "daily_summary" {
  count = var.enable_timestream ? 1 : 0

  name               = "${local.name_prefix}-daily-summary"
  execution_role_arn = aws_iam_role.timestream_scheduled_query[0].arn

  query_string = <<-EOT
    SELECT
      bin(time, 1d) as day,
      app,
      layer,
      AVG(measure_value::double) as avg_progress,
      MAX(measure_value::double) as max_progress,
      MIN(measure_value::double) as min_progress
    FROM "${aws_timestreamwrite_database.progress[0].database_name}"."progress_metrics"
    WHERE measure_name = 'progress'
      AND time > ago(1d)
    GROUP BY bin(time, 1d), app, layer
  EOT

  schedule_configuration {
    schedule_expression = "cron(0 1 * * ? *)" # 1 AM daily
  }

  target_configuration {
    timestream_configuration {
      database_name = aws_timestreamwrite_database.progress[0].database_name
      table_name    = "daily_summaries"

      time_column = "day"

      dimension_mapping {
        name                 = "app"
        dimension_value_type = "VARCHAR"
      }

      dimension_mapping {
        name                 = "layer"
        dimension_value_type = "VARCHAR"
      }

      multi_measure_mappings {
        target_multi_measure_name = "progress_stats"

        multi_measure_attribute_mapping {
          source_column      = "avg_progress"
          measure_value_type = "DOUBLE"
        }

        multi_measure_attribute_mapping {
          source_column      = "max_progress"
          measure_value_type = "DOUBLE"
        }

        multi_measure_attribute_mapping {
          source_column      = "min_progress"
          measure_value_type = "DOUBLE"
        }
      }
    }
  }

  notification_configuration {
    sns_configuration {
      topic_arn = aws_sns_topic.alerts.arn
    }
  }

  error_report_configuration {
    s3_configuration {
      bucket_name       = aws_s3_bucket.progress.id
      object_key_prefix = "timestream-errors/"
    }
  }

  tags = local.common_tags
}

# IAM role for Timestream scheduled queries
resource "aws_iam_role" "timestream_scheduled_query" {
  count = var.enable_timestream ? 1 : 0

  name = "${local.name_prefix}-timestream-sq-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "timestream.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "timestream_scheduled_query" {
  count = var.enable_timestream ? 1 : 0

  name = "${local.name_prefix}-timestream-sq-policy"
  role = aws_iam_role.timestream_scheduled_query[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "timestream:Select",
          "timestream:WriteRecords",
          "timestream:DescribeEndpoints"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.progress.arn}/timestream-errors/*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}
