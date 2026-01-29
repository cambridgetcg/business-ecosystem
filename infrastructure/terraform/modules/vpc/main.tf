# VPC Module for Business Ecosystem
# Supports tiered network isolation for compliance-sensitive services

# =============================================================================
# Variables
# =============================================================================

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR block for VPC"
}

variable "availability_zones" {
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
  description = "Availability zones"
}

variable "enable_nat_gateway" {
  type        = bool
  default     = true
  description = "Enable NAT Gateway for private subnets"
}

variable "single_nat_gateway" {
  type        = bool
  default     = true
  description = "Use single NAT Gateway (cost optimization for non-prod)"
}

variable "enable_flow_logs" {
  type        = bool
  default     = true
  description = "Enable VPC Flow Logs for compliance"
}

variable "flow_logs_retention_days" {
  type        = number
  default     = 90
  description = "Flow logs retention in days (compliance requirement)"
}

variable "enable_isolated_subnets" {
  type        = bool
  default     = true
  description = "Create isolated subnets for compliance-sensitive services (KYC, Banking)"
}

locals {
  name_prefix    = "ecosystem-${var.environment}"
  az_count       = length(var.availability_zones)
  nat_count      = var.single_nat_gateway ? 1 : local.az_count

  # Subnet CIDR allocation (using /20 for larger address space)
  # Public:   10.0.0.0/20,  10.0.16.0/20,  10.0.32.0/20
  # Private:  10.0.48.0/20, 10.0.64.0/20,  10.0.80.0/20
  # Isolated: 10.0.96.0/20, 10.0.112.0/20, 10.0.128.0/20
  # Database: 10.0.144.0/20, 10.0.160.0/20, 10.0.176.0/20
}

# =============================================================================
# VPC
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Enable IPv6 for future-proofing
  assign_generated_ipv6_cidr_block = false

  tags = {
    Name        = "${local.name_prefix}-vpc"
    Environment = var.environment
  }
}

# =============================================================================
# Internet Gateway
# =============================================================================

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-igw"
    Environment = var.environment
  }
}

# =============================================================================
# Subnets - Public (ALB, NAT Gateway)
# =============================================================================

resource "aws_subnet" "public" {
  count                   = local.az_count
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${local.name_prefix}-public-${var.availability_zones[count.index]}"
    Environment = var.environment
    Tier        = "public"
    "kubernetes.io/role/elb" = "1"  # For EKS ALB if needed later
  }
}

# =============================================================================
# Subnets - Private (General services)
# =============================================================================

resource "aws_subnet" "private" {
  count             = local.az_count
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 3)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${local.name_prefix}-private-${var.availability_zones[count.index]}"
    Environment = var.environment
    Tier        = "private"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# =============================================================================
# Subnets - Isolated (Compliance-sensitive: KYC, Banking, Data-Privacy)
# =============================================================================

resource "aws_subnet" "isolated" {
  count             = var.enable_isolated_subnets ? local.az_count : 0
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 6)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${local.name_prefix}-isolated-${var.availability_zones[count.index]}"
    Environment = var.environment
    Tier        = "isolated"
    Compliance  = "sensitive"
  }
}

# =============================================================================
# Subnets - Database (RDS, ElastiCache)
# =============================================================================

resource "aws_subnet" "database" {
  count             = local.az_count
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 9)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${local.name_prefix}-database-${var.availability_zones[count.index]}"
    Environment = var.environment
    Tier        = "database"
  }
}

# Database subnet group for RDS
resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Database subnet group for ${local.name_prefix}"
  subnet_ids  = aws_subnet.database[*].id

  tags = {
    Name        = "${local.name_prefix}-db-subnet-group"
    Environment = var.environment
  }
}

# ElastiCache subnet group
resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name_prefix}-cache-subnet-group"
  description = "ElastiCache subnet group for ${local.name_prefix}"
  subnet_ids  = aws_subnet.database[*].id

  tags = {
    Name        = "${local.name_prefix}-cache-subnet-group"
    Environment = var.environment
  }
}

# =============================================================================
# NAT Gateway
# =============================================================================

resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? local.nat_count : 0
  domain = "vpc"

  tags = {
    Name        = "${local.name_prefix}-nat-eip-${count.index + 1}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? local.nat_count : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "${local.name_prefix}-nat-${count.index + 1}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.main]
}

# =============================================================================
# Route Tables
# =============================================================================

# Public route table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${local.name_prefix}-public-rt"
    Environment = var.environment
  }
}

# Private route tables (one per AZ for HA, or single for cost)
resource "aws_route_table" "private" {
  count  = var.enable_nat_gateway ? local.nat_count : 1
  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[var.single_nat_gateway ? 0 : count.index].id
    }
  }

  tags = {
    Name        = "${local.name_prefix}-private-rt-${count.index + 1}"
    Environment = var.environment
  }
}

