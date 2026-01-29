/**
 * Cache Key Builder
 * Utilities for building consistent cache keys
 */

export interface KeyBuilderConfig {
  /** Global prefix for all keys */
  prefix: string;
  /** Separator between key parts */
  separator?: string;
  /** Whether to hash long keys */
  hashLongKeys?: boolean;
  /** Max key length before hashing */
  maxKeyLength?: number;
}

export class CacheKeyBuilder {
  private prefix: string;
  private separator: string;
  private hashLongKeys: boolean;
  private maxKeyLength: number;

  constructor(config: KeyBuilderConfig) {
    this.prefix = config.prefix;
    this.separator = config.separator || ':';
    this.hashLongKeys = config.hashLongKeys ?? true;
    this.maxKeyLength = config.maxKeyLength || 200;
  }

  /**
   * Build a cache key from parts
   */
  build(...parts: (string | number | undefined | null)[]): string {
    const filtered = parts.filter((p) => p !== undefined && p !== null);
    const key = [this.prefix, ...filtered].join(this.separator);

    if (this.hashLongKeys && key.length > this.maxKeyLength) {
      return this.prefix + this.separator + this.simpleHash(key);
    }

    return key;
  }

  /**
   * Build a key for an entity by type and ID
   */
  entity(type: string, id: string): string {
    return this.build(type, id);
  }

  /**
   * Build a key for a list/collection query
   */
  list(type: string, filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return this.build(type, 'list');
    }
    const filterKey = this.normalizeFilters(filters);
    return this.build(type, 'list', filterKey);
  }

  /**
   * Build a key for a count query
   */
  count(type: string, filters?: Record<string, unknown>): string {
    if (!filters || Object.keys(filters).length === 0) {
      return this.build(type, 'count');
    }
    const filterKey = this.normalizeFilters(filters);
    return this.build(type, 'count', filterKey);
  }

  /**
   * Build a key for a method/function result
   */
  method(service: string, method: string, ...args: unknown[]): string {
    const argsKey = args.length > 0 ? this.simpleHash(JSON.stringify(args)) : '';
    return this.build(service, method, argsKey || undefined);
  }

  /**
   * Get pattern for invalidating all keys of a type
   */
  pattern(type: string): string {
    return this.build(type, '*');
  }

  /**
   * Get pattern for invalidating entity and related list caches
   */
  entityPattern(type: string, id: string): string[] {
    return [
      this.entity(type, id),
      this.build(type, 'list', '*'),
      this.build(type, 'count', '*'),
    ];
  }

  private normalizeFilters(filters: Record<string, unknown>): string {
    const sorted = Object.keys(filters)
      .sort()
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {} as Record<string, unknown>);
    return this.simpleHash(JSON.stringify(sorted));
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Default key builder factory
 */
export function createKeyBuilder(prefix: string): CacheKeyBuilder {
  return new CacheKeyBuilder({ prefix });
}

/**
 * Standard key builders for common domains
 */
export const KeyBuilders = {
  entity: createKeyBuilder('entity'),
  user: createKeyBuilder('user'),
  session: createKeyBuilder('session'),
  permission: createKeyBuilder('perm'),
  config: createKeyBuilder('config'),
};
