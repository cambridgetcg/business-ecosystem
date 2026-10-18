# Data Privacy Service - Terraform Outputs

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.service.name
}

output "service_arn" {
  description = "ARN of the ECS service"
  value       = aws_ecs_service.service.id
}

output "task_definition_arn" {
  description = "ARN of the task definition"
  value       = aws_ecs_task_definition.service.arn
}

output "target_group_arn" {
  description = "ARN of the ALB target group"
  value       = aws_lb_target_group.service.arn
}

output "security_group_id" {
  description = "ID of the service security group"
  value       = aws_security_group.service.id
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.service.name
}

output "service_endpoints" {
  description = "API endpoints exposed by this service"
  value = {
    consent    = "/api/v1/consent"
    dsar       = "/api/v1/dsar"
    breach     = "/api/v1/breach"
    dpia       = "/api/v1/dpia"
    activities = "/api/v1/activities"
    processors = "/api/v1/processors"
    transfers  = "/api/v1/transfers"
    metrics    = "/api/v1/metrics"
    health     = "/health"
    ready      = "/ready"
    docs       = "/docs"
  }
}
