/**
 * Redis Cache Implementation
 * Production-ready caching using ioredis
 */

import { Redis, type Redis as RedisClient } from 'ioredis';
import type { CacheConfig, CacheService, CacheSetOptions } from './types.js';

export class RedisCache implements CacheService {
  private client: RedisClient;
  private config: CacheConfig;
  private connected = false;

  constructor(config: CacheConfig) {
    this.config = config;

    const redisOptions = {
      retryStrategy: (times: number) => {
        if (times > (config.maxRetries ?? 3)) {
          return null; // Stop retrying
        }
        return config.retryDelayMs ?? Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      ...(config.keyPrefix ? { keyPrefix: `${config.keyPrefix}:` } : {}),
    };

    this.client = new Redis(config.url, redisOptions);

    this.client.on('connect', () => {
      this.connected = true;
    });

    this.client.on('error', (err: Error) => {
      console.error('[RedisCache] Connection error:', err.message);
      this.connected = false;
    });

    this.client.on('close', () => {
      this.connected = false;
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;

    try {
      const value = await this.client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[RedisCache] Get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const serialized = JSON.stringify(value);
      const ttl = options?.ttl ?? this.config.defaultTtlSeconds;

      if (options?.nx) {
        await this.client.set(key, serialized, 'EX', ttl, 'NX');
      } else if (options?.xx) {
        await this.client.set(key, serialized, 'EX', ttl, 'XX');
      } else {
        await this.client.set(key, serialized, 'EX', ttl);
      }
    } catch (error) {
      console.error('[RedisCache] Set error:', error);
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error('[RedisCache] Delete error:', error);
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.config.enabled) return 0;

    try {
      const fullPattern = this.config.keyPrefix
        ? `${this.config.keyPrefix}:${pattern}`
        : pattern;

      let cursor = '0';
      let deleted = 0;

      do {
        const [newCursor, keys] = await this.client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
        cursor = newCursor;

        if (keys.length > 0) {
          // Remove prefix from keys since client adds it automatically
          const keysWithoutPrefix = this.config.keyPrefix
            ? keys.map((k: string) => k.replace(`${this.config.keyPrefix}:`, ''))
            : keys;
          deleted += await this.client.del(...keysWithoutPrefix);
        }
      } while (cursor !== '0');

      return deleted;
    } catch (error) {
      console.error('[RedisCache] DeletePattern error:', error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      console.error('[RedisCache] Exists error:', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.config.enabled) return -2;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error('[RedisCache] TTL error:', error);
      return -2;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.config.enabled) return 0;

    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error('[RedisCache] Incr error:', error);
      return 0;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.config.enabled || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await this.client.mget(...keys);
      return values.map((v: string | null) => (v ? JSON.parse(v) as T : null));
    } catch (error) {
      console.error('[RedisCache] Mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number | undefined }>): Promise<void> {
    if (!this.config.enabled || entries.length === 0) return;

    try {
      const pipeline = this.client.pipeline();

      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        const ttl = entry.ttl ?? this.config.defaultTtlSeconds;
        pipeline.set(entry.key, serialized, 'EX', ttl);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('[RedisCache] Mset error:', error);
    }
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheSetOptions
  ): Promise<T> {
    if (!this.config.enabled) {
      return fn();
    }

    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const value = await fn();
      await this.set(key, value, options);
      return value;
    } catch (error) {
      console.error('[RedisCache] GetOrSet error:', error);
      return fn();
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.client.status === 'ready';
  }

  /**
   * Get the underlying Redis client for advanced operations
   */
  getClient(): RedisClient {
    return this.client;
  }
}
