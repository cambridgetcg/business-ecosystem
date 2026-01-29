# Infrastructure

Local development infrastructure and Infrastructure as Code (IaC) for the business ecosystem.

## Purpose

The `infrastructure/` directory provides everything needed to run the business ecosystem locally and deploy it to cloud environments. It includes:

- **Local Development**: Docker Compose stack for all supporting services
- **Infrastructure as Code**: Terraform modules for AWS deployment
- **Observability**: Prometheus, Grafana, and Jaeger configuration
- **Database Initialization**: Scripts for creating domain databases

## Quick Start

### Local Development

```bash
# Start all infrastructure services
cd infrastructure
docker-compose up -d

# Or from root
pnpm docker:up

# Check service health
docker-compose ps

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Verify Services

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | `localhost:5432` | postgres / postgres |
| Redis | `localhost:6379` | - |
| RabbitMQ | `localhost:5672` | guest / guest |
| RabbitMQ UI | `localhost:15672` | guest / guest |
| MinIO | `localhost:9000` | minioadmin / minioadmin |
| MinIO Console | `localhost:9001` | minioadmin / minioadmin |
| Elasticsearch | `localhost:9200` | - |
| Jaeger UI | `localhost:16686` | - |
| Prometheus | `localhost:9090` | - |
| Grafana | `localhost:3000` | admin / admin |

## Directory Structure

```
infrastructure/
├── docker-compose.yml      # Local development stack
├── init-scripts/           # Database initialization
│   └── postgres/
│       └── 01-create-databases.sql
├── terraform/              # Infrastructure as Code
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   └── modules/
│       ├── vpc/
│       ├── rds/
│       ├── elasticache/
│       ├── ecs/
│       └── ...
├── prometheus/             # Metrics collection config
│   └── prometheus.yml
└── grafana/                # Dashboards and datasources
    └── provisioning/
        ├── dashboards/
        └── datasources/
```

## Services

### Core Data Stores

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| **PostgreSQL** | postgres:16-alpine | Primary database | 5432 |
| **Redis** | redis:7-alpine | Caching, sessions, rate limiting | 6379 |
| **RabbitMQ** | rabbitmq:3-management | Message broker | 5672, 15672 |
| **Elasticsearch** | elasticsearch:8.11.0 | Search, audit logs | 9200 |

### AWS Emulation

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| **LocalStack** | localstack/localstack | S3, SQS, SNS, SES, Secrets | 4566 |
| **MinIO** | minio/minio | S3-compatible storage | 9000, 9001 |

### Observability

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| **Prometheus** | prom/prometheus | Metrics collection | 9090 |
| **Grafana** | grafana/grafana | Metrics visualization | 3000 |
| **Jaeger** | jaegertracing/all-in-one | Distributed tracing | 16686, 4317, 4318 |

## Database Initialization

When PostgreSQL starts, it automatically runs scripts in `init-scripts/postgres/`:

```sql
-- Creates separate database per domain (bounded contexts)
CREATE DATABASE entity_governance;
CREATE DATABASE banking_treasury;
CREATE DATABASE accounting;
CREATE DATABASE compliance;
CREATE DATABASE contracts_legal;
CREATE DATABASE insurance;
CREATE DATABASE intellectual_property;
CREATE DATABASE data_privacy;
-- ... and more
```

Each domain service connects to its own database, enforcing domain boundaries.

## Terraform (IaC)

### Structure

```
terraform/
├── modules/                # Reusable modules
│   ├── vpc/                # Network configuration
│   ├── rds/                # PostgreSQL RDS
│   ├── elasticache/        # Redis cluster
│   ├── ecs/                # Container orchestration
│   ├── alb/                # Load balancer
│   ├── secrets/            # Secrets Manager
│   └── monitoring/         # CloudWatch, alarms
└── environments/
    ├── dev/                # Development environment
    ├── staging/            # Staging environment
    └── production/         # Production environment
```

### Deployment

```bash
cd terraform/environments/dev

# Initialize
terraform init

# Plan changes
terraform plan

# Apply
terraform apply
```

### Key Resources

| Module | AWS Service | Purpose |
|--------|-------------|---------|
| `vpc` | VPC, Subnets | Network isolation |
| `rds` | RDS PostgreSQL | Primary database |
| `elasticache` | ElastiCache Redis | Caching layer |
| `ecs` | ECS Fargate | Container hosting |
| `alb` | Application LB | Load balancing |
| `secrets` | Secrets Manager | Credential storage |

## Observability Configuration

### Prometheus

Configured in `prometheus/prometheus.yml` to scrape:
- All domain services on `/metrics` endpoint
- Infrastructure services (PostgreSQL exporter, Redis exporter)
- Node metrics

### Grafana

Pre-configured dashboards in `grafana/provisioning/dashboards/`:
- **System Overview**: CPU, memory, network across services
- **Database Metrics**: PostgreSQL connections, queries, replication
- **Cache Metrics**: Redis hit rates, memory, connections
- **Business Metrics**: Domain-specific KPIs

### Jaeger

Distributed tracing configured to receive:
- OTLP over gRPC (port 4317)
- OTLP over HTTP (port 4318)

Services use OpenTelemetry SDK to emit traces.

## Environment Variables

Services expect these environment variables (with defaults for local development):

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/{domain}_db

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# AWS (LocalStack)
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

## Common Operations

### Reset Everything

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it ecosystem-postgres psql -U postgres

# Connect to specific database
docker exec -it ecosystem-postgres psql -U postgres -d entity_governance

# Redis CLI
docker exec -it ecosystem-redis redis-cli
```

### Logs and Debugging

```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f postgres

# RabbitMQ queues
docker exec ecosystem-rabbitmq rabbitmqctl list_queues
```

## Health Checks

All services include health checks. Verify with:

```bash
# Service status
docker-compose ps

# Detailed health
docker inspect --format='{{.State.Health.Status}}' ecosystem-postgres
docker inspect --format='{{.State.Health.Status}}' ecosystem-redis
```

## Related Documentation

- [BACKBONE.md](../docs/BACKBONE.md) - Architecture and app initialization
- [shared/README.md](../shared/README.md) - Shared libraries including database/cache
- [terraform/README.md](./terraform/README.md) - Detailed IaC documentation
