# Ecosystem Baseline (Zero Point)

**Established**: January 2026
**Overall Progress**: 63%

---

## Service Status Matrix

| Layer | Service | Progress | Tests | AWS Infra | Events | API |
|-------|---------|----------|-------|-----------|--------|-----|
| **Foundational** | Banking & Treasury | 90% | 45 | ✓ | ✓ | ✓ |
| | KYC & Identity | 85% | 38 | ✓ | ✓ | ✓ |
| | Entity Governance | 60% | 22 | ✓ | ✓ | ✓ |
| | Accounting | 90% | 52 | ✓ | ✓ | ✓ |
| | Tax | 90% | 90 | ✓ | ✓ | ✓ |
| | Contracts & Legal | 50% | 15 | ✗ | ◐ | ◐ |
| | Compliance | 10% | 0 | ✗ | ✗ | ✗ |
| | Corporate Security | 5% | 0 | ✗ | ✗ | ✗ |
| **Operational** | Contracts & Legal | 90% | 42 | ✓ | ✓ | ✓ |
| | Data & Privacy | 45% | 18 | ◐ | ✓ | ◐ |
| | IP Management | 95% | 48 | ✓ | ✓ | ✓ |
| | Insurance | 15% | 5 | ✗ | ◐ | ◐ |
| | Operational Gateway | 40% | 12 | ◐ | ◐ | ◐ |
| **Gateway** | API Gateway | 85% | 35 | ✓ | N/A | ✓ |

Legend: ✓ Complete | ◐ Partial | ✗ Missing

---

## Capability Matrix

### Core Business Functions

| Capability | Service | Status |
|------------|---------|--------|
| Bank account management | Banking & Treasury | ✓ |
| Transaction processing | Banking & Treasury | ✓ |
| Treasury operations | Banking & Treasury | ✓ |
| Identity verification | KYC & Identity | ✓ |
| AML screening | KYC & Identity | ✓ |
| Company registration | Entity Governance | ✓ |
| Director management | Entity Governance | ◐ |
| Shareholder management | Entity Governance | ✗ |
| General ledger | Accounting | ✓ |
| Financial reporting | Accounting | ✓ |
| Corporation Tax | Tax | ✓ |
| VAT returns | Tax | ✓ |
| PAYE/NI | Tax | ✓ |
| Contract management | Contracts & Legal | ✓ |
| Document generation | Contracts & Legal | ✗ |
| IP registration | IP Management | ✓ |
| IP portfolio management | IP Management | ✓ |

### Compliance & Security

| Capability | Service | Status |
|------------|---------|--------|
| Regulatory tracking | Compliance | ✗ |
| Obligation management | Compliance | ✗ |
| Compliance reporting | Compliance | ✗ |
| Identity & access | Corporate Security | ✗ |
| Threat detection | Corporate Security | ✗ |
| Audit logging | Corporate Security | ✗ |
| GDPR consent | Data & Privacy | ◐ |
| Data subject rights | Data & Privacy | ◐ |
| Privacy assessments | Data & Privacy | ✗ |

### Risk Management

| Capability | Service | Status |
|------------|---------|--------|
| Policy management | Insurance | ✗ |
| Claims processing | Insurance | ✗ |
| Risk assessment | Insurance | ✗ |

---

## Infrastructure Status

### AWS Resources by Service

| Service | VPC | ECS | RDS | Redis | S3 | SQS | WAF | CloudWatch |
|---------|-----|-----|-----|-------|-----|-----|-----|------------|
| Banking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| KYC | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Entity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Accounting | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tax | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contracts (F) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Compliance | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Security | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Contracts (O) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Privacy | ◐ | ◐ | ◐ | ✗ | ✓ | ✗ | ✗ | ◐ |
| IP | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Insurance | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Gateway (O) | ◐ | ◐ | ✗ | ◐ | ✗ | ◐ | ◐ | ◐ |
| API Gateway | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ |

---

## Test Coverage

| Service | Unit | Integration | E2E | Total |
|---------|------|-------------|-----|-------|
| Banking & Treasury | 35 | 10 | 0 | 45 |
| KYC & Identity | 28 | 10 | 0 | 38 |
| Entity Governance | 18 | 4 | 0 | 22 |
| Accounting | 40 | 12 | 0 | 52 |
| Tax | 75 | 15 | 0 | 90 |
| Contracts & Legal (F) | 10 | 5 | 0 | 15 |
| Compliance | 0 | 0 | 0 | 0 |
| Corporate Security | 0 | 0 | 0 | 0 |
| Contracts & Legal (O) | 32 | 10 | 0 | 42 |
| Data & Privacy | 12 | 6 | 0 | 18 |
| IP Management | 38 | 10 | 0 | 48 |
| Insurance | 5 | 0 | 0 | 5 |
| Operational Gateway | 8 | 4 | 0 | 12 |
| API Gateway | 25 | 10 | 0 | 35 |
| **TOTAL** | **326** | **96** | **0** | **422** |

---

## Event Integration Status

### Published Events

| Service | Events Published | Consumers |
|---------|------------------|-----------|
| Banking | account.*, transaction.* | Accounting, Tax |
| KYC | verification.*, screening.* | Entity, Banking |
| Entity | entity.*, director.* | Tax, Compliance |
| Accounting | journal.*, period.* | Tax, Reporting |
| Tax | tax.*, vat.*, paye.* | Accounting, Compliance |
| Contracts | contract.*, document.* | Entity, Compliance |
| IP | ip.*, trademark.*, patent.* | Contracts, Compliance |

### Missing Event Integration

| Service | Required Events | Status |
|---------|-----------------|--------|
| Compliance | compliance.*, obligation.* | Not implemented |
| Security | security.*, access.*, audit.* | Not implemented |
| Insurance | policy.*, claim.* | Not implemented |
| Privacy | consent.*, dsr.*, breach.* | Partial |

---

## Critical Gaps Summary

### Immediate (Blocks Business Operations)
1. **Corporate Security**: No IAM, no audit trails
2. **Compliance**: No regulatory tracking

### Near-term (Limits Capability)
3. **Insurance**: No policy management
4. **Data & Privacy**: Incomplete GDPR automation
5. **Entity Governance**: Missing director/shareholder management

### Future (Enhancement)
6. **External APIs**: HMRC MTD, Companies House
7. **Cross-service workflows**: Operational Gateway completion

---

## Baseline Metrics

| Metric | Value |
|--------|-------|
| Total services | 14 |
| Production-ready | 7 (50%) |
| In development | 4 (29%) |
| Scaffolded only | 3 (21%) |
| Total tests | 422 |
| Services with 0 tests | 2 |
| AWS infrastructure complete | 8 services |
| Event integration complete | 7 services |

---

*This baseline serves as the reference point for measuring ecosystem development progress.*
