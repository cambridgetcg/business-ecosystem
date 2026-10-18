################################################################################
# Audit Logging Infrastructure
################################################################################
#
# Comprehensive audit trail for banking-treasury:
# - CloudTrail for AWS API-level auditing
# - S3 bucket for long-term log storage
# - CloudWatch Logs for application-level auditing
# - Athena for ad-hoc audit queries
# - Glue Catalog for schema management
#
# Retention: 7 years (financial compliance requirement)
#
################################################################################

################################################################################
# S3 Bucket for Audit Logs
################################################################################

resource "aws_s3_bucket" "audit_logs" {
  count = var.enable_audit_logging ? 1 : 0

  bucket = "${local.name_prefix}-audit-logs-${local.account_id}"

  tags = merge(local.common_tags, {
    Purpose = "audit-logs"
  })
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  count = var.enable_audit_logging ? 1 : 0

  bucket = aws_s3_bucket.audit_logs[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  count = var.enable_audit_logging ? 1 : 0

  bucket = aws_s3_bucket.audit_logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.environment == "prod" ? "aws:kms" : "AES256"
      kms_master_key_id = var.environment == "prod" ? aws_kms_key.audit[0].arn : null
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  count = var.enable_audit_logging ? 1 : 0

  bucket = aws_s3_bucket.audit_logs[0].id

  rule {
    id     = "audit-log-lifecycle"
    status = "Enabled"

    # Transition to cheaper storage classes over time
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    transition {
      days          = 730  # 2 years
      storage_class = "DEEP_ARCHIVE"
    }

    # Expire after retention period
    expiration {
      days = var.audit_log_retention_days
    }

    # Clean up old versions
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  count = var.enable_audit_logging ? 1 : 0

  bucket = aws_s3_bucket.audit_logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Object Lock for compliance (prevents deletion)
resource "aws_s3_bucket_object_lock_configuration" "audit_logs" {
  count = var.enable_audit_logging && var.environment == "prod" ? 1 : 0

  bucket = aws_s3_bucket.audit_logs[0].id

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 365  # 1 year minimum lock
    }
  }
}

# KMS key for audit log encryption (production only)
resource "aws_kms_key" "audit" {
  count = var.enable_audit_logging && var.environment == "prod" ? 1 : 0

  description             = "KMS key for banking-treasury audit log encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowRootAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowCloudTrailAccess"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceArn" = "arn:aws:cloudtrail:${local.region}:${local.account_id}:trail/${local.name_prefix}-trail"
          }
        }
      },
      {
        Sid    = "AllowS3Access"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowLogsAccess"
        Effect = "Allow"
        Principal = {
          Service = "logs.${local.region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_kms_alias" "audit" {
  count = var.enable_audit_logging && var.environment == "prod" ? 1 : 0

  name          = "alias/${local.name_prefix}-audit"
  target_key_id = aws_kms_key.audit[0].key_id
}

################################################################################
# CloudTrail
################################################################################

resource "aws_cloudtrail" "banking_treasury" {
  count = var.enable_audit_logging ? 1 : 0

  name                          = "${local.name_prefix}-trail"
  s3_bucket_name                = aws_s3_bucket.audit_logs[0].id
  s3_key_prefix                 = "cloudtrail"
  include_global_service_events = true
  is_multi_region_trail         = false
  enable_logging                = true

  # KMS encryption in production
  kms_key_id = var.environment == "prod" ? aws_kms_key.audit[0].arn : null

  # CloudWatch Logs integration
  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail[0].arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail_cloudwatch[0].arn

  # Enable insights for anomaly detection
  dynamic "insight_selector" {
    for_each = var.enable_cloudtrail_insights ? [1] : []
    content {
      insight_type = "ApiCallRateInsight"
    }
  }

  dynamic "insight_selector" {
    for_each = var.enable_cloudtrail_insights ? [1] : []
    content {
      insight_type = "ApiErrorRateInsight"
    }
  }

  # Event selectors for data events
  event_selector {
    read_write_type           = "All"
    include_management_events = true

    # Log S3 data events for audit bucket
    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.audit_logs[0].arn}/"]
    }
  }

  tags = local.common_tags

  depends_on = [aws_s3_bucket_policy.audit_logs]
}

