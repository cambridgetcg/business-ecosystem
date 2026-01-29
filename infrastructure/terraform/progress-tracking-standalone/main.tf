# Progress Tracking - Standalone Deployment
# Uses local state for easy testing

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Local state for testing
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "business-ecosystem"
      Environment = var.environment
      ManagedBy   = "terraform"
      Component   = "progress-tracking"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository in format owner/repo"
  default     = "your-org/business-ecosystem"
}

variable "notification_email" {
  type        = string
  description = "Email for notifications"
  default     = ""
}

module "progress_tracking" {
  source = "../modules/progress-tracking"

  environment  = var.environment
  project_name = "ecosystem"
  aws_region   = var.aws_region

  github_repo   = var.github_repo
  github_branch = "main"

  notification_email         = var.notification_email
  enable_slack_notifications = false
  enable_email_notifications = var.notification_email != ""

  enable_timestream = false
  enable_quicksight = false

  snapshot_retention_days = 30

  tags = {
    Component = "progress-tracking"
  }
}

output "summary" {
  value = module.progress_tracking.summary
}

output "webhook_url" {
  value     = module.progress_tracking.lambda_sync_url
  sensitive = true
}
