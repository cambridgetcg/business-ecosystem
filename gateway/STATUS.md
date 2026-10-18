# HTTP Edge Gateway Status

**Layer**: Gateway
**Status**: Development — workspace wired; runtime release blocked

## Verified scope

- `gateway/` is an explicit pnpm workspace member, distinct from
  `operational/gateway/`.
- Its locked dependencies include the existing health, logging, observability
  and service-auth workspaces. Turbo schedules their builds before this gateway.
- [Workspace wiring tests](README.md#check-the-wiring) exercise pnpm discovery
  and the dry build graph. They do not boot servers or contact business services.
- Frozen installation is verified with lifecycle scripts disabled. That is not
  a Docker image, a passing monorepo build, or an authenticated runtime test.

## Known release blockers

Measured on 2026-10-17 with
`pnpm exec turbo run build --filter=@ecosystem/gateway --continue`: none of the
five tasks in the gateway build chain succeeds.

- Shared libraries: logging reports TS2349 Pino call-signature errors; the
  logging, health, observability and service-auth declaration builds report
  TS5074, and observability also reports TS6307. Repairing logging alone leaves
  the other three failing.
- The gateway's own source does not compile. `tsc --noEmit` reports undeclared
  request properties (`correlationId`, `requestId`), a `user` declaration that
  conflicts with `@fastify/jwt`, untyped JWT claims in `src/middleware/auth.ts`
  and a possibly-undefined access in `src/index.ts`. Its declaration build also
  reports TS5074 and TS6307.

Workspace inclusion reveals this chain; it does not repair or waive those gates.
Re-run the normal build/typecheck/test gates after these fixes land.

The gateway itself still needs runtime and security acceptance. In particular:

- `src/index.ts` has a development JWT-secret fallback; production must not rely
  on that default.
- Per-service rate-limit declarations exist in `src/config/services.ts`, but
  `src/index.ts` currently installs only a global limit.
- `Dockerfile` and the repository deployment workflow are not proven runnable
  release paths. This change has not built a container or provisioned a target.
- No verified Cloudflare site/source attribution is established by this work.
  Do not equate a similarly named site with this runtime.

## Read the actual owners

See the [small source map](README.md#source-map). The current configured downstreams
are in `src/config/services.ts`; no orchestration or operational-aggregator route
is currently declared there. Configured URLs and route definitions do not prove
reachability, successful authorization, or persistence.

The previous progress percentages and “Blockers: None” were historical planning
claims, not execution evidence. They remain in Git history; this status does not
replace them with another estimated completion percentage.
