# RDS Module for Business Ecosystem
# Multi-database instance with per-service isolation

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "subnet_group_name" {
  type        = string
  description = "Database subnet group name"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "VPC CIDR for security group rules"
}

variable "instance_class" {
  type        = string
  default     = "db.t3.medium"
  description = "RDS instance class"
}

variable "allocated_storage" {
  type        = number
  default     = 50
  description = "Initial allocated storage in GB"
}

variable "max_allocated_storage" {
  type        = number
  default     = 200
  description = "Maximum storage autoscaling in GB"
}

variable "multi_az" {
  type        = bool
  default     = false
  description = "Enable Multi-AZ deployment"
}

variable "kms_key_arn" {
  type        = string
  default     = null
  description = "KMS key ARN for encryption"
}

variable "databases" {
  type = list(object({
    name        = string
    description = string
  }))
  default = [
    { name = "accounting", description = "Accounting service" },
    { name = "kyc_identity", description = "KYC service" },
    { name = "tax", description = "Tax service" },
    { name = "compliance", description = "Compliance service" },
    { name = "corporate_security", description = "Corporate Security" },
    { name = "entity_governance", description = "Entity Governance" },
    { name = "banking_treasury", description = "Banking Treasury" },
    { name = "contracts_legal", description = "Contracts Legal" },
    { name = "data_privacy", description = "Data Privacy" },
    { name = "intellectual_property", description = "IP service" },
    { name = "insurance", description = "Insurance service" }
  ]
}

variable "create_read_replica" {
  type        = bool
  default     = false
}

locals {
  name_prefix = "ecosystem-${var.environment}"
}

# Security Group
resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-"
  description = "Security group for RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name_prefix}-rds-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Parameter Group
resource "aws_db_parameter_group" "main" {
  name_prefix = "${local.name_prefix}-pg16-"
  family      = "postgres16"

  parameter {
    name         = "max_connections"
    value        = "200"
    apply_method = "pending-reboot"  # Requires reboot to apply
  }

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"  # Static parameter requires reboot
  }

  tags = {
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Master Password
resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "master" {
  name_prefix             = "${local.name_prefix}-rds-master-"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "master" {
  secret_id = aws_secretsmanager_secret.master.id
  secret_string = jsonencode({
    username = "ecosystem_admin"
    password = random_password.master.result
    engine   = "postgres"
    port     = 5432
  })
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  engine               = "postgres"
  engine_version       = "16"
  parameter_group_name = aws_db_parameter_group.main.name

  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn

  db_name  = "ecosystem"
  username = "ecosystem_admin"
  password = random_password.master.result

  db_subnet_group_name   = var.subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  multi_az            = var.multi_az
  skip_final_snapshot = var.environment != "prod"

  backup_retention_period            = var.environment == "prod" ? 30 : 7
  performance_insights_enabled       = true
  iam_database_authentication_enabled = true

  tags = {
    Name        = "${local.name_prefix}-postgres"
    Environment = var.environment
  }
}

# Read Replica
resource "aws_db_instance" "replica" {
  count               = var.create_read_replica ? 1 : 0
  identifier          = "${local.name_prefix}-postgres-replica"
  instance_class      = var.instance_class
  replicate_source_db = aws_db_instance.main.identifier
  skip_final_snapshot = true

  tags = {
    Name        = "${local.name_prefix}-postgres-replica"
    Environment = var.environment
  }
}

# Per-Service Credentials
resource "random_password" "service" {
  for_each         = { for db in var.databases : db.name => db }
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "service" {
  for_each                = { for db in var.databases : db.name => db }
  name_prefix             = "${local.name_prefix}-${each.key}-db-"
  recovery_window_in_days = var.environment == "prod" ? 7 : 0

  tags = {
    Environment = var.environment
    Service     = each.key
  }
}

resource "aws_secretsmanager_secret_version" "service" {
  for_each  = { for db in var.databases : db.name => db }
  secret_id = aws_secretsmanager_secret.service[each.key].id
  secret_string = jsonencode({
    username = "${each.key}_user"
    password = random_password.service[each.key].result
    database = each.key
    host     = aws_db_instance.main.address
    port     = 5432
    url      = "postgresql://${each.key}_user:${urlencode(random_password.service[each.key].result)}@${aws_db_instance.main.address}:5432/${each.key}?sslmode=require"
  })
}

# Outputs
output "endpoint" {
  value = aws_db_instance.main.endpoint
}

output "address" {
  value = aws_db_instance.main.address
}

output "master_secret_arn" {
  value = aws_secretsmanager_secret.master.arn
}

output "service_secret_arns" {
  value = { for k, v in aws_secretsmanager_secret.service : k => v.arn }
}

output "security_group_id" {
  value = aws_security_group.rds.id
}
