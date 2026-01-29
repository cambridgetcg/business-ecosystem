# Intellectual Property Service

> **Mission**: To protect, manage, and maximize the value of intellectual property assets across the enterprise through systematic portfolio management, rights enforcement, and strategic licensing.

IP protection, portfolio management, and licensing.

**[Full Purpose & Mission Statement](./PURPOSE.md)** | **[API Documentation](http://localhost:3014/docs)**

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run type checking
pnpm typecheck

# Run tests
pnpm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/ecosystem_dev` |
| `REDIS_URL` | Redis connection (optional) | In-memory cache |
| `PORT` | Server port | `3014` |
| `NODE_ENV` | Environment | `development` |

---

## Subdomains

### trademarks
Trademark registration and portfolio management.
- `trademark.ts` - Trademark records
- `trademark-class.ts` - Nice Classification classes
- `trademark-application.ts` - Filing applications
- `trademark-registration.ts` - Granted registrations
- `trademark-renewal.ts` - Renewal tracking
- `use-declaration.ts` - Use declarations (Section 8/15)
- `opposition.ts` - Opposition proceedings

### patents
Patent prosecution and maintenance.
- `patent.ts` - Patent records
- `patent-application.ts` - Utility/design applications
- `provisional-application.ts` - Provisional filings
- `patent-claim.ts` - Claim tracking
- `patent-prosecution.ts` - Office action responses
- `maintenance-fee.ts` - Annuity payments
- `continuation.ts` - Continuation applications
- `pct-application.ts` - International PCT filings

### copyrights
Copyright registration and protection.
- `copyright.ts` - Copyright records
- `copyright-registration.ts` - Registrations
- `work-type.ts` - Literary, musical, software, etc.
- `authorship.ts` - Author/creator records
- `copyright-notice.ts` - Notice requirements
- `dmca-notice.ts` - DMCA takedown notices

### trade-secrets
Trade secret identification and protection.
- `trade-secret.ts` - Trade secret inventory
- `confidential-info.ts` - Confidential information
- `protection-measure.ts` - Protection protocols
- `access-log.ts` - Access tracking
- `misappropriation.ts` - Misappropriation incidents

### domain-names
Domain portfolio management.
- `domain-name.ts` - Domain records
- `domain-registration.ts` - Registration details
- `domain-renewal.ts` - Renewal tracking
- `registrar.ts` - Registrar relationships
- `udrp-proceeding.ts` - UDRP disputes
- `cybersquatting.ts` - Cybersquatting claims

### ip-licensing
IP licensing and royalty management.
- `license-agreement.ts` - License agreements
- `license-type.ts` - Exclusive, non-exclusive, sublicense
- `royalty.ts` - Royalty obligations
- `royalty-calculation.ts` - Royalty computations
- `sublicense.ts` - Sublicense tracking
- `license-termination.ts` - Termination records

### ip-strategy
Portfolio strategy and analysis.
- `ip-portfolio.ts` - Portfolio overview
- `portfolio-valuation.ts` - IP asset valuation
- `fto-analysis.ts` - Freedom to Operate analysis
- `ip-landscape.ts` - Competitive landscape
- `ip-strategy.ts` - Strategic planning

### ip-enforcement
IP enforcement and litigation.
- `infringement.ts` - Infringement records
- `cease-desist.ts` - C&D letters
- `ip-litigation.ts` - Litigation matters
- `settlement.ts` - Settlement agreements
- `customs-recordation.ts` - Customs recordation

---

## Architecture

```
src/
├── domain/           # Domain entities, events, services
│   ├── entities/     # Patent, Trademark, Copyright, License
│   └── events/       # Domain events for each entity
├── application/      # Use cases, commands, queries
├── infrastructure/   # Persistence, cache, external integrations
│   ├── persistence/  # Drizzle ORM, repositories
│   └── cache/        # Redis/in-memory caching
└── api/              # REST API (Fastify)
    └── rest/         # Routes and controllers
```

---

## External Integrations

- **patent-offices/**: USPTO, EPO, WIPO, national offices
- **trademark-offices/**: USPTO TEAS, EUIPO, WIPO Madrid
- **watch-services/**: Trademark watching services

## Key Integrations

- **contracts-legal**: Licensing agreements
- **entity-governance**: IP ownership by entity
- **compliance**: IP compliance requirements
- **accounting**: IP asset accounting

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Detailed health check |
| `GET` | `/health/live` | Liveness probe |
| `GET` | `/health/ready` | Readiness probe |
| `GET` | `/api/v1/patents` | List patents |
| `POST` | `/api/v1/patents` | Create patent |
| `GET` | `/api/v1/patents/:id` | Get patent by ID |
| `GET` | `/api/v1/trademarks` | List trademarks |
| `POST` | `/api/v1/trademarks` | Create trademark |
| `GET` | `/api/v1/trademarks/:id` | Get trademark by ID |

Full API documentation available at `/docs` when running locally.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Fastify |
| ORM | Drizzle |
| Database | PostgreSQL |
| Cache | Redis / In-Memory |
| Validation | Zod |
| DI | tsyringe |
| Logging | Pino |

---

## License

Proprietary - Business Ecosystem
