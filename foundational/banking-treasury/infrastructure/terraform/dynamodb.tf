################################################################################
# DynamoDB - Hot Cash Position Store
################################################################################
#
# Real-time cash position data with <1 minute freshness requirement.
# Uses DynamoDB for:
# - Microsecond read latency
# - Auto-scaling for variable load
# - Streams for change data capture
# - TTL for automatic data refresh triggers
#
################################################################################

################################################################################
# Cash Position Table
################################################################################

resource "aws_dynamodb_table" "cash_positions" {
  name         = "${local.name_prefix}-cash-positions"
  billing_mode = var.environment == "prod" ? "PROVISIONED" : "PAY_PER_REQUEST"

  # Partition: entity_id (account, entity, or business unit)
  # Sort: currency_timestamp (currency + ISO timestamp for time-series)
  hash_key  = "entity_id"
  range_key = "currency_timestamp"

  # Provisioned capacity for production (with auto-scaling)
  dynamic "read_capacity" {
    for_each = var.environment == "prod" ? [1] : []
    content {
      # Placeholder - actual value set via auto-scaling
    }
  }

  read_capacity  = var.environment == "prod" ? var.dynamodb_read_capacity : null
  write_capacity = var.environment == "prod" ? var.dynamodb_write_capacity : null

  # Primary key attributes
  attribute {
    name = "entity_id"
    type = "S"
  }

  attribute {
    name = "currency_timestamp"
    type = "S"
  }

  # GSI attributes
  attribute {
    name = "account_id"
    type = "S"
  }

  attribute {
    name = "currency"
    type = "S"
  }

  attribute {
    name = "updated_at"
    type = "S"
  }

  # GSI: Query by account
  global_secondary_index {
    name            = "account-index"
    hash_key        = "account_id"
    range_key       = "updated_at"
    projection_type = "ALL"

    read_capacity  = var.environment == "prod" ? var.dynamodb_read_capacity : null
    write_capacity = var.environment == "prod" ? var.dynamodb_write_capacity : null
  }

  # GSI: Query by currency for consolidated views
  global_secondary_index {
    name            = "currency-index"
    hash_key        = "currency"
    range_key       = "updated_at"
    projection_type = "ALL"

    read_capacity  = var.environment == "prod" ? var.dynamodb_read_capacity : null
    write_capacity = var.environment == "prod" ? var.dynamodb_write_capacity : null
  }

  # TTL for automatic cleanup of old position snapshots
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  # Enable DynamoDB Streams for change data capture
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # Point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Server-side encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.environment == "prod" ? aws_kms_key.dynamodb[0].arn : null
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-cash-positions"
    Purpose = "real-time-cash-positions"
  })
}

################################################################################
# Transaction Ledger Table (Hot Path)
################################################################################

resource "aws_dynamodb_table" "transaction_ledger" {
  name         = "${local.name_prefix}-transaction-ledger"
  billing_mode = var.environment == "prod" ? "PROVISIONED" : "PAY_PER_REQUEST"

  # Partition: account_id
  # Sort: transaction_id (ULID for natural time ordering)
  hash_key  = "account_id"
  range_key = "transaction_id"

  read_capacity  = var.environment == "prod" ? var.dynamodb_read_capacity : null
  write_capacity = var.environment == "prod" ? var.dynamodb_write_capacity : null

  attribute {
    name = "account_id"
    type = "S"
  }

  attribute {
    name = "transaction_id"
    type = "S"
  }

  attribute {
    name = "payment_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  # GSI: Query by payment for multi-leg transactions
  global_secondary_index {
    name            = "payment-index"
    hash_key        = "payment_id"
    range_key       = "created_at"
    projection_type = "ALL"

    read_capacity  = var.environment == "prod" ? var.dynamodb_read_capacity : null
    write_capacity = var.environment == "prod" ? var.dynamodb_write_capacity : null
  }

  # Enable streams for transaction processing
  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.environment == "prod" ? aws_kms_key.dynamodb[0].arn : null
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-transaction-ledger"
    Purpose = "hot-transaction-ledger"
  })
}

################################################################################
# Payment Status Table (Real-time tracking)
################################################################################

