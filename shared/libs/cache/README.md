# @ecosystem/cache

Caching abstraction layer for the business ecosystem, providing a consistent interface for caching with Redis.

## Installation

```bash
pnpm add @ecosystem/cache
```

## Features

- **Redis-based caching**: Production-ready Redis implementation using ioredis
- **Cache-aside pattern**: Automatic cache population on misses
- **Tag-based invalidation**: Group related cache entries for bulk invalidation
- **Key builder utilities**: Consistent cache key generation
- **Stale-while-revalidate**: Background refresh for better performance

## Usage

### Basic Operations

```typescript
import { RedisCache, createKeyBuilder } from '@ecosystem/cache';

const cache = new RedisCache({
  url: 'redis://localhost:6379',
  keyPrefix: 'myapp:',
  defaultTtl: 3600, // 1 hour
});

const keys = createKeyBuilder('user');

// Set a value
await cache.set(keys.entity('user', userId), user, { ttl: 3600 });

// Get a value
const user = await cache.get<User>(keys.entity('user', userId));

// Delete a value
await cache.delete(keys.entity('user', userId));
```

### Cache-Aside Pattern

```typescript
import { cacheAside, memoize } from '@ecosystem/cache';

// Automatic cache population
const user = await cacheAside(
  cache,
  () => fetchUserFromDatabase(userId),
  keys.entity('user', userId),
  { ttl: 3600 }
);

// Memoize a function
const getUser = memoize(cache, fetchUserFromDatabase, {
  keyPrefix: 'user',
  ttl: 3600,
});
const user = await getUser(userId);
```

### Tag-Based Invalidation

```typescript
// Set with tags
await cache.set('user:123', user, { 
  ttl: 3600, 
  tags: ['users', 'user:123'] 
});

await cache.set('user:456', otherUser, { 
  ttl: 3600, 
  tags: ['users', 'user:456'] 
});

// Invalidate all users
await cache.invalidateByTags(['users']);
```

### Batch Operations

```typescript
import { batchGetWithCache } from '@ecosystem/cache';

const users = await batchGetWithCache(
  cache,
  userIds,
  (id) => keys.entity('user', id),
  async (missingIds) => {
    const users = await db.users.findMany({ where: { id: { in: missingIds } } });
    return new Map(users.map(u => [u.id, u]));
  },
  { ttl: 3600 }
);
```

### Key Building

```typescript
import { CacheKeyBuilder, createKeyBuilder } from '@ecosystem/cache';

const keys = createKeyBuilder('myservice');

keys.entity('user', '123');           // 'myservice:user:123'
keys.list('user');                     // 'myservice:user:list:default'
keys.list('user', { status: 'active' }); // 'myservice:user:list:abc123'
keys.count('user');                    // 'myservice:user:count:all'
keys.method('auth', 'validate', token); // 'myservice:auth:validate:xyz789'
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `CACHE_DEFAULT_TTL` | Default TTL in seconds | 3600 |
| `CACHE_KEY_PREFIX` | Global key prefix | `cache:` |

### CacheConfig Options

```typescript
interface CacheConfig {
  url?: string;           // Redis URL
  host?: string;          // Redis host
  port?: number;          // Redis port (default: 6379)
  password?: string;      // Redis password
  db?: number;            // Redis database number
  keyPrefix?: string;     // Key prefix for all entries
  defaultTtl?: number;    // Default TTL in seconds
  tls?: boolean;          // Enable TLS
}
```

## Health Checks

```typescript
import { createRedisHealthCheck } from '@ecosystem/health';

const cache = new RedisCache({ url: 'redis://localhost:6379' });
const healthCheck = createRedisHealthCheck(cache.getClient());

// Register with health check system
registerHealthCheck(healthCheck);
```

## Best Practices

1. **Use meaningful key prefixes**: Group related keys by domain/feature
2. **Set appropriate TTLs**: Balance freshness vs. performance
3. **Use tags for invalidation**: Group related cache entries
4. **Handle cache failures gracefully**: Cache is optional, not required
5. **Monitor hit rates**: Track cache effectiveness
