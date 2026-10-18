################################################################################
# Terraform Outputs for UK Tax Service
################################################################################

# =============================================================================
# VPC Outputs
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

# =============================================================================
# RDS Outputs
# =============================================================================

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "RDS instance address"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "db_credentials_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

# =============================================================================
# ECS Outputs
# =============================================================================

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.api.name
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.api.repository_url
}

# =============================================================================
# ALB Outputs
# =============================================================================

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.api.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the load balancer (for Route53)"
  value       = aws_lb.api.zone_id
}

output "alb_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.api.arn
}

output "api_url" {
  description = "URL to access the Tax API"
  value       = var.certificate_arn != "" ? "https://${aws_lb.api.dns_name}" : "http://${aws_lb.api.dns_name}"
}

# =============================================================================
# Security Group Outputs
# =============================================================================

output "ecs_security_group_id" {
  description = "ECS tasks security group ID"
  value       = aws_security_group.ecs_tasks.id
}

output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

# =============================================================================
# S3 Outputs
# =============================================================================

output "s3_bucket_name" {
  description = "S3 bucket name for tax documents"
  value       = aws_s3_bucket.files.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.files.arn
}

# =============================================================================
# SQS Outputs
# =============================================================================

output "ct_calculations_queue_url" {
  description = "URL of the Corporation Tax calculations SQS queue"
  value       = aws_sqs_queue.ct_calculations.url
}

output "ct_calculations_queue_arn" {
  description = "ARN of the Corporation Tax calculations SQS queue"
  value       = aws_sqs_queue.ct_calculations.arn
}

output "vat_returns_queue_url" {
  description = "URL of the VAT returns SQS queue"
  value       = aws_sqs_queue.vat_returns.url
}

output "paye_submissions_queue_url" {
  description = "URL of the PAYE submissions SQS queue"
  value       = aws_sqs_queue.paye_submissions.url
}

output "notifications_queue_url" {
  description = "URL of the notifications SQS queue"
  value       = aws_sqs_queue.notifications.url
}

# =============================================================================
# Redis Outputs
# =============================================================================

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = 6379
}

output "redis_secret_arn" {
  description = "ARN of the Redis auth secret"
  value       = aws_secretsmanager_secret.redis_auth.arn
}

# =============================================================================
# WAF Outputs
# =============================================================================

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.api.arn
}

output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.api.id
}

# =============================================================================
# Monitoring Outputs
# =============================================================================

output "sns_topic_arn" {
  description = "ARN of the SNS alerts topic"
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "log_group_name" {
  description = "CloudWatch log group name for ECS"
  value       = aws_cloudwatch_log_group.ecs.name
}
