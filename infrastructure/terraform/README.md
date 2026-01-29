# Business Ecosystem Terraform Infrastructure

This directory contains the Terraform configurations for deploying the Business Ecosystem to AWS.

## Directory Structure

```
terraform/
├── modules/              # Reusable Terraform modules
│   ├── vpc/              # VPC with isolated/private/public subnets
│   ├── rds/              # Multi-database PostgreSQL with per-service credentials
│   ├── ecs-cluster/      # Shared ECS Fargate cluster
│   ├── ecs-service/      # Individual service deployment
│   ├── elasticache/      # Redis cluster for caching
│   ├── messaging/        # Amazon MQ (RabbitMQ)
│   ├── observability/    # CloudWatch dashboards and alarms
│   └── security/         # IAM and KMS modules
│       ├── iam/          # Service roles with permission boundaries
│       └── kms/          # Service-specific encryption keys
├── environments/         # Environment-specific configurations
│   ├── dev/              # Development (cost-optimized)
│   ├── staging/          # Staging (prod-like, smaller)
│   └── prod/             # Production (full HA)
├── shared/               # Cross-environment resources
│   └── ecr/              # Container registries
├── state/                # State management bootstrap
└── main.tf               # Legacy (to be removed)
```

## Getting Started

### 1. Bootstrap State Management

First, create the S3 bucket and DynamoDB table for state management:

```bash
cd state
terraform init
terraform apply
```

### 2. Deploy an Environment

```bash
cd environments/dev
terraform init
terraform plan
terraform apply
```

## Environment Differences

| Feature | Dev | Staging | Prod |
|---------|-----|---------|------|
| RDS Instance | db.t3.micro | db.t3.medium | db.r6g.large |
| RDS Multi-AZ | No | Yes | Yes |
| RDS Read Replica | No | No | Yes |
| Redis Nodes | 1 | 2 | 3 |
| NAT Gateways | 1 | 1 | 3 (1 per AZ) |
| Flow Log Retention | 30 days | 90 days | 365 days |
| MQ Instance | mq.t3.micro | mq.t3.micro | mq.m5.large |
| MQ Deployment | Single | Single | Multi-AZ Cluster |

## Module Documentation

### VPC Module

Creates a VPC with:
- Public subnets (ALB, NAT Gateway)
- Private subnets (general services)
- Isolated subnets (compliance-sensitive services - no internet)
- Database subnets (RDS, ElastiCache)
- VPC Endpoints for AWS services
- VPC Flow Logs

### RDS Module

Creates PostgreSQL with:
- Multi-database support (one per service)
- Per-service credentials in Secrets Manager
- IAM authentication enabled
- Performance Insights
- SSL enforcement

### Security Modules

- **KMS**: Service-specific keys for RDS, Secrets, S3, Logs
- **IAM**: Permission boundaries, ECS execution role, per-service task roles

## Services Supported

| Service | Tier | Port | Database |
|---------|------|------|----------|
| accounting | foundational | 3001 | accounting |
| kyc-identity | foundational | 3002 | kyc_identity |
| tax | foundational | 3003 | tax |
| compliance | foundational | 3004 | compliance |
| corporate-security | foundational | 3005 | corporate_security |
| entity-governance | foundational | 3006 | entity_governance |
| banking-treasury | foundational | 3007 | banking_treasury |
| contracts-legal | operational | 3011 | contracts_legal |
| data-privacy | operational | 3012 | data_privacy |
| intellectual-property | operational | 3013 | intellectual_property |
| insurance | operational | 3014 | insurance |

## Cost Optimization

- **Dev**: Single instances, Fargate Spot eligible, minimal redundancy
- **Staging**: Moderate redundancy for testing failover
- **Prod**: Full HA with Multi-AZ, read replicas

Estimated monthly costs (us-east-1):
- Dev: ~$150-200/month
- Staging: ~$400-500/month
- Prod: ~$1,500-2,000/month

## Compliance Features

- VPC Flow Logs for network auditing
- KMS encryption for data at rest
- SSL/TLS for data in transit
- Isolated subnets for sensitive services (KYC, Banking, Data-Privacy)
- IAM permission boundaries
- Secrets Manager for credential rotation
