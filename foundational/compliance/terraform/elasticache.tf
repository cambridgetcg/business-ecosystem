################################################################################
# ElastiCache Redis for Compliance Service
################################################################################

resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-redis-subnet"
  description = "Redis subnet group for compliance service"
  subnet_ids  = aws_subnet.private[*].id

  tags = { Name = "${var.project_name}-${var.environment}-redis-subnet-group" }
}

resource "aws_elasticache_parameter_group" "main" {
  name        = "${var.project_name}-${var.environment}-redis7"
  family      = "redis7"
  description = "Redis 7.x parameter group for compliance service"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  tags = { Name = "${var.project_name}-${var.environment}-redis-params" }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description          = "Redis cluster for compliance service caching"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.main.name

  num_cache_clusters = var.environment == "production" ? 2 : 1

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled           = var.environment == "production"

  snapshot_retention_limit = var.environment == "production" ? 7 : 1
  snapshot_window          = "05:00-06:00"
  maintenance_window       = "mon:06:00-mon:07:00"

  apply_immediately = var.environment != "production"

  tags = { Name = "${var.project_name}-${var.environment}-redis" }
}

# =============================================================================
# Secrets Manager for Redis Credentials
# =============================================================================

resource "aws_secretsmanager_secret" "redis_credentials" {
  name        = "${var.project_name}/${var.environment}/redis-credentials"
  description = "Redis credentials for compliance service"
  tags        = { Name = "${var.project_name}-${var.environment}-redis-credentials" }
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    host      = aws_elasticache_replication_group.main.primary_endpoint_address
    port      = 6379
    auth      = var.redis_auth_token
    url       = "rediss://:${var.redis_auth_token}@${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
    reader_url = "rediss://:${var.redis_auth_token}@${aws_elasticache_replication_group.main.reader_endpoint_address}:6379"
  })
}
