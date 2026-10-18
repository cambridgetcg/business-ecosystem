# Data Privacy Service - ECS Configuration

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "service" {
  name              = "/ecs/${local.full_name}"
  retention_in_days = var.environment == "production" ? 90 : 30
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "execution" {
  name = "${local.full_name}-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "execution_policy" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "${local.full_name}-secrets"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [
        data.aws_secretsmanager_secret.database.arn,
        data.aws_secretsmanager_secret.rabbitmq.arn
      ]
    }]
  })
}

# IAM Role for ECS Task
resource "aws_iam_role" "task" {
  name = "${local.full_name}-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "task_cloudwatch" {
  name = "${local.full_name}-cloudwatch"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "${aws_cloudwatch_log_group.service.arn}:*"
    }]
  })
}

# Security Group for ECS Service
resource "aws_security_group" "service" {
  name        = "${local.full_name}-service"
  description = "Security group for ${local.service_name} ECS service"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description     = "Allow traffic from ALB"
    from_port       = local.container_port
    to_port         = local.container_port
    protocol        = "tcp"
    security_groups = [data.aws_lb.main.security_groups[0]]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "service" {
  family                   = local.full_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = local.cpu_units
  memory                   = local.memory_mb
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn           = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name  = local.service_name
    image = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${local.service_name}:${var.image_tag}"

    essential = true

    portMappings = [{
      containerPort = local.container_port
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = var.environment },
      { name = "PORT", value = tostring(local.container_port) },
      { name = "HOST", value = "0.0.0.0" },
      { name = "SERVICE_NAME", value = local.service_name },
      { name = "SERVICE_VERSION", value = var.image_tag },
      { name = "LOG_LEVEL", value = var.log_level },
      { name = "LOG_FORMAT", value = "json" },
      { name = "RATE_LIMIT_MAX_REQUESTS", value = tostring(var.rate_limit_max_requests) },
      { name = "RATE_LIMIT_WINDOW_MS", value = tostring(var.rate_limit_window_ms) },
      { name = "AWS_REGION", value = var.aws_region }
    ]

    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "${data.aws_secretsmanager_secret.database.arn}:url::"
      },
      {
        name      = "RABBITMQ_URL"
        valueFrom = "${data.aws_secretsmanager_secret.rabbitmq.arn}:url::"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.service.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:${local.container_port}/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}

# ECS Service
resource "aws_ecs_service" "service" {
  name            = local.full_name
  cluster         = data.aws_ecs_cluster.main.arn
  task_definition = aws_ecs_task_definition.service.arn
  desired_count   = local.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.private.ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.service.arn
    container_name   = local.service_name
    container_port   = local.container_port
  }

  deployment_configuration {
    minimum_healthy_percent = 100
    maximum_percent         = 200
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener_rule.service]
}

# ALB Target Group
resource "aws_lb_target_group" "service" {
  name        = "${local.full_name}-tg"
  port        = local.container_port
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = local.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  deregistration_delay = 30
}

# ALB Listener Rule
resource "aws_lb_listener_rule" "service" {
  listener_arn = data.aws_lb_listener.https.arn
  priority     = 130  # Unique priority for data-privacy service

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service.arn
  }

  condition {
    path_pattern {
      values = ["/api/v1/consent/*", "/api/v1/dsar/*", "/api/v1/breach/*", "/api/v1/dpia/*", "/api/v1/activities/*", "/api/v1/processors/*", "/api/v1/transfers/*", "/api/v1/metrics/*"]
    }
  }

  condition {
    host_header {
      values = ["api.${var.environment}.ecosystem.local", "api.ecosystem.io"]
    }
  }
}
