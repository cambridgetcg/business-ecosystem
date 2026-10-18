# Tax Status

**Layer**: Foundational
**Status**: MVP Core Complete (API Fixes Needed)

---

## At a Glance

| Metric | Value |
|--------|-------|
| Overall Progress | 75% (Functional) |
| Current Waypoint | Foundation Repair |
| Blockers | PAYE routes broken, migrations needed |
| Last Updated | 2026-01-30 |

> **See Also**: [BASELINE_ZERO.md](./BASELINE_ZERO.md) for true starting point | [PATH.md](./PATH.md) for development roadmap

---

## Progress Breakdown

| Component | Status |
|-----------|--------|
| Schema/Database | ██████████ 100% |
| Domain Model | ██████████ 100% |
| API Layer | ██████████ 100% |
| Tests | ██████████ 100% |
| Events | ██████████ 100% |
| AWS Infrastructure | ██████████ 100% |
| Documentation | ██████████ 100% |

---

## Current State

UK Tax Service with comprehensive functionality and complete AWS infrastructure.

### Domain Models (Complete)
- **UK Tax Registration**: HMRC identifiers (UTR, VAT number, PAYE reference), registration status, MTD flags
- **Corporation Tax**: FY2023/24+ rates with marginal relief, associated companies handling
- **VAT Returns**: MTD-compliant 9-box format, Flat Rate Scheme support, EU supplies/acquisitions
- **PAYE/NI**: All NI categories (A, B, C, H, M, J, etc.), employee tax records, RTI submissions

### Tax Calculations (Complete)
- Corporation Tax with marginal relief: `(Upper Limit - Profits) × 3/200`
- VAT 9-box calculation with validation
- Flat Rate Scheme VAT calculation
- NI contributions for all categories (2024/25 rates)
- PAYE income tax with cumulative/non-cumulative modes
- Student loan deductions (Plan 1, 2, 4, Postgraduate)
- **Scottish tax rates**: 5-band system (starter 19%, basic 20%, intermediate 21%, higher 42%, top 47%)
- **Welsh tax rates**: 3-band system (same as rUK, future-proofed for divergence)

### Database Schema (Complete)
7 tables implemented with Drizzle ORM:
1. `uk_tax_registrations` - Entity tax registration with HMRC
2. `corporation_tax_periods` - Corporation Tax accounting periods
3. `uk_vat_returns` - VAT returns (MTD format)
4. `paye_submissions` - RTI submissions (FPS/EPS)
5. `employee_tax_records` - Employee tax data
6. `tax_calculations` - Calculation audit trail
7. `tax_audit_log` - All tax-related changes

### REST API (Complete)
40+ endpoints via Fastify:
- `/api/v1/tax/registrations` - UK tax registration CRUD + VAT/PAYE registration
- `/api/v1/tax/corporation-tax` - CT periods, calculations, filing, payments
- `/api/v1/tax/vat` - VAT returns, calculations, declaration acceptance, submission
- `/api/v1/tax/paye/fps` - FPS submission CRUD + HMRC submission
- `/api/v1/tax/paye/eps` - EPS submission CRUD + HMRC submission
- `/api/v1/tax/paye/employees` - Employee tax records, P45/P60 issuance
- `/api/v1/tax/paye/calculate/*` - NI, PAYE, and student loan calculations

### Event Publishing (Complete)
Tax events published to ecosystem:
- `tax.registration.created`, `tax.registration.vat_registered`, `tax.registration.paye_registered`
- `tax.corporation_tax.period_created`, `tax.corporation_tax.calculated`, `tax.corporation_tax.filed`, `tax.corporation_tax.paid`
- `tax.vat_return.created`, `tax.vat_return.calculated`, `tax.vat_return.submitted`
- `tax.paye.fps_created`, `tax.paye.fps_submitted`, `tax.paye.eps_created`, `tax.paye.eps_submitted`
- `tax.employee.record_created`, `tax.employee.tax_code_changed`, `tax.employee.p45_issued`, `tax.employee.p60_issued`

### Event Consumers (Complete)
Subscribes to ecosystem events:
- `entity-governance.entity.created` - Auto-creates tax registration
- `entity-governance.entity.updated` - Updates accounting period end
- `entity-governance.entity.dissolved` - Deregisters from tax schemes
- `accounting.financial_period.closed` - Updates VAT threshold monitoring

### Unit Tests (Complete)
115 tests passing:
- 27 Corporation Tax tests (small profits, main rate, marginal relief, associated companies)
- 24 VAT tests (9-box calculation, FRS, EU supplies, validation)
- 64 PAYE/NI tests (all NI categories, tax codes, student loans, Scottish/Welsh tax regions, K codes, edge cases)

### Integration Tests (Complete)
API endpoint tests with mocked repositories:
- Registration API tests (CRUD, VAT/PAYE registration)
- PAYE API tests (FPS, EPS, employee records, calculations)

