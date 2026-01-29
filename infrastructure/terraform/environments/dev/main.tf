# Development Environment Configuration
# Optimized for cost with single instances and minimal redundancy

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

  backend "s3" {
    bucket         = "ecosystem-terraform-state-034362054546"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ecosystem-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "business-ecosystem"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

# =============================================================================
# Foundation Layer - Network
# =============================================================================

module "vpc" {
  source = "../../modules/vpc"

  environment            = "dev"
  vpc_cidr               = "10.0.0.0/16"
  availability_zones     = ["us-east-1a", "us-east-1b"]
  enable_nat_gateway     = true
  single_nat_gateway     = true  # Cost optimization
  enable_flow_logs       = true
  flow_logs_retention_days = 30
  enable_isolated_subnets = true
}

# =============================================================================
# Foundation Layer - Security
# =============================================================================

module "kms" {
  source = "../../modules/security/kms"

  environment        = "dev"
  enable_key_rotation = true
  deletion_window    = 7  # Shorter for dev
}

# =============================================================================
# Data Layer
# =============================================================================

module "rds" {
  source = "../../modules/rds"

  environment         = "dev"
  vpc_id              = module.vpc.vpc_id
  subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_cidr            = "10.0.0.0/16"
  instance_class      = "db.t3.micro"  # Cost optimization
  allocated_storage   = 20
  max_allocated_storage = 50
  multi_az            = false
  kms_key_arn         = module.kms.rds_key_arn
  create_read_replica = false
}

module "elasticache" {
  source = "../../modules/elasticache"

  environment       = "dev"
  vpc_id            = module.vpc.vpc_id
  subnet_group_name = module.vpc.elasticache_subnet_group_name
  vpc_cidr          = "10.0.0.0/16"
  node_type         = "cache.t3.micro"
  num_cache_nodes   = 1
  automatic_failover = false
  multi_az          = false
  kms_key_arn       = module.kms.rds_key_arn
}

module "messaging" {
  source = "../../modules/messaging"

  environment     = "dev"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  vpc_cidr        = "10.0.0.0/16"
  instance_type   = "mq.t3.micro"
  deployment_mode = "SINGLE_INSTANCE"
}

# =============================================================================
# Compute Layer - ECS Cluster
# =============================================================================

module "ecs" {
  source = "../../modules/ecs-cluster"

  environment        = "dev"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids
}

# =============================================================================
# Service Layer - IAM
# =============================================================================

locals {
  services = [
    { name = "accounting",           tier = "foundational" },
    { name = "kyc-identity",         tier = "foundational" },
    { name = "tax",                  tier = "foundational" },
    { name = "compliance",           tier = "foundational" },
    { name = "corporate-security",   tier = "foundational" },
    { name = "entity-governance",    tier = "foundational" },
    { name = "banking-treasury",     tier = "foundational" },
    { name = "contracts-legal",      tier = "operational" },
    { name = "data-privacy",         tier = "operational" },
    { name = "intellectual-property", tier = "operational" },
    { name = "insurance",            tier = "operational" }
  ]
}

module "iam" {
  source = "../../modules/security/iam"

  environment = "dev"
  services = [
    for s in local.services : {
      name = s.name
      secret_arns = [
        module.rds.service_secret_arns[replace(s.name, "-", "_")],
        module.elasticache.auth_secret_arn,
        module.messaging.credentials_secret_arn
      ]
      additional_policies = []
    }
  ]
}

# =============================================================================
# Outputs
# =============================================================================

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "private_subnet_ids" {
  value = module.vpc.private_subnet_ids
}

output "isolated_subnet_ids" {
  value = module.vpc.isolated_subnet_ids
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.elasticache.primary_endpoint
  sensitive = true
}

output "mq_endpoints" {
  value     = module.messaging.amqp_endpoints
  sensitive = true
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "service_secret_arns" {
  value     = module.rds.service_secret_arns
  sensitive = true
}
