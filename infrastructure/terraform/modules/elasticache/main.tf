# ElastiCache Module for Business Ecosystem
# Shared Redis cluster for caching and session management

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_group_name" {
  type        = string
  description = "ElastiCache subnet group name"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
}

variable "node_type" {
  type        = string
  default     = "cache.t3.micro"
}

variable "num_cache_nodes" {
  type        = number
  default     = 1
}

variable "engine_version" {
  type        = string
  default     = "7.1"
}

variable "automatic_failover" {
  type        = bool
  default     = false
}

variable "multi_az" {
  type        = bool
  default     = false
}

variable "at_rest_encryption" {
  type        = bool
  default     = true
}

variable "transit_encryption" {
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  type        = string
  default     = null
}

variable "snapshot_retention" {
  type        = number
  default     = 7
}

locals {
  name_prefix = "ecosystem-${var.environment}"
}

# Security Group
resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-"
  description = "Security group for Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Redis from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name_prefix}-redis-sg"
    Environment = var.environment
  }

}

# Parameter Group
resource "aws_elasticache_parameter_group" "redis" {
  name        = "${local.name_prefix}-redis7"
  family      = "redis7"
  description = "Redis 7 parameters for ${local.name_prefix}"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  tags = {
    Environment = var.environment
  }

}

# Redis Auth Token
resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "redis_auth" {
  name_prefix             = "${local.name_prefix}-redis-auth-"
  recovery_window_in_days = var.environment == "prod" ? 7 : 0

  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id = aws_secretsmanager_secret.redis_auth.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth.result
  })
}

# Redis Replication Group
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis cluster for ${local.name_prefix}"

  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  subnet_group_name  = var.subnet_group_name
  security_group_ids = [aws_security_group.redis.id]

  automatic_failover_enabled = var.automatic_failover
  multi_az_enabled           = var.multi_az

  at_rest_encryption_enabled = var.at_rest_encryption
  transit_encryption_enabled = var.transit_encryption
  auth_token                 = var.transit_encryption ? random_password.redis_auth.result : null
  kms_key_id                 = var.kms_key_arn

  snapshot_retention_limit = var.snapshot_retention
  snapshot_window          = "05:00-06:00"
  maintenance_window       = "sun:06:00-sun:07:00"

  auto_minor_version_upgrade = true
  apply_immediately          = var.environment != "prod"

  tags = {
    Name        = "${local.name_prefix}-redis"
    Environment = var.environment
  }
}

# Outputs
output "primary_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "reader_endpoint" {
  value = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "port" {
  value = 6379
}

output "auth_secret_arn" {
  value = aws_secretsmanager_secret.redis_auth.arn
}

output "security_group_id" {
  value = aws_security_group.redis.id
}

output "connection_string" {
  description = "Redis connection string (without auth token)"
  value       = "rediss://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
}
