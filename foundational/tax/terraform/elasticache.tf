################################################################################
# ElastiCache Redis for UK Tax Service
################################################################################
#
# Use cases:
# - Tax code lookups and validation
# - NI threshold caching
# - Rate limiting counters
# - Session/API key caching
# - Calculation result caching
#
################################################################################

# =============================================================================
# Subnet Group
# =============================================================================

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-cache-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-cache-subnet"
  }
}

# =============================================================================
# Parameter Group (Redis 7.x optimized settings)
# =============================================================================

resource "aws_elasticache_parameter_group" "main" {
  family = "redis7"
  name   = "${var.project_name}-${var.environment}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "appendonly"
    value = "no"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-params"
  }
}

# =============================================================================
# Redis Replication Group
# =============================================================================

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description          = "Redis cache for ${var.project_name} ${var.environment}"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  parameter_group_name = aws_elasticache_parameter_group.main.name

  num_cache_clusters = var.environment == "production" ? 2 : 1
  port               = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled           = var.environment == "production"

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_retention_limit = var.environment == "production" ? 7 : 0
  snapshot_window          = "04:00-05:00"

  auto_minor_version_upgrade = true
  apply_immediately          = var.environment != "production"

  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}

# =============================================================================
# Secrets Manager for Redis Auth Token
# =============================================================================

resource "aws_secretsmanager_secret" "redis_auth" {
  name        = "${var.project_name}/${var.environment}/redis-auth"
  description = "Redis AUTH token for ${var.project_name} ${var.environment}"

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-auth"
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id = aws_secretsmanager_secret.redis_auth.id
  secret_string = jsonencode({
    auth_token = var.redis_auth_token
    endpoint   = aws_elasticache_replication_group.main.primary_endpoint_address
    port       = 6379
  })
}

# Allow ECS execution role to read Redis secret
resource "aws_iam_role_policy" "ecs_execution_redis_secret" {
  name = "redis-secret-access"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.redis_auth.arn
        ]
      }
    ]
  })
}
