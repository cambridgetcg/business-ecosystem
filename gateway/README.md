# HTTP edge gateway

`@ecosystem/gateway` is the Fastify request-routing entry point in `gateway/`.
It is **not** `@ecosystem/operational-gateway` in
[`operational/gateway/`](../operational/gateway/), the Hono aggregation API.
Keep their package names, directories and responsibilities separate.

## Source map

| Responsibility                                              | Owner                                                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Process startup, proxy registration and discovery responses | [`src/index.ts`](src/index.ts)                                                          |
| Upstream URLs, prefixes and declared auth/rate-limit policy | [`src/config/services.ts`](src/config/services.ts)                                      |
| JWT checks and forwarded user context                       | [`src/middleware/auth.ts`](src/middleware/auth.ts)                                      |
| Workspace membership                                        | [`../pnpm-workspace.yaml`](../pnpm-workspace.yaml)                                      |
| Dependency resolution                                       | [`../pnpm-lock.yaml`](../pnpm-lock.yaml)                                                |
| Build dependency ordering                                   | [`../turbo.json`](../turbo.json) and [`package.json`](package.json)                     |
| Focused metadata checks                                     | [`tests/`](tests/) and [Workspace wiring CI](../.github/workflows/workspace-wiring.yml) |

The routing table is a configuration declaration, not proof that each service is
running. The `/api/v1/services` response projects that table;
`/api/v1/health/services` actively contacts upstreams. Reading source or checking
workspace metadata does neither. Do not use the aggregate health route as a
passive inventory collector.

## Check the wiring

From the repository root, with Node 20+ and the pinned pnpm 9.0.0:

```sh
# No dependency installation or application startup required.
node --test gateway/tests/workspace.test.mjs

# Install without application or Git-hook lifecycle scripts.
pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile

# pnpm membership plus Turbo's dry build graph; does not build or start services.
pnpm --filter @ecosystem/gateway run test
```

The build-plan test uses a temporary cache under `TMPDIR` (or the platform temp
root) and removes only its own directory. Set `TMPDIR` to an approved scratch
location when required. Both discovery and dependency order are tested through
the real package manager and task runner, not a second hand-maintained catalog.

## Release boundary

Workspace membership now exposes this gateway to the normal build/typecheck/test
pipeline. The focused CI is **not a deployment or a successful compiler build**.
See [current status and blockers](STATUS.md) before running or publishing it.

[`PURPOSE.md`](PURPOSE.md) and [`MISSION.md`](MISSION.md) describe intended design,
not measured availability or proof that every listed protection is enforced.
This change does not deploy the Dockerfile, identify a Cloudflare owner, connect
live business systems, or merge the two gateways. Resolve the repository-wide
release gates and verify the exact hosting target before enabling runtime traffic.