resource "aws_dynamodb_table" "payment_status" {
  name         = "${local.name_prefix}-payment-status"
  billing_mode = var.environment == "prod" ? "PROVISIONED" : "PAY_PER_REQUEST"

  hash_key = "payment_id"

  read_capacity  = var.environment == "prod" ? var.dynamodb_read_capacity : null
  write_capacity = var.environment == "prod" ? var.dynamodb_write_capacity : null

  attribute {
    name = "payment_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "updated_at"
    type = "S"
  }

  attribute {
    name = "source_account"
    type = "S"
  }

  # GSI: Query by status for dashboard/monitoring
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "updated_at"
    projection_type = "ALL"

    read_capacity  = var.environment == "prod" ? var.dynamodb_read_capacity : null
    write_capacity = var.environment == "prod" ? var.dynamodb_write_capacity : null
  }

  # GSI: Query by source account
  global_secondary_index {
    name            = "source-account-index"
    hash_key        = "source_account"
    range_key       = "updated_at"
    projection_type = "ALL"

    read_capacity  = var.environment == "prod" ? var.dynamodb_read_capacity : null
    write_capacity = var.environment == "prod" ? var.dynamodb_write_capacity : null
  }

  # TTL for completed payments (archive to cold storage after 30 days)
  ttl {
    attribute_name = "archive_at"
    enabled        = true
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.environment == "prod" ? aws_kms_key.dynamodb[0].arn : null
  }

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-payment-status"
    Purpose = "real-time-payment-tracking"
  })
}

################################################################################
# KMS Key for DynamoDB Encryption
################################################################################

resource "aws_kms_key" "dynamodb" {
  count = var.environment == "prod" ? 1 : 0

  description             = "KMS key for banking-treasury DynamoDB encryption"
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
        Sid    = "Allow DynamoDB Service"
        Effect = "Allow"
        Principal = {
          Service = "dynamodb.amazonaws.com"
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

resource "aws_kms_alias" "dynamodb" {
  count = var.environment == "prod" ? 1 : 0

  name          = "alias/${local.name_prefix}-dynamodb"
  target_key_id = aws_kms_key.dynamodb[0].key_id
}

################################################################################
# Auto-Scaling (Production)
################################################################################

# Cash Positions Table - Read Scaling
resource "aws_appautoscaling_target" "cash_positions_read" {
  count = var.environment == "prod" ? 1 : 0

  max_capacity       = var.dynamodb_max_read_capacity
  min_capacity       = var.dynamodb_read_capacity
  resource_id        = "table/${aws_dynamodb_table.cash_positions.name}"
  scalable_dimension = "dynamodb:table:ReadCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "cash_positions_read" {
  count = var.environment == "prod" ? 1 : 0

  name               = "${local.name_prefix}-cash-positions-read-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.cash_positions_read[0].resource_id
  scalable_dimension = aws_appautoscaling_target.cash_positions_read[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.cash_positions_read[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBReadCapacityUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

# Cash Positions Table - Write Scaling
resource "aws_appautoscaling_target" "cash_positions_write" {
  count = var.environment == "prod" ? 1 : 0

  max_capacity       = var.dynamodb_max_write_capacity
  min_capacity       = var.dynamodb_write_capacity
  resource_id        = "table/${aws_dynamodb_table.cash_positions.name}"
  scalable_dimension = "dynamodb:table:WriteCapacityUnits"
  service_namespace  = "dynamodb"
}

resource "aws_appautoscaling_policy" "cash_positions_write" {
  count = var.environment == "prod" ? 1 : 0

  name               = "${local.name_prefix}-cash-positions-write-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.cash_positions_write[0].resource_id
  scalable_dimension = aws_appautoscaling_target.cash_positions_write[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.cash_positions_write[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "DynamoDBWriteCapacityUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

################################################################################
# CloudWatch Alarms
################################################################################

resource "aws_cloudwatch_metric_alarm" "cash_positions_throttled_reads" {
  count = var.environment == "prod" ? 1 : 0

  alarm_name          = "${local.name_prefix}-cash-positions-throttled-reads"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReadThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Cash positions table experiencing read throttling"

  dimensions = {
    TableName = aws_dynamodb_table.cash_positions.name
  }

  alarm_actions = var.alert_email != "" ? [aws_sns_topic.alerts[0].arn] : []
  ok_actions    = var.alert_email != "" ? [aws_sns_topic.alerts[0].arn] : []

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "cash_positions_throttled_writes" {
  count = var.environment == "prod" ? 1 : 0

  alarm_name          = "${local.name_prefix}-cash-positions-throttled-writes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "WriteThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Cash positions table experiencing write throttling"

  dimensions = {
    TableName = aws_dynamodb_table.cash_positions.name
  }

  alarm_actions = var.alert_email != "" ? [aws_sns_topic.alerts[0].arn] : []
  ok_actions    = var.alert_email != "" ? [aws_sns_topic.alerts[0].arn] : []

  tags = local.common_tags
}

# Alert SNS topic (conditional)
resource "aws_sns_topic" "alerts" {
  count = var.alert_email != "" ? 1 : 0

  name = "${local.name_prefix}-dynamodb-alerts"
  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count = var.alert_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}
