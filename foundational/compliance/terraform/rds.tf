################################################################################
# RDS PostgreSQL for Compliance Service
################################################################################

resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-db-subnet"
  description = "Database subnet group"
  subnet_ids  = aws_subnet.private[*].id
  tags        = { Name = "${var.project_name}-${var.environment}-db-subnet-group" }
}

resource "aws_db_parameter_group" "main" {
  name        = "${var.project_name}-${var.environment}-pg16"
  family      = "postgres16"
  description = "PostgreSQL 16 parameter group for compliance service"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = { Name = "${var.project_name}-${var.environment}-pg16-params" }
}

resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-${var.environment}-postgres"

  engine               = "postgres"
  engine_version       = "16.6"
  instance_class       = var.db_instance_class
  parameter_group_name = aws_db_parameter_group.main.name

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = var.environment != "production"
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

# =============================================================================
# Secrets Manager for Database Credentials
# =============================================================================

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${var.project_name}/${var.environment}/db-credentials"
  description = "Database credentials for compliance service"
  tags        = { Name = "${var.project_name}-${var.environment}-db-credentials" }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    database = var.db_name
    url      = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}"
  })
}
