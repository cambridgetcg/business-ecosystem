/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse with configurable limits
 */

import type { Context, Next } from 'hono';
import { rateLimitConfig } from '../env.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (c: Context) => string;
  skip?: (c: Context) => boolean;
  message?: string;
}

// In-memory store (for single-instance deployments)
// For distributed deployments, replace with Redis
const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(c: Context): string {
  // Check various headers for real IP (behind proxy/load balancer)
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection info (may not be available in all environments)
  return 'unknown';
}

/**
 * Create rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = rateLimitConfig.windowMs,
    maxRequests = rateLimitConfig.maxRequests,
    keyGenerator = defaultKeyGenerator,
    skip = () => false,
    message = 'Too many requests, please try again later',
  } = options;

  return async (c: Context, next: Next) => {
    // Skip if configured to skip this request
    if (skip(c)) {
      return next();
    }

    const key = keyGenerator(c);
    const now = Date.now();
    const resetAt = now + windowMs;

    let entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      // New window
      entry = { count: 1, resetAt };
      store.set(key, entry);
    } else {
      // Existing window
      entry.count++;
    }

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSeconds));

    // Check if over limit
    if (entry.count > maxRequests) {
      c.header('Retry-After', String(resetSeconds));
      return c.json(
        {
          error: 'Rate limit exceeded',
          message,
          retryAfter: resetSeconds,
        },
        429
      );
    }

    return next();
  };
}

/**
 * Strict rate limiter for sensitive operations
 * (e.g., breach notifications, consent withdrawals)
 */
export function strictRateLimit() {
  return rateLimit({
    windowMs: 60000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    message: 'Rate limit exceeded for sensitive operation',
  });
}

/**
 * Lenient rate limiter for read operations
 */
export function lenientRateLimit() {
  return rateLimit({
    windowMs: 60000, // 1 minute
    maxRequests: 200, // 200 requests per minute
  });
}

/**
 * Rate limiter that includes entity ID in the key
 * Useful for per-tenant rate limiting
 */
export function entityRateLimit(options: Omit<RateLimitOptions, 'keyGenerator'> = {}) {
  return rateLimit({
    ...options,
    keyGenerator: (c) => {
      const entityId = c.req.param('entityId') || c.req.query('entityId') || 'global';
      const ip = defaultKeyGenerator(c);
      return `${entityId}:${ip}`;
    },
  });
}
