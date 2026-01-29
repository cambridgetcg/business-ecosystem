# Messaging Module for Business Ecosystem
# Amazon MQ (RabbitMQ) for event-driven architecture

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for broker"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
}

variable "instance_type" {
  type        = string
  default     = "mq.t3.micro"
}

variable "deployment_mode" {
  type        = string
  default     = "SINGLE_INSTANCE"
  description = "SINGLE_INSTANCE or CLUSTER_MULTI_AZ"
}

variable "engine_version" {
  type        = string
  default     = "3.13"  # Valid versions: 3.13, 4.2
}

variable "auto_minor_version_upgrade" {
  type        = bool
  default     = true
}

variable "publicly_accessible" {
  type        = bool
  default     = false
}

variable "kms_key_arn" {
  type        = string
  default     = null
}

locals {
  name_prefix = "ecosystem-${var.environment}"
}

# Security Group
resource "aws_security_group" "mq" {
  name_prefix = "${local.name_prefix}-mq-"
  description = "Security group for Amazon MQ"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5671
    to_port     = 5671
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "AMQPS from VPC"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS Management Console"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name_prefix}-mq-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Admin Credentials
resource "random_password" "mq_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_+{}<>?"  # Amazon MQ forbids: [ ] : =
}

resource "aws_secretsmanager_secret" "mq_credentials" {
  name_prefix             = "${local.name_prefix}-mq-admin-"
  recovery_window_in_days = var.environment == "prod" ? 7 : 0

  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "mq_credentials" {
  secret_id = aws_secretsmanager_secret.mq_credentials.id
  secret_string = jsonencode({
    username = "ecosystem_admin"
    password = random_password.mq_admin.result
  })
}

# Amazon MQ Broker
resource "aws_mq_broker" "main" {
  broker_name = "${local.name_prefix}-rabbitmq"

  engine_type         = "RabbitMQ"
  engine_version      = var.engine_version
  host_instance_type  = var.instance_type
  deployment_mode     = var.deployment_mode
  publicly_accessible = var.publicly_accessible

  subnet_ids         = var.deployment_mode == "CLUSTER_MULTI_AZ" ? var.subnet_ids : [var.subnet_ids[0]]
  security_groups    = [aws_security_group.mq.id]

  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  encryption_options {
    use_aws_owned_key = var.kms_key_arn == null
    kms_key_id        = var.kms_key_arn
  }

  logs {
    general = true
  }

  maintenance_window_start_time {
    day_of_week = "SUNDAY"
    time_of_day = "06:00"
    time_zone   = "UTC"
  }

  user {
    username = "ecosystem_admin"
    password = random_password.mq_admin.result
  }

  tags = {
    Name        = "${local.name_prefix}-rabbitmq"
    Environment = var.environment
  }
}

# Outputs
output "broker_id" {
  value = aws_mq_broker.main.id
}

output "broker_arn" {
  value = aws_mq_broker.main.arn
}

output "amqp_endpoints" {
  value = aws_mq_broker.main.instances[*].endpoints
}

output "console_url" {
  value = aws_mq_broker.main.instances[0].console_url
}

output "credentials_secret_arn" {
  value = aws_secretsmanager_secret.mq_credentials.arn
}

output "security_group_id" {
  value = aws_security_group.mq.id
}
