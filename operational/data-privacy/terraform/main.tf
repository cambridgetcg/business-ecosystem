# Data Privacy Service - AWS Infrastructure
# Terraform configuration for ECS Fargate deployment

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ecosystem-terraform-state"
    key            = "services/data-privacy/terraform.tfstate"
    region         = "eu-west-2"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Service     = "data-privacy"
      Environment = var.environment
      ManagedBy   = "terraform"
      Team        = "platform"
    }
  }
}

# Data sources for existing infrastructure
data "aws_vpc" "main" {
  tags = {
    Name = "ecosystem-${var.environment}-vpc"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Tier = "private"
  }
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Tier = "public"
  }
}

data "aws_ecs_cluster" "main" {
  cluster_name = "ecosystem-${var.environment}"
}

data "aws_lb" "main" {
  name = "ecosystem-${var.environment}-alb"
}

data "aws_lb_listener" "https" {
  load_balancer_arn = data.aws_lb.main.arn
  port              = 443
}

data "aws_secretsmanager_secret" "database" {
  name = "ecosystem/${var.environment}/data-privacy/database"
}

data "aws_secretsmanager_secret" "rabbitmq" {
  name = "ecosystem/${var.environment}/rabbitmq"
}

# Local values
locals {
  service_name = "data-privacy"
  full_name    = "${local.service_name}-${var.environment}"

  container_port = 3012
  health_check_path = "/health"

  cpu_units    = var.environment == "production" ? 512 : 256
  memory_mb    = var.environment == "production" ? 1024 : 512
  desired_count = var.environment == "production" ? 2 : 1
}
