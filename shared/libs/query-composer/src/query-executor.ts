/**
 * Query Executor
 * Orchestrates parallel and sequential query execution with dependency management
 */

import { pino } from 'pino';
import type { Logger } from 'pino';
import type { QueryOptions, QueryFn, QueryMeta } from './types.js';

const logger: Logger = pino({ name: 'query-executor' });

export interface ExecutorOptions {
  timeout?: number;
  correlationId?: string;
}

export class QueryExecutor {
  private defaultTimeout: number;

  constructor(options?: { defaultTimeout?: number }) {
    this.defaultTimeout = options?.defaultTimeout ?? 30000;
  }

  /**
   * Execute multiple queries in parallel
   * Returns results as soon as all complete
   */
  async parallel<T extends Record<string, unknown>>(
    queries: { [K in keyof T]: QueryFn<T[K]> },
    options?: ExecutorOptions
  ): Promise<{ data: T; meta: QueryMeta }> {
    const startTime = Date.now();
    const correlationId = options?.correlationId;
    const timeout = options?.timeout ?? this.defaultTimeout;

    const queryEntries = Object.entries(queries) as Array<[keyof T, QueryFn<T[keyof T]>]>;
    const sources: string[] = [];

    logger.debug({ queryCount: queryEntries.length, correlationId }, 'Executing parallel queries');

    const results = await Promise.all(
      queryEntries.map(async ([name, queryFn]) => {
        const queryStart = Date.now();
        try {
          const result = await this.withTimeout(queryFn({ correlationId }), timeout, String(name));
          sources.push(String(name));
          logger.debug({ name, executionTimeMs: Date.now() - queryStart }, 'Query completed');
          return [name, result] as const;
        } catch (error) {
          logger.error({ name, error }, 'Query failed');
          throw new QueryExecutionError(String(name), error as Error);
        }
      })
    );

    const data = Object.fromEntries(results) as T;

    return {
      data,
      meta: {
        executionTimeMs: Date.now() - startTime,
        cached: false,
        sources,
        correlationId,
      },
    };
  }

  /**
   * Execute queries sequentially, passing results to dependent queries
   */
  async sequential<T>(
    queries: Array<{
      name: string;
      query: (context: Record<string, unknown>) => Promise<unknown>;
    }>,
    options?: ExecutorOptions
  ): Promise<{ data: Record<string, unknown>; meta: QueryMeta }> {
    const startTime = Date.now();
    const correlationId = options?.correlationId;
    const timeout = options?.timeout ?? this.defaultTimeout;
    const context: Record<string, unknown> = {};
    const sources: string[] = [];

    logger.debug({ queryCount: queries.length, correlationId }, 'Executing sequential queries');

    for (const { name, query } of queries) {
      const queryStart = Date.now();
      try {
        const result = await this.withTimeout(query(context), timeout, name);
        context[name] = result;
        sources.push(name);
        logger.debug({ name, executionTimeMs: Date.now() - queryStart }, 'Sequential query completed');
      } catch (error) {
        logger.error({ name, error }, 'Sequential query failed');
        throw new QueryExecutionError(name, error as Error);
      }
    }

    return {
      data: context,
      meta: {
        executionTimeMs: Date.now() - startTime,
        cached: false,
        sources,
        correlationId,
      },
    };
  }

  /**
   * Execute queries with dependency resolution
   * Queries with no dependencies run in parallel
   * Queries with dependencies wait for their dependencies
   */
  async withDependencies<T extends Record<string, unknown>>(
    queries: {
      [K in keyof T]: {
        query: (context: Partial<T>) => Promise<T[K]>;
        dependsOn?: (keyof T)[];
      };
    },
    options?: ExecutorOptions
  ): Promise<{ data: T; meta: QueryMeta }> {
    const startTime = Date.now();
    const correlationId = options?.correlationId;
    const timeout = options?.timeout ?? this.defaultTimeout;
    const context: Partial<T> = {};
    const sources: string[] = [];
    const pending = new Map<keyof T, Promise<void>>();
    const completed = new Set<keyof T>();

    const executeQuery = async (name: keyof T): Promise<void> => {
      if (completed.has(name)) return;
      if (pending.has(name)) return pending.get(name);

      const { query, dependsOn = [] } = queries[name];

      const promise = (async () => {
        // Wait for dependencies
        await Promise.all(
          dependsOn.map(dep => {
            if (!completed.has(dep) && !pending.has(dep)) {
              return executeQuery(dep);
            }
            return pending.get(dep);
          })
        );

        const queryStart = Date.now();
        try {
          const result = await this.withTimeout(query(context), timeout, String(name));
          context[name] = result;
          sources.push(String(name));
          completed.add(name);
          logger.debug({ name, executionTimeMs: Date.now() - queryStart }, 'Dependency query completed');
        } catch (error) {
          logger.error({ name, error }, 'Dependency query failed');
          throw new QueryExecutionError(String(name), error as Error);
        }
      })();

      pending.set(name, promise);
      return promise;
    };

    logger.debug({ queryCount: Object.keys(queries).length, correlationId }, 'Executing queries with dependencies');

    // Execute all queries (will resolve dependencies automatically)
    await Promise.all(
      (Object.keys(queries) as (keyof T)[]).map(name => executeQuery(name))
    );

    return {
      data: context as T,
      meta: {
        executionTimeMs: Date.now() - startTime,
        cached: false,
        sources,
        correlationId,
      },
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number, name: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new QueryTimeoutError(name, timeout)), timeout)
      ),
    ]);
  }
}

export class QueryExecutionError extends Error {
  constructor(
    public queryName: string,
    public cause: Error
  ) {
    super(`Query '${queryName}' failed: ${cause.message}`);
    this.name = 'QueryExecutionError';
  }
}

export class QueryTimeoutError extends Error {
  constructor(
    public queryName: string,
    public timeoutMs: number
  ) {
    super(`Query '${queryName}' timed out after ${timeoutMs}ms`);
    this.name = 'QueryTimeoutError';
  }
}
