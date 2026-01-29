/**
 * Cached Repository Decorator
 * Wraps any BaseRepository with caching using the cache-aside pattern
 */

import { BaseRepository } from './repository.js';
import type { Entity, PaginatedResult, PaginationParams, QueryFilter } from './types.js';

/** Minimal cache interface (compatible with @ecosystem/cache) */
export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ttl?: number; tags?: string[] }): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteMany(keys: string[]): Promise<number>;
  invalidateByTags(tags: string[]): Promise<number>;
}

export interface CachedRepositoryOptions {
  /** Cache key prefix (usually entity type name) */
  keyPrefix: string;
  /** Default TTL in seconds */
  ttl?: number;
  /** Additional tags for cache invalidation */
  baseTags?: string[];
  /** Whether to cache list queries */
  cacheListQueries?: boolean;
  /** TTL for list queries (usually shorter than single entity) */
  listTtl?: number;
}

/**
 * Wraps a repository with caching
 * Automatically invalidates related caches on writes
 */
export class CachedRepository<T extends Entity> extends BaseRepository<T> {
  private inner: BaseRepository<T>;
  private cache: CacheClient;
  private options: Required<CachedRepositoryOptions>;

  constructor(
    inner: BaseRepository<T>,
    cache: CacheClient,
    options: CachedRepositoryOptions
  ) {
    super();
    this.inner = inner;
    this.cache = cache;
    this.options = {
      keyPrefix: options.keyPrefix,
      ttl: options.ttl ?? 3600,
      baseTags: options.baseTags ?? [],
      cacheListQueries: options.cacheListQueries ?? false,
      listTtl: options.listTtl ?? 300,
    };
  }

  private entityKey(id: string): string {
    return this.options.keyPrefix + ':entity:' + id;
  }

  private listKey(params?: PaginationParams): string {
    const base = this.options.keyPrefix + ':list';
    if (!params) return base + ':default';
    return base + ':' + this.hashParams(params);
  }

  private filterKey(filters: QueryFilter[]): string {
    return this.options.keyPrefix + ':filter:' + this.hashParams(filters);
  }

  private countKey(filters?: QueryFilter[]): string {
    if (!filters) return this.options.keyPrefix + ':count:all';
    return this.options.keyPrefix + ':count:' + this.hashParams(filters);
  }

  private hashParams(obj: unknown): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private entityTags(id: string): string[] {
    return [
      ...this.options.baseTags,
      this.options.keyPrefix,
      this.options.keyPrefix + ':' + id,
    ];
  }

  private listTags(): string[] {
    return [...this.options.baseTags, this.options.keyPrefix, this.options.keyPrefix + ':lists'];
  }

  async findById(id: string): Promise<T | null> {
    const key = this.entityKey(id);

    // Try cache first
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from database
    const entity = await this.inner.findById(id);
    if (entity) {
      await this.cache.set(key, entity, {
        ttl: this.options.ttl,
        tags: this.entityTags(id),
      });
    }

    return entity;
  }

  async findAll(params?: PaginationParams): Promise<PaginatedResult<T>> {
    if (!this.options.cacheListQueries) {
      return this.inner.findAll(params);
    }

    const key = this.listKey(params);
    const cached = await this.cache.get<PaginatedResult<T>>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await this.inner.findAll(params);
    await this.cache.set(key, result, {
      ttl: this.options.listTtl,
      tags: this.listTags(),
    });

    return result;
  }

  async findBy(filters: QueryFilter[]): Promise<T[]> {
    if (!this.options.cacheListQueries) {
      return this.inner.findBy(filters);
    }

    const key = this.filterKey(filters);
    const cached = await this.cache.get<T[]>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await this.inner.findBy(filters);
    await this.cache.set(key, result, {
      ttl: this.options.listTtl,
      tags: this.listTags(),
    });

    return result;
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const entity = await this.inner.create(data);

    // Cache the new entity
    await this.cache.set(this.entityKey(entity.id), entity, {
      ttl: this.options.ttl,
      tags: this.entityTags(entity.id),
    });

    // Invalidate list caches
    await this.invalidateLists();

    return entity;
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T> {
    const entity = await this.inner.update(id, data);

    // Update cache
    await this.cache.set(this.entityKey(id), entity, {
      ttl: this.options.ttl,
      tags: this.entityTags(id),
    });

    // Invalidate list caches
    await this.invalidateLists();

    return entity;
  }

  async delete(id: string): Promise<void> {
    await this.inner.delete(id);

    // Remove from cache
    await this.cache.delete(this.entityKey(id));

    // Invalidate list caches
    await this.invalidateLists();
  }

  async exists(id: string): Promise<boolean> {
    // Check cache first
    const cached = await this.cache.get<T>(this.entityKey(id));
    if (cached !== null) {
      return true;
    }

    return this.inner.exists(id);
  }

  async count(filters?: QueryFilter[]): Promise<number> {
    if (!this.options.cacheListQueries) {
      return this.inner.count(filters);
    }

    const key = this.countKey(filters);
    const cached = await this.cache.get<number>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await this.inner.count(filters);
    await this.cache.set(key, result, {
      ttl: this.options.listTtl,
      tags: this.listTags(),
    });

    return result;
  }

  /** Manually invalidate all list/filter/count caches */
  async invalidateLists(): Promise<void> {
    await this.cache.invalidateByTags([this.options.keyPrefix + ':lists']);
  }

  /** Manually invalidate a specific entity cache */
  async invalidateEntity(id: string): Promise<void> {
    await this.cache.delete(this.entityKey(id));
  }

  /** Manually invalidate all caches for this repository */
  async invalidateAll(): Promise<void> {
    await this.cache.invalidateByTags([this.options.keyPrefix]);
  }

  /** Get the underlying repository */
  getInner(): BaseRepository<T> {
    return this.inner;
  }
}

/**
 * Factory function to wrap a repository with caching
 */
export function withCache<T extends Entity>(
  repository: BaseRepository<T>,
  cache: CacheClient,
  options: CachedRepositoryOptions
): CachedRepository<T> {
  return new CachedRepository(repository, cache, options);
}