# S3 bucket policy for CloudTrail
resource "aws_s3_bucket_policy" "audit_logs" {
  count = var.enable_audit_logging ? 1 : 0

  bucket = aws_s3_bucket.audit_logs[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.audit_logs[0].arn
        Condition = {
          StringEquals = {
            "aws:SourceArn" = "arn:aws:cloudtrail:${local.region}:${local.account_id}:trail/${local.name_prefix}-trail"
          }
        }
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.audit_logs[0].arn}/cloudtrail/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl"  = "bucket-owner-full-control"
            "aws:SourceArn" = "arn:aws:cloudtrail:${local.region}:${local.account_id}:trail/${local.name_prefix}-trail"
          }
        }
      },
      {
        Sid    = "AllowFirehoseWrite"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.audit_logs[0].arn}/application-logs/*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = local.account_id
          }
        }
      }
    ]
  })
}

# CloudWatch Log Group for CloudTrail
resource "aws_cloudwatch_log_group" "cloudtrail" {
  count = var.enable_audit_logging ? 1 : 0

  name              = "/aws/cloudtrail/${local.name_prefix}"
  retention_in_days = 90  # Keep recent logs for quick queries

  kms_key_id = var.environment == "prod" ? aws_kms_key.audit[0].arn : null

  tags = local.common_tags
}

# IAM role for CloudTrail to write to CloudWatch Logs
resource "aws_iam_role" "cloudtrail_cloudwatch" {
  count = var.enable_audit_logging ? 1 : 0

  name = "${local.name_prefix}-cloudtrail-cloudwatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "cloudtrail_cloudwatch" {
  count = var.enable_audit_logging ? 1 : 0

  name = "cloudwatch-logs"
  role = aws_iam_role.cloudtrail_cloudwatch[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.cloudtrail[0].arn}:*"
      }
    ]
  })
}

################################################################################
# Application Audit Logs (via Kinesis Firehose)
################################################################################

resource "aws_cloudwatch_log_group" "application_audit" {
  count = var.enable_audit_logging ? 1 : 0

  name              = "/banking-treasury/${var.environment}/audit"
  retention_in_days = 30  # Short-term, streams to S3

  kms_key_id = var.environment == "prod" ? aws_kms_key.audit[0].arn : null

  tags = local.common_tags
}

# Kinesis Firehose to stream application logs to S3
resource "aws_kinesis_firehose_delivery_stream" "audit_logs" {
  count = var.enable_audit_logging ? 1 : 0

  name        = "${local.name_prefix}-audit-firehose"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose[0].arn
    bucket_arn = aws_s3_bucket.audit_logs[0].arn
    prefix     = "application-logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"

    error_output_prefix = "application-logs-errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"

    buffering_size     = 5   # MB
    buffering_interval = 300 # seconds

    compression_format = "GZIP"

    # Convert to Parquet for efficient querying
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
        database_name = aws_glue_catalog_database.audit[0].name
        table_name    = aws_glue_catalog_table.audit_logs[0].name
        role_arn      = aws_iam_role.firehose[0].arn
      }
    }

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.firehose[0].name
      log_stream_name = "S3Delivery"
    }
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "firehose" {
  count = var.enable_audit_logging ? 1 : 0

  name              = "/aws/firehose/${local.name_prefix}-audit"
  retention_in_days = 14

  tags = local.common_tags
}

# IAM role for Firehose
resource "aws_iam_role" "firehose" {
  count = var.enable_audit_logging ? 1 : 0

  name = "${local.name_prefix}-firehose"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "firehose" {
  count = var.enable_audit_logging ? 1 : 0

  name = "firehose-policy"
  role = aws_iam_role.firehose[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetBucketLocation",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.audit_logs[0].arn,
          "${aws_s3_bucket.audit_logs[0].arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetTable",
          "glue:GetTableVersion",
          "glue:GetTableVersions"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.firehose[0].arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.environment == "prod" ? aws_kms_key.audit[0].arn : "*"
      }
    ]
  })
}

# CloudWatch Logs subscription to Firehose
resource "aws_cloudwatch_log_subscription_filter" "audit_to_firehose" {
  count = var.enable_audit_logging ? 1 : 0

  name            = "${local.name_prefix}-audit-subscription"
  log_group_name  = aws_cloudwatch_log_group.application_audit[0].name
  filter_pattern  = ""  # All logs
  destination_arn = aws_kinesis_firehose_delivery_stream.audit_logs[0].arn
  role_arn        = aws_iam_role.cloudwatch_to_firehose[0].arn
}

resource "aws_iam_role" "cloudwatch_to_firehose" {
  count = var.enable_audit_logging ? 1 : 0

  name = "${local.name_prefix}-cwl-to-firehose"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "logs.${local.region}.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "cloudwatch_to_firehose" {
  count = var.enable_audit_logging ? 1 : 0

  name = "firehose-put"
  role = aws_iam_role.cloudwatch_to_firehose[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "firehose:PutRecord"
        Resource = aws_kinesis_firehose_delivery_stream.audit_logs[0].arn
      }
    ]
  })
}

################################################################################
# Glue Catalog for Athena Queries
################################################################################

resource "aws_glue_catalog_database" "audit" {
  count = var.enable_audit_logging ? 1 : 0

  name = replace("${local.name_prefix}-audit", "-", "_")

  description = "Banking-Treasury audit log database"
}

resource "aws_glue_catalog_table" "audit_logs" {
  count = var.enable_audit_logging ? 1 : 0

  database_name = aws_glue_catalog_database.audit[0].name
  name          = "application_audit_logs"

  table_type = "EXTERNAL_TABLE"

  parameters = {
    classification = "parquet"
    "parquet.compression" = "SNAPPY"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.audit_logs[0].id}/application-logs/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
    }

    columns {
      name = "timestamp"
      type = "timestamp"
    }

    columns {
      name = "event_type"
      type = "string"
    }

    columns {
      name = "actor_id"
      type = "string"
    }

    columns {
      name = "actor_type"
      type = "string"
    }

    columns {
      name = "resource_type"
      type = "string"
    }

    columns {
      name = "resource_id"
      type = "string"
    }

    columns {
      name = "action"
      type = "string"
    }

    columns {
      name = "before_state"
      type = "string"
    }

    columns {
      name = "after_state"
      type = "string"
    }

    columns {
      name = "metadata"
      type = "string"
    }

    columns {
      name = "request_id"
      type = "string"
    }

    columns {
      name = "ip_address"
      type = "string"
    }
  }

  partition_keys {
    name = "year"
    type = "string"
  }

  partition_keys {
    name = "month"
    type = "string"
  }

  partition_keys {
    name = "day"
    type = "string"
  }
}

################################################################################
# Athena Workgroup for Queries
################################################################################

resource "aws_athena_workgroup" "audit" {
  count = var.enable_audit_logging ? 1 : 0

  name = "${local.name_prefix}-audit-queries"

  configuration {
    result_configuration {
      output_location = "s3://${aws_s3_bucket.audit_logs[0].id}/athena-results/"

      encryption_configuration {
        encryption_option = var.environment == "prod" ? "SSE_KMS" : "SSE_S3"
        kms_key_arn       = var.environment == "prod" ? aws_kms_key.audit[0].arn : null
      }
    }

    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    bytes_scanned_cutoff_per_query = 10737418240  # 10 GB limit
  }

  tags = local.common_tags
}

# Example saved queries for common audit tasks
resource "aws_athena_named_query" "payments_by_user" {
  count = var.enable_audit_logging ? 1 : 0

  name        = "Payments by User"
  description = "Find all payment events by a specific user"
  workgroup   = aws_athena_workgroup.audit[0].name
  database    = aws_glue_catalog_database.audit[0].name

  query = <<-EOQ
    SELECT
      timestamp,
      event_type,
      resource_id as payment_id,
      action,
      metadata
    FROM application_audit_logs
    WHERE actor_id = 'USER_ID_HERE'
      AND resource_type = 'Payment'
      AND year = '2026'
    ORDER BY timestamp DESC
    LIMIT 100
  EOQ
}

resource "aws_athena_named_query" "balance_changes" {
  count = var.enable_audit_logging ? 1 : 0

  name        = "Balance Changes by Account"
  description = "Find all balance changes for a specific account"
  workgroup   = aws_athena_workgroup.audit[0].name
  database    = aws_glue_catalog_database.audit[0].name

  query = <<-EOQ
    SELECT
      timestamp,
      event_type,
      before_state,
      after_state,
      actor_id,
      metadata
    FROM application_audit_logs
    WHERE resource_type = 'BankAccount'
      AND resource_id = 'ACCOUNT_ID_HERE'
      AND action IN ('balance_update', 'credit', 'debit')
    ORDER BY timestamp DESC
    LIMIT 100
  EOQ
}

resource "aws_athena_named_query" "failed_payments" {
  count = var.enable_audit_logging ? 1 : 0

  name        = "Failed Payments Last 7 Days"
  description = "Find all failed payment attempts in the last 7 days"
  workgroup   = aws_athena_workgroup.audit[0].name
  database    = aws_glue_catalog_database.audit[0].name

  query = <<-EOQ
    SELECT
      timestamp,
      resource_id as payment_id,
      actor_id,
      metadata
    FROM application_audit_logs
    WHERE resource_type = 'Payment'
      AND event_type = 'Payment.Failed'
      AND timestamp >= current_timestamp - interval '7' day
    ORDER BY timestamp DESC
  EOQ
}
