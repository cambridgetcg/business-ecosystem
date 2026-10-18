################################################################################
# Intellectual Property Service Infrastructure
################################################################################
#
# This configuration provisions AWS resources for the IP service:
#
# Resources:
# - S3 buckets (documents, trade secrets with tiered encryption)
# - KMS keys (standard for docs, dedicated for trade secrets)
# - DynamoDB tables (deadlines, patent state, trademark state)
# - EventBridge (IP domain events)
# - SNS topics (alerts, notifications)
# - CloudWatch (audit logging)
#
################################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration - uncomment for remote state
  # backend "s3" {
  #   bucket         = "ecosystem-terraform-state"
  #   key            = "intellectual-property/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "business-ecosystem"
      Service     = "intellectual-property"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name_prefix = "ip-service-${var.environment}"
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name

  common_tags = {
    Service     = "intellectual-property"
    Environment = var.environment
  }
}

################################################################################
# KMS Keys - Tiered Encryption
################################################################################

# Standard KMS key for general IP documents
resource "aws_kms_key" "ip_documents" {
  description             = "KMS key for IP document encryption"
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
        Sid    = "Allow S3 Service"
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
      }
    ]
  })

  tags = merge(local.common_tags, {
    Purpose = "document-encryption"
  })
}

resource "aws_kms_alias" "ip_documents" {
  name          = "alias/${local.name_prefix}-documents"
  target_key_id = aws_kms_key.ip_documents.key_id
}

# Dedicated high-security KMS key for trade secrets
resource "aws_kms_key" "trade_secrets" {
  description             = "High-security KMS key for trade secret encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  # Stricter policy for trade secrets
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
        Sid    = "Allow S3 Service"
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
      }
    ]
  })

  tags = merge(local.common_tags, {
    Purpose          = "trade-secret-encryption"
    SecurityLevel    = "high"
    ComplianceScope  = "confidential"
  })
}

resource "aws_kms_alias" "trade_secrets" {
  name          = "alias/${local.name_prefix}-trade-secrets"
  target_key_id = aws_kms_key.trade_secrets.key_id
}

