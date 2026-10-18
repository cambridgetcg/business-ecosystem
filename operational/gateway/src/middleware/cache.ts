/**
 * Response Caching Middleware
 * In-memory cache with TTL support
 */

import type { Context, Next } from 'hono';
import pino from 'pino';

const logger = pino({ name: 'operational-gateway-cache' });

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtl: number;

  constructor(defaultTtl = 30000) { // 30 seconds default
    this.defaultTtl = defaultTtl;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  set(key: string, data: unknown, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTtl);
    this.cache.set(key, { data, expiresAt });
    logger.debug({ key, ttl: ttl || this.defaultTtl }, 'Cache set');
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    logger.debug({ key }, 'Cache hit');
    return entry.data;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    logger.debug({ key }, 'Cache invalidated');
  }

  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    logger.debug({ pattern: pattern.toString(), count }, 'Cache pattern invalidated');
    return count;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info({ entriesCleared: size }, 'Cache cleared');
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug({ cleaned }, 'Cache cleanup completed');
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

// Singleton cache instance
export const cache = new ResponseCache();

// Cache TTL configurations per endpoint pattern
const CACHE_CONFIG: Record<string, number> = {
  '/health': 5000,           // 5 seconds
  '/domains/health': 10000,  // 10 seconds
  '/overview': 30000,        // 30 seconds
  '/expiring': 60000,        // 1 minute
  '/pending-actions': 30000, // 30 seconds
  '/compliance': 60000,      // 1 minute
  '/search': 30000,          // 30 seconds
  '/timeline': 30000,        // 30 seconds
  '/stats': 120000,          // 2 minutes
};

function getTtl(path: string): number {
  for (const [pattern, ttl] of Object.entries(CACHE_CONFIG)) {
    if (path.includes(pattern)) {
      return ttl;
    }
  }
  return 30000; // Default 30 seconds
}

function getCacheKey(c: Context): string {
  const url = new URL(c.req.url);
  return `${c.req.method}:${url.pathname}:${url.search}`;
}

export function cacheMiddleware(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;

  return async function (c: Context, next: Next) {
    // Skip caching for non-GET requests
    if (c.req.method !== 'GET' || !enabled) {
      await next();
      return;
    }

    const key = getCacheKey(c);

    // Check cache
    const cached = cache.get(key);
    if (cached) {
      c.header('X-Cache', 'HIT');
      return c.json(cached);
    }

    // Execute request and cache response
    await next();

    // Cache successful JSON responses
    const response = c.res;
    if (response.status === 200) {
      try {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();
        const ttl = getTtl(c.req.path);
        cache.set(key, data, ttl);
        c.header('X-Cache', 'MISS');
        c.header('X-Cache-TTL', String(ttl));
      } catch {
        // Ignore caching errors
      }
    }
  };
}

// Cache invalidation endpoint helper
export function invalidateEntityCache(entityId: string): void {
  cache.invalidatePattern(new RegExp(`entities/${entityId}`));
}
