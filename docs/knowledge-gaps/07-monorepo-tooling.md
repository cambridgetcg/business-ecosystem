# Monorepo Tooling Evolution: Turborepo vs Nx vs pnpm

## Knowledge Gap Identified

**The uncertainty**: The monorepo tooling landscape has matured significantly. Turborepo (acquired by Vercel), Nx, and native pnpm workspaces each have distinct philosophies and trade-offs. The decision framework for choosing between them felt incomplete.

---

## Research Findings

### The Monorepo Problem

Large codebases need:
1. **Task orchestration**: Run builds/tests in dependency order
2. **Caching**: Don't rebuild unchanged code
3. **Affected detection**: What changed? What needs to rebuild?
4. **Dependency management**: Shared deps across packages
5. **Code generation**: Scaffolding, consistency

Different tools solve different subsets differently.

### Tool Comparison

#### pnpm Workspaces

**What it is**: Package manager with workspace support (not a build tool)

**Strengths:**
- Fastest package installation
- Disk-efficient (content-addressable storage)
- Strict by default (no phantom dependencies)
- Simple mental model
- No lock-in

**Limitations:**
- No task caching
- No remote caching
- No affected detection
- No code generation
- Manual task orchestration

**Best for:**
- Simple monorepos without complex build graphs
- Teams that want full control
- Projects that need a package manager, not a build system

#### Turborepo

**What it is**: Fast, focused task runner with caching

**Strengths:**
- Extremely fast
- Simple configuration (`turbo.json`)
- Excellent remote caching (Vercel integration)
- Minimal learning curve
- Incremental adoption

**Limitations:**
- Limited code generation
- No project graph visualization (basic)
- Less "batteries included"
- Vercel-centric ecosystem

**Best for:**
- Teams prioritizing speed and simplicity
- Vercel deployments
- JavaScript/TypeScript projects
- Incremental monorepo adoption

**turbo.json example:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "test/**"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

#### Nx

**What it is**: Full-featured monorepo toolkit with opinions

**Strengths:**
- Rich plugin ecosystem
- Excellent code generation (`nx generate`)
- Project graph visualization
- Sophisticated affected detection
- Language/framework agnostic
- Module federation support
- Distributed task execution

**Limitations:**
- Steeper learning curve
- More configuration
- Can feel heavy for small projects
- Plugin quality varies

**Best for:**
- Large, complex monorepos
- Multi-language projects
- Teams wanting structure and conventions
- Enterprise environments

**nx.json example:**
```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "test": {
      "cache": true,
      "inputs": ["default", "^default"]
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": ["default", "!{projectRoot}/**/*.spec.ts"]
  }
}
```

### Decision Framework

```
START
  │
  ├─ Simple project, few packages?
  │     └─ YES → pnpm workspaces (+ scripts)
  │
  ├─ JavaScript/TypeScript only, Vercel deployment?
  │     └─ YES → Turborepo
  │
  ├─ Multi-language, need code generation?
  │     └─ YES → Nx
  │
  ├─ Need distributed task execution?
  │     └─ YES → Nx Cloud
  │
  ├─ Want minimal tooling overhead?
  │     └─ YES → Turborepo
  │
  └─ Large enterprise, complex dependency graph?
        └─ YES → Nx
```

### Hybrid Approaches

Many teams use combinations:

**pnpm + Turborepo** (most common):
```
pnpm (package management)
  └── Turborepo (task orchestration + caching)
```

**pnpm + Nx**:
```
pnpm (package management)
  └── Nx (full build system + code gen)
```

### Caching Comparison

| Feature | pnpm | Turborepo | Nx |
|---------|------|-----------|-----|
| Local cache | ❌ | ✅ | ✅ |
| Remote cache | ❌ | ✅ (Vercel) | ✅ (Nx Cloud) |
| Cache sharing | ❌ | ✅ | ✅ |
| Custom cache backends | ❌ | ✅ (S3, etc.) | ✅ |
| Distributed execution | ❌ | ❌ | ✅ |

### What This Means for Business-Ecosystem

For the business-ecosystem architecture:

1. **Current State**: pnpm workspaces established
   - 11 domain services
   - Shared libs, contracts, events packages
   - Clean structure already in place

2. **Recommendation: pnpm + Turborepo**
   - Already using pnpm
   - TypeScript monorepo (Turborepo sweet spot)
   - Vercel deployment possible
   - Simple, fast, minimal overhead
   - Remote caching for CI

3. **Implementation:**
   ```json
   // turbo.json
   {
     "tasks": {
       "build": {
         "dependsOn": ["^build"],
         "outputs": ["dist/**"]
       },
       "test": {
         "dependsOn": ["build"]
       },
       "lint": {},
       "typecheck": {
         "dependsOn": ["^build"]
       },
       "db:migrate": {
         "cache": false
       },
       "dev": {
         "cache": false,
         "persistent": true
       }
     }
   }
   ```

4. **Why not Nx:**
   - Overkill for TypeScript-only project
   - Turborepo is simpler, ecosystem already has structure
   - Nx's code generation less valuable when patterns are established

---

## Gaps That Remain

1. **Remote caching costs**: How expensive at scale?
2. **Migration paths**: Moving between tools as needs change
3. **Custom task runners**: Integrating non-JS tools into the graph
4. **Bazel comparison**: When does Bazel make sense vs these tools?

---

## Sources

- Turborepo documentation
- Nx documentation
- pnpm workspaces documentation
- Various monorepo comparison articles
- Community benchmarks and case studies

---

*Research Date: January 2026*
*Gap Status: Substantially Filled - Decision framework clear, specific scenarios may vary*
