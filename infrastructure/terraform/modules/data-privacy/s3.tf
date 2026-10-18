# =============================================================================
# S3 Audit Bucket for Data Privacy
# =============================================================================
# GDPR Art. 5(1)(f) - Accountability through immutable audit trail
# 7-year retention with lifecycle policies for cost optimization

# -----------------------------------------------------------------------------
# Audit Bucket
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "audit" {
  bucket = "${local.name_prefix}-audit"

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-audit"
    Purpose = "Immutable Audit Trail"
  })
}

# -----------------------------------------------------------------------------
# Bucket Versioning
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_versioning" "audit" {
  bucket = aws_s3_bucket.audit.id

  versioning_configuration {
    status = "Enabled"
  }
}

# -----------------------------------------------------------------------------
# Bucket Encryption (SSE-KMS)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_server_side_encryption_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data_privacy.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# -----------------------------------------------------------------------------
# Block Public Access
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_public_access_block" "audit" {
  bucket = aws_s3_bucket.audit.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# Object Lock Configuration (GOVERNANCE mode for audit compliance)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_object_lock_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = var.audit_s3_retention_days
    }
  }
}

# -----------------------------------------------------------------------------
# Lifecycle Rules
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_lifecycle_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id

  rule {
    id     = "audit-lifecycle"
    status = "Enabled"

    # Transition to Intelligent-Tiering after 90 days
    transition {
      days          = 90
      storage_class = "INTELLIGENT_TIERING"
    }

    # Transition to Glacier after configured days (default 365)
    transition {
      days          = var.audit_glacier_transition_days
      storage_class = "GLACIER"
    }

    # Transition to Deep Archive after configured days (default 730)
    transition {
      days          = var.audit_deep_archive_transition_days
      storage_class = "DEEP_ARCHIVE"
    }

    # Expire after retention period (default 7 years = 2555 days)
    expiration {
      days = var.audit_s3_retention_days
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # Delete old versions after 90 days
  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# -----------------------------------------------------------------------------
# Bucket Policy
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "audit" {
  bucket = aws_s3_bucket.audit.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyInsecureTransport"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.audit.arn,
          "${aws_s3_bucket.audit.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "AllowFirehoseDelivery"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.audit.arn}/*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# DSAR Export Bucket (for data subject access request exports)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "dsar_exports" {
  bucket = "${local.name_prefix}-dsar-exports"

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-dsar-exports"
    Purpose = "DSAR Data Exports"
  })
}

resource "aws_s3_bucket_versioning" "dsar_exports" {
  bucket = aws_s3_bucket.dsar_exports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dsar_exports" {
  bucket = aws_s3_bucket.dsar_exports.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data_privacy.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "dsar_exports" {
  bucket = aws_s3_bucket.dsar_exports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle for DSAR exports - auto-delete after 30 days
resource "aws_s3_bucket_lifecycle_configuration" "dsar_exports" {
  bucket = aws_s3_bucket.dsar_exports.id

  rule {
    id     = "expire-dsar-exports"
    status = "Enabled"

    expiration {
      days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
