# Entity Governance - Terraform Configuration
#
# Infrastructure for legal entity management, governance, and compliance tracking.
# Uses shared VPC from ecosystem infrastructure when available, or creates standalone.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Backend configuration - uncomment when ready for remote state
  # backend "s3" {
  #   bucket         = "ecosystem-terraform-state"
  #   key            = "foundational/entity-governance/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "ecosystem-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "entity-governance"
      Environment = var.environment
      ManagedBy   = "terraform"
      Domain      = "foundational"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # Partitioning strategy: All 8 subdomains share one database
  # but use consistent entity_id foreign keys for data locality
  subdomains = [
    "entity",
    "corporate-structure",
    "governance",
    "shareholders",
    "officers-directors",
    "corporate-records",
    "registered-agent",
    "annual-filings"
  ]
}
