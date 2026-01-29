# LIGHT: Entity Governance Accumulated Insights

> **Learnings, Insights, Gathered Heuristics, and Truth** - What we've learned that persists across sessions.

**Last Updated**: January 29, 2026

---

## Architectural Insights

### 1. Clean Architecture Works Well Here

**Insight**: The domain-centric structure (`domain/` -> `application/` -> `infrastructure/` -> `api/`) naturally fits legal entity management where business rules are complex and long-lived.

**Evidence**:
- Domain entities like `LegalEntity` have clear invariants (jurisdiction required, entity type immutable after formation)
- Business rules can be expressed in domain layer without infrastructure concerns
- File: `src/domain/entities/legal-entity.ts`

**Application**: Continue using this pattern. Don't shortcut by putting business logic in handlers or routes.

---

### 2. Schema-First Development Paid Off

**Insight**: Building comprehensive database schema (18 tables) before implementation created a solid foundation and revealed domain complexity early.

**Evidence**:
- Schema forced decisions about relationships (shareholders vs members, boards vs committees)
- Foreign key constraints documented domain invariants
- Drizzle types provide compile-time safety
- File: `src/infrastructure/persistence/schema.ts`

**Application**: For new subdomains, design schema first to clarify the domain model.

---

### 3. SaaS Infrastructure is Commodity

**Insight**: Rate limiting, compression, JWT, CORS, etc. are solved problems. Using Fastify plugins is the right choice - don't reinvent.

**Evidence**:
- 9 Fastify plugins wired in single session
- No custom code needed for standard SaaS concerns
- File: `src/api/rest/app.ts`

**Application**: Always check for existing ecosystem solutions before building.

---

## Domain Insights

### 4. Jurisdiction is More Complex Than Expected

**Insight**: "Jurisdiction" isn't just where an entity is formed. There are 4 distinct contexts: formation, qualification (where authorized to operate), tax nexus, and regulatory.

**Evidence**:
- Research document: `research/01-jurisdiction-complexity.md`
- An LLC formed in Delaware may be qualified in California, have tax nexus in New York, and face regulatory requirements in Texas
- Single `jurisdiction` field is insufficient

**Application**: Implement jurisdiction context model from IMPLEMENTATION_PLAN.md Phase 0.

---

### 5. LLC vs Corporation Governance Differs Fundamentally

**Insight**: LLCs have members and operating agreements, not shareholders and bylaws. The governance model cannot be unified without losing precision.

**Evidence**:
- Research document: `research/02-llc-operating-agreements.md`
- LLC members have capital accounts, corporations have share ownership
- Manager-managed vs member-managed is LLC-specific concept

**Application**: Implement separate governance patterns per entity type, not generic governance.

---

### 6. BOI/CTA is Regulatory Critical

**Insight**: Corporate Transparency Act requires beneficial ownership reporting. Penalties are severe ($500/day, criminal liability). This is not optional compliance.

**Evidence**:
- Research document: `research/03-beneficial-ownership-cta.md`
- Deadlines already passed for existing entities
- 23 exemption categories must be tracked

**Application**: Prioritize BOI/CTA implementation (Phase 1 in roadmap).

---

### 7. Cap Table is Not Just Shareholder Count

**Insight**: Real cap tables include share classes, liquidation preferences, anti-dilution, convertibles (SAFEs, notes), options, and waterfall calculations.

**Evidence**:
- Research document: `research/05-cap-table-complexity.md`
- Exit waterfall determines actual payout, not just ownership percentage
- Fully diluted calculation requires option pool math

**Application**: Basic shareholder tracking is insufficient. Plan for full cap table (Phase 3).

---

## Technical Insights

### 8. Event Publishing Ready, Handlers Missing

**Insight**: The infrastructure for event-driven architecture exists, but events aren't being consumed. Publishing without handling creates false confidence.

**Evidence**:
- `event-publisher.ts` publishes to RabbitMQ
- `event-handlers.ts` is empty/stub
- Entity onboarding saga in `@ecosystem/workflows` expects events

**Application**: Wire event handlers before claiming "event-driven" architecture works.

---

### 9. Tests Are Non-Negotiable

**Insight**: Zero test coverage makes refactoring dangerous and hides bugs. Legal entity management has complex invariants that must be verified.

**Evidence**:
- No tests in `__tests__/` or `tests/` directory
- vitest configured but unused
- Package.json has test scripts that pass trivially (no tests to run)

**Application**: Add tests with each feature. Minimum 80% coverage on domain layer.

---

### 10. Drizzle + Zod Provides Good DX

**Insight**: Drizzle ORM with Zod validation creates type-safe database access with runtime validation. The combination catches errors at compile time and request time.

**Evidence**:
- Schema types flow from database to API
- Zod schemas validate incoming requests
- Type errors caught before runtime

**Application**: Continue using this stack. Don't introduce conflicting validation patterns.

---

## Process Insights

### 11. PP Methodology Reveals Gaps

**Insight**: Using Purpose Prompter's systematic approach (Territory -> Understanding -> Signal -> Verify) exposed that entity-governance looked more complete than it was.

**Evidence**:
- Initial assessment: "looks ready"
- PP assessment: 25% complete, 7 of 8 subdomains incomplete
- Progress tracking now quantified

**Application**: Use PP methodology for future assessments. Don't trust surface appearances.

---

### 12. Research Documents Are Valuable

**Insight**: The 8 research documents in `research/` contain deep domain knowledge that should guide implementation, not just be archived.

**Evidence**:
- Jurisdiction complexity (4 contexts) documented
- BOI/CTA requirements detailed
- Cap table edge cases identified

**Application**: Reference research documents during implementation. Create understanding maps linking research to code.

---

## Anti-Patterns Observed

### 1. Schema Without Implementation

**Problem**: All 18 tables exist, but only 1 subdomain has working handlers.
**Lesson**: Schema is necessary but not sufficient. Plan implementation alongside schema.

### 2. Infrastructure Before Domain

**Problem**: SaaS middleware complete, domain logic incomplete.
**Lesson**: Core domain should be prioritized over infrastructure polish.

### 3. Event Publishing Without Handling

**Problem**: Events publish but nothing consumes them.
**Lesson**: Event-driven architecture requires both sides. Test end-to-end.

---

## Heuristics for Entity Governance

1. **When in doubt, check jurisdiction requirements** - They vary more than expected
2. **Treat audit trail as first-class** - Corporate actions must be traceable
3. **Separate entity types early** - LLC vs Corp differences are fundamental
4. **Design for compliance first** - Regulatory requirements drive structure
5. **Test business rules, not CRUD** - The value is in the invariants

---

## Questions to Resolve

1. **How should we handle entity type changes?** (e.g., LLC converting to Corp)
2. **What's the right granularity for events?** (entity.updated vs specific field events)
3. **Should cap table calculations be real-time or batch?**
4. **How do we handle multi-entity transactions?** (parent guaranteeing subsidiary)

---

## Future Research Needed

1. **International entity support** - Non-US jurisdictions have different requirements
2. **Blockchain corporate records** - Is this valuable or hype?
3. **AI governance recommendations** - What's feasible vs theoretical?

---

*LIGHT captures accumulated wisdom. Update after each significant learning.*
