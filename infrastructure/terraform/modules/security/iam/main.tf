# IAM Module for Business Ecosystem
# Service IAM roles with permission boundaries

variable "environment" {
  type = string
}

variable "services" {
  type = list(object({
    name               = string
    secret_arns        = list(string)
    additional_policies = list(string)
  }))
  default = []
}

locals {
  name_prefix = "ecosystem-${var.environment}"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Permission Boundary - limits what service roles can do
resource "aws_iam_policy" "permission_boundary" {
  name        = "${local.name_prefix}-permission-boundary"
  description = "Permission boundary for ecosystem service roles"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowedActions"
        Effect = "Allow"
        Action = [
          "logs:*",
          "xray:*",
          "secretsmanager:GetSecretValue",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sns:Publish",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "rds-db:connect"
        ]
        Resource = "*"
      },
      {
        Sid      = "DenyIAMAdmin"
        Effect   = "Deny"
        Action   = [
          "iam:*User*",
          "iam:*Group*",
          "iam:*Policy*",
          "iam:*Role*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# ECS Task Execution Role (shared)
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  permissions_boundary = aws_iam_policy.permission_boundary.arn

  tags = {
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "kms:Decrypt"
      ]
      Resource = "*"
    }]
  })
}

# Per-Service Task Roles
resource "aws_iam_role" "service_task" {
  for_each = { for s in var.services : s.name => s }

  name = "${local.name_prefix}-${each.key}-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  permissions_boundary = aws_iam_policy.permission_boundary.arn

  tags = {
    Environment = var.environment
    Service     = each.key
  }
}

resource "aws_iam_role_policy" "service_secrets" {
  for_each = { for s in var.services : s.name => s if length(s.secret_arns) > 0 }

  name = "${local.name_prefix}-${each.key}-secrets"
  role = aws_iam_role.service_task[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = each.value.secret_arns
    }]
  })
}

resource "aws_iam_role_policy" "service_base" {
  for_each = { for s in var.services : s.name => s }

  name = "${local.name_prefix}-${each.key}-base"
  role = aws_iam_role.service_task[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/${local.name_prefix}*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

# Outputs
output "permission_boundary_arn" {
  value = aws_iam_policy.permission_boundary.arn
}

output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "service_task_role_arns" {
  value = { for k, v in aws_iam_role.service_task : k => v.arn }
}
