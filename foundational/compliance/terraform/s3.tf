################################################################################
# S3 Bucket for Compliance Documents and Evidence
################################################################################
#
# Stores:
# - evidence/: Compliance evidence and supporting documents
# - policies/: Policy documents and procedures
# - audits/: Audit reports and assessments
# - exports/: Generated compliance reports
#
# Retention: 7+ years for regulatory compliance (SOX, GDPR, etc.)
#
################################################################################

resource "aws_s3_bucket" "compliance_documents" {
  bucket = "${var.project_name}-${var.environment}-documents"

  tags = {
    Name        = "${var.project_name}-${var.environment}-documents"
    Purpose     = "compliance-documents"
    Compliance  = "SOX-GDPR"
    Retention   = "7-years"
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "compliance_documents" {
  bucket = aws_s3_bucket.compliance_documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for document audit trail
resource "aws_s3_bucket_versioning" "compliance_documents" {
  bucket = aws_s3_bucket.compliance_documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption with KMS for compliance data
resource "aws_s3_bucket_server_side_encryption_configuration" "compliance_documents" {
  bucket = aws_s3_bucket.compliance_documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Object lock configuration for immutable audit records
resource "aws_s3_bucket_object_lock_configuration" "compliance_documents" {
  count  = var.environment == "production" ? 1 : 0
  bucket = aws_s3_bucket.compliance_documents.id

  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 2555  # ~7 years
    }
  }
}

# Lifecycle rules for different document types
resource "aws_s3_bucket_lifecycle_configuration" "compliance_documents" {
  bucket = aws_s3_bucket.compliance_documents.id

  # Evidence: 7 years retention (regulatory requirement)
  rule {
    id     = "evidence-lifecycle"
    status = "Enabled"

    filter {
      prefix = "evidence/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 730  # 2 years
      storage_class = "GLACIER"
    }

    # Keep for 7 years total - then move to deep archive
    transition {
      days          = 2555  # ~7 years
      storage_class = "DEEP_ARCHIVE"
    }

    # Delete after 10 years
    expiration {
      days = 3650
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 3650
    }
  }

  # Policies: Long-term retention
  rule {
    id     = "policies-lifecycle"
    status = "Enabled"

    filter {
      prefix = "policies/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 730
      storage_class = "GLACIER"
    }

    # Keep policy documents for 10 years
    expiration {
      days = 3650
    }

    noncurrent_version_expiration {
      noncurrent_days = 3650
    }
  }

  # Audits: 7 years retention (SOX/regulatory)
  rule {
    id     = "audits-lifecycle"
    status = "Enabled"

    filter {
      prefix = "audits/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 730
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555  # ~7 years
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 2555
    }
  }

  # Exports: 90 days delete (temporary reports)
  rule {
    id     = "exports-lifecycle"
    status = "Enabled"

    filter {
      prefix = "exports/"
    }

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }

  # Clean up incomplete multipart uploads
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {
      prefix = ""
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CORS configuration for presigned URL uploads
resource "aws_s3_bucket_cors_configuration" "compliance_documents" {
  bucket = aws_s3_bucket.compliance_documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.environment == "production" ? var.allowed_origins : ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Bucket policy for ECS task access
resource "aws_s3_bucket_policy" "compliance_documents" {
  bucket = aws_s3_bucket.compliance_documents.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowECSTaskAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_task_role.arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.compliance_documents.arn,
          "${aws_s3_bucket.compliance_documents.arn}/*"
        ]
      },
      {
        Sid    = "DenyUnencryptedUploads"
        Effect = "Deny"
        Principal = "*"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.compliance_documents.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
        }
      }
    ]
  })

  depends_on = [aws_iam_role.ecs_task_role]
}

# =============================================================================
# S3 Access Logging Bucket (for audit compliance)
# =============================================================================

resource "aws_s3_bucket" "access_logs" {
  bucket = "${var.project_name}-${var.environment}-access-logs"

  tags = {
    Name    = "${var.project_name}-${var.environment}-access-logs"
    Purpose = "s3-access-logging"
  }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# Enable access logging on compliance documents bucket
resource "aws_s3_bucket_logging" "compliance_documents" {
  bucket = aws_s3_bucket.compliance_documents.id

  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "compliance-documents/"
}
