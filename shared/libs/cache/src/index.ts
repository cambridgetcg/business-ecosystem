/**
 * @ecosystem/cache
 * Caching abstraction layer for the business ecosystem
 *
 * Usage:
 * ```typescript
 * import { RedisCache, cacheAside, createKeyBuilder } from '@ecosystem/cache';
 *
 * const cache = new RedisCache({ url: 'redis://localhost:6379' });
 * const keys = createKeyBuilder('myservice');
 *
 * // Simple get/set
 * await cache.set(keys.entity('user', userId), user, { ttl: 3600 });
 * const cached = await cache.get<User>(keys.entity('user', userId));
 *
 * // Cache-aside pattern
 * const user = await cacheAside(cache, () => fetchUser(id), keys.entity('user', id));
 * ```
 */

// Types
export type {
  CacheConfig,
  CacheOptions,
  CacheEntry,
  CacheStats,
  CacheClient,
  CacheSerializer,
} from './types.js';

// Redis implementation
export { RedisCache } from './redis-client.js';

// Serialization
export { jsonSerializer, wrapCacheEntry, unwrapCacheEntry } from './serializer.js';

// Cache-aside pattern
export { cacheAside, memoize, batchGetWithCache, type CacheAsideOptions } from './cache-aside.js';

// Key building utilities
export { CacheKeyBuilder, createKeyBuilder, KeyBuilders, type KeyBuilderConfig } from './key-builder.js';

// Factory function for quick setup
export function createCache(config: import('./types.js').CacheConfig): import('./types.js').CacheClient {
  return new (require('./redis-client.js').RedisCache)(config);
}
