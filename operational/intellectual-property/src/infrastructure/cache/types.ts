/**
 * Cache Types - Abstractions for caching layer
 */

export interface CacheConfig {
  /** Redis connection URL */
  url: string;
  /** Key prefix for namespace isolation */
  keyPrefix: string;
  /** Default TTL in seconds */
  defaultTtlSeconds: number;
  /** Enable/disable caching */
  enabled: boolean;
  /** Max retries for connection */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelayMs?: number;
}

export interface CacheSetOptions {
  /** TTL in seconds, overrides default */
  ttl?: number | undefined;
  /** Only set if key doesn't exist */
  nx?: boolean | undefined;
  /** Only set if key exists */
  xx?: boolean | undefined;
}

export interface CacheService {
  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;

  /**
   * Delete a key from cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Delete multiple keys matching a pattern
   */
  deletePattern(pattern: string): Promise<number>;

  /**
   * Check if a key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get remaining TTL for a key in seconds
   */
  ttl(key: string): Promise<number>;

  /**
   * Increment a numeric value
   */
  incr(key: string): Promise<number>;

  /**
   * Get multiple values
   */
  mget<T>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Set multiple values
   */
  mset<T>(entries: Array<{ key: string; value: T; ttl?: number | undefined }>): Promise<void>;

  /**
   * Execute a function with cache-aside pattern
   * Returns cached value if exists, otherwise executes fn and caches result
   */
  getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheSetOptions
  ): Promise<T>;

  /**
   * Health check
   */
  ping(): Promise<boolean>;

  /**
   * Close connection
   */
  close(): Promise<void>;

  /**
   * Check if cache is connected/available
   */
  isConnected(): boolean;
}

/**
 * Cache key builders for consistent key naming
 */
export const CacheKeys = {
  patent: {
    byId: (id: string) => `patent:${id}`,
    list: (filters: string) => `patents:list:${filters}`,
    count: (filters: string) => `patents:count:${filters}`,
  },
  trademark: {
    byId: (id: string) => `trademark:${id}`,
    list: (filters: string) => `trademarks:list:${filters}`,
    count: (filters: string) => `trademarks:count:${filters}`,
  },
  copyright: {
    byId: (id: string) => `copyright:${id}`,
    list: (filters: string) => `copyrights:list:${filters}`,
    count: (filters: string) => `copyrights:count:${filters}`,
  },
  license: {
    byId: (id: string) => `license:${id}`,
    list: (filters: string) => `licenses:list:${filters}`,
    count: (filters: string) => `licenses:count:${filters}`,
    byAsset: (ipType: string, assetId: string) => `licenses:asset:${ipType}:${assetId}`,
  },
} as const;

/**
 * Default cache TTLs in seconds
 */
export const CacheTTL = {
  /** Single entity - 5 minutes */
  ENTITY: 300,
  /** List results - 1 minute */
  LIST: 60,
  /** Count results - 2 minutes */
  COUNT: 120,
  /** Session data - 30 minutes */
  SESSION: 1800,
  /** Static/config data - 1 hour */
  CONFIG: 3600,
} as const;
