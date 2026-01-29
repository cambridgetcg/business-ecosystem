/**
 * Cache Types
 * Core interfaces for the caching abstraction layer
 */

export interface CacheConfig {
  /** Redis connection URL or host configuration */
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  /** Key prefix for all cache entries */
  keyPrefix?: string;
  /** Default TTL in seconds */
  defaultTtl?: number;
  /** Enable cluster mode */
  cluster?: boolean;
  /** TLS configuration */
  tls?: boolean;
}

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Tags for cache invalidation */
  tags?: string[];
  /** Skip cache and force fresh data */
  skipCache?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt?: number;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keyCount: number;
  memoryUsage?: number;
}

export interface CacheClient {
  /** Get a value from cache */
  get<T>(key: string): Promise<T | null>;
  
  /** Set a value in cache */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  
  /** Delete a key from cache */
  delete(key: string): Promise<boolean>;
  
  /** Delete multiple keys */
  deleteMany(keys: string[]): Promise<number>;
  
  /** Check if a key exists */
  exists(key: string): Promise<boolean>;
  
  /** Get TTL of a key in seconds */
  ttl(key: string): Promise<number>;
  
  /** Set new TTL for a key */
  expire(key: string, ttl: number): Promise<boolean>;
  
  /** Get multiple values */
  getMany<T>(keys: string[]): Promise<Map<string, T | null>>;
  
  /** Set multiple values */
  setMany<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void>;
  
  /** Clear all keys with prefix */
  clear(): Promise<void>;
  
  /** Invalidate by tags */
  invalidateByTags(tags: string[]): Promise<number>;
  
  /** Health check */
  ping(): Promise<boolean>;
  
  /** Get cache statistics */
  stats(): Promise<CacheStats>;
  
  /** Close connection */
  close(): Promise<void>;
}

/** Serializer interface for custom value serialization */
export interface CacheSerializer {
  serialize<T>(value: T): string;
  deserialize<T>(data: string): T;
}
