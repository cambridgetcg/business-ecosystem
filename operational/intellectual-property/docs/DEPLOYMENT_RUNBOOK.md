# Intellectual Property Service - Deployment Runbook

> **Version:** 1.0.0
> **Service:** @ecosystem/intellectual-property
> **Port:** 3014
> **Last Updated:** 2026-01-30

This runbook provides comprehensive deployment procedures for the Intellectual Property (IP) service, covering development through production environments.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Database Setup](#3-database-setup)
4. [Infrastructure Deployment (Terraform)](#4-infrastructure-deployment-terraform)
5. [Application Deployment](#5-application-deployment)
6. [Post-Deployment Verification](#6-post-deployment-verification)
7. [Monitoring Setup](#7-monitoring-setup)
8. [Rollback Procedures](#8-rollback-procedures)
9. [Troubleshooting Guide](#9-troubleshooting-guide)
10. [Maintenance Procedures](#10-maintenance-procedures)

---

## 1. Prerequisites

### 1.1 Required AWS Permissions

The deploying user/role needs the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TerraformStateManagement",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": [
        "arn:aws:s3:::business-ecosystem-terraform-state/*",
        "arn:aws:dynamodb:*:*:table/terraform-state-lock"
      ]
    },
    {
      "Sid": "IPServiceResources",
      "Effect": "Allow",
      "Action": [
        "s3:*",
        "kms:*",
        "dynamodb:*",
        "events:*",
        "sns:*",
        "logs:*",
        "iam:*",
        "ecr:*",
        "ecs:*",
        "lambda:*",
        "rds:*",
        "secretsmanager:*",
        "ssm:*"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestTag/Service": "intellectual-property"
        }
      }
    }
  ]
}
```

**Minimum IAM Policies Required:**
- `AmazonS3FullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonEventBridgeFullAccess`
- `AmazonSNSFullAccess`
- `CloudWatchLogsFullAccess`
- `AWSKeyManagementServicePowerUser`
- `AmazonECS_FullAccess`
- `AmazonRDSFullAccess`
- `SecretsManagerReadWrite`

### 1.2 Required Tools

| Tool | Minimum Version | Installation |
|------|-----------------|--------------|
| Terraform | >= 1.5.0 | `brew install terraform` |
| Node.js | >= 20.0.0 | `brew install node@20` |
| pnpm | >= 8.0.0 | `npm install -g pnpm` |
| AWS CLI | >= 2.0.0 | `brew install awscli` |
| Docker | >= 24.0.0 | Docker Desktop |
| PostgreSQL Client | >= 15.0 | `brew install postgresql@15` |

**Verify installations:**

```bash
# Check all tool versions
terraform --version  # Should be >= 1.5.0
node --version       # Should be >= 20.0.0
pnpm --version       # Should be >= 8.0.0
aws --version        # Should be >= 2.0.0
docker --version     # Should be >= 24.0.0
psql --version       # Should be >= 15.0
```

### 1.3 Environment Variables List

**Required Environment Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/staging/production) | `production` |
| `PORT` | Application port | `3014` |
| `HOST` | Bind address | `0.0.0.0` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCOUNT_ID` | AWS account ID | `123456789012` |

**Optional Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `DB_POOL_MAX` | Max DB connections | `20` |
| `DB_POOL_MIN` | Min DB connections | `2` |
| `DB_IDLE_TIMEOUT` | Pool idle timeout (ms) | `30000` |
| `DB_CONNECT_TIMEOUT` | Connection timeout (ms) | `5000` |
| `DB_SSL` | Enable SSL for DB | `false` |
| `REDIS_URL` | Redis connection URL | (in-memory if not set) |
| `CACHE_TTL` | Cache TTL in seconds | `300` |
| `CACHE_ENABLED` | Enable caching | `true` |
| `RABBITMQ_URL` | RabbitMQ connection URL | (in-memory if not set) |
| `RABBITMQ_EXCHANGE` | RabbitMQ exchange name | `ecosystem.ip` |
| `EVENTS_ENABLED` | Enable event publishing | `true` |

**AWS Service Environment Variables:**

| Variable | Description |
|----------|-------------|
| `EVENTBRIDGE_BUS_NAME` | EventBridge bus name |
| `EVENTBRIDGE_BUS_ARN` | EventBridge bus ARN |
| `SNS_DEADLINE_ALERTS_TOPIC` | SNS topic for deadline alerts |
| `SNS_CRITICAL_ALERTS_TOPIC` | SNS topic for critical alerts |
| `SNS_IP_EVENTS_TOPIC` | SNS topic for IP events |
| `SNS_TRADE_SECRET_ALERTS_TOPIC` | SNS topic for trade secret alerts |
| `S3_IP_DOCUMENTS_BUCKET` | S3 bucket for IP documents |
| `S3_TRADE_SECRETS_BUCKET` | S3 bucket for trade secrets |
| `KMS_DOCUMENTS_KEY_ID` | KMS key for document encryption |
| `KMS_TRADE_SECRETS_KEY_ID` | KMS key for trade secret encryption |
| `DYNAMODB_DEADLINES_TABLE` | DynamoDB deadlines table |
| `DYNAMODB_EVENTS_TABLE` | DynamoDB events table |
| `CLOUDWATCH_AUDIT_LOG_GROUP` | CloudWatch audit log group |
| `CLOUDWATCH_APPLICATION_LOG_GROUP` | CloudWatch application log group |

### 1.4 Network Requirements

**Inbound:**
- Port 3014 (HTTP) from load balancer/VPC
- Port 443 (HTTPS) if TLS termination at service

**Outbound:**
- PostgreSQL (5432) to RDS
- Redis (6379) to ElastiCache (optional)
- RabbitMQ (5672) to Amazon MQ (optional)
- HTTPS (443) to AWS services:
  - S3 (documents.s3.amazonaws.com)
  - DynamoDB (dynamodb.us-east-1.amazonaws.com)
  - EventBridge (events.us-east-1.amazonaws.com)
  - SNS (sns.us-east-1.amazonaws.com)
  - KMS (kms.us-east-1.amazonaws.com)
  - CloudWatch (logs.us-east-1.amazonaws.com)
  - Secrets Manager (secretsmanager.us-east-1.amazonaws.com)

**DNS Requirements:**
- Internal DNS resolution for RDS endpoint
- VPC endpoints recommended for AWS services in production

---

## 2. Environment Setup

### 2.1 Development Environment Setup

```bash
# 1. Clone the repository
cd /path/to/business-ecosystem
git clone <repository-url>

# 2. Navigate to IP service
cd operational/intellectual-property

# 3. Install dependencies
pnpm install

# 4. Create local environment file
cp .env.example .env

# 5. Configure local environment
cat > .env << 'EOF'
NODE_ENV=development
PORT=3014
LOG_LEVEL=debug
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/intellectual_property
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
CACHE_ENABLED=true
EVENTS_ENABLED=true
EOF

# 6. Start local PostgreSQL (if using Docker)
docker run -d \
  --name ip-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=intellectual_property \
  -p 5432:5432 \
  postgres:15-alpine

# 7. Run database migrations
pnpm db:push

# 8. Start the development server
pnpm dev
```

### 2.2 Staging Environment Setup

```bash
# 1. Configure AWS credentials for staging
export AWS_PROFILE=staging
aws configure --profile staging

# 2. Navigate to terraform directory
cd infrastructure/terraform

# 3. Create staging tfvars
cat > terraform.staging.tfvars << 'EOF'
environment = "staging"
aws_region  = "us-east-1"

# EventBridge
enable_event_archive         = true
event_archive_retention_days = 30

# Deadlines
deadline_alert_days       = [30, 14, 7, 3, 1]
enable_deadline_scheduler = true

# Audit
audit_log_retention_cloudwatch = 30
audit_log_retention_s3         = 365
application_log_retention_days = 14

# Notifications
alert_email                = "ip-staging-alerts@yourcompany.com"
enable_email_notifications = true

# Features
enable_cross_service_events    = true
enable_step_functions          = false
enable_deadline_lambda         = true
enable_trade_secret_mfa_delete = false
EOF

# 4. Initialize and apply Terraform
terraform init
terraform workspace select staging || terraform workspace new staging
terraform plan -var-file=terraform.staging.tfvars -out=staging.tfplan
terraform apply staging.tfplan

# 5. Configure application environment
# Store in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "ip-service/staging/config" \
  --secret-string '{
    "DATABASE_URL": "postgresql://user:pass@staging-rds.xxxxx.us-east-1.rds.amazonaws.com:5432/ip_staging",
    "REDIS_URL": "redis://staging-redis.xxxxx.cache.amazonaws.com:6379",
    "RABBITMQ_URL": "amqp://user:pass@staging-mq.xxxxx.us-east-1.amazonaws.com:5672"
  }'
```

### 2.3 Production Environment Setup

```bash
# 1. Configure AWS credentials for production
export AWS_PROFILE=production
aws configure --profile production

# 2. Navigate to terraform directory
cd infrastructure/terraform

# 3. Create production tfvars
cat > terraform.prod.tfvars << 'EOF'
environment = "prod"
aws_region  = "us-east-1"

# EventBridge
enable_event_archive         = true
event_archive_retention_days = 365

# Deadlines
deadline_alert_days       = [90, 60, 30, 14, 7, 3, 1]
enable_deadline_scheduler = true

# Audit - 7 year retention for compliance
audit_log_retention_cloudwatch = 90
audit_log_retention_s3         = 2555
application_log_retention_days = 30

# Notifications
alert_email                = "ip-prod-alerts@yourcompany.com"
enable_email_notifications = true

# Features
enable_cross_service_events    = true
enable_step_functions          = true
enable_deadline_lambda         = true
enable_trade_secret_mfa_delete = true  # IMPORTANT: Requires manual CLI setup

# DynamoDB
dynamodb_billing_mode = "PAY_PER_REQUEST"
EOF

# 4. Initialize and apply Terraform (with approval workflow)
terraform init
terraform workspace select prod || terraform workspace new prod
terraform plan -var-file=terraform.prod.tfvars -out=prod.tfplan

# CRITICAL: Review plan carefully before applying
terraform apply prod.tfplan
```

### 2.4 Secrets Management (AWS Secrets Manager)

**Create secrets for each environment:**

```bash
# Development secrets (local reference)
aws secretsmanager create-secret \
  --name "ip-service/dev/database" \
  --description "IP Service development database credentials" \
  --secret-string '{
    "host": "localhost",
    "port": 5432,
    "username": "postgres",
    "password": "postgres",
    "database": "intellectual_property"
  }'

# Production secrets
aws secretsmanager create-secret \
  --name "ip-service/prod/database" \
  --description "IP Service production database credentials" \
  --secret-string '{
    "host": "ip-prod-db.xxxxx.us-east-1.rds.amazonaws.com",
    "port": 5432,
    "username": "ip_service",
    "password": "<SECURE_PASSWORD>",
    "database": "intellectual_property"
  }'

# Production API keys
aws secretsmanager create-secret \
  --name "ip-service/prod/api-keys" \
  --description "IP Service production API keys" \
  --secret-string '{
    "sentry_dsn": "https://xxx@sentry.io/xxx",
    "slack_webhook": "https://hooks.slack.com/services/xxx"
  }'
```

**Retrieve secrets in application:**

```bash
# Get database URL
aws secretsmanager get-secret-value \
  --secret-id "ip-service/prod/database" \
  --query 'SecretString' \
  --output text | jq -r '"postgresql://\(.username):\(.password)@\(.host):\(.port)/\(.database)"'
```

---

## 3. Database Setup

### 3.1 PostgreSQL Provisioning (RDS)

**Create RDS instance via AWS Console or CLI:**

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name ip-service-prod \
  --db-subnet-group-description "IP Service production subnets" \
  --subnet-ids subnet-xxx subnet-yyy

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier ip-service-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username ip_admin \
  --master-user-password "<SECURE_PASSWORD>" \
  --allocated-storage 100 \
  --max-allocated-storage 1000 \
  --storage-type gp3 \
  --storage-encrypted \
  --kms-key-id alias/ip-service-prod-documents \
  --db-subnet-group-name ip-service-prod \
  --vpc-security-group-ids sg-xxx \
  --db-name intellectual_property \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Sun:04:00-Sun:05:00" \
  --multi-az \
  --publicly-accessible false \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --deletion-protection \
  --tags Key=Service,Value=intellectual-property Key=Environment,Value=prod
```

**RDS recommended settings by environment:**

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| Instance Class | db.t3.micro | db.t3.small | db.t3.medium+ |
| Storage | 20 GB | 50 GB | 100 GB+ |
| Multi-AZ | No | No | Yes |
| Backup Retention | 1 day | 7 days | 30 days |
| Encryption | Optional | Yes | Yes |
| Performance Insights | No | Yes | Yes |
| Deletion Protection | No | Yes | Yes |

### 3.2 Running Migrations with Drizzle

**Generate migrations:**

```bash
# Navigate to service directory
cd operational/intellectual-property

# Generate new migration
pnpm db:generate

# This creates files in migrations/ directory
ls -la migrations/
```

**Apply migrations:**

```bash
# Development - direct push (no migration files)
pnpm db:push

# Staging/Production - run migration files
DATABASE_URL="postgresql://user:pass@host:5432/db" pnpm db:push

# Or use drizzle-kit directly
npx drizzle-kit push:pg --config=drizzle.config.ts
```

**Migration checklist:**

- [ ] Review generated SQL in `migrations/` directory
- [ ] Test migration on staging first
- [ ] Create database backup before production migration
- [ ] Schedule maintenance window for breaking changes
- [ ] Verify application compatibility with schema changes

**View migration status:**

```bash
# Check database studio (local development)
pnpm db:studio

# Introspect existing database
pnpm db:introspect
```

### 3.3 Database Backup Configuration

**Automated backups (RDS):**

```bash
# Modify backup retention
aws rds modify-db-instance \
  --db-instance-identifier ip-service-prod \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --apply-immediately
```

**Manual snapshot before deployment:**

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier ip-service-prod \
  --db-snapshot-identifier ip-service-prod-pre-deploy-$(date +%Y%m%d-%H%M%S)

# Verify snapshot
aws rds describe-db-snapshots \
  --db-instance-identifier ip-service-prod \
  --query 'DBSnapshots[0].{ID:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime}'
```

**Point-in-time recovery:**

```bash
# Restore to new instance at specific time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier ip-service-prod \
  --target-db-instance-identifier ip-service-prod-restored \
  --restore-time "2024-01-15T12:00:00Z"
```

### 3.4 Connection String Configuration

**Connection string format:**

```
postgresql://[user]:[password]@[host]:[port]/[database]?[options]
```

**Production connection string with SSL:**

```bash
# With SSL (recommended for production)
DATABASE_URL="postgresql://ip_service:password@ip-prod-db.xxxxx.us-east-1.rds.amazonaws.com:5432/intellectual_property?sslmode=require"

# Environment variables for pooling
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=5000
DB_SSL=true
```

**Connection pool sizing guide:**

| Environment | Max Connections | Min Connections | Notes |
|-------------|-----------------|-----------------|-------|
| Development | 5 | 1 | Local PostgreSQL |
| Staging | 10 | 2 | Shared instance |
| Production | 20-50 | 5 | Based on RDS instance size |

---

## 4. Infrastructure Deployment (Terraform)

### 4.1 Initialize Terraform

```bash
# Navigate to terraform directory
cd infrastructure/terraform

# Initialize Terraform (downloads providers)
terraform init

# For S3 backend (production)
terraform init \
  -backend-config="bucket=business-ecosystem-terraform-state" \
  -backend-config="key=intellectual-property/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=terraform-state-lock" \
  -backend-config="encrypt=true"
```

### 4.2 Plan and Review Changes

```bash
# Select workspace
terraform workspace select prod || terraform workspace new prod

# Plan with specific tfvars
terraform plan \
  -var-file=terraform.prod.tfvars \
  -out=tfplan

# Review plan output
terraform show tfplan

# Generate human-readable plan
terraform show -no-color tfplan > tfplan.txt
```

**Plan review checklist:**

- [ ] No unexpected resource deletions
- [ ] KMS key changes reviewed (30-day deletion window)
- [ ] S3 bucket changes reviewed (data loss risk)
- [ ] DynamoDB table changes reviewed (data loss risk)
- [ ] IAM policy changes reviewed (security impact)
- [ ] EventBridge rule changes reviewed (event routing impact)

### 4.3 Apply Infrastructure

```bash
# Apply with plan file (recommended)
terraform apply tfplan

# Or apply with auto-approve (CI/CD only)
terraform apply -var-file=terraform.prod.tfvars -auto-approve
```

**Resources created by Terraform:**

| Resource Type | Name Pattern | Purpose |
|---------------|--------------|---------|
| KMS Key | `ip-service-{env}-documents` | Document encryption |
| KMS Key | `ip-service-{env}-trade-secrets` | Trade secret encryption |
| S3 Bucket | `ip-service-{env}-documents` | IP document storage |
| S3 Bucket | `ip-service-{env}-trade-secrets` | Trade secret storage |
| DynamoDB Table | `ip-service-{env}-deadlines` | Deadline tracking |
| DynamoDB Table | `ip-service-{env}-events` | Event sourcing |
| EventBridge Bus | `ip-service-{env}-events` | Event routing |
| SNS Topic | `ip-service-{env}-deadline-alerts` | Deadline notifications |
| SNS Topic | `ip-service-{env}-critical-alerts` | Critical alerts |
| SNS Topic | `ip-service-{env}-trade-secret-alerts` | Trade secret alerts |
| CloudWatch Log Group | `/ip-service/{env}/audit` | Audit logs |
| CloudWatch Log Group | `/ip-service/{env}/application` | Application logs |
| IAM Role | `ip-service-{env}-service-role` | Service execution role |

### 4.4 Verify Resource Creation

```bash
# Verify S3 buckets
aws s3 ls | grep ip-service

# Verify DynamoDB tables
aws dynamodb list-tables | grep ip-service

# Verify EventBridge event bus
aws events list-event-buses | grep ip-service

# Verify SNS topics
aws sns list-topics | grep ip-service

# Verify KMS keys
aws kms list-aliases | grep ip-service

# Verify CloudWatch log groups
aws logs describe-log-groups --log-group-name-prefix /ip-service

# Get all Terraform outputs
terraform output -json > outputs.json
cat outputs.json | jq .
```

---

## 5. Application Deployment

### 5.1 Build the Application

```bash
# Navigate to service directory
cd operational/intellectual-property

# Clean previous build
pnpm clean

# Install dependencies
pnpm install --frozen-lockfile

# Type check
pnpm typecheck

# Run tests
pnpm test

# Build production bundle
pnpm build

# Verify build output
ls -la dist/
```

### 5.2 Docker Image Build and Push to ECR

**Create ECR repository:**

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name intellectual-property \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=KMS

# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com
```

**Build and push image:**

```bash
# Set variables
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1
export IMAGE_TAG=$(git rev-parse --short HEAD)
export ECR_REPO=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/intellectual-property

# Build Docker image
docker build \
  -t intellectual-property:${IMAGE_TAG} \
  -t intellectual-property:latest \
  -f Dockerfile \
  .

# Tag for ECR
docker tag intellectual-property:${IMAGE_TAG} ${ECR_REPO}:${IMAGE_TAG}
docker tag intellectual-property:latest ${ECR_REPO}:latest

# Push to ECR
docker push ${ECR_REPO}:${IMAGE_TAG}
docker push ${ECR_REPO}:latest

# Verify push
aws ecr describe-images \
  --repository-name intellectual-property \
  --query 'imageDetails[*].{Tag:imageTags[0],Pushed:imagePushedAt}' \
  --output table
```

### 5.3 ECS Deployment

**Create ECS task definition:**

```bash
# Create task definition JSON
cat > task-definition.json << 'EOF'
{
  "family": "ip-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ip-service-prod-service-role",
  "containerDefinitions": [
    {
      "name": "ip-service",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/intellectual-property:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3014,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3014"},
        {"name": "AWS_REGION", "value": "us-east-1"}
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:${AWS_ACCOUNT_ID}:secret:ip-service/prod/database:DATABASE_URL::"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3014/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ip-service/prod/application",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

**Update ECS service:**

```bash
# Update service with new task definition
aws ecs update-service \
  --cluster ip-service-cluster \
  --service ip-service \
  --task-definition ip-service:latest \
  --force-new-deployment

# Monitor deployment
aws ecs describe-services \
  --cluster ip-service-cluster \
  --services ip-service \
  --query 'services[0].deployments'
```

### 5.4 Lambda Deployment (Alternative)

For serverless deployment using Lambda:

```bash
# Build Lambda package
pnpm build
zip -r lambda.zip dist node_modules package.json

# Create Lambda function
aws lambda create-function \
  --function-name ip-service \
  --runtime nodejs20.x \
  --role arn:aws:iam::${AWS_ACCOUNT_ID}:role/ip-service-prod-service-role \
  --handler dist/lambda.handler \
  --zip-file fileb://lambda.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables="{NODE_ENV=production}"

# Update existing function
aws lambda update-function-code \
  --function-name ip-service \
  --zip-file fileb://lambda.zip
```

### 5.5 Environment Variable Configuration

**ECS environment configuration:**

```bash
# Update task definition with environment variables
# (Usually done through Terraform or CloudFormation)

# Verify environment in running task
aws ecs describe-tasks \
  --cluster ip-service-cluster \
  --tasks $(aws ecs list-tasks --cluster ip-service-cluster --service-name ip-service --query 'taskArns[0]' --output text) \
  --query 'tasks[0].overrides.containerOverrides[0].environment'
```

---

## 6. Post-Deployment Verification

### 6.1 Health Check Verification

**Endpoint verification:**

```bash
# Set service URL
export SERVICE_URL="http://ip-service-alb.us-east-1.elb.amazonaws.com"

# 1. Liveness probe
curl -s ${SERVICE_URL}/health/live | jq .
# Expected: {"status":"ok","timestamp":"..."}

# 2. Readiness probe
curl -s ${SERVICE_URL}/health/ready | jq .
# Expected: {"status":"ready","timestamp":"..."}

# 3. Detailed health check
curl -s ${SERVICE_URL}/health | jq .
# Expected: Full component status including postgres, cache, memory

# 4. Service info
curl -s ${SERVICE_URL}/ | jq .
# Expected: Service metadata and version
```

**Health check response interpretation:**

| Status | Meaning | Action |
|--------|---------|--------|
| `healthy` | All systems operational | None |
| `degraded` | Non-critical component issue | Monitor, investigate |
| `unhealthy` | Critical component failure | Rollback, investigate |

### 6.2 Database Connectivity Test

```bash
# Connect to database (from bastion host or VPN)
PGPASSWORD=$DB_PASSWORD psql \
  -h ip-prod-db.xxxxx.us-east-1.rds.amazonaws.com \
  -U ip_service \
  -d intellectual_property \
  -c "SELECT current_timestamp, current_user, version();"

# Verify tables exist
psql -c "\dt"

# Check migration status
psql -c "SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
```

### 6.3 AWS Service Connectivity Tests

```bash
# Test S3 access
aws s3 ls s3://ip-service-prod-documents/

# Test DynamoDB access
aws dynamodb scan \
  --table-name ip-service-prod-deadlines \
  --max-items 1

# Test EventBridge
aws events put-events --entries '[{
  "Source": "ip-service-test",
  "DetailType": "TestEvent",
  "Detail": "{\"test\": true}",
  "EventBusName": "ip-service-prod-events"
}]'

# Test SNS
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:${AWS_ACCOUNT_ID}:ip-service-prod-deadline-alerts \
  --message "Deployment test notification"

# Test KMS
aws kms encrypt \
  --key-id alias/ip-service-prod-documents \
  --plaintext "test" \
  --query CiphertextBlob \
  --output text
```

### 6.4 Smoke Tests for Critical Endpoints

```bash
# Create test patent
curl -X POST ${SERVICE_URL}/api/v1/patents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -d '{
    "title": "Smoke Test Patent",
    "type": "utility",
    "inventors": ["Test Inventor"]
  }' | jq .

# Get patents list
curl -s ${SERVICE_URL}/api/v1/patents | jq .

# Create test trademark
curl -X POST ${SERVICE_URL}/api/v1/trademarks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -d '{
    "mark": "SMOKE_TEST",
    "type": "word",
    "ownerId": "00000000-0000-0000-0000-000000000001"
  }' | jq .

# API documentation
curl -s ${SERVICE_URL}/docs | head -20
```

**Smoke test checklist:**

- [ ] `/health` returns `healthy`
- [ ] `/health/live` returns 200
- [ ] `/health/ready` returns 200
- [ ] `POST /api/v1/patents` creates patent
- [ ] `GET /api/v1/patents` lists patents
- [ ] `POST /api/v1/trademarks` creates trademark
- [ ] `GET /api/v1/trademarks` lists trademarks
- [ ] API docs accessible at `/docs`

---

## 7. Monitoring Setup

### 7.1 CloudWatch Dashboards

**Create dashboard:**

```bash
cat > dashboard.json << 'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "title": "Request Count",
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "ip-service-alb"]
        ],
        "period": 60,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Response Time",
        "metrics": [
          ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "ip-service-alb"]
        ],
        "period": 60,
        "stat": "Average"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Error Rate",
        "metrics": [
          ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", "ip-service-alb"]
        ],
        "period": 60,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Database Connections",
        "metrics": [
          ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "ip-service-prod"]
        ],
        "period": 60,
        "stat": "Average"
      }
    },
    {
      "type": "log",
      "properties": {
        "title": "Application Errors",
        "query": "SOURCE '/ip-service/prod/application' | filter @message like /ERROR/ | sort @timestamp desc | limit 20"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name ip-service-prod \
  --dashboard-body file://dashboard.json
```

### 7.2 Log Groups and Retention

**Log groups created by Terraform:**

| Log Group | Retention | Purpose |
|-----------|-----------|---------|
| `/ip-service/{env}/audit` | 90 days CW / 7 years S3 | Audit trail |
| `/ip-service/{env}/application` | 30 days | Application logs |
| `/ip-service/{env}/trade-secret-access` | 90 days | Trade secret access |

**Query logs:**

```bash
# Recent errors
aws logs filter-log-events \
  --log-group-name /ip-service/prod/application \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000) \
  --query 'events[*].message'

# Specific request trace
aws logs filter-log-events \
  --log-group-name /ip-service/prod/application \
  --filter-pattern '{ $.correlationId = "abc-123" }'
```

### 7.3 Alarms Configuration

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name ip-service-prod-high-error-rate \
  --alarm-description "IP Service error rate > 5%" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:${AWS_ACCOUNT_ID}:ip-service-prod-critical-alerts

# High latency alarm
aws cloudwatch put-metric-alarm \
  --alarm-name ip-service-prod-high-latency \
  --alarm-description "IP Service P99 latency > 2s" \
  --metric-name TargetResponseTime \
  --namespace AWS/ApplicationELB \
  --extended-statistic p99 \
  --period 300 \
  --threshold 2 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --alarm-actions arn:aws:sns:us-east-1:${AWS_ACCOUNT_ID}:ip-service-prod-deadline-alerts

# Database connection alarm
aws cloudwatch put-metric-alarm \
  --alarm-name ip-service-prod-db-connections \
  --alarm-description "Database connections > 80%" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=ip-service-prod \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:${AWS_ACCOUNT_ID}:ip-service-prod-critical-alerts
```

### 7.4 PagerDuty/OpsGenie Integration

**SNS to PagerDuty:**

```bash
# Create PagerDuty integration endpoint
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:${AWS_ACCOUNT_ID}:ip-service-prod-critical-alerts \
  --protocol https \
  --notification-endpoint "https://events.pagerduty.com/integration/<integration-key>/enqueue"
```

**Recommended alert routing:**

| Alert Type | Destination | Priority |
|------------|-------------|----------|
| Health check failure | PagerDuty | P1 (Critical) |
| High error rate (>5%) | PagerDuty | P2 (High) |
| Missed IP deadline | PagerDuty | P2 (High) |
| Trade secret accessed | Slack + Email | P3 (Medium) |
| High latency (>2s) | Slack | P4 (Low) |
| Deadline approaching | Email | P5 (Info) |

---

## 8. Rollback Procedures

### 8.1 Application Rollback

**ECS rollback:**

```bash
# List recent task definitions
aws ecs list-task-definitions \
  --family-prefix ip-service \
  --sort DESC \
  --max-items 5

# Rollback to previous version
aws ecs update-service \
  --cluster ip-service-cluster \
  --service ip-service \
  --task-definition ip-service:PREVIOUS_VERSION \
  --force-new-deployment

# Monitor rollback
watch -n 5 'aws ecs describe-services --cluster ip-service-cluster --services ip-service --query "services[0].deployments"'
```

**Docker image rollback:**

```bash
# List available images
aws ecr describe-images \
  --repository-name intellectual-property \
  --query 'imageDetails[*].{Tag:imageTags[0],Pushed:imagePushedAt}' \
  --output table

# Re-tag previous image as latest
PREV_TAG="abc1234"
docker pull ${ECR_REPO}:${PREV_TAG}
docker tag ${ECR_REPO}:${PREV_TAG} ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest
```

### 8.2 Database Rollback

**Restore from snapshot:**

```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier ip-service-prod \
  --query 'DBSnapshots[*].{ID:DBSnapshotIdentifier,Created:SnapshotCreateTime,Status:Status}'

# Restore to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ip-service-prod-rollback \
  --db-snapshot-identifier ip-service-prod-pre-deploy-20240115

# Wait for restoration
aws rds wait db-instance-available \
  --db-instance-identifier ip-service-prod-rollback

# Update DNS/connection string to point to restored instance
# (Manual step - update secrets manager)
```

**Point-in-time recovery:**

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier ip-service-prod \
  --target-db-instance-identifier ip-service-prod-pitr \
  --restore-time "2024-01-15T11:30:00Z" \
  --use-latest-restorable-time
```

### 8.3 Infrastructure Rollback

**Terraform state rollback:**

```bash
# View state history (if using S3 versioning)
aws s3api list-object-versions \
  --bucket business-ecosystem-terraform-state \
  --prefix intellectual-property/terraform.tfstate

# Restore previous state version
aws s3api get-object \
  --bucket business-ecosystem-terraform-state \
  --key intellectual-property/terraform.tfstate \
  --version-id "PREVIOUS_VERSION_ID" \
  terraform.tfstate.backup

# Apply previous state
terraform state push terraform.tfstate.backup

# Re-apply to restore infrastructure
terraform apply -var-file=terraform.prod.tfvars
```

**Manual resource restoration:**

```bash
# If DynamoDB table was deleted
aws dynamodb restore-table-from-backup \
  --target-table-name ip-service-prod-deadlines \
  --backup-arn arn:aws:dynamodb:us-east-1:${AWS_ACCOUNT_ID}:table/ip-service-prod-deadlines/backup/xxx
```

### 8.4 Emergency Contacts

| Role | Name | Contact | Escalation |
|------|------|---------|------------|
| Primary On-Call | DevOps Team | @devops-oncall (Slack) | PagerDuty |
| Database Admin | DBA Team | dba@yourcompany.com | Phone |
| Security | Security Team | security@yourcompany.com | Phone |
| Engineering Lead | Tech Lead | @tech-lead (Slack) | Phone |
| AWS Support | AWS | Premium Support Console | Case |

---

## 9. Troubleshooting Guide

### 9.1 Common Deployment Issues

**Build failures:**

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| TypeScript errors | `pnpm build` fails | Run `pnpm typecheck`, fix errors |
| Missing dependencies | Module not found | Run `pnpm install --frozen-lockfile` |
| Node version mismatch | Syntax errors | Use Node.js 20.x |
| Memory exhausted | Build killed | Increase Node memory: `NODE_OPTIONS=--max_old_space_size=4096` |

**Docker build failures:**

```bash
# Clear Docker cache
docker system prune -af

# Build with no cache
docker build --no-cache -t intellectual-property:latest .

# Check for large files
du -sh node_modules
du -sh dist
```

**ECR push failures:**

```bash
# Re-authenticate
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ${ECR_REPO}

# Check repository permissions
aws ecr get-repository-policy --repository-name intellectual-property
```

### 9.2 Database Connection Issues

**Connection refused:**

```bash
# Check security group
aws ec2 describe-security-groups \
  --group-ids sg-xxx \
  --query 'SecurityGroups[0].IpPermissions'

# Check RDS status
aws rds describe-db-instances \
  --db-instance-identifier ip-service-prod \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint}'

# Test network connectivity
nc -zv ip-prod-db.xxxxx.us-east-1.rds.amazonaws.com 5432
```

**Too many connections:**

```bash
# Check current connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Terminate idle connections
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < now() - interval '10 minutes';"

# Adjust pool settings
export DB_POOL_MAX=10
export DB_POOL_MIN=2
```

**SSL/TLS errors:**

```bash
# Test SSL connection
openssl s_client -connect ip-prod-db.xxxxx.us-east-1.rds.amazonaws.com:5432 -starttls postgres

# Use correct SSL mode
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### 9.3 AWS Permission Issues

**Access denied errors:**

```bash
# Check current identity
aws sts get-caller-identity

# Test specific permission
aws s3 ls s3://ip-service-prod-documents/ 2>&1

# Check IAM role policies
aws iam list-role-policies --role-name ip-service-prod-service-role
aws iam list-attached-role-policies --role-name ip-service-prod-service-role

# Simulate permission
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::${AWS_ACCOUNT_ID}:role/ip-service-prod-service-role \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::ip-service-prod-documents/test.pdf
```

**KMS key issues:**

```bash
# Check key policy
aws kms get-key-policy \
  --key-id alias/ip-service-prod-documents \
  --policy-name default

# Verify grants
aws kms list-grants --key-id alias/ip-service-prod-documents
```

### 9.4 Health Check Failures

**Readiness probe fails:**

```bash
# Check application logs
aws logs tail /ip-service/prod/application --follow

# Check database connectivity
curl -s http://localhost:3014/health | jq '.components[] | select(.name=="postgres")'

# Check cache connectivity
curl -s http://localhost:3014/health | jq '.components[] | select(.name=="cache")'
```

**Health endpoint returns degraded:**

| Component | Status | Likely Cause | Resolution |
|-----------|--------|--------------|------------|
| postgres | unhealthy | DB connection failed | Check RDS, security groups |
| cache | unhealthy | Redis connection failed | Check ElastiCache, use in-memory |
| memory | degraded | >90% heap usage | Increase memory, check for leaks |

**Debugging health checks:**

```bash
# Get detailed health info
curl -s http://localhost:3014/health | jq .

# Check individual components
curl -s http://localhost:3014/health | jq '.components'

# Monitor over time
watch -n 5 'curl -s http://localhost:3014/health | jq ".status"'
```

---

## 10. Maintenance Procedures

### 10.1 Scaling Up/Down

**ECS scaling:**

```bash
# Manual scaling
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/ip-service-cluster/ip-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Configure auto-scaling
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/ip-service-cluster/ip-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name ip-service-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 300,
    "ScaleInCooldown": 300
  }'
```

**RDS scaling:**

```bash
# Vertical scaling (instance class)
aws rds modify-db-instance \
  --db-instance-identifier ip-service-prod \
  --db-instance-class db.t3.large \
  --apply-immediately

# Storage scaling (automatic if configured)
aws rds modify-db-instance \
  --db-instance-identifier ip-service-prod \
  --allocated-storage 200 \
  --apply-immediately
```

### 10.2 Database Maintenance Windows

**Schedule maintenance:**

```bash
# View current maintenance window
aws rds describe-db-instances \
  --db-instance-identifier ip-service-prod \
  --query 'DBInstances[0].PreferredMaintenanceWindow'

# Update maintenance window
aws rds modify-db-instance \
  --db-instance-identifier ip-service-prod \
  --preferred-maintenance-window "Sun:04:00-Sun:05:00"
```

**Pre-maintenance checklist:**

- [ ] Notify stakeholders of maintenance window
- [ ] Create manual snapshot
- [ ] Verify backup restoration process
- [ ] Prepare rollback plan
- [ ] Monitor during maintenance

### 10.3 Certificate Rotation

**ACM certificates:**

```bash
# Check certificate expiration
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:${AWS_ACCOUNT_ID}:certificate/xxx \
  --query 'Certificate.{DomainName:DomainName,NotAfter:NotAfter,Status:Status}'

# ACM auto-renews managed certificates
# For imported certificates, manually import new certificate
aws acm import-certificate \
  --certificate fileb://cert.pem \
  --private-key fileb://key.pem \
  --certificate-chain fileb://chain.pem \
  --certificate-arn arn:aws:acm:us-east-1:${AWS_ACCOUNT_ID}:certificate/xxx
```

**RDS SSL certificates:**

```bash
# Check certificate expiration
aws rds describe-db-instances \
  --db-instance-identifier ip-service-prod \
  --query 'DBInstances[0].CACertificateIdentifier'

# Update CA certificate
aws rds modify-db-instance \
  --db-instance-identifier ip-service-prod \
  --ca-certificate-identifier rds-ca-rsa2048-g1 \
  --apply-immediately
```

### 10.4 Secret Rotation

**Automatic rotation setup:**

```bash
# Enable rotation for database secret
aws secretsmanager rotate-secret \
  --secret-id ip-service/prod/database \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:${AWS_ACCOUNT_ID}:function/SecretsManagerRDSPostgreSQLRotationSingleUser \
  --rotation-rules '{"AutomaticallyAfterDays": 30}'

# Manual rotation
aws secretsmanager rotate-secret \
  --secret-id ip-service/prod/database
```

**Post-rotation verification:**

```bash
# Verify new secret works
NEW_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id ip-service/prod/database \
  --query SecretString --output text)

# Test connection
psql "$(echo $NEW_SECRET | jq -r '"postgresql://\(.username):\(.password)@\(.host):\(.port)/\(.database)"')" \
  -c "SELECT 1"

# Restart application to pick up new credentials
aws ecs update-service \
  --cluster ip-service-cluster \
  --service ip-service \
  --force-new-deployment
```

---

## Appendix A: Quick Reference Commands

```bash
# Health check
curl -s ${SERVICE_URL}/health | jq .

# View logs
aws logs tail /ip-service/prod/application --follow

# Restart service
aws ecs update-service --cluster ip-service-cluster --service ip-service --force-new-deployment

# Scale to N instances
aws ecs update-service --cluster ip-service-cluster --service ip-service --desired-count N

# Create backup
aws rds create-db-snapshot --db-instance-identifier ip-service-prod --db-snapshot-identifier manual-$(date +%Y%m%d)

# Run migrations
DATABASE_URL="..." pnpm db:push

# Terraform plan
terraform plan -var-file=terraform.prod.tfvars

# Deploy new image
docker build -t ${ECR_REPO}:${TAG} . && docker push ${ECR_REPO}:${TAG}
```

---

## Appendix B: Environment Comparison

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| Database | Local PostgreSQL | RDS t3.small | RDS t3.medium+ Multi-AZ |
| Cache | In-memory | ElastiCache t3.micro | ElastiCache t3.small |
| ECS Tasks | N/A | 1 | 2+ (auto-scaling) |
| Backup Retention | None | 7 days | 30 days |
| Audit Log Retention | None | 30 days | 7 years |
| KMS Encryption | Optional | Yes | Yes |
| Trade Secret MFA Delete | No | No | Yes |
| EventBridge Archive | 7 days | 30 days | 365 days |

---

## Appendix C: Terraform Outputs Reference

After running `terraform apply`, these outputs are available:

```bash
terraform output -json
```

Key outputs:
- `kms_key_documents_arn` - KMS key for document encryption
- `kms_key_trade_secrets_arn` - KMS key for trade secrets
- `s3_bucket_documents_name` - S3 bucket for IP documents
- `s3_bucket_trade_secrets_name` - S3 bucket for trade secrets
- `dynamodb_deadlines_table_name` - DynamoDB deadlines table
- `dynamodb_events_table_name` - DynamoDB events table
- `eventbridge_bus_name` - EventBridge event bus
- `sns_deadline_alerts_arn` - SNS topic for deadline alerts
- `sns_critical_alerts_arn` - SNS topic for critical alerts
- `iam_service_role_arn` - IAM role for the service
- `aws_config` - Complete configuration object for application

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-30 | Platform Team | Initial release |

---

*This runbook is maintained by the Platform Engineering team. For questions or updates, contact platform-eng@yourcompany.com.*
