################################################################################
# Progress Tracking Module - S3 Storage
################################################################################

# Main progress bucket for snapshots and reports
resource "aws_s3_bucket" "progress" {
  bucket = "${local.name_prefix}-data"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-data"
  })
}

# Enable versioning for audit trail
resource "aws_s3_bucket_versioning" "progress" {
  bucket = aws_s3_bucket.progress.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "progress" {
  bucket = aws_s3_bucket.progress.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "progress" {
  bucket = aws_s3_bucket.progress.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rules for cost optimization
resource "aws_s3_bucket_lifecycle_configuration" "progress" {
  bucket = aws_s3_bucket.progress.id

  rule {
    id     = "snapshots-lifecycle"
    status = "Enabled"

    filter {
      prefix = "snapshots/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = var.snapshot_retention_days + 180
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "reports-lifecycle"
    status = "Enabled"

    filter {
      prefix = "reports/"
    }

    transition {
      days          = 60
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 365
    }
  }

  rule {
    id     = "cleanup-incomplete-uploads"
    status = "Enabled"

    filter {
      prefix = ""
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Bucket policy for Lambda access
resource "aws_s3_bucket_policy" "progress" {
  bucket = aws_s3_bucket.progress.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.lambda_execution.arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.progress.arn,
          "${aws_s3_bucket.progress.arn}/*"
        ]
      }
    ]
  })
}

# S3 event notification for new snapshots
resource "aws_s3_bucket_notification" "progress" {
  bucket = aws_s3_bucket.progress.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.comparator.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "snapshots/"
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.s3_invoke_comparator]
}
