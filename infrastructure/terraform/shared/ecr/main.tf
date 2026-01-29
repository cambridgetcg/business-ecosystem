# ECR Module for Business Ecosystem
# Container registries for all services

variable "environment" {
  type    = string
  default = "shared"
}

variable "services" {
  type = list(string)
  default = [
    "accounting",
    "kyc-identity",
    "tax",
    "compliance",
    "corporate-security",
    "entity-governance",
    "banking-treasury",
    "contracts-legal",
    "data-privacy",
    "intellectual-property",
    "insurance"
  ]
}

variable "image_retention_count" {
  type    = number
  default = 30
}

variable "scan_on_push" {
  type    = bool
  default = true
}

locals {
  name_prefix = "ecosystem"
}

# ECR Repositories
resource "aws_ecr_repository" "services" {
  for_each = toset(var.services)

  name                 = "${local.name_prefix}/${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Service = each.key
  }
}

# Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "services" {
  for_each = toset(var.services)

  repository = aws_ecr_repository.services[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.image_retention_count} images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = var.image_retention_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Outputs
output "repository_urls" {
  description = "Map of service name to ECR repository URL"
  value       = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}

output "repository_arns" {
  description = "Map of service name to ECR repository ARN"
  value       = { for k, v in aws_ecr_repository.services : k => v.arn }
}
