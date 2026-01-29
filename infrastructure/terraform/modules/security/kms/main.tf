# KMS Module for Business Ecosystem
# Service-specific encryption keys with compliance requirements

variable "environment" {
  type = string
}

variable "enable_key_rotation" {
  type    = bool
  default = true
}

variable "deletion_window" {
  type    = number
  default = 30
}

locals {
  name_prefix = "ecosystem-${var.environment}"
  
  # Define key purposes and their compliance requirements
  keys = {
    rds = {
      description = "RDS database encryption"
      policy_services = ["rds.amazonaws.com"]
    }
    secrets = {
      description = "Secrets Manager encryption"
      policy_services = ["secretsmanager.amazonaws.com"]
    }
    s3 = {
      description = "S3 bucket encryption"
      policy_services = ["s3.amazonaws.com"]
    }
    logs = {
      description = "CloudWatch Logs encryption"
      policy_services = ["logs.amazonaws.com"]
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# KMS Keys
resource "aws_kms_key" "keys" {
  for_each = local.keys

  description             = "${local.name_prefix} - ${each.value.description}"
  deletion_window_in_days = var.deletion_window
  enable_key_rotation     = var.enable_key_rotation

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "AllowServiceAccess"
        Effect = "Allow"
        Principal = {
          Service = each.value.policy_services
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${local.name_prefix}-${each.key}"
    Environment = var.environment
    Purpose     = each.key
  }
}

resource "aws_kms_alias" "keys" {
  for_each = local.keys

  name          = "alias/${local.name_prefix}-${each.key}"
  target_key_id = aws_kms_key.keys[each.key].key_id
}

# Outputs
output "key_arns" {
  description = "Map of key purpose to ARN"
  value       = { for k, v in aws_kms_key.keys : k => v.arn }
}

output "key_ids" {
  description = "Map of key purpose to ID"
  value       = { for k, v in aws_kms_key.keys : k => v.key_id }
}

output "rds_key_arn" {
  value = aws_kms_key.keys["rds"].arn
}

output "secrets_key_arn" {
  value = aws_kms_key.keys["secrets"].arn
}

output "s3_key_arn" {
  value = aws_kms_key.keys["s3"].arn
}

output "logs_key_arn" {
  value = aws_kms_key.keys["logs"].arn
}
