################################################################################
# S3 Bucket for UK Tax Service Files
################################################################################
#
# Stores:
# - tax-returns/: CT600, VAT returns, RTI submissions - 7 year HMRC retention
# - supporting-docs/: Invoices, receipts, bank statements - 7 year retention
# - mtd-submissions/: MTD API request/response logs
# - exports/: Generated reports and exports
#
################################################################################

resource "aws_s3_bucket" "files" {
  bucket = "${var.project_name}-${var.environment}-files"

  tags = {
    Name       = "${var.project_name}-${var.environment}-files"
    Purpose    = "tax-documents"
    Compliance = "HMRC"
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "files" {
  bucket = aws_s3_bucket.files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for document audit trail
resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Lifecycle rules for HMRC compliance
resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  # Tax returns: 7 years retention (HMRC requirement)
  rule {
    id     = "tax-returns-lifecycle"
    status = "Enabled"

    filter {
      prefix = "tax-returns/"
    }

    transition {
      days          = 365
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 730 # 2 years
      storage_class = "GLACIER"
    }

    # Keep for 7 years total (HMRC requirement)
    expiration {
      days = 2555 # ~7 years
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 2555
    }
  }

  # Supporting documents: 7 years retention (HMRC requirement)
  rule {
    id     = "supporting-docs-lifecycle"
    status = "Enabled"

    filter {
      prefix = "supporting-docs/"
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
      days = 2555 # ~7 years
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 2555
    }
  }

  # MTD submissions: 2 years retention
  rule {
    id     = "mtd-submissions-lifecycle"
    status = "Enabled"

    filter {
      prefix = "mtd-submissions/"
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    expiration {
      days = 730 # 2 years
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  # Exports: 30 days delete
  rule {
    id     = "exports-lifecycle"
    status = "Enabled"

    filter {
      prefix = "exports/"
    }

    expiration {
      days = 30
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
resource "aws_s3_bucket_cors_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.environment == "production" ? var.allowed_origins : ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Bucket policy for ECS task access
resource "aws_s3_bucket_policy" "files" {
  bucket = aws_s3_bucket.files.id

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
          aws_s3_bucket.files.arn,
          "${aws_s3_bucket.files.arn}/*"
        ]
      }
    ]
  })

  depends_on = [aws_iam_role.ecs_task_role]
}
