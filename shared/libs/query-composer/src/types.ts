/**
 * Query composer types
 */

export interface QueryOptions {
  correlationId?: string;
  timeout?: number;
  cache?: CacheOptions;
}

export interface CacheOptions {
  enabled: boolean;
  ttlSeconds?: number;
  key?: string;
}

export interface QueryResult<T> {
  data: T;
  meta: QueryMeta;
}

export interface QueryMeta {
  executionTimeMs: number;
  cached: boolean;
  sources: string[];
  correlationId?: string;
}

export type QueryFn<T> = (options?: QueryOptions) => Promise<T>;

export interface QueryStep<T> {
  name: string;
  query: QueryFn<T>;
  dependsOn?: string[];
  transform?: (data: T, context: Record<string, unknown>) => unknown;
}

export interface CompositeQueryResult<T> {
  data: T;
  meta: {
    totalExecutionTimeMs: number;
    steps: Array<{
      name: string;
      executionTimeMs: number;
      cached: boolean;
    }>;
    correlationId?: string;
  };
}

export interface DataLoaderBatch<K, V> {
  keys: K[];
  resolver: (keys: K[]) => Promise<Map<K, V>>;
}

export interface DataLoaderOptions {
  batchDelayMs?: number;
  maxBatchSize?: number;
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
}
