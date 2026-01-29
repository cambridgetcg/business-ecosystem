/**
 * DataLoader
 * Prevents N+1 queries by batching and caching
 */

import pino from 'pino';
import type { Logger } from 'pino';
import type { DataLoaderOptions } from './types.js';

const logger: Logger = (pino as unknown as (options: object) => Logger)({ name: 'data-loader' });

export class DataLoader<K, V> {
  private batchDelayMs: number;
  private maxBatchSize: number;
  private cacheEnabled: boolean;
  private cacheTtlMs: number;
  private cache: Map<string, { value: V; expiresAt: number }>;
  private pendingBatch: { key: K; resolve: (value: V) => void; reject: (error: Error) => void }[];
  private batchTimeout: ReturnType<typeof setTimeout> | null;
  private batchFn: (keys: K[]) => Promise<Map<K, V>>;

  constructor(
    batchFn: (keys: K[]) => Promise<Map<K, V>>,
    options?: DataLoaderOptions
  ) {
    this.batchFn = batchFn;
    this.batchDelayMs = options?.batchDelayMs ?? 10;
    this.maxBatchSize = options?.maxBatchSize ?? 100;
    this.cacheEnabled = options?.cacheEnabled ?? true;
    this.cacheTtlMs = options?.cacheTtlMs ?? 60000;
    this.cache = new Map();
    this.pendingBatch = [];
    this.batchTimeout = null;
  }

  async load(key: K): Promise<V> {
    const cacheKey = this.serializeKey(key);

    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        logger.debug({ key }, 'DataLoader cache hit');
        return cached.value;
      }
    }

    // Add to pending batch
    return new Promise<V>((resolve, reject) => {
      this.pendingBatch.push({ key, resolve, reject });

      // Schedule batch execution
      if (this.pendingBatch.length >= this.maxBatchSize) {
        this.executeBatch();
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.executeBatch(), this.batchDelayMs);
      }
    });
  }

  async loadMany(keys: K[]): Promise<Map<K, V>> {
    const results = await Promise.all(keys.map(key => this.load(key).then(value => [key, value] as const)));
    return new Map(results);
  }

  prime(key: K, value: V): void {
    if (this.cacheEnabled) {
      const cacheKey = this.serializeKey(key);
      this.cache.set(cacheKey, {
        value,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }
  }

  clear(key?: K): void {
    if (key) {
      const cacheKey = this.serializeKey(key);
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }

  private async executeBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const batch = this.pendingBatch;
    this.pendingBatch = [];

    if (batch.length === 0) return;

    const keys = batch.map(item => item.key);
    logger.debug({ batchSize: keys.length }, 'DataLoader executing batch');

    try {
      const results = await this.batchFn(keys);

      for (const { key, resolve, reject } of batch) {
        const value = results.get(key);
        if (value !== undefined) {
          // Cache the result
          if (this.cacheEnabled) {
            const cacheKey = this.serializeKey(key);
            this.cache.set(cacheKey, {
              value,
              expiresAt: Date.now() + this.cacheTtlMs,
            });
          }
          resolve(value);
        } else {
          reject(new DataLoaderKeyNotFoundError(key));
        }
      }
    } catch (error) {
      logger.error({ error, batchSize: keys.length }, 'DataLoader batch failed');
      for (const { reject } of batch) {
        reject(error as Error);
      }
    }
  }

  private serializeKey(key: K): string {
    return typeof key === 'object' ? JSON.stringify(key) : String(key);
  }
}

export class DataLoaderKeyNotFoundError<K> extends Error {
  constructor(public key: K) {
    super(`DataLoader: Key not found: ${JSON.stringify(key)}`);
    this.name = 'DataLoaderKeyNotFoundError';
  }
}

/**
 * Create a DataLoader for entity lookups
 */
export function createEntityLoader<T extends { id: string }>(
  fetchFn: (ids: string[]) => Promise<T[]>,
  options?: DataLoaderOptions
): DataLoader<string, T> {
  return new DataLoader(
    async (ids: string[]) => {
      const entities = await fetchFn(ids);
      return new Map(entities.map(e => [e.id, e]));
    },
    options
  );
}
