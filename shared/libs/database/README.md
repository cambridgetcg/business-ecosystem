# @ecosystem/database

Database abstraction layer for the business ecosystem, providing consistent patterns for data access across all services.

## Installation

```bash
pnpm add @ecosystem/database
```

## Features

- **Repository Pattern**: Generic CRUD operations with pagination and filtering
- **Unit of Work**: Transaction management with automatic rollback
- **Drizzle ORM Integration**: Full support for Drizzle ORM with PostgreSQL
- **Cached Repository**: Transparent caching decorator using cache-aside pattern

## Usage

### Basic Repository Pattern

```typescript
import { Repository, Entity, PaginationParams } from '@ecosystem/database';

interface User extends Entity {
  email: string;
  name: string;
}

class UserRepository implements Repository<User> {
  // Implement CRUD operations
}
```

### Drizzle ORM

```typescript
import { DrizzleConnection, DrizzleRepository } from '@ecosystem/database/drizzle';
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

// Define schema
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Create connection
const connection = new DrizzleConnection({
  url: process.env.DATABASE_URL,
  poolMax: 20,
});
await connection.connect();

// Create repository
class UserRepository extends DrizzleRepository<User> {
  constructor(db: DrizzleDb) {
    super(db, {
      table: users,
      columns: { id: users.id, createdAt: users.createdAt, updatedAt: users.updatedAt },
      mapToEntity: (row) => ({ ...row }),
      mapToInsert: (data) => ({ ...data }),
    });
  }
}
```

### Cached Repository

```typescript
import { withCache, CachedRepository } from '@ecosystem/database';
import { RedisCache } from '@ecosystem/cache';

const cache = new RedisCache({ url: 'redis://localhost:6379' });
const userRepo = new UserRepository(db);

const cachedUserRepo = withCache(userRepo, cache, {
  keyPrefix: 'user',
  ttl: 3600,
  cacheListQueries: true,
  listTtl: 300,
});

// Automatic caching on reads, invalidation on writes
const user = await cachedUserRepo.findById(userId);
```

### Transactions

```typescript
import { withTransaction, withDrizzleTransaction } from '@ecosystem/database/drizzle';

// Using raw pool transaction
await withTransaction(pool, async (client) => {
  await client.query('INSERT INTO users ...');
  await client.query('INSERT INTO accounts ...');
});

// Using Drizzle transaction
await withDrizzleTransaction(db, async (tx) => {
  await tx.insert(users).values({ ... });
  await tx.insert(accounts).values({ ... });
});
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `DB_POOL_MIN` | Minimum pool connections | 2 |
| `DB_POOL_MAX` | Maximum pool connections | 20 |
| `DB_SSL` | Enable SSL | false |

## Architecture

```
@ecosystem/database
├── types.ts           # Core interfaces (Entity, Repository, etc.)
├── repository.ts      # Base repository abstract class
├── connection.ts      # Connection management interface
├── unit-of-work.ts    # Transaction management
├── cached-repository.ts # Caching decorator
└── drizzle/
    ├── connection.ts  # Drizzle-specific connection
    ├── repository.ts  # Drizzle repository base class
    └── transaction.ts # Drizzle transaction utilities
```

## Best Practices

1. **One database per bounded context**: Each domain service has its own database
2. **Repository per aggregate root**: Create repositories for aggregate roots only
3. **Use transactions for multi-step operations**: Wrap related writes in transactions
4. **Cache read-heavy data**: Use CachedRepository for frequently accessed entities
5. **Implement soft deletes**: Use `SoftDeletableEntity` for audit trails
