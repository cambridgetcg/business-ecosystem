/**
 * In-Memory Cache Implementation
 * Development/fallback caching using LRU-cache
 */

import { LRUCache } from 'lru-cache';
import type { CacheConfig, CacheService, CacheSetOptions } from './types.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache implements CacheService {
  private cache: LRUCache<string, CacheEntry<unknown>>;
  private config: CacheConfig;

  constructor(config: Omit<CacheConfig, 'url'> & { maxSize?: number }) {
    this.config = { ...config, url: 'memory://' };

    this.cache = new LRUCache({
      max: config.maxSize ?? 1000,
      ttl: config.defaultTtlSeconds * 1000,
      ttlAutopurge: true,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;

    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey) as CacheEntry<T> | undefined;

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(prefixedKey);
      return null;
    }

    return entry.value;
  }

  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    if (!this.config.enabled) return;

    const prefixedKey = this.getPrefixedKey(key);
    const ttlMs = (options?.ttl ?? this.config.defaultTtlSeconds) * 1000;

    if (options?.nx) {
      if (this.cache.has(prefixedKey)) return;
    }

    if (options?.xx) {
      if (!this.cache.has(prefixedKey)) return;
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };

    this.cache.set(prefixedKey, entry, { ttl: ttlMs });
  }

  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    const prefixedKey = this.getPrefixedKey(key);
    return this.cache.delete(prefixedKey);
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.config.enabled) return 0;

    const regex = this.patternToRegex(this.getPrefixedKey(pattern));
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey) as CacheEntry<unknown> | undefined;

    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(prefixedKey);
      return false;
    }

    return true;
  }

  async ttl(key: string): Promise<number> {
    if (!this.config.enabled) return -2;

    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey) as CacheEntry<unknown> | undefined;

    if (!entry) return -2; // Key doesn't exist
    if (Date.now() > entry.expiresAt) return -2;

    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }

  async incr(key: string): Promise<number> {
    if (!this.config.enabled) return 0;

    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey) as CacheEntry<number> | undefined;

    const currentValue = entry?.value ?? 0;
    const newValue = currentValue + 1;

    await this.set(key, newValue);
    return newValue;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.config.enabled || keys.length === 0) {
      return keys.map(() => null);
    }

    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (!this.config.enabled || entries.length === 0) return;

    await Promise.all(
      entries.map(entry => this.set(entry.key, entry.value, { ttl: entry.ttl }))
    );
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheSetOptions
  ): Promise<T> {
    if (!this.config.enabled) {
      return fn();
    }

    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    await this.set(key, value, options);
    return value;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.cache.clear();
  }

  isConnected(): boolean {
    return true;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; max: number } {
    return {
      size: this.cache.size,
      max: this.cache.max,
    };
  }

  private getPrefixedKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  private patternToRegex(pattern: string): RegExp {
    // Convert Redis glob pattern to regex
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*') // * -> .*
      .replace(/\?/g, '.'); // ? -> .
    return new RegExp(`^${escaped}$`);
  }
}
