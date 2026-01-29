# Dimension 45: ESM Compatibility Patterns

**Discovery Source**: Phase 1 Implementation - Pino and amqplib import issues
**Understanding Level**: UNDERSTANDS
**Last Updated**: January 27, 2026

---

## Aha Moment

> Node.js ESM imports don't always work the same as CommonJS. When a library was designed for CommonJS (`module.exports = fn`), ESM import sees it as `{ default: fn }` not just `fn`. The workaround: runtime detection.

---

## What This Is

The patterns for handling ESM (ECMAScript Modules) compatibility in a TypeScript/Node.js monorepo:
- Runtime detection of module type
- Default export handling
- Type assertion workarounds
- Package.json configuration

---

## Mental Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CommonJS vs ESM Import Behavior                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LIBRARY CODE (CommonJS)                                                    │
│  ───────────────────────                                                    │
│  // pino/index.js                                                           │
│  module.exports = function pino(opts) { ... }                               │
│  module.exports.stdTimeFunctions = { ... }                                  │
│                                                                             │
│  HOW IT'S SEEN                                                              │
│  ────────────────                                                           │
│                                                                             │
│  CommonJS (require)          │   ESM (import)                              │
│  ────────────────────────────┼─────────────────────────────────────────    │
│  const pino = require('pino')│   import pino from 'pino'                   │
│  pino({ ... })               │   pino({ ... }) // ERROR!                   │
│  // Works!                   │   // pino is { default: fn }                │
│                              │                                              │
│                              │   // What you get:                           │
│                              │   pino = {                                   │
│                              │     default: [Function pino],               │
│                              │     stdTimeFunctions: { ... }                │
│                              │   }                                          │
│                                                                             │
│  THE WORKAROUND                                                             │
│  ──────────────                                                             │
│  const pinoFn = typeof pino === 'function'                                 │
│    ? pino                      // Already callable                          │
│    : (pino as any).default;    // Extract from wrapper                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. The Default Export Problem

When a CommonJS module exports a function directly:
```javascript
// CommonJS library
module.exports = function myLib() { ... }
```

ESM import rules create a wrapper:
```javascript
// What ESM sees
{ default: [Function myLib], ...otherExports }
```

So `import myLib from 'mylib'` gives you the wrapper, not the function.

### 2. Runtime Detection Pattern

```typescript
// Pattern discovered in Phase 1
import pino from 'pino';

// Runtime check - works whether bundled or not
const pinoFn = typeof pino === 'function'
  ? pino
  : (pino as any).default;

export const logger = pinoFn({ level: 'info' });
```

**Why runtime check?**: TypeScript types say `pino` is callable, but at runtime it might not be.

### 3. Package.json Configuration

```json
{
  "type": "module",           // Enable ESM
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

The `"type": "module"` tells Node.js to treat `.js` files as ESM.

### 4. Import Path Extensions

ESM requires explicit extensions in imports:
```typescript
// CommonJS (works without extension)
import { foo } from './lib/utils';

// ESM (requires extension)
import { foo } from './lib/utils.js';  // Note: .js even for .ts files
```

---

## Implementation Details

### Pino Fix Location
`/operational/data-privacy/src/lib/logger.ts:13`

```typescript
// Use pino.default for ESM compatibility
const pinoFn = typeof pino === 'function' ? pino : (pino as any).default;

export const logger = pinoFn({
  level: logLevel,
  // ... config
});
```

### amqplib Type Issue
`/shared/libs/messaging/src/rabbitmq-subscriber.ts:6`

```typescript
// Types say Connection, reality is ChannelModel
import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

// This returns ChannelModel, not Connection
this.connection = await amqplib.connect(this.config.url);
```

### tsconfig.json Settings

```json
{
  "compilerOptions": {
    "module": "ESNext",        // ESM output
    "moduleResolution": "bundler",  // or "node16"
    "esModuleInterop": true,   // CommonJS interop
    "allowSyntheticDefaultImports": true
  }
}
```

---

## Curiosities Discovered

### 1. Why Does It Sometimes Work?
Sometimes `import pino from 'pino'; pino({})` works fine.

**Factors**:
- `esModuleInterop` in tsconfig
- How bundler handles it (Vite, esbuild, tsc differ)
- Node.js version
- Whether running compiled JS or tsx

**Answer**: It depends on the compilation/execution chain. Runtime detection is safest.

### 2. TypeScript Types Lie
TypeScript types for pino say it's callable. The types are designed for CommonJS.

**Question**: Should types be updated for ESM or should libraries export differently?
**Status**: Industry-wide issue, no consensus solution.

### 3. .js Extension for .ts Files
ESM imports need `.js` extension even when source is `.ts`:

```typescript
// File: src/lib/logger.ts
// Importing from: src/lib/prisma.ts

import { prisma } from './prisma.js';  // .js not .ts!
```

**Why**: TypeScript compiles to JS. The runtime sees JS files. Extensions must match runtime.

---

## Anti-Patterns to Avoid

### 1. Ignoring the Problem
```typescript
// DON'T: Assume it works
import pino from 'pino';
const logger = pino({ ... });  // May fail at runtime
```

### 2. Blanket Type Assertions
```typescript
// DON'T: Assert without checking
const pinoFn = (pino as any).default;  // Fails if already callable
```

### 3. Mixed Module Styles
```typescript
// DON'T: Mix require and import
import pino from 'pino';
const other = require('other');  // Breaks ESM
```

---

## Recommended Patterns

### Pattern 1: Runtime Detection
```typescript
const lib = typeof imported === 'function'
  ? imported
  : (imported as any).default;
```

### Pattern 2: Named Imports When Possible
```typescript
// Prefer named imports - less ambiguity
import { stdTimeFunctions } from 'pino';
```

### Pattern 3: Explicit Types
```typescript
import type { Logger } from 'pino';
// Then use the runtime-detected function with known type
const logger: Logger = pinoFn({ ... });
```

---

## Related Documentation

- Node.js ESM docs: https://nodejs.org/api/esm.html
- TypeScript moduleResolution: https://www.typescriptlang.org/docs/handbook/module-resolution.html
- pino issue tracker: (likely has open issues about this)

---

## Open Questions

1. **Bundler Differences**: How do Vite, esbuild, and tsc differ in handling this?
2. **Future Direction**: Will Node.js/TypeScript solve this at the platform level?
3. **Library Best Practices**: Should libraries dual-publish CJS and ESM?
4. **Testing**: How to test both module systems in CI?

---

## Now You Can

With this understanding, you can:
1. Fix ESM import errors when they occur
2. Recognize the pattern in other codebases
3. Configure new packages for ESM correctly
4. Debug "X is not a function" errors at runtime
5. Explain why TypeScript compiles but Node.js fails

---

*"The transition from CommonJS to ESM is like moving from implicit to explicit - painful but ultimately better."*
