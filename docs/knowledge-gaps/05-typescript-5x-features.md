# TypeScript 5.x Advanced Features

## Knowledge Gap Identified

**The uncertainty**: TypeScript has evolved significantly with 5.x releases. Features like decorators (finally standardized), `const` type parameters, the `satisfies` operator, and `using` declarations represent meaningful changes to how TypeScript code should be written. My patterns felt dated.

---

## Research Findings

### The `satisfies` Operator (5.0+)

**The problem it solves:**
```typescript
// Old way: Type annotation loses literal types
const config: Record<string, string> = {
  apiUrl: "https://api.example.com",
  timeout: "5000"  // Oops, should be number
};
config.apiUrl  // type: string (lost "https://api.example.com")

// Old way: No annotation loses type safety
const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000
};
// No guarantee this matches expected shape
```

**The solution:**
```typescript
type Config = Record<string, string | number>;

const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000
} satisfies Config;

config.apiUrl  // type: "https://api.example.com" (literal preserved!)
config.timeout // type: number (literal preserved!)
// AND we get type checking against Config shape
```

**Use cases:**
- Configuration objects with known keys
- Maintaining literal types while ensuring shape
- Discriminated unions with precise types

### `const` Type Parameters (5.0+)

**The problem:**
```typescript
function makeArray<T>(item: T): T[] {
  return [item];
}

const arr = makeArray({ name: "test" });
// arr: { name: string }[]  -- lost literal type!
```

**The solution:**
```typescript
function makeArray<const T>(item: T): T[] {
  return [item];
}

const arr = makeArray({ name: "test" });
// arr: { readonly name: "test" }[]  -- literal preserved!
```

**Use cases:**
- Factory functions that should preserve literal types
- Builder patterns
- Configuration builders

### Decorators (5.0+ - Stage 3 Standard)

TypeScript 5.0 finally implemented TC39 Stage 3 decorators (not the experimental ones):

```typescript
// Class decorator
function logged<T extends new (...args: any[]) => any>(
  target: T,
  context: ClassDecoratorContext
) {
  return class extends target {
    constructor(...args: any[]) {
      console.log(`Creating ${context.name}`);
      super(...args);
    }
  };
}

@logged
class MyService {
  // ...
}

// Method decorator
function measure<T extends (...args: any[]) => any>(
  target: T,
  context: ClassMethodDecoratorContext
) {
  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const start = performance.now();
    const result = target.apply(this, args);
    console.log(`${String(context.name)} took ${performance.now() - start}ms`);
    return result;
  };
}

class Service {
  @measure
  processData(data: string[]): void {
    // ...
  }
}
```

**Key differences from experimental decorators:**
- No `reflect-metadata` needed for basic use
- Different signature (includes `context` parameter)
- Better type inference
- Field decorators have different timing

### `using` Declarations (5.2+)

Resource management with `Symbol.dispose`:

```typescript
// Define a disposable resource
class FileHandle {
  constructor(private path: string) {
    console.log(`Opening ${path}`);
  }

  read(): string {
    return "file contents";
  }

  [Symbol.dispose]() {
    console.log(`Closing ${this.path}`);
  }
}

// Automatic cleanup
function processFile() {
  using file = new FileHandle("/tmp/data.txt");
  const contents = file.read();
  // file is automatically disposed when scope exits
  return contents;
}

// Async version with Symbol.asyncDispose
class DatabaseConnection {
  async [Symbol.asyncDispose]() {
    await this.close();
  }
}

async function query() {
  await using db = new DatabaseConnection();
  return db.query("SELECT * FROM users");
  // connection closed automatically
}
```

**Use cases:**
- Database connections
- File handles
- Locks and semaphores
- Transaction management

### Import Attributes (5.3+)

```typescript
// Import JSON with type assertion
import config from "./config.json" with { type: "json" };

// Import CSS (in bundlers that support it)
import styles from "./styles.css" with { type: "css" };
```

### Improved `switch(true)` Narrowing (5.3+)

```typescript
function handle(x: string | number | boolean) {
  switch (true) {
    case typeof x === "string":
      return x.toUpperCase();  // x is string
    case typeof x === "number":
      return x.toFixed(2);     // x is number
    default:
      return x;                // x is boolean
  }
}
```

### Utility Type Improvements

```typescript
// NoInfer<T> - prevents inference from this position (5.4+)
function createState<T>(initial: NoInfer<T>): State<T> {
  // T must be explicitly provided, not inferred from initial
}

// Improved inference in generic functions
function map<T, U>(arr: T[], fn: (x: T) => U): U[] {
  // Better inference in 5.x
}
```

### What This Means for Business-Ecosystem

For the ecosystem codebase:

1. **`satisfies` for Configuration**
   ```typescript
   export const domainConfig = {
     accounting: { db: "accounting_db" },
     tax: { db: "tax_db" }
   } satisfies Record<DomainName, DomainConfig>;
   ```

2. **`using` for Resource Management**
   ```typescript
   async function withTransaction<T>(
     fn: (tx: Transaction) => Promise<T>
   ): Promise<T> {
     await using tx = await db.beginTransaction();
     return fn(tx);
     // auto-commit or rollback on dispose
   }
   ```

3. **Decorators for Cross-Cutting Concerns**
   ```typescript
   class ContractService {
     @audit("contract.create")
     @authorize("contracts:write")
     @validate(CreateContractSchema)
     async createContract(data: CreateContractDTO) {
       // ...
     }
   }
   ```

4. **`const` Parameters for Builders**
   ```typescript
   function defineEvent<const T extends EventSchema>(schema: T) {
     return schema;
   }

   // Preserves literal types for event names, etc.
   ```

---

## Gaps That Remain

1. **Decorator ecosystem**: Many libraries still use experimental decorators
2. **`using` adoption**: Few libraries implement `Symbol.dispose` yet
3. **Build tool support**: Not all tools fully support latest features
4. **Performance implications**: Some features have runtime cost

---

## Sources

- TypeScript 5.0-5.4 release notes
- TypeScript documentation
- TC39 proposals (decorators, explicit resource management)
- Various TypeScript deep-dive articles

---

*Research Date: January 2026*
*Gap Status: Substantially Filled - Features clear, ecosystem adoption ongoing*
