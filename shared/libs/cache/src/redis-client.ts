/**
 * Redis Cache Client
 * Production-ready Redis caching implementation using ioredis
 */

import { Redis } from 'ioredis';
import type { CacheClient, CacheConfig, CacheOptions, CacheStats, CacheSerializer } from './types.js';
import { jsonSerializer } from './serializer.js';

export class RedisCache implements CacheClient {
  private client: Redis;
  private keyPrefix: string;
  private defaultTtl: number;
  private serializer: CacheSerializer;
  private counters = { hits: 0, misses: 0 };

  constructor(config: CacheConfig, serializer: CacheSerializer = jsonSerializer) {
    this.keyPrefix = config.keyPrefix || 'cache:';
    this.defaultTtl = config.defaultTtl || 3600; // 1 hour default
    this.serializer = serializer;

    if (config.url) {
      this.client = new Redis(config.url, {
        keyPrefix: this.keyPrefix,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
    } else {
      this.client = new Redis({
        host: config.host || 'localhost',
        port: config.port || 6379,
        ...(config.password !== undefined ? { password: config.password } : {}),
        db: config.db || 0,
        keyPrefix: this.keyPrefix,
        ...(config.tls ? { tls: {} } : {}),
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
    }

    this.client.on('error', (err) => {
      console.error('Redis cache error:', err.message);
    });
  }

  private fullKey(key: string): string {
    // ioredis handles prefix automatically, but we need this for pattern matching
    return key;
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(this.fullKey(key));
    if (!data) {
      this.counters.misses++;
      return null;
    }
    this.counters.hits++;
    try {
      return this.serializer.deserialize<T>(data);
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTtl;
    const serialized = this.serializer.serialize(value);

    if (ttl > 0) {
      await this.client.setex(this.fullKey(key), ttl, serialized);
    } else {
      await this.client.set(this.fullKey(key), serialized);
    }

    // Store tags if provided
    if (options?.tags && options.tags.length > 0) {
      const pipeline = this.client.pipeline();
      for (const tag of options.tags) {
        pipeline.sadd(this.tagKey(tag), this.fullKey(key));
        if (ttl > 0) {
          pipeline.expire(this.tagKey(tag), ttl + 3600); // Tags expire after keys
        }
      }
      await pipeline.exec();
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(this.fullKey(key));
    return result > 0;
  }

  async deleteMany(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys.map((k) => this.fullKey(k)));
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(this.fullKey(key));
    return result > 0;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(this.fullKey(key));
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.client.expire(this.fullKey(key), ttl);
    return result === 1;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    if (keys.length === 0) return result;

    const values = await this.client.mget(...keys.map((k) => this.fullKey(k)));

    keys.forEach((key, index) => {
      const data = values[index];
      if (data) {
        this.counters.hits++;
        try {
          result.set(key, this.serializer.deserialize<T>(data));
        } catch {
          result.set(key, null);
        }
      } else {
        this.counters.misses++;
        result.set(key, null);
      }
    });

    return result;
  }

  async setMany<T>(entries: Array<{ key: string; value: T; options?: CacheOptions | undefined }>): Promise<void> {
    if (entries.length === 0) return;

    const pipeline = this.client.pipeline();

    for (const { key, value, options } of entries) {
      const ttl = options?.ttl ?? this.defaultTtl;
      const serialized = this.serializer.serialize(value);

      if (ttl > 0) {
        pipeline.setex(this.fullKey(key), ttl, serialized);
      } else {
        pipeline.set(this.fullKey(key), serialized);
      }

      if (options?.tags) {
        for (const tag of options.tags) {
          pipeline.sadd(this.tagKey(tag), this.fullKey(key));
        }
      }
    }

    await pipeline.exec();
  }

  async clear(): Promise<void> {
    // Use SCAN to find and delete keys with our prefix
    let cursor = '0';
    const pattern = this.keyPrefix + '*';

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        // Keys from SCAN include the full key (with prefix), but del needs keys without
        // Since ioredis adds prefix, we need to remove it for deletion
        const keysWithoutPrefix = keys.map((k) => k.replace(this.keyPrefix, ''));
        await this.client.del(...keysWithoutPrefix);
      }
    } while (cursor !== '0');
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    if (tags.length === 0) return 0;

    let totalDeleted = 0;

    for (const tag of tags) {
      const keys = await this.client.smembers(this.tagKey(tag));
      if (keys.length > 0) {
        const deleted = await this.client.del(...keys);
        totalDeleted += deleted;
      }
      await this.client.del(this.tagKey(tag));
    }

    return totalDeleted;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async stats(): Promise<CacheStats> {
    const total = this.counters.hits + this.counters.misses;
    const info = await this.client.info('memory');
    const usedMemory = info.match(/used_memory:(\d+)/)?.[1];

    return {
      hits: this.counters.hits,
      misses: this.counters.misses,
      hitRate: total > 0 ? this.counters.hits / total : 0,
      keyCount: await this.client.dbsize(),
      memoryUsage: usedMemory !== undefined ? parseInt(usedMemory, 10) : undefined,
    };
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  /** Get raw Redis client for advanced operations */
  getClient(): Redis {
    return this.client;
  }

  private tagKey(tag: string): string {
    return '_tags:' + tag;
  }
}
