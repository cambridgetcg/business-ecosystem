# Entity Governance RDS PostgreSQL Instance
#
# Partitioning Strategy:
# - Single database with all 8 subdomains (entity, corporate-structure, governance,
#   shareholders, officers-directors, corporate-records, registered-agent, annual-filings)
# - All tables share entity_id foreign key for data locality
# - Time-based partitioning on audit_log table (handled at application level via Drizzle)
# - Row-level security can be added for multi-tenant scenarios

resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-db-subnet"
  description = "Database subnet group for entity governance"
  subnet_ids  = aws_subnet.private[*].id
  tags        = { Name = "${var.project_name}-${var.environment}-db-subnet-group" }
}

resource "aws_db_parameter_group" "main" {
  name        = "${var.project_name}-${var.environment}-pg16"
  family      = "postgres16"
  description = "PostgreSQL 16 parameter group for entity governance"

  # Logging for audit and debugging
  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking > 1 second
  }

  # Connection settings optimized for entity governance workload
  parameter {
    name  = "max_connections"
    value = "100"
  }

  # Work memory for complex joins across subdomains
  parameter {
    name  = "work_mem"
    value = "16384" # 16MB
  }

  tags = { Name = "${var.project_name}-${var.environment}-pg16-params" }
}

resource "random_password" "db_password" {
  count   = var.db_password == null ? 1 : 0
  length  = 32
  special = false
}

locals {
  db_password = var.db_password != null ? var.db_password : random_password.db_password[0].result
}

resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}-postgres"

  engine               = "postgres"
  engine_version       = "16.4"
  instance_class       = var.db_instance_class
  parameter_group_name = aws_db_parameter_group.main.name

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = local.db_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period   = var.db_backup_retention_period
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot     = true
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-final-snapshot" : null

  performance_insights_enabled    = var.environment == "production"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  deletion_protection                 = var.db_deletion_protection
  iam_database_authentication_enabled = true
  auto_minor_version_upgrade          = true
  apply_immediately                   = var.environment != "production"

  tags = { Name = "${var.project_name}-${var.environment}-postgres" }
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}/${var.environment}/db-credentials"
  description = "Database credentials for entity governance"
  tags        = { Name = "${var.project_name}-${var.environment}-db-credentials" }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = local.db_password
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    database = var.db_name
    url      = "postgresql://${var.db_username}:${local.db_password}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}"
  })
}
