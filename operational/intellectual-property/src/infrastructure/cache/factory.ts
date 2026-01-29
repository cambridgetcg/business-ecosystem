/**
 * Cache Service Factory
 * Creates the appropriate cache implementation based on configuration
 */

import type { CacheConfig, CacheService } from './types.js';
import { RedisCache } from './redis-cache.js';
import { MemoryCache } from './memory-cache.js';

export interface CreateCacheOptions {
  /** Redis URL, if not provided uses memory cache */
  redisUrl?: string | undefined;
  /** Key prefix for namespace isolation */
  keyPrefix?: string | undefined;
  /** Default TTL in seconds (default: 300) */
  defaultTtlSeconds?: number | undefined;
  /** Enable caching (default: true) */
  enabled?: boolean | undefined;
  /** Max size for memory cache (default: 1000) */
  maxMemorySize?: number | undefined;
}

/**
 * Creates a cache service based on environment and configuration
 * - Returns RedisCache if redisUrl is provided
 * - Falls back to MemoryCache for development or if Redis unavailable
 */
export function createCacheService(options: CreateCacheOptions = {}): CacheService {
  const {
    redisUrl,
    keyPrefix = 'ip',
    defaultTtlSeconds = 300,
    enabled = true,
    maxMemorySize = 1000,
  } = options;

  // Use Redis if URL is provided and not explicitly in-memory mode
  if (redisUrl && redisUrl !== 'memory://') {
    const config: CacheConfig = {
      url: redisUrl,
      keyPrefix,
      defaultTtlSeconds,
      enabled,
      maxRetries: 3,
      retryDelayMs: 1000,
    };

    return new RedisCache(config);
  }

  // Fall back to memory cache
  return new MemoryCache({
    keyPrefix,
    defaultTtlSeconds,
    enabled,
    maxSize: maxMemorySize,
  });
}

/**
 * Creates a no-op cache service that doesn't cache anything
 * Useful for testing or when caching should be disabled
 */
export function createNullCache(): CacheService {
  return new MemoryCache({
    keyPrefix: '',
    defaultTtlSeconds: 0,
    enabled: false,
  });
}
