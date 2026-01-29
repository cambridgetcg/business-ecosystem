# SQLite Renaissance: Edge Databases

## Knowledge Gap Identified

**The uncertainty**: SQLite has undergone a renaissance, becoming viable for distributed/edge applications through projects like Turso, Cloudflare D1, and LiteFS. The replication patterns, consistency models, and appropriate use cases felt unclear. When is "SQLite at the edge" the right choice?

---

## Research Findings

### Why SQLite Now?

SQLite was always excellent but constrained to single-node use. What changed:

1. **Distributed replication solved** (LiteFS, Turso/libSQL)
2. **Edge runtime compatibility** (HTTP-based access)
3. **Embedded ML** (sqlite-vec for vectors)
4. **Performance at scale** (read-heavy workloads shine)

### The Key Players

#### Turso / libSQL

- Fork of SQLite with replication primitives
- Distributed SQLite with edge replicas
- HTTP API (works at edge)
- Embedded replicas (sync to local SQLite file)

```typescript
import { createClient } from "@libsql/client";

const client = createClient({
  url: "libsql://my-db.turso.io",
  authToken: process.env.TURSO_TOKEN,
});

const result = await client.execute("SELECT * FROM users WHERE id = ?", [1]);
```

#### Cloudflare D1

- SQLite at Cloudflare's edge
- Native integration with Workers
- Automatic replication to edge locations
- Limited to Cloudflare ecosystem

```typescript
export default {
  async fetch(request, env) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).bind(1).all();
    return Response.json(results);
  }
};
```

#### LiteFS

- FUSE-based replication for SQLite
- Primary/replica model
- Used by Fly.io
- Requires specific deployment environment

### Replication Models

#### Primary/Replica (LiteFS, Turso default)
```
Primary (writes)
    │
    ├──► Replica 1 (reads)
    ├──► Replica 2 (reads)
    └──► Replica N (reads)
```
- Writes go to primary
- Async replication to replicas
- Eventual consistency for reads
- Strong consistency for read-after-write on primary

#### Embedded Replicas (Turso)
```
Application
    │
    ├─ Local SQLite (embedded replica)
    │      ▲
    │      │ sync
    │      ▼
    └─ Remote Turso (primary)
```
- Local reads (zero latency)
- Writes to remote, then sync
- Offline capable
- Great for read-heavy workloads

### Consistency Trade-offs

| Model | Read Consistency | Write Consistency | Latency |
|-------|------------------|-------------------|---------|
| Primary only | Strong | Strong | High (network) |
| Replica reads | Eventual | Strong | Low (local/edge) |
| Embedded replica | Eventual (until sync) | Strong | Zero (local) |

**The pattern**: Accept eventual consistency for reads, ensure writes are confirmed at primary.

### When to Use SQLite at Edge

**Good for:**
- Read-heavy workloads (90%+ reads)
- Data with regional affinity
- Offline-first applications
- Simple relational data
- Per-user or per-tenant databases

**Not good for:**
- Write-heavy workloads
- Strong consistency requirements
- Complex transactions across databases
- Large datasets (>10GB per database)
- High write concurrency

### Multi-Database Patterns

**Per-tenant database:**
```
tenant_001.db  ←─ Tenant 1 data (isolated)
tenant_002.db  ←─ Tenant 2 data (isolated)
tenant_003.db  ←─ Tenant 3 data (isolated)
```

Benefits:
- Complete tenant isolation
- Easy backup/restore per tenant
- Can place tenant DB near user
- Simple compliance (delete tenant = delete DB)

### Vector Search in SQLite

sqlite-vec enables vector similarity search:

```sql
-- Create virtual table for vectors
CREATE VIRTUAL TABLE embeddings USING vec0(
  document_id INTEGER PRIMARY KEY,
  embedding FLOAT[1536]
);

-- Insert
INSERT INTO embeddings VALUES (1, ?);  -- bind embedding array

-- Search
SELECT document_id, distance
FROM embeddings
WHERE embedding MATCH ?  -- bind query embedding
ORDER BY distance
LIMIT 10;
```

This enables RAG applications with SQLite as the vector store.

### What This Means for Business-Ecosystem

For a compliance/legal/financial system:

1. **Not Primary Database**
   - Financial data needs strong consistency
   - Complex transactions across entities
   - RDS PostgreSQL remains appropriate

2. **Potential for Auxiliary Use Cases**
   - Per-entity audit log caching
   - Local search indexes
   - Offline compliance checklist
   - Edge-cached reference data (regulations, templates)

3. **Multi-Region Compliance**
   - Data residency requirements
   - SQLite replicas in specific regions
   - Read from local, write to primary in jurisdiction

4. **Vector Search for Documents**
   - Contract similarity search
   - Regulation matching
   - Could use Turso with sqlite-vec

**Architecture consideration:**
```
Primary (PostgreSQL on RDS)
    │
    └──► Derived Data
            │
            └──► SQLite Edge Cache (Turso/D1)
                 (read-only materialized views)
```

---

## Gaps That Remain

1. **Conflict resolution**: What happens with concurrent writes in replicated SQLite?
2. **Monitoring and observability**: Tooling is immature
3. **Migration patterns**: How to move from/to traditional DBs?
4. **Long-term durability guarantees**: How reliable is replication?

---

## Sources

- Turso documentation and libSQL repo
- Cloudflare D1 documentation
- LiteFS (Fly.io) documentation
- sqlite-vec project
- Various edge database comparison articles

---

*Research Date: January 2026*
*Gap Status: Substantially Filled - Patterns clear, production maturity still developing*