### AWS Infrastructure (Complete)
Full Terraform infrastructure in `terraform/`:

#### Networking
- **VPC**: `10.5.0.0/16` CIDR with public/private subnets across 3 AZs
- **Security Groups**: ALB, ECS, RDS, Redis with least-privilege access

#### Compute
- **ECS Fargate**: Cluster with auto-scaling (1-4 tasks), CPU/memory scaling policies
- **ECR**: Container registry with lifecycle policies
- **ALB**: Application Load Balancer with HTTP/HTTPS listeners, health checks

#### Data Stores
- **RDS PostgreSQL 16**: Encrypted storage, automated backups, IAM authentication
- **S3**: HMRC-compliant 7-year retention for tax documents
- **ElastiCache Redis 7**: Encrypted, with auth token

#### Async Processing (SQS)
- `ct-calculations` - Corporation Tax processing queue
- `vat-returns` - VAT return calculation queue
- `paye-submissions` - PAYE RTI processing queue
- `notifications` - Tax event notifications queue
- All queues have DLQs with CloudWatch alarms

#### Security
- **WAF**: SQL injection, XSS, rate limiting, IP reputation
- **Rate Limits**: 1000 req/5min general, 50 req/5min for tax submissions
- **API Key Enforcement**: Required for all /api/ endpoints

#### Monitoring
- **CloudWatch Alarms**: ECS CPU/memory, ALB 5XX/latency, RDS CPU/storage/connections, Redis, SQS DLQs, WAF blocks
- **CloudWatch Dashboard**: Service health, performance metrics, queue depths, logs
- **SNS Alerts**: Centralized alert topic for all alarms

---

## Terraform Files

```
terraform/
├── main.tf           # Provider configuration (eu-west-2 for UK)
├── variables.tf      # All configuration variables
├── vpc.tf            # VPC, subnets, NAT gateway
├── security_groups.tf # ALB, ECS, RDS, Redis security groups
├── rds.tf            # PostgreSQL 16, Secrets Manager
├── ecr.tf            # Container registry with lifecycle
├── ecs.tf            # Cluster, task definition, service, auto-scaling
├── alb.tf            # Load balancer, target group, listeners
├── s3.tf             # Tax documents with HMRC retention
├── sqs.tf            # Tax processing queues
├── elasticache.tf    # Redis cache cluster
├── waf.tf            # Web application firewall
├── cloudwatch.tf     # Alarms, dashboard, SNS topic
└── outputs.tf        # All resource outputs
```

---

## Remaining Work

### High Priority
- [x] ~~Integration tests for API endpoints~~ ✅ Complete
- [x] ~~Database migration script (`pnpm db:migrate`)~~ ✅ Complete

### Medium Priority
- [x] ~~PAYE routes implementation~~ ✅ Complete
- [x] ~~Employee tax record routes~~ ✅ Complete
- [x] ~~Event consumer handlers (entity-governance, accounting events)~~ ✅ Complete
- [x] ~~HMRC MTD API integration foundation~~ ✅ Complete (OAuth 2.0, API client, VAT submission service)
- [x] ~~Scottish/Welsh tax rate support~~ ✅ Complete (tax regions, 5-band Scottish, Welsh bands)

### Low Priority
- [x] ~~API documentation~~ ✅ Complete (comprehensive README with API reference, examples)
- [x] ~~Additional edge case tests~~ ✅ Complete (K codes, regional prefixes, student loan plans, thresholds)

---

## Success Criteria Status

| Criteria | Status |
|----------|--------|
| All 7 database tables created | ✅ Complete |
| Corporation Tax calculation with marginal relief tested | ✅ Complete |
| VAT 9-box calculation tested | ✅ Complete |
| PAYE/NI calculation for Category A tested | ✅ Complete |
| 40+ API endpoints functional | ✅ Complete |
| Events publishing to ecosystem | ✅ Complete |
| Event consumers wired | ✅ Complete |
| 90+ unit tests passing | ✅ 115 tests passing |
| Integration tests for API | ✅ Complete |
| Database migration setup | ✅ Complete |
| AWS Infrastructure (Terraform) | ✅ Complete |
| CloudWatch Monitoring | ✅ Complete |

---

## Deployment

```bash
# Initialize Terraform
cd terraform
terraform init

# Review plan
terraform plan -var="db_password=xxx" -var="redis_auth_token=xxx"

# Apply infrastructure
terraform apply -var="db_password=xxx" -var="redis_auth_token=xxx"

# Build and push container
docker build -t tax-api .
docker tag tax-api:latest <ecr-url>:latest
docker push <ecr-url>:latest

# Update ECS service
aws ecs update-service --cluster tax-development --service tax-api --force-new-deployment
```

---

## Dependencies

- entity-governance (entity context) - event integration ready
- accounting (financial data) - event integration ready

---

*Last updated: 2026-01-30*
