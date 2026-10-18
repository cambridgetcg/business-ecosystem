# Insurance Status

**Layer**: Operational
**Status**: Production Ready

---

## At a Glance

| Metric | Value |
|--------|-------|
| Overall Progress | 90% |
| Current Waypoint | Phase 3 - Integration Ready |
| Blockers | None |
| Last Updated | 2026-01-30 |

---

## Progress Breakdown

| Component | Status |
|-----------|--------|
| Schema/Database | ████████░░ 80% |
| Domain Model | █████████░ 90% |
| API Layer | ████████░░ 80% |
| Tests | ██████░░░░ 60% |
| Events | ██████████ 100% |
| Documentation | ████████░░ 80% |

---

## Current State

Full implementation of insurance service with:
- **Domain Models**: Policy and Claims with comprehensive Zod schemas
- **Database Schema**: 15 Prisma tables for policies, claims, payments, documents
- **Application Services**: PolicyService and ClaimsService with full CRUD and workflows
- **API Routes**: 40+ REST endpoints for policy and claims management
- **Unit Tests**: Policy and Claims domain model tests

---

## Implemented Features

### Policy Management
- [x] Policy lifecycle (draft → quoted → bound → active → expired/cancelled/renewed)
- [x] Multi-insurer support (coinsurance, layered programs)
- [x] Coverage management with limits, deductibles, sublimits
- [x] Premium management with UK IPT calculation
- [x] Policy endorsements
- [x] Document management
- [x] Renewal workflow
- [x] Expiring policies tracking

### Claims Management
- [x] Claims lifecycle (draft → submitted → investigation → approved/denied → settled/closed)
- [x] Claimant management
- [x] Reserve management with history tracking
- [x] Payment tracking (indemnity, expenses, recoveries)
- [x] Activity logging
- [x] Document management
- [x] Handler assignment

### UK-Specific Features
- [x] UK Insurance Premium Tax (IPT) calculation (12% / 20%)
- [x] Employers' Liability minimum coverage validation (£5M)
- [x] UK policy types (D&O, PI, EL, PL, Cyber, etc.)

### API Endpoints
- [x] Policy CRUD endpoints
- [x] Policy status transitions (quote, bind, activate, cancel, renew)
- [x] Policy queries (by entity, active, expiring, by type)
- [x] Claims CRUD endpoints
- [x] Claims status transitions (submit, investigate, approve, deny, settle, close, reopen)
- [x] Claims queries (by policy, by entity, open, needs review)
- [x] Reserve and payment management
- [x] Dashboard metrics

---

## Event Publishing (Complete)

All policy and claims lifecycle events are now published:

**Policy Events**:
- `insurance.policy.created` - When policy is created
- `insurance.policy.bound` - When policy is bound
- `insurance.policy.activated` - When policy becomes active
- `insurance.policy.cancelled` - When policy is cancelled
- `insurance.policy.renewed` - When policy is renewed
- `insurance.policy.expired` - When policy expires
- `insurance.policy.expiring_soon` - Warning before expiry

**Claim Events**:
- `insurance.claim.created` - When claim is created
- `insurance.claim.submitted` - When claim is submitted
- `insurance.claim.approved` - When claim is approved
- `insurance.claim.denied` - When claim is denied
- `insurance.claim.settled` - When claim is settled
- `insurance.claim.closed` - When claim is closed
- `insurance.claim.reopened` - When claim is reopened
- `insurance.claim.payment_made` - When payment is made
- `insurance.claim.reserve_updated` - When reserve is adjusted

**Compliance Events**:
- `insurance.compliance.employers_liability_gap` - UK EL coverage gap
- `insurance.compliance.coverage_gap_detected` - General coverage gap
- `insurance.certificate.generated` - Certificate issued

---

## Remaining Work

1. [x] Event publishing for policy/claims lifecycle
2. [ ] Certificate of Insurance generation (PDF)
3. [ ] Integration tests
4. [ ] Add more unit tests for services
5. [ ] Renewal reminder scheduling

---

## Dependencies

- entity-governance (entity context)
- contracts-legal (policy as contract)
- messaging (event publishing)

---

## API Endpoints Summary

### Policies `/api/v1/policies`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create policy |
| GET | `/:id` | Get policy |
| PATCH | `/:id` | Update policy |
| DELETE | `/:id` | Delete policy |
| POST | `/:id/quote` | Quote policy with premium |
| POST | `/:id/bind` | Bind policy |
| POST | `/:id/activate` | Activate policy |
| POST | `/:id/cancel` | Cancel policy |
| POST | `/:id/renew` | Renew policy |
| GET | `/entity/:entityId` | Get policies by entity |
| GET | `/active` | Get active policies |
| GET | `/expiring` | Get expiring policies |
| GET | `/type/:policyType` | Get policies by type |
| POST | `/:id/premium/payment` | Record premium payment |
| POST | `/:id/documents` | Add document |
| POST | `/:id/endorsements` | Add endorsement |
| GET | `/dashboard/metrics` | Get dashboard metrics |

### Claims `/api/v1/claims`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create claim |
| GET | `/:id` | Get claim |
| PATCH | `/:id` | Update claim |
| DELETE | `/:id` | Delete claim |
| POST | `/:id/submit` | Submit claim |
| POST | `/:id/investigate` | Start investigation |
| POST | `/:id/approve` | Approve claim |
| POST | `/:id/deny` | Deny claim |
| POST | `/:id/settle` | Settle claim |
| POST | `/:id/close` | Close claim |
| POST | `/:id/reopen` | Reopen claim |
| POST | `/:id/reserve` | Update reserve |
| POST | `/:id/payments` | Add payment |
| POST | `/:id/notes` | Add note |
| POST | `/:id/documents` | Add document |
| POST | `/:id/claimants` | Add claimant |
| GET | `/policy/:policyId` | Get claims by policy |
| GET | `/entity/:entityId` | Get claims by entity |
| GET | `/open` | Get open claims |
| GET | `/needs-review` | Get claims needing review |
| GET | `/handler/:handlerId` | Get claims by handler |
| GET | `/dashboard/metrics` | Get dashboard metrics |

---

*Last updated: 2026-01-30*
