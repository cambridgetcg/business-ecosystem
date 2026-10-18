# Corporate Security Service - Implementation Plan

## Current State (80% → Target 95%)

The Corporate Security service has a solid foundation with core IAM capabilities. This plan details the remaining work to reach production readiness.

### ✅ Completed (80%)

- **Identity Management**: Full CRUD, password hashing, failed login tracking, lockout
- **RBAC**: Role creation, assignment, hierarchy, permission checking
- **ABAC**: Policy evaluation, combining algorithms, attribute conditions
- **Audit Logging**: Chain-linked, tamper-evident logs with SHA-256 checksums
- **Session Management**: Token-based sessions with expiration
- **Database Schema**: 10 tables with proper indexing
- **REST API**: Auth, identities, roles, audit endpoints
- **Tests**: 50+ unit tests for domain logic

### 🔄 In Progress

- **Event Publishing**: Domain events for cross-service integration (ADDED)
- **Integration with @ecosystem/messaging**: RabbitMQ/EventBridge connectivity

### ❌ Not Started

- MFA Implementation (TOTP, SMS)
- SSO Integration (SAML 2.0, OIDC)
- Remaining Domain Subdomains (8 modules)
- Infrastructure (Terraform, Docker)
- Integration Tests

---

## Phase 1: Event Integration (Week 1)

### Goals
- Enable cross-service security event publishing
- Connect to ecosystem event bus

### Tasks

#### 1.1 Event Infrastructure ✅ DONE
```
src/core/events/
├── domain-events.ts     ✅ Created - Event type constants and factories
├── event-publisher.ts   ✅ Created - Publisher interfaces and implementations
└── index.ts             ✅ Created - Exports
```

#### 1.2 Service Integration
- [ ] Inject ISecurityEventPublisher into SecurityService
- [ ] Publish events on identity creation/update
- [ ] Publish events on role assignment
- [ ] Publish events on access decisions
- [ ] Publish events on audit log creation (critical actions)

#### 1.3 RabbitMQ Integration
- [ ] Add RabbitMQ publisher implementation
- [ ] Configure exchange and routing keys
- [ ] Add connection retry logic

---

## Phase 2: MFA Implementation (Week 2)

### Goals
- Implement TOTP (Time-based One-Time Password)
- Add backup codes support

### Tasks

#### 2.1 TOTP Service
```typescript
// src/domain/mfa/services/totp-service.ts
interface TOTPService {
  generateSecret(identityId: string): Promise<TOTPSecret>;
  verifyCode(identityId: string, code: string): Promise<boolean>;
  disableMFA(identityId: string): Promise<void>;
}
```

#### 2.2 Backup Codes
```typescript
// src/domain/mfa/services/backup-code-service.ts
interface BackupCodeService {
  generateCodes(identityId: string, count: number): Promise<string[]>;
  verifyCode(identityId: string, code: string): Promise<boolean>;
  regenerateCodes(identityId: string): Promise<string[]>;
}
```

#### 2.3 API Endpoints
- `POST /api/v1/security/mfa/setup` - Initialize MFA setup
- `POST /api/v1/security/mfa/verify` - Verify setup code
- `POST /api/v1/security/mfa/challenge` - Challenge during login
- `POST /api/v1/security/mfa/disable` - Disable MFA
- `GET /api/v1/security/mfa/backup-codes` - Get backup codes

---

## Phase 3: SSO Integration (Week 3)

### Goals
- Support SAML 2.0 for enterprise SSO
- Support OIDC for modern providers

### Tasks

#### 3.1 SAML Service
```typescript
// src/domain/sso/services/saml-service.ts
interface SAMLService {
  generateAuthRequest(providerId: string): Promise<SAMLAuthRequest>;
  validateResponse(response: string): Promise<SAMLAssertion>;
  mapAttributes(assertion: SAMLAssertion): Promise<IdentityAttributes>;
}
```

#### 3.2 OIDC Service
```typescript
// src/domain/sso/services/oidc-service.ts
interface OIDCService {
  getAuthorizationUrl(providerId: string): Promise<string>;
  exchangeCode(code: string): Promise<OIDCTokens>;
  validateIdToken(token: string): Promise<OIDCClaims>;
}
```

#### 3.3 Provider Configuration
```typescript
// src/domain/sso/models/sso-provider.ts
interface SSOProvider {
  id: string;
  tenantId: string;
  type: 'saml' | 'oidc';
  name: string;
  enabled: boolean;
  config: SAMLConfig | OIDCConfig;
  attributeMapping: Record<string, string>;
}
```

