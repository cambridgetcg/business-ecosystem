/**
 * Redis Cache Module
 *
 * Provides caching layer for the contracts-legal service.
 * Uses the existing ioredis dependency.
 */

import Redis, { RedisOptions } from 'ioredis';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
const log = logger.child({ module: 'cache' });

export interface CacheConfig {
  url?: string;
  password?: string;
  tls?: boolean;
  defaultTtl?: number;
}

/**
 * Initialize Redis connection
 */
export function initializeCache(config?: CacheConfig): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = config?.url || process.env.REDIS_URL || 'redis://localhost:6379';

  const options: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        log.error({ times }, 'Redis connection failed after retries');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  };

  if (config?.password || process.env.REDIS_PASSWORD) {
    options.password = config?.password || process.env.REDIS_PASSWORD;
  }

  if (config?.tls || process.env.REDIS_TLS_ENABLED === 'true') {
    options.tls = {};
  }

  redisClient = new Redis(redisUrl, options);

  redisClient.on('connect', () => {
    log.info('Redis connected');
  });

  redisClient.on('error', (err) => {
    log.error({ error: err.message }, 'Redis error');
  });

  redisClient.on('close', () => {
    log.info('Redis connection closed');
  });

  return redisClient;
}

/**
 * Get Redis client (lazy initialization)
 */
export function getCache(): Redis {
  if (!redisClient) {
    return initializeCache();
  }
  return redisClient;
}

/**
 * Disconnect Redis
 */
export async function disconnectCache(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    log.info('Redis disconnected');
  }
}

/**
 * Check Redis health
 */
export async function checkCacheHealth(): Promise<boolean> {
  try {
    const redis = getCache();
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    log.error({ error }, 'Redis health check failed');
    return false;
  }
}

const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getCache();
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    log.warn({ key, error }, 'Cache get failed');
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  try {
    const redis = getCache();
    const ttl = ttlSeconds ?? DEFAULT_TTL;
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    log.warn({ key, error }, 'Cache set failed');
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const redis = getCache();
    await redis.del(key);
  } catch (error) {
    log.warn({ key, error }, 'Cache delete failed');
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<number> {
  try {
    const redis = getCache();
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    const deleted = await redis.del(...keys);
    log.debug({ pattern, deleted }, 'Cache invalidated');
    return deleted;
  } catch (error) {
    log.warn({ pattern, error }, 'Cache invalidate pattern failed');
    return 0;
  }
}

export const CacheKeys = {
  contract: (id: string) => `contract:${id}`,
  contractList: (hash: string) => `contracts:list:${hash}`,
  contractTemplate: (id: string) => `template:${id}`,
  party: (id: string) => `party:${id}`,
  matter: (id: string) => `matter:${id}`,
  permission: (userId: string, resource: string) => `perm:${userId}:${resource}`,
} as const;

export const CacheTTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 3600,
  TEMPLATE: parseInt(process.env.CACHE_CONTRACT_TEMPLATE_TTL || '3600', 10),
} as const;

export async function cacheThrough<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }
  const data = await fetcher();
  await cacheSet(key, data, ttlSeconds);
  return data;
}
