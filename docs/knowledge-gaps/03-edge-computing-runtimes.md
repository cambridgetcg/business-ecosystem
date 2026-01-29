# Edge Computing Runtimes: V8 Isolates and Beyond

## Knowledge Gap Identified

**The uncertainty**: Edge computing runtimes (Cloudflare Workers, Deno Deploy, Vercel Edge Functions) represent a paradigm shift from traditional serverless. The isolation model, cold start characteristics, and appropriate use cases felt unclear. When should edge functions be used vs traditional functions?

---

## Research Findings

### The V8 Isolate Model

Traditional serverless (AWS Lambda, etc.):
```
Request → Cold Start (container spin-up) → Execute → Respond
          ~100-500ms                       variable
```

V8 Isolate model (Cloudflare Workers, etc.):
```
Request → Isolate Creation → Execute → Respond
          ~0-5ms             variable
```

**Why the difference matters:**
- V8 isolates share a running V8 engine
- No container spin-up, no OS boot
- Memory isolation without process isolation
- Sub-millisecond cold starts

### Runtime Comparison

| Feature | Cloudflare Workers | Deno Deploy | Vercel Edge |
|---------|-------------------|-------------|-------------|
| Runtime | workerd (V8) | Deno (V8) | Edge Runtime (V8) |
| Cold start | ~0ms | ~0-10ms | ~0-25ms |
| Max execution | 30s (paid), 10ms (free) | 50ms (free), unlimited (paid) | 30s |
| Memory | 128MB | 512MB | 128MB |
| Node.js compat | WinterCG subset | High (npm:) | WinterCG subset |
| Native Node APIs | ❌ No | ✅ Most | ❌ No |
| File system | ❌ No | ❌ No | ❌ No |
| TCP sockets | ✅ (connect()) | ✅ | ❌ |
| GPU/ML | ✅ (Workers AI) | ❌ | ❌ |
| Global locations | 300+ | 35+ | 30+ |

### WinterCG: The Standard Emerges

WinterCG (Web-interoperable Runtimes Community Group) is standardizing edge runtime APIs:

- `fetch()` - HTTP client
- `Request`/`Response` - Standard web APIs
- `crypto.subtle` - Web Crypto API
- `TextEncoder`/`TextDecoder`
- `URL`/`URLSearchParams`
- `Headers`

**Key insight**: Code written to WinterCG standards runs on all edge platforms.

### What Edge Can and Cannot Do

**Good for:**
- Request routing and rewriting
- Authentication/authorization at the edge
- A/B testing and feature flags
- Response transformation
- Caching and cache invalidation
- Geographic personalization
- API gateway patterns
- Light data validation

**Not good for:**
- Long-running processes
- Heavy computation
- Direct database connections (use HTTP-based DBs)
- File system operations
- Native module dependencies
- Complex Node.js applications

### The Database Problem

Edge functions can't use traditional database drivers (no TCP sockets, no native modules).

**Solutions emerged:**
1. **HTTP-based databases**: Planetscale, Neon (serverless Postgres), Turso
2. **Edge-native databases**: Cloudflare D1, Durable Objects, KV
3. **Connection poolers**: PgBouncer, Supabase pooler

```typescript
// Traditional (doesn't work at edge)
import pg from 'pg';
const client = new pg.Client(); // ❌ TCP socket

// Edge-compatible
const response = await fetch('https://db.example.com/query', {
  method: 'POST',
  body: JSON.stringify({ sql: 'SELECT * FROM users' })
}); // ✅ HTTP
```

### Architectural Patterns

#### Pattern 1: Edge + Origin
```
User → Edge Function (auth, routing) → Origin (Node.js/Python)
```
- Edge handles the fast stuff
- Origin handles the complex stuff

#### Pattern 2: Edge-First
```
User → Edge Function → Edge Database (D1, Turso)
```
- Entire application at the edge
- Works for simpler CRUD applications

#### Pattern 3: BFF at Edge
```
User → Edge BFF (aggregation) → Multiple Backend Services
```
- Edge function as Backend-for-Frontend
- Aggregates multiple API calls
- Reduces client latency

### What This Means for Business-Ecosystem

For a compliance/legal/financial system:

1. **Edge for Auth and Routing**
   - JWT validation at edge (fast, reduces origin load)
   - Geographic routing for data residency compliance
   - Rate limiting per-entity

2. **Origin for Business Logic**
   - Complex compliance rules need full Node.js
   - Database transactions need traditional connections
   - Audit logging needs reliable persistence

3. **Hybrid Architecture**
   ```
   User → Cloudflare Workers (auth, routing)
        → ECS/Lambda (business logic)
        → RDS (data persistence)
   ```

4. **Data Residency**
   - Edge can route requests to region-specific origins
   - Important for GDPR (EU data stays in EU)
   - Cloudflare's jurisdiction controls are relevant

---

## Gaps That Remain

1. **Edge observability**: Tracing and debugging across edge/origin is immature
2. **State management**: Durable Objects vs Redis vs alternatives for edge state
3. **Testing patterns**: How to test edge functions locally with full fidelity

---

## Sources

- Cloudflare Workers documentation (workerd runtime)
- WinterCG specification
- Deno Deploy architecture
- Vercel Edge Functions limitations
- Various benchmarks and comparisons

---

*Research Date: January 2026*
*Gap Status: Substantially Filled - Model clear, edge cases (literally) remain*
