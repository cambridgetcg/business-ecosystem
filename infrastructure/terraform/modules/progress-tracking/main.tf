################################################################################
# Progress Tracking Module - Main
################################################################################
#
# This module creates AWS infrastructure for tracking development progress
# across the business-ecosystem monorepo.
#
# Features:
# - S3 storage for progress snapshots and reports
# - DynamoDB for real-time state and history
# - Lambda functions for sync, analysis, and reporting
# - EventBridge schedules for automated sync and reports
# - SNS topics for notifications
# - CloudWatch dashboard and alarms
# - Optional Timestream for time-series metrics
#
# Usage:
#   module "progress_tracking" {
#     source = "./modules/progress-tracking"
#
#     environment        = "dev"
#     project_name       = "ecosystem"
#     github_repo        = "org/business-ecosystem"
#     notification_email = "team@example.com"
#   }
#
################################################################################

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Secrets for GitHub token and Slack webhook
resource "aws_secretsmanager_secret" "github_token" {
  name        = "${local.name_prefix}/github-token"
  description = "GitHub token for accessing repository"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "slack_webhook" {
  count = var.enable_slack_notifications ? 1 : 0

  name        = "${local.name_prefix}/slack-webhook"
  description = "Slack webhook URL for notifications"

  tags = local.common_tags
}

# Set initial secret values (placeholder - update manually or via CI)
resource "aws_secretsmanager_secret_version" "github_token" {
  secret_id = aws_secretsmanager_secret.github_token.id
  secret_string = jsonencode({
    token = "REPLACE_WITH_GITHUB_TOKEN"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret_version" "slack_webhook" {
  count = var.enable_slack_notifications ? 1 : 0

  secret_id = aws_secretsmanager_secret.slack_webhook[0].id
  secret_string = jsonencode({
    url = var.slack_webhook_url != "" ? var.slack_webhook_url : "REPLACE_WITH_SLACK_WEBHOOK"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