# Isolated route table (NO internet access - compliance requirement)
resource "aws_route_table" "isolated" {
  count  = var.enable_isolated_subnets ? 1 : 0
  vpc_id = aws_vpc.main.id

  # NO routes to internet - completely isolated

  tags = {
    Name        = "${local.name_prefix}-isolated-rt"
    Environment = var.environment
    Compliance  = "no-internet"
  }
}

# Database route table (NO internet access)
resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  # NO routes to internet - database isolation

  tags = {
    Name        = "${local.name_prefix}-database-rt"
    Environment = var.environment
  }
}

# =============================================================================
# Route Table Associations
# =============================================================================

resource "aws_route_table_association" "public" {
  count          = local.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = local.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[var.single_nat_gateway ? 0 : count.index].id
}

resource "aws_route_table_association" "isolated" {
  count          = var.enable_isolated_subnets ? local.az_count : 0
  subnet_id      = aws_subnet.isolated[count.index].id
  route_table_id = aws_route_table.isolated[0].id
}

resource "aws_route_table_association" "database" {
  count          = local.az_count
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# =============================================================================
# VPC Endpoints (for isolated subnets to access AWS services)
# =============================================================================

# S3 Gateway Endpoint (free)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(
    aws_route_table.private[*].id,
    var.enable_isolated_subnets ? aws_route_table.isolated[*].id : [],
    [aws_route_table.database.id]
  )

  tags = {
    Name        = "${local.name_prefix}-s3-endpoint"
    Environment = var.environment
  }
}

# DynamoDB Gateway Endpoint (free)
resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(
    aws_route_table.private[*].id,
    var.enable_isolated_subnets ? aws_route_table.isolated[*].id : [],
    [aws_route_table.database.id]
  )

  tags = {
    Name        = "${local.name_prefix}-dynamodb-endpoint"
    Environment = var.environment
  }
}

# Security group for Interface Endpoints
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${local.name_prefix}-vpce-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for VPC Interface Endpoints"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name_prefix}-vpce-sg"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Interface endpoints for isolated subnets (required for AWS service access)
resource "aws_vpc_endpoint" "interface_endpoints" {
  for_each = var.enable_isolated_subnets ? toset([
    "ecr.api",
    "ecr.dkr",
    "logs",
    "secretsmanager",
    "kms",
    "ssm",
    "ssmmessages",
    "ec2messages"
  ]) : toset([])

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name        = "${local.name_prefix}-${each.key}-endpoint"
    Environment = var.environment
  }
}

# =============================================================================
# VPC Flow Logs (Compliance requirement)
# =============================================================================

resource "aws_cloudwatch_log_group" "flow_logs" {
  count             = var.enable_flow_logs ? 1 : 0
  name              = "/aws/vpc/${local.name_prefix}/flow-logs"
  retention_in_days = var.flow_logs_retention_days

  tags = {
    Name        = "${local.name_prefix}-flow-logs"
    Environment = var.environment
  }
}

resource "aws_iam_role" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0
  name  = "${local.name_prefix}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
    }]
  })

  tags = {
    Name        = "${local.name_prefix}-flow-logs-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "flow_logs" {
  count = var.enable_flow_logs ? 1 : 0
  name  = "${local.name_prefix}-vpc-flow-logs-policy"
  role  = aws_iam_role.flow_logs[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_flow_log" "main" {
  count                = var.enable_flow_logs ? 1 : 0
  vpc_id               = aws_vpc.main.id
  traffic_type         = "ALL"
  iam_role_arn         = aws_iam_role.flow_logs[0].arn
  log_destination_type = "cloud-watch-logs"
  log_destination      = aws_cloudwatch_log_group.flow_logs[0].arn

  tags = {
    Name        = "${local.name_prefix}-flow-log"
    Environment = var.environment
  }
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_region" "current" {}

# =============================================================================
# Outputs
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (general services)"
  value       = aws_subnet.private[*].id
}

output "isolated_subnet_ids" {
  description = "Isolated subnet IDs (compliance-sensitive services)"
  value       = var.enable_isolated_subnets ? aws_subnet.isolated[*].id : []
}

output "database_subnet_ids" {
  description = "Database subnet IDs"
  value       = aws_subnet.database[*].id
}

output "database_subnet_group_name" {
  description = "Database subnet group name"
  value       = aws_db_subnet_group.main.name
}

output "elasticache_subnet_group_name" {
  description = "ElastiCache subnet group name"
  value       = aws_elasticache_subnet_group.main.name
}

output "nat_gateway_ips" {
  description = "NAT Gateway public IPs"
  value       = var.enable_nat_gateway ? aws_eip.nat[*].public_ip : []
}

output "vpc_endpoint_security_group_id" {
  description = "Security group ID for VPC endpoints"
  value       = aws_security_group.vpc_endpoints.id
}

output "availability_zones" {
  description = "Availability zones used"
  value       = var.availability_zones
}
