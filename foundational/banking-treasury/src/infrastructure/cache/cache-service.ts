/**
 * Cache Service
 *
 * Provides domain-specific caching operations for banking-treasury.
 * Abstracts Redis operations with typed methods and automatic serialization.
 */

import { getRedisClient, isRedisAvailable } from './redis-client.js';
import { env } from '../../env.js';

// Cache key prefixes for namespacing
const CACHE_PREFIX = 'banking-treasury';
const KEY_PREFIX = {
  account: `${CACHE_PREFIX}:account`,
  accountList: `${CACHE_PREFIX}:accounts`,
  cashPosition: `${CACHE_PREFIX}:cash-position`,
  forecast: `${CACHE_PREFIX}:forecast`,
  payment: `${CACHE_PREFIX}:payment`,
} as const;

type CacheKeyPrefix = typeof KEY_PREFIX[keyof typeof KEY_PREFIX];

/**
 * Build a cache key with prefix
 */
function buildKey(prefix: CacheKeyPrefix, ...parts: string[]): string {
  return [prefix, ...parts].join(':');
}

/**
 * Cache Service - generic caching operations with fallback
 */
export class CacheService {
  private defaultTtl: number;

  constructor(defaultTtl: number = env.CACHE_TTL_SECONDS) {
    this.defaultTtl = defaultTtl;
  }

  /**
   * Get a cached value, returns null if not found or caching disabled
   */
  async get<T>(key: string): Promise<T | null> {
    if (!env.ENABLE_CACHING) {
      return null;
    }

    try {
      const available = await isRedisAvailable();
      if (!available) {
        return null;
      }

      const client = await getRedisClient();
      const value = await client.get(key);

      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set a cached value with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!env.ENABLE_CACHING) {
      return false;
    }

    try {
      const available = await isRedisAvailable();
      if (!available) {
        return false;
      }

      const client = await getRedisClient();
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.defaultTtl;

      await client.setEx(key, ttl, serialized);
      return true;
    } catch (error) {
      console.warn('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<boolean> {
    if (!env.ENABLE_CACHING) {
      return false;
    }

    try {
      const available = await isRedisAvailable();
      if (!available) {
        return false;
      }

      const client = await getRedisClient();
      await client.del(key);
      return true;
    } catch (error) {
      console.warn('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!env.ENABLE_CACHING) {
      return 0;
    }

    try {
      const available = await isRedisAvailable();
      if (!available) {
        return 0;
      }

      const client = await getRedisClient();
      const keys = await client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await client.del(keys);
      return keys.length;
    } catch (error) {
      console.warn('Cache deletePattern error:', error);
      return 0;
    }
  }

  /**
   * Get or set with a loader function (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  // Domain-specific cache methods

  /**
   * Cache a bank account by ID
   */
  async cacheAccount(accountId: string, account: unknown): Promise<boolean> {
    const key = buildKey(KEY_PREFIX.account, accountId);
    return this.set(key, account);
  }

  /**
   * Get a cached bank account
   */
  async getAccount<T>(accountId: string): Promise<T | null> {
    const key = buildKey(KEY_PREFIX.account, accountId);
    return this.get<T>(key);
  }

  /**
   * Invalidate account cache
   */
  async invalidateAccount(accountId: string): Promise<boolean> {
    const key = buildKey(KEY_PREFIX.account, accountId);
    return this.delete(key);
  }

  /**
   * Cache account list for an entity
   */
  async cacheAccountList(entityId: string, accounts: unknown[]): Promise<boolean> {
    const key = buildKey(KEY_PREFIX.accountList, entityId);
    return this.set(key, accounts);
  }

  /**
   * Get cached account list for an entity
   */
  async getAccountList<T>(entityId: string): Promise<T[] | null> {
    const key = buildKey(KEY_PREFIX.accountList, entityId);
    return this.get<T[]>(key);
  }

  /**
   * Invalidate all account caches for an entity
   */
  async invalidateEntityAccounts(entityId: string): Promise<number> {
    const pattern = `${KEY_PREFIX.accountList}:${entityId}*`;
    return this.deletePattern(pattern);
  }

  /**
   * Cache cash position for an entity
   */
  async cacheCashPosition(entityId: string, position: unknown, currency?: string): Promise<boolean> {
    const key = buildKey(KEY_PREFIX.cashPosition, entityId, currency ?? 'all');
    // Cash position has shorter TTL (1 minute) as it changes frequently
    return this.set(key, position, 60);
  }

  /**
   * Get cached cash position
   */
  async getCashPosition<T>(entityId: string, currency?: string): Promise<T | null> {
    const key = buildKey(KEY_PREFIX.cashPosition, entityId, currency ?? 'all');
    return this.get<T>(key);
  }

  /**
   * Invalidate cash position cache for an entity
   */
  async invalidateCashPosition(entityId: string): Promise<number> {
    const pattern = `${KEY_PREFIX.cashPosition}:${entityId}*`;
    return this.deletePattern(pattern);
  }

  /**
   * Cache a forecast
   */
  async cacheForecast(forecastId: string, forecast: unknown): Promise<boolean> {
    const key = buildKey(KEY_PREFIX.forecast, forecastId);
    // Forecasts can be cached longer (10 minutes)
    return this.set(key, forecast, 600);
  }

  /**
   * Invalidate all caches for an entity (after significant changes)
   */
  async invalidateEntityCaches(entityId: string): Promise<void> {
    await Promise.all([
      this.invalidateEntityAccounts(entityId),
      this.invalidateCashPosition(entityId),
      this.deletePattern(`${KEY_PREFIX.forecast}:*${entityId}*`),
    ]);
  }
}

// Singleton instance
export const cacheService = new CacheService();
