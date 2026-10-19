/**
 * Cache Serializers
 * JSON and custom serialization for cache values
 */

import type { CacheSerializer, CacheEntry } from './types.js';

/**
 * Default JSON serializer
 */
export const jsonSerializer: CacheSerializer = {
  serialize<T>(value: T): string {
    return JSON.stringify(value, (_, v: unknown) => {
      // Handle Date objects
      if (v instanceof Date) {
        return { __type: 'Date', value: v.toISOString() };
      }
      // Handle Map objects
      if (v instanceof Map) {
        return { __type: 'Map', value: Array.from(v.entries()) };
      }
      // Handle Set objects
      if (v instanceof Set) {
        return { __type: 'Set', value: Array.from(v) };
      }
      return v;
    });
  },

  deserialize<T>(data: string): T {
    return JSON.parse(data, (_, v: unknown) => {
      if (v && typeof v === 'object' && '__type' in v) {
        // A value serialize() tagged above.
        const tagged = v as { __type: unknown; value: unknown };
        switch (tagged.__type) {
          case 'Date':
            return new Date(tagged.value as string);
          case 'Map':
            return new Map(tagged.value as [unknown, unknown][]);
          case 'Set':
            return new Set(tagged.value as unknown[]);
        }
      }
      return v;
    }) as T;
  },
};

/**
 * Create a cache entry wrapper with metadata
 */
export function wrapCacheEntry<T>(
  value: T,
  ttl?: number,
  tags?: string[]
): CacheEntry<T> {
  const now = Date.now();
  return {
    value,
    createdAt: now,
    expiresAt: ttl ? now + ttl * 1000 : undefined,
    tags,
  };
}

/**
 * Unwrap a cache entry, returning null if expired
 */
export function unwrapCacheEntry<T>(entry: CacheEntry<T>): T | null {
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    return null;
  }
  return entry.value;
}