---

## Phase 4: Domain Submodules (Weeks 4-6)

### 4.1 Physical Security
```
src/domain/physical-security/models/
├── facility.ts
├── access-zone.ts
├── access-badge.ts
├── access-log.ts
├── visitor.ts
└── surveillance-system.ts
```

### 4.2 Personnel Security
```
src/domain/personnel-security/models/
├── background-check.ts
├── security-clearance.ts
├── clearance-level.ts
├── periodic-reinvestigation.ts
└── adverse-information.ts
```

### 4.3 Information Classification
```
src/domain/information-classification/models/
├── classification-level.ts
├── data-classification.ts
├── handling-procedure.ts
├── marking-requirement.ts
└── declassification.ts
```

### 4.4 Business Continuity
```
src/domain/business-continuity/models/
├── bcp.ts
├── crisis.ts
├── crisis-response.ts
├── recovery-objective.ts
├── alternate-site.ts
└── bcp-test.ts
```

### 4.5 Fraud Prevention
```
src/domain/fraud-prevention/models/
├── internal-control.ts
├── segregation-of-duties.ts
├── fraud-risk.ts
├── fraud-indicator.ts
└── fraud-investigation.ts
```

### 4.6 Vendor Security
```
src/domain/vendor-security/models/
├── vendor-risk-assessment.ts
├── security-questionnaire.ts
├── vendor-risk-rating.ts
├── security-review.ts
└── vendor-remediation.ts
```

### 4.7 Incident Response
```
src/domain/incident-response/models/
├── security-incident.ts      # Already exists in schema
├── incident-severity.ts
├── incident-response-plan.ts
├── breach-notification.ts
└── lessons-learned.ts
```

### 4.8 Security Governance
```
src/domain/security-governance/models/
├── security-policy.ts
├── risk-assessment.ts
├── security-metric.ts
├── security-committee.ts
└── security-roadmap.ts
```

---

## Phase 5: Infrastructure (Week 7)

### 5.1 Terraform Modules
```
infrastructure/terraform/
├── main.tf
├── ecs.tf           # ECS Fargate service
├── alb.tf           # Application Load Balancer
├── rds.tf           # PostgreSQL database
├── elasticache.tf   # Redis for sessions
├── cloudwatch.tf    # Logging and metrics
├── waf.tf           # Web Application Firewall
├── secrets.tf       # Secrets Manager
└── variables.tf
```

### 5.2 Docker Configuration
```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3006
CMD ["node", "dist/index.js"]
```

### 5.3 CI/CD Pipeline
- GitHub Actions workflow
- Build, test, deploy stages
- Environment-specific deployments

---

## Phase 6: Testing & Documentation (Week 8)

### 6.1 Integration Tests
- Database integration tests with testcontainers
- API endpoint tests
- Event publishing tests
- MFA flow tests
- SSO integration tests

### 6.2 Load Testing
- Authentication endpoint benchmarks
- Authorization decision latency
- Concurrent session handling

### 6.3 Documentation
- API documentation (OpenAPI)
- Security architecture guide
- Deployment runbook
- Incident response playbook

---

## Dependencies

### Internal
- `@ecosystem/messaging` - Event bus integration
- `@ecosystem/repository` - Repository patterns
- Entity Governance - Personnel records
- Compliance - Control testing integration

### External
- `speakeasy` or `otpauth` - TOTP generation
- `passport-saml` - SAML 2.0 support
- `openid-client` - OIDC support
- `bcrypt` - Password hashing (production)
- `jsonwebtoken` - JWT handling

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Test Coverage | >80% |
| API Response Time (p95) | <100ms |
| Failed Login Rate | <5% |
| MFA Adoption | >50% of users |
| Audit Log Integrity | 100% verified |
| Security Incidents | 0 critical |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| MFA adoption resistance | Gradual rollout, education |
| SSO provider outages | Local fallback authentication |
| Audit log tampering | Chain-linked checksums, external backup |
| Performance degradation | Caching, connection pooling |

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Events | Week 1 | Cross-service integration |
| 2. MFA | Week 2 | TOTP + backup codes |
| 3. SSO | Week 3 | SAML + OIDC |
| 4. Domains | Weeks 4-6 | 8 submodules |
| 5. Infra | Week 7 | AWS deployment |
| 6. Testing | Week 8 | Production ready |

**Total: 8 weeks to production-ready Corporate Security service**
