/**
 * Benchmark Utilities for Load Testing
 *
 * Provides helpers for measuring execution time, running concurrent queries,
 * and calculating statistics for load test results.
 *
 * @module test/load
 */

/**
 * Result of a single execution timing.
 */
export interface TimingResult {
  duration: number; // milliseconds
  success: boolean;
  error?: string | undefined;
}

/**
 * Result of measuring execution time.
 */
export interface ExecutionResult<T> {
  result: T | null;
  duration: number; // milliseconds
  success: boolean;
  error?: string | undefined;
}

/**
 * Statistics calculated from timing results.
 */
export interface Statistics {
  count: number;
  successCount: number;
  failureCount: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p50: number;
  p95: number;
  p99: number;
  standardDeviation: number;
  totalDuration: number;
}

/**
 * Result of concurrent execution.
 */
export interface ConcurrentExecutionResult<T> {
  results: ExecutionResult<T>[];
  statistics: Statistics;
  throughput: number; // requests per second
}

/**
 * Memory usage snapshot.
 */
export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Memory tracking result.
 */
export interface MemoryTrackingResult {
  before: MemorySnapshot;
  after: MemorySnapshot;
  delta: MemorySnapshot;
  peakHeapUsed: number;
}

/**
 * Measure the execution time of an async function.
 *
 * @param fn - The async function to measure
 * @returns ExecutionResult with timing and success/error info
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<ExecutionResult<T>> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    return {
      result,
      duration,
      success: true,
    };
  } catch (error) {
    const duration = performance.now() - start;

    return {
      result: null,
      duration,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute multiple instances of a function concurrently.
 *
 * @param fn - The async function to execute
 * @param concurrency - Number of concurrent executions
 * @returns ConcurrentExecutionResult with all results and statistics
 */
export async function concurrentExecutor<T>(
  fn: () => Promise<T>,
  concurrency: number
): Promise<ConcurrentExecutionResult<T>> {
  const startTime = performance.now();

  // Create array of promises
  const promises = Array.from({ length: concurrency }, () =>
    measureExecutionTime(fn)
  );

  // Execute all concurrently
  const results = await Promise.all(promises);

  const totalDuration = performance.now() - startTime;

  // Calculate statistics
  const durations = results.map(r => r.duration);
  const statistics = calculateStatistics(
    durations,
    results.filter(r => r.success).length,
    results.filter(r => !r.success).length
  );

  // Calculate throughput (requests per second)
  const throughput = (concurrency / totalDuration) * 1000;

  return {
    results,
    statistics,
    throughput,
  };
}

/**
 * Execute a function multiple times sequentially.
 *
 * @param fn - The async function to execute
 * @param iterations - Number of iterations
 * @returns Array of execution results
 */
export async function sequentialExecutor<T>(
  fn: () => Promise<T>,
  iterations: number
): Promise<ExecutionResult<T>[]> {
  const results: ExecutionResult<T>[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = await measureExecutionTime(fn);
    results.push(result);
  }

  return results;
}

/**
 * Execute with rate limiting (requests per second).
 *
 * @param fn - The async function to execute
 * @param totalRequests - Total number of requests to make
 * @param requestsPerSecond - Target rate
 * @returns Array of execution results
 */
export async function rateLimitedExecutor<T>(
  fn: () => Promise<T>,
  totalRequests: number,
  requestsPerSecond: number
): Promise<ExecutionResult<T>[]> {
  const results: ExecutionResult<T>[] = [];
  const intervalMs = 1000 / requestsPerSecond;

  for (let i = 0; i < totalRequests; i++) {
    const start = performance.now();
    const result = await measureExecutionTime(fn);
    results.push(result);

    // Wait for next interval if needed
    const elapsed = performance.now() - start;
    if (elapsed < intervalMs && i < totalRequests - 1) {
      await sleep(intervalMs - elapsed);
    }
  }

  return results;
}

/**
 * Calculate statistics from timing data.
 *
 * @param durations - Array of duration values in milliseconds
 * @param successCount - Number of successful executions
 * @param failureCount - Number of failed executions
 * @returns Statistics object with various metrics
 */
export function calculateStatistics(
  durations: number[],
  successCount: number,
  failureCount: number
): Statistics {
  if (durations.length === 0) {
    return {
      count: 0,
      successCount: 0,
      failureCount: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      standardDeviation: 0,
      totalDuration: 0,
    };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const count = durations.length;
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const mean = totalDuration / count;

  // Calculate standard deviation
  const squaredDiffs = durations.map(d => Math.pow(d - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / count;
  const standardDeviation = Math.sqrt(avgSquaredDiff);

  return {
    count,
    successCount,
    failureCount,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: percentile(sorted, 50),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    standardDeviation,
    totalDuration,
  };
}

/**
 * Calculate percentile from sorted array.
 *
 * @param sortedArray - Sorted array of values
 * @param p - Percentile (0-100)
 * @returns Value at the given percentile
 */
export function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return sortedArray[0];

  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedArray[lower];
  }

  // Interpolate between lower and upper
  const weight = index - lower;
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

/**
 * Get current memory usage snapshot.
 */
export function getMemorySnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss,
  };
}

/**
 * Track memory usage during function execution.
 *
 * @param fn - The async function to track
 * @returns MemoryTrackingResult with before/after snapshots
 */
export async function trackMemory<T>(
  fn: () => Promise<T>
): Promise<{ result: T; memory: MemoryTrackingResult }> {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const before = getMemorySnapshot();
  let peakHeapUsed = before.heapUsed;

  // Set up interval to track peak memory
  const memoryCheckInterval = setInterval(() => {
    const current = process.memoryUsage().heapUsed;
    if (current > peakHeapUsed) {
      peakHeapUsed = current;
    }
  }, 10);

  try {
    const result = await fn();

    clearInterval(memoryCheckInterval);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const after = getMemorySnapshot();

    return {
      result,
      memory: {
        before,
        after,
        delta: {
          heapUsed: after.heapUsed - before.heapUsed,
          heapTotal: after.heapTotal - before.heapTotal,
          external: after.external - before.external,
          rss: after.rss - before.rss,
        },
        peakHeapUsed,
      },
    };
  } finally {
    clearInterval(memoryCheckInterval);
  }
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = Math.abs(bytes);

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const sign = bytes < 0 ? '-' : '';
  return `${sign}${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration to human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}us`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Sleep for specified milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a range of numbers.
 */
export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Create a warmup function that runs the given function multiple times.
 * Useful for JIT compilation warmup before benchmarking.
 */
export async function warmup<T>(
  fn: () => Promise<T>,
  iterations = 5
): Promise<void> {
  for (let i = 0; i < iterations; i++) {
    try {
      await fn();
    } catch {
      // Ignore errors during warmup
    }
  }
}

/**
 * Benchmark configuration.
 */
export interface BenchmarkConfig {
  warmupIterations?: number;
  iterations?: number;
  concurrencyLevels?: number[];
  timeout?: number;
}

/**
 * Default benchmark configuration.
 */
export const defaultBenchmarkConfig: Required<BenchmarkConfig> = {
  warmupIterations: 5,
  iterations: 100,
  concurrencyLevels: [1, 10, 50, 100],
  timeout: 60000, // 1 minute
};
