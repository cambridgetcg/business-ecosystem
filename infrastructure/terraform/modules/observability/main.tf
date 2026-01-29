# Observability Module for Business Ecosystem
# CloudWatch dashboards, alarms, and X-Ray configuration

variable "environment" {
  type = string
}

variable "services" {
  type = list(string)
  default = []
}

variable "ecs_cluster_name" {
  type = string
}

variable "rds_instance_id" {
  type    = string
  default = null
}

variable "elasticache_cluster_id" {
  type    = string
  default = null
}

variable "alarm_sns_topic_arn" {
  type    = string
  default = null
}

locals {
  name_prefix = "ecosystem-${var.environment}"
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-overview"

  dashboard_body = jsonencode({
    widgets = concat(
      # ECS Cluster Metrics
      [
        {
          type   = "metric"
          x      = 0
          y      = 0
          width  = 12
          height = 6
          properties = {
            title  = "ECS Cluster CPU & Memory"
            region = data.aws_region.current.name
            metrics = [
              ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, { stat = "Average" }],
              ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, { stat = "Average" }]
            ]
            period = 300
          }
        }
      ],
      # RDS Metrics (if provided)
      var.rds_instance_id != null ? [
        {
          type   = "metric"
          x      = 12
          y      = 0
          width  = 12
          height = 6
          properties = {
            title  = "RDS Database Performance"
            region = data.aws_region.current.name
            metrics = [
              ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_id],
              ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_instance_id],
              ["AWS/RDS", "FreeableMemory", "DBInstanceIdentifier", var.rds_instance_id]
            ]
            period = 300
          }
        }
      ] : [],
      # Per-service widgets
      [
        for idx, service in var.services : {
          type   = "metric"
          x      = (idx % 2) * 12
          y      = 6 + floor(idx / 2) * 6
          width  = 12
          height = 6
          properties = {
            title  = "${service} Service Metrics"
            region = data.aws_region.current.name
            metrics = [
              ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", "${local.name_prefix}-${service}"],
              ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", "${local.name_prefix}-${service}"]
            ]
            period = 300
          }
        }
      ]
    )
  })
}

# High CPU Alarm
resource "aws_cloudwatch_metric_alarm" "cluster_cpu_high" {
  alarm_name          = "${local.name_prefix}-cluster-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS cluster CPU utilization is above 80%"

  dimensions = {
    ClusterName = var.ecs_cluster_name
  }

  alarm_actions = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  tags = {
    Environment = var.environment
  }
}

# High Memory Alarm
resource "aws_cloudwatch_metric_alarm" "cluster_memory_high" {
  alarm_name          = "${local.name_prefix}-cluster-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "ECS cluster memory utilization is above 85%"

  dimensions = {
    ClusterName = var.ecs_cluster_name
  }

  alarm_actions = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  tags = {
    Environment = var.environment
  }
}

# RDS Alarms (if configured)
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization is above 80%"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  count = var.rds_instance_id != null ? 1 : 0

  alarm_name          = "${local.name_prefix}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 180  # 90% of max_connections (200)
  alarm_description   = "RDS connections approaching limit"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = var.alarm_sns_topic_arn != null ? [var.alarm_sns_topic_arn] : []

  tags = {
    Environment = var.environment
  }
}

data "aws_region" "current" {}

# Outputs
output "dashboard_name" {
  value = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_arn" {
  value = aws_cloudwatch_dashboard.main.dashboard_arn
}

output "alarm_arns" {
  value = concat(
    [aws_cloudwatch_metric_alarm.cluster_cpu_high.arn],
    [aws_cloudwatch_metric_alarm.cluster_memory_high.arn],
    var.rds_instance_id != null ? [aws_cloudwatch_metric_alarm.rds_cpu_high[0].arn] : [],
    var.rds_instance_id != null ? [aws_cloudwatch_metric_alarm.rds_connections_high[0].arn] : []
  )
}
