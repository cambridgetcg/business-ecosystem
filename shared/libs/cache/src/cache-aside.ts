/**
 * Cache-Aside Pattern Implementation
 * Wraps data fetching with automatic caching
 */

import type { CacheClient, CacheOptions } from './types.js';

export interface CacheAsideOptions<T> extends CacheOptions {
  /** Function to generate cache key */
  keyFn?: (...args: unknown[]) => string;
  /** Whether to refresh cache in background on hit */
  staleWhileRevalidate?: boolean;
  /** Extra TTL for stale data during revalidation */
  staleTime?: number;
  /** Error handler for fetch failures */
  onError?: (error: Error) => void;
  /** Transform data before caching */
  transform?: (data: T) => T;
}

/**
 * Cache-aside helper that wraps a fetch function with caching
 */
export function cacheAside<T>(
  cache: CacheClient,
  fetchFn: () => Promise<T>,
  key: string,
  options?: CacheAsideOptions<T>
): Promise<T | null> {
  return cacheAsideImpl(cache, fetchFn, key, options);
}

async function cacheAsideImpl<T>(
  cache: CacheClient,
  fetchFn: () => Promise<T>,
  key: string,
  options?: CacheAsideOptions<T>
): Promise<T | null> {
  // Skip cache if requested
  if (options?.skipCache) {
    const data = await fetchFn();
    return options.transform ? options.transform(data) : data;
  }

  // Try to get from cache
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    // Stale-while-revalidate: return cached value but refresh in background
    if (options?.staleWhileRevalidate) {
      const ttl = await cache.ttl(key);
      const threshold = (options.ttl || 3600) * 0.1; // 10% of TTL
      if (ttl > 0 && ttl < threshold) {
        // Refresh in background
        refreshInBackground(cache, fetchFn, key, options);
      }
    }
    return cached;
  }

  // Cache miss - fetch and cache
  try {
    const data = await fetchFn();
    const transformed = options?.transform ? options.transform(data) : data;
    await cache.set(key, transformed, options);
    return transformed;
  } catch (error) {
    options?.onError?.(error as Error);
    return null;
  }
}

function refreshInBackground<T>(
  cache: CacheClient,
  fetchFn: () => Promise<T>,
  key: string,
  options?: CacheAsideOptions<T>
): void {
  fetchFn()
    .then(async (data) => {
      const transformed = options?.transform ? options.transform(data) : data;
      await cache.set(key, transformed, options);
    })
    .catch((error) => {
      options?.onError?.(error as Error);
    });
}

/**
 * Create a memoized function with caching
 */
export function memoize<TArgs extends unknown[], TResult>(
  cache: CacheClient,
  fn: (...args: TArgs) => Promise<TResult>,
  options: {
    keyPrefix: string;
    ttl?: number;
    tags?: string[];
  }
): (...args: TArgs) => Promise<TResult | null> {
  return async (...args: TArgs): Promise<TResult | null> => {
    const key = options.keyPrefix + ':' + JSON.stringify(args);
    return cacheAside(cache, () => fn(...args), key, {
      ttl: options.ttl,
      tags: options.tags,
    });
  };
}

/**
 * Batch get with cache-aside
 * Fetches missing items from source and caches them
 */
export async function batchGetWithCache<T>(
  cache: CacheClient,
  ids: string[],
  keyFn: (id: string) => string,
  fetchMissing: (ids: string[]) => Promise<Map<string, T>>,
  options?: CacheOptions
): Promise<Map<string, T | null>> {
  const result = new Map<string, T | null>();
  
  if (ids.length === 0) return result;

  // Build keys
  const keyToId = new Map<string, string>();
  const keys: string[] = [];
  for (const id of ids) {
    const key = keyFn(id);
    keyToId.set(key, id);
    keys.push(key);
  }

  // Get from cache
  const cached = await cache.getMany<T>(keys);

  // Find missing
  const missingIds: string[] = [];
  for (const [key, value] of cached) {
    const id = keyToId.get(key)!;
    if (value !== null) {
      result.set(id, value);
    } else {
      missingIds.push(id);
    }
  }

  // Fetch missing
  if (missingIds.length > 0) {
    const fetched = await fetchMissing(missingIds);
    
    // Cache and add to result
    const toCache: Array<{ key: string; value: T; options?: CacheOptions }> = [];
    for (const [id, value] of fetched) {
      result.set(id, value);
      toCache.push({ key: keyFn(id), value, options });
    }

    if (toCache.length > 0) {
      await cache.setMany(toCache);
    }

    // Mark unfound as null
    for (const id of missingIds) {
      if (!fetched.has(id)) {
        result.set(id, null);
      }
    }
  }

  return result;
}
