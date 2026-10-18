################################################################################
# Banking-Treasury Infrastructure
################################################################################
#
# This configuration provisions AWS resources specific to the banking-treasury
# service, using shared ecosystem modules where appropriate.
#
# Resources:
# - RDS PostgreSQL (via shared module, Multi-AZ in production)
# - ElastiCache Redis (via shared module)
# - EventBridge (event routing)
# - Step Functions (payment workflow)
# - CloudTrail + S3 (audit logging)
# - IAM roles and policies
#
################################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration - uncomment for remote state
  # backend "s3" {
  #   bucket         = "ecosystem-terraform-state"
  #   key            = "banking-treasury/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "business-ecosystem"
      Service     = "banking-treasury"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name_prefix  = "banking-treasury-${var.environment}"
  account_id   = data.aws_caller_identity.current.account_id
  region       = data.aws_region.current.name

  common_tags = {
    Service     = "banking-treasury"
    Environment = var.environment
  }
}

################################################################################
# VPC Data (assumes shared VPC exists)
################################################################################

data "aws_vpc" "ecosystem" {
  tags = {
    Name = "ecosystem-${var.environment}"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.ecosystem.id]
  }

  tags = {
    Tier = "private"
  }
}

data "aws_db_subnet_group" "ecosystem" {
  name = "ecosystem-${var.environment}"
}

data "aws_elasticache_subnet_group" "ecosystem" {
  name = "ecosystem-${var.environment}"
}

################################################################################
# RDS PostgreSQL - Banking Treasury Database
################################################################################

# Use the shared RDS module with banking-treasury specific configuration
module "database" {
  source = "../../../../infrastructure/terraform/modules/rds"

  environment       = var.environment
  vpc_id            = data.aws_vpc.ecosystem.id
  subnet_group_name = data.aws_db_subnet_group.ecosystem.name
  vpc_cidr          = data.aws_vpc.ecosystem.cidr_block

  # Production: Multi-AZ for high availability
  multi_az = var.environment == "prod"

  # Instance sizing based on environment
  instance_class = var.environment == "prod" ? "db.r6g.large" : "db.t3.medium"

  # Storage configuration
  allocated_storage     = var.environment == "prod" ? 100 : 20
  max_allocated_storage = var.environment == "prod" ? 500 : 100

  # Read replica for analytics/reporting queries
  create_read_replica = var.environment == "prod"

  # Only create banking_treasury database
  databases = [
    {
      name        = "banking_treasury"
      description = "Banking & Treasury Service Database"
    }
  ]

  # Use customer-managed KMS key in production
  kms_key_arn = var.environment == "prod" ? aws_kms_key.database[0].arn : null
}

# KMS key for database encryption (production only)
resource "aws_kms_key" "database" {
  count = var.environment == "prod" ? 1 : 0

  description             = "KMS key for banking-treasury database encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = local.common_tags
}

resource "aws_kms_alias" "database" {
  count = var.environment == "prod" ? 1 : 0

  name          = "alias/${local.name_prefix}-database"
  target_key_id = aws_kms_key.database[0].key_id
}

################################################################################
# ElastiCache Redis - Caching Layer
################################################################################

module "cache" {
  source = "../../../../infrastructure/terraform/modules/elasticache"

  environment       = var.environment
  vpc_id            = data.aws_vpc.ecosystem.id
  subnet_group_name = data.aws_elasticache_subnet_group.ecosystem.name
  vpc_cidr          = data.aws_vpc.ecosystem.cidr_block

  # Instance sizing
  node_type       = var.environment == "prod" ? "cache.r6g.large" : "cache.t3.micro"
  num_cache_nodes = var.environment == "prod" ? 2 : 1

  # High availability in production
  automatic_failover = var.environment == "prod"
  multi_az           = var.environment == "prod"

  # Encryption
  at_rest_encryption  = true
  transit_encryption  = true
  kms_key_arn         = var.environment == "prod" ? aws_kms_key.cache[0].arn : null

  # Backup
  snapshot_retention = var.environment == "prod" ? 7 : 1
}

# KMS key for cache encryption (production only)
resource "aws_kms_key" "cache" {
  count = var.environment == "prod" ? 1 : 0

  description             = "KMS key for banking-treasury cache encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = local.common_tags
}

################################################################################
# Secrets Manager - Additional Secrets
################################################################################

# Bank API credentials
resource "aws_secretsmanager_secret" "bank_api_credentials" {
  name_prefix             = "${local.name_prefix}-bank-api-"
  description             = "Bank API credentials for payment processing"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "bank_api_credentials" {
  secret_id = aws_secretsmanager_secret.bank_api_credentials.id
  secret_string = jsonencode({
    plaid_client_id = "REPLACE_ME"
    plaid_secret    = "REPLACE_ME"
    mx_api_key      = "REPLACE_ME"
    swift_bic       = "REPLACE_ME"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# FX provider credentials
resource "aws_secretsmanager_secret" "fx_provider" {
  name_prefix             = "${local.name_prefix}-fx-provider-"
  description             = "FX rate provider credentials"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = local.common_tags
}
