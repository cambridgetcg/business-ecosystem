# =============================================================================
# Kinesis Firehose for Audit Log Streaming
# =============================================================================
# CloudWatch Logs → Kinesis Firehose → S3 (Parquet)
# Enables Athena queries on audit data

# -----------------------------------------------------------------------------
# IAM Role for Firehose
# -----------------------------------------------------------------------------

resource "aws_iam_role" "firehose" {
  name = "${local.name_prefix}-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "sts:ExternalId" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "firehose" {
  name = "${local.name_prefix}-firehose-policy"
  role = aws_iam_role.firehose.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.audit.arn,
          "${aws_s3_bucket.audit.arn}/*"
        ]
      },
      {
        Sid    = "KMSAccess"
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.data_privacy.arn
      },
      {
        Sid    = "GlueAccess"
        Effect = "Allow"
        Action = [
          "glue:GetTable",
          "glue:GetTableVersion",
          "glue:GetTableVersions"
        ]
        Resource = [
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:catalog",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:database/${aws_glue_catalog_database.audit.name}",
          "arn:aws:glue:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${aws_glue_catalog_database.audit.name}/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.firehose.arn}:*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group for Firehose Errors
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "firehose" {
  name              = "/aws/firehose/${local.name_prefix}-audit"
  retention_in_days = 14
  kms_key_id        = aws_kms_key.data_privacy.arn

  tags = local.common_tags
}

resource "aws_cloudwatch_log_stream" "firehose" {
  name           = "delivery-errors"
  log_group_name = aws_cloudwatch_log_group.firehose.name
}

# -----------------------------------------------------------------------------
# Kinesis Firehose Delivery Stream
# -----------------------------------------------------------------------------

resource "aws_kinesis_firehose_delivery_stream" "audit" {
  name        = "${local.name_prefix}-audit-stream"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn            = aws_iam_role.firehose.arn
    bucket_arn          = aws_s3_bucket.audit.arn
    prefix              = "audit/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    error_output_prefix = "errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    buffering_size      = 64
    buffering_interval  = 60
    compression_format  = "UNCOMPRESSED" # Parquet handles compression

    # Enable Parquet format conversion
    data_format_conversion_configuration {
      enabled = true

      input_format_configuration {
        deserializer {
          open_x_json_ser_de {}
        }
      }

      output_format_configuration {
        serializer {
          parquet_ser_de {
            compression = "SNAPPY"
          }
        }
      }

      schema_configuration {
        database_name = aws_glue_catalog_database.audit.name
        table_name    = aws_glue_catalog_table.audit_events.name
        role_arn      = aws_iam_role.firehose.arn
      }
    }

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose.name
      log_stream_name = aws_cloudwatch_log_stream.firehose.name
    }

    # Server-side encryption
    s3_backup_mode = "Disabled"
  }

  server_side_encryption {
    enabled  = true
    key_type = "CUSTOMER_MANAGED_CMK"
    key_arn  = aws_kms_key.data_privacy.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-audit-stream"
  })
}

# -----------------------------------------------------------------------------
# CloudWatch Logs Subscription to Firehose
# -----------------------------------------------------------------------------

resource "aws_iam_role" "cloudwatch_to_firehose" {
  name = "${local.name_prefix}-cw-to-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "cloudwatch_to_firehose" {
  name = "${local.name_prefix}-cw-to-firehose-policy"
  role = aws_iam_role.cloudwatch_to_firehose.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "firehose:PutRecord",
          "firehose:PutRecordBatch"
        ]
        Resource = aws_kinesis_firehose_delivery_stream.audit.arn
      }
    ]
  })
}

# Application audit log group
resource "aws_cloudwatch_log_group" "audit" {
  name              = "/data-privacy/audit"
  retention_in_days = var.audit_log_retention_days
  kms_key_id        = aws_kms_key.data_privacy.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-audit-logs"
  })
}

# Subscription filter to send audit logs to Firehose
resource "aws_cloudwatch_log_subscription_filter" "audit_to_firehose" {
  name            = "${local.name_prefix}-audit-to-firehose"
  log_group_name  = aws_cloudwatch_log_group.audit.name
  filter_pattern  = "" # All logs
  destination_arn = aws_kinesis_firehose_delivery_stream.audit.arn
  role_arn        = aws_iam_role.cloudwatch_to_firehose.arn
}
