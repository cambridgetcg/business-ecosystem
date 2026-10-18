/**
 * Cache Middleware Tests
 *
 * Tests for cache hit/miss behavior, TTL expiration,
 * and cache invalidation patterns.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create a fresh cache module for testing
class TestResponseCache {
  private cache = new Map<string, { data: unknown; expiresAt: number }>();
  private defaultTtl: number;

  constructor(defaultTtl = 30000) {
    this.defaultTtl = defaultTtl;
  }

  set(key: string, data: unknown, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTtl);
    this.cache.set(key, { data, expiresAt });
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  // Expose internal map for testing
  _getEntry(key: string) {
    return this.cache.get(key);
  }
}

describe('ResponseCache', () => {
  let cache: TestResponseCache;

  beforeEach(() => {
    cache = new TestResponseCache(30000);
  });

  afterEach(() => {
    cache.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      const data = { message: 'Hello, World!' };
      cache.set('test-key', data);

      const result = cache.get('test-key');
      expect(result).toEqual(data);
    });

    it('should return null for missing keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should store complex objects', () => {
      const data = {
        entities: [
          { id: 1, name: 'Entity 1' },
          { id: 2, name: 'Entity 2' },
        ],
        metadata: {
          total: 2,
          page: 1,
        },
      };

      cache.set('complex-key', data);
      const result = cache.get('complex-key');
      expect(result).toEqual(data);
    });

    it('should use default TTL when not specified', () => {
      const data = { test: true };
      cache.set('default-ttl-key', data);

      const entry = cache._getEntry('default-ttl-key');
      expect(entry?.expiresAt).toBeGreaterThan(Date.now());
      expect(entry?.expiresAt).toBeLessThanOrEqual(Date.now() + 30000 + 100); // Allow small buffer
    });

    it('should use custom TTL when specified', () => {
      const data = { test: true };
      const customTtl = 5000;
      cache.set('custom-ttl-key', data, customTtl);

      const entry = cache._getEntry('custom-ttl-key');
      expect(entry?.expiresAt).toBeGreaterThan(Date.now());
      expect(entry?.expiresAt).toBeLessThanOrEqual(Date.now() + customTtl + 100);
    });
  });

  describe('TTL expiration', () => {
    it('should return null for expired entries', async () => {
      const data = { test: true };
      cache.set('expiring-key', data, 50); // 50ms TTL

      // Should exist immediately
      expect(cache.get('expiring-key')).toEqual(data);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be expired now
      expect(cache.get('expiring-key')).toBeNull();
    });

    it('should delete expired entries on access', async () => {
      const data = { test: true };
      cache.set('auto-delete-key', data, 50);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Access triggers deletion
      cache.get('auto-delete-key');

      // Entry should be removed from internal map
      expect(cache._getEntry('auto-delete-key')).toBeUndefined();
    });

    it('should not expire entries before TTL', async () => {
      const data = { test: true };
      cache.set('valid-key', data, 200);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(cache.get('valid-key')).toEqual(data);
    });
  });

  describe('invalidate', () => {
    it('should remove specific key', () => {
      cache.set('key1', { data: 1 });
      cache.set('key2', { data: 2 });

      cache.invalidate('key1');

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toEqual({ data: 2 });
    });

    it('should handle invalidating non-existent key', () => {
      expect(() => cache.invalidate('non-existent')).not.toThrow();
    });
  });

  describe('invalidatePattern', () => {
    it('should remove all matching keys', () => {
      cache.set('entities/123/overview', { data: 1 });
      cache.set('entities/123/pending', { data: 2 });
      cache.set('entities/456/overview', { data: 3 });
      cache.set('health', { data: 4 });

      const count = cache.invalidatePattern(/entities\/123/);

      expect(count).toBe(2);
      expect(cache.get('entities/123/overview')).toBeNull();
      expect(cache.get('entities/123/pending')).toBeNull();
      expect(cache.get('entities/456/overview')).toEqual({ data: 3 });
      expect(cache.get('health')).toEqual({ data: 4 });
    });

    it('should return count of invalidated entries', () => {
      cache.set('test-1', { data: 1 });
      cache.set('test-2', { data: 2 });
      cache.set('other', { data: 3 });

      const count = cache.invalidatePattern(/^test-/);
      expect(count).toBe(2);
    });

    it('should return 0 when no matches', () => {
      cache.set('key1', { data: 1 });

      const count = cache.invalidatePattern(/non-matching/);
      expect(count).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', { data: 1 });
      cache.set('key2', { data: 2 });
      cache.set('key3', { data: 3 });

      expect(cache.size).toBe(3);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });
  });

  describe('size', () => {
    it('should return correct count', () => {
      expect(cache.size).toBe(0);

      cache.set('key1', { data: 1 });
      expect(cache.size).toBe(1);

      cache.set('key2', { data: 2 });
      expect(cache.size).toBe(2);

      cache.invalidate('key1');
      expect(cache.size).toBe(1);
    });
  });
});

describe('Cache TTL Configuration', () => {
  // Test the TTL configuration logic
  function getTtl(path: string): number {
    const CACHE_CONFIG: Record<string, number> = {
      '/health': 5000,
      '/domains/health': 10000,
      '/overview': 30000,
      '/expiring': 60000,
      '/pending-actions': 30000,
      '/compliance': 60000,
      '/search': 30000,
      '/timeline': 30000,
      '/stats': 120000,
    };

    for (const [pattern, ttl] of Object.entries(CACHE_CONFIG)) {
      if (path.includes(pattern)) {
        return ttl;
      }
    }
    return 30000;
  }

  it('should return correct TTL for health endpoint', () => {
    expect(getTtl('/health')).toBe(5000);
    expect(getTtl('/api/health')).toBe(5000);
  });

  it('should return correct TTL for domains health endpoint', () => {
    expect(getTtl('/domains/health')).toBe(10000);
    expect(getTtl('/operational/domains/health')).toBe(10000);
  });

  it('should return correct TTL for overview endpoint', () => {
    expect(getTtl('/entities/123/overview')).toBe(30000);
    expect(getTtl('/operational/overview')).toBe(30000);
  });

  it('should return correct TTL for expiring endpoint', () => {
    expect(getTtl('/entities/123/expiring')).toBe(60000);
    expect(getTtl('/operational/expiring')).toBe(60000);
  });

  it('should return correct TTL for stats endpoint', () => {
    expect(getTtl('/stats/overview')).toBe(120000);
    expect(getTtl('/operational/stats')).toBe(120000);
  });

  it('should return default TTL for unknown paths', () => {
    expect(getTtl('/unknown/path')).toBe(30000);
    expect(getTtl('/api/v1/something')).toBe(30000);
  });
});

describe('Cache Key Generation', () => {
  function getCacheKey(method: string, pathname: string, search: string): string {
    return `${method}:${pathname}:${search}`;
  }

  it('should generate unique keys for different methods', () => {
    const key1 = getCacheKey('GET', '/entities/123', '');
    const key2 = getCacheKey('POST', '/entities/123', '');

    expect(key1).not.toBe(key2);
    expect(key1).toBe('GET:/entities/123:');
    expect(key2).toBe('POST:/entities/123:');
  });

  it('should generate unique keys for different paths', () => {
    const key1 = getCacheKey('GET', '/entities/123', '');
    const key2 = getCacheKey('GET', '/entities/456', '');

    expect(key1).not.toBe(key2);
  });

  it('should generate unique keys for different query params', () => {
    const key1 = getCacheKey('GET', '/entities', '?status=active');
    const key2 = getCacheKey('GET', '/entities', '?status=pending');

    expect(key1).not.toBe(key2);
    expect(key1).toBe('GET:/entities:?status=active');
    expect(key2).toBe('GET:/entities:?status=pending');
  });

  it('should generate same key for identical requests', () => {
    const key1 = getCacheKey('GET', '/entities/123/overview', '?compliance=true');
    const key2 = getCacheKey('GET', '/entities/123/overview', '?compliance=true');

    expect(key1).toBe(key2);
  });
});

describe('Entity Cache Invalidation', () => {
  let cache: TestResponseCache;

  beforeEach(() => {
    cache = new TestResponseCache();
  });

  afterEach(() => {
    cache.clear();
  });

  it('should invalidate all cache entries for an entity', () => {
    const entityId = 'entity-123';

    cache.set(`GET:/operational/entities/${entityId}/overview:`, { data: 1 });
    cache.set(`GET:/operational/entities/${entityId}/pending-actions:`, { data: 2 });
    cache.set(`GET:/operational/entities/${entityId}/expiring:?days=30`, { data: 3 });
    cache.set(`GET:/operational/entities/other-entity/overview:`, { data: 4 });

    const count = cache.invalidatePattern(new RegExp(`entities/${entityId}`));

    expect(count).toBe(3);
    expect(cache.get(`GET:/operational/entities/${entityId}/overview:`)).toBeNull();
    expect(cache.get(`GET:/operational/entities/other-entity/overview:`)).not.toBeNull();
  });
});