# KMS key for SNS encryption
resource "aws_kms_key" "sns" {
  count = var.environment == "prod" ? 1 : 0

  description             = "KMS key for IP service SNS encryption"
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
        Sid    = "Allow SNS Service"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow EventBridge"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

################################################################################
# S3 Buckets - Document Storage
################################################################################

# General IP documents bucket (patents, trademarks, copyrights, licenses)
resource "aws_s3_bucket" "ip_documents" {
  bucket = "${local.name_prefix}-documents"

  tags = merge(local.common_tags, {
    Purpose = "ip-document-storage"
  })
}

resource "aws_s3_bucket_versioning" "ip_documents" {
  bucket = aws_s3_bucket.ip_documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ip_documents" {
  bucket = aws_s3_bucket.ip_documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.ip_documents.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "ip_documents" {
  bucket = aws_s3_bucket.ip_documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rules for IP documents (long retention)
resource "aws_s3_bucket_lifecycle_configuration" "ip_documents" {
  bucket = aws_s3_bucket.ip_documents.id

  # Patent documents - 20 year retention (patent term)
  rule {
    id     = "patent-lifecycle"
    status = "Enabled"

    filter {
      prefix = "patents/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 2555 # 7 years
      storage_class = "GLACIER"
    }

    expiration {
      days = 7300 # 20 years
    }
  }

  # Trademark documents - 14 year retention
  rule {
    id     = "trademark-lifecycle"
    status = "Enabled"

    filter {
      prefix = "trademarks/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 2555
      storage_class = "GLACIER"
    }

    expiration {
      days = 5110 # 14 years
    }
  }

  # Copyright documents - lifetime + 70 years (use 100 years max)
  rule {
    id     = "copyright-lifecycle"
    status = "Enabled"

    filter {
      prefix = "copyrights/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 2555
      storage_class = "GLACIER_DEEP_ARCHIVE"
    }

    # No expiration - copyrights are perpetual
  }

  # Domain name documents - 10 year retention
  rule {
    id     = "domain-lifecycle"
    status = "Enabled"

    filter {
      prefix = "domains/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 1825 # 5 years
      storage_class = "GLACIER"
    }

    expiration {
      days = 3650 # 10 years
    }
  }

  # License agreements - 7 year retention after termination
  rule {
    id     = "license-lifecycle"
    status = "Enabled"

    filter {
      prefix = "licenses/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 2555
      storage_class = "GLACIER"
    }
  }
}

# Trade secrets bucket (highest security)
resource "aws_s3_bucket" "trade_secrets" {
  bucket = "${local.name_prefix}-trade-secrets"

  tags = merge(local.common_tags, {
    Purpose         = "trade-secret-storage"
    SecurityLevel   = "high"
    ComplianceScope = "confidential"
  })
}

resource "aws_s3_bucket_versioning" "trade_secrets" {
  bucket = aws_s3_bucket.trade_secrets.id

  versioning_configuration {
    status = "Enabled"
    # MFA delete enabled in production via AWS CLI (requires MFA)
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "trade_secrets" {
  bucket = aws_s3_bucket.trade_secrets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.trade_secrets.arn # Dedicated high-security key
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "trade_secrets" {
  bucket = aws_s3_bucket.trade_secrets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Trade secrets - no expiration, indefinite retention
resource "aws_s3_bucket_lifecycle_configuration" "trade_secrets" {
  bucket = aws_s3_bucket.trade_secrets.id

  rule {
    id     = "trade-secret-lifecycle"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 730 # 2 years
      storage_class = "STANDARD_IA"
    }

    # No transition to Glacier - trade secrets need quick access
    # No expiration - trade secrets are perpetual until disclosed
  }
}

################################################################################
# DynamoDB Tables - Deadline & State Tracking
################################################################################

# IP Deadlines table (maintenance fees, renewals, response deadlines)
resource "aws_dynamodb_table" "ip_deadlines" {
  name         = "${local.name_prefix}-deadlines"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  # GSI for querying deadlines by status and due date
  global_secondary_index {
    name            = "gsi1-status-deadline"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  # TTL for completed/expired deadlines (cleanup after 1 year)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.ip_documents.arn
  }

  # Enable DynamoDB Streams for deadline escalation Lambda
  stream_enabled   = var.enable_deadline_lambda
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = merge(local.common_tags, {
    Purpose = "deadline-tracking"
  })
}

# IP Events/Milestones table (for event sourcing and history)
resource "aws_dynamodb_table" "ip_events" {
  name         = "${local.name_prefix}-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "eventType"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  # GSI for querying events by type
  global_secondary_index {
    name            = "gsi1-event-type"
    hash_key        = "eventType"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # Enable DynamoDB Streams for event processing
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # Point-in-time recovery
  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  # Encryption
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.ip_documents.arn
  }

  tags = merge(local.common_tags, {
    Purpose = "event-sourcing"
  })
}

################################################################################
# CloudWatch Log Groups - Audit Logging
################################################################################

resource "aws_cloudwatch_log_group" "ip_audit" {
  name              = "/ip-service/${var.environment}/audit"
  retention_in_days = var.audit_log_retention_cloudwatch

  kms_key_id = aws_kms_key.ip_documents.arn

  tags = merge(local.common_tags, {
    Purpose = "audit-logging"
  })
}

resource "aws_cloudwatch_log_group" "ip_application" {
  name              = "/ip-service/${var.environment}/application"
  retention_in_days = var.application_log_retention_days

  tags = merge(local.common_tags, {
    Purpose = "application-logging"
  })
}

# Trade secret access log (separate, higher retention)
resource "aws_cloudwatch_log_group" "trade_secret_access" {
  name              = "/ip-service/${var.environment}/trade-secret-access"
  retention_in_days = var.audit_log_retention_cloudwatch

  kms_key_id = aws_kms_key.trade_secrets.arn

  tags = merge(local.common_tags, {
    Purpose       = "trade-secret-audit"
    SecurityLevel = "high"
  })
}

################################################################################
# IAM Role for IP Service
################################################################################

resource "aws_iam_role" "ip_service" {
  name = "${local.name_prefix}-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "ecs-tasks.amazonaws.com",
            "lambda.amazonaws.com"
          ]
        }
      }
    ]
  })

  tags = local.common_tags
}

# S3 access policy
resource "aws_iam_role_policy" "ip_s3_access" {
  name = "${local.name_prefix}-s3-access"
  role = aws_iam_role.ip_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.ip_documents.arn,
          "${aws_s3_bucket.ip_documents.arn}/*",
          aws_s3_bucket.trade_secrets.arn,
          "${aws_s3_bucket.trade_secrets.arn}/*"
        ]
      }
    ]
  })
}

# KMS access policy
resource "aws_iam_role_policy" "ip_kms_access" {
  name = "${local.name_prefix}-kms-access"
  role = aws_iam_role.ip_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = [
          aws_kms_key.ip_documents.arn,
          aws_kms_key.trade_secrets.arn
        ]
      }
    ]
  })
}

# DynamoDB access policy
resource "aws_iam_role_policy" "ip_dynamodb_access" {
  name = "${local.name_prefix}-dynamodb-access"
  role = aws_iam_role.ip_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.ip_deadlines.arn,
          "${aws_dynamodb_table.ip_deadlines.arn}/index/*",
          aws_dynamodb_table.ip_events.arn,
          "${aws_dynamodb_table.ip_events.arn}/index/*"
        ]
      }
    ]
  })
}

# CloudWatch Logs access policy
resource "aws_iam_role_policy" "ip_cloudwatch_access" {
  name = "${local.name_prefix}-cloudwatch-access"
  role = aws_iam_role.ip_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.ip_audit.arn}:*",
          "${aws_cloudwatch_log_group.ip_application.arn}:*",
          "${aws_cloudwatch_log_group.trade_secret_access.arn}:*"
        ]
      }
    ]
  })
}
