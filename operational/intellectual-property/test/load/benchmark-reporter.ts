/**
 * Benchmark Results Reporter
 *
 * Formats and outputs benchmark results in readable and machine-readable formats.
 * Supports console output, JSON reports, and baseline comparison.
 *
 * @module test/load
 */

import type { Statistics, MemoryTrackingResult, ConcurrentExecutionResult } from './benchmark-utils.js';
import { formatBytes, formatDuration } from './benchmark-utils.js';

/**
 * Baseline thresholds for performance comparison.
 */
export interface PerformanceBaseline {
  name: string;
  maxP50: number; // Maximum acceptable p50 in ms
  maxP95: number; // Maximum acceptable p95 in ms
  maxP99: number; // Maximum acceptable p99 in ms
  minThroughput?: number; // Minimum acceptable throughput (req/s)
}

/**
 * Default performance baselines for deadline queries.
 */
export const defaultBaselines: Record<string, PerformanceBaseline> = {
  'getUpcomingDeadlines-7': {
    name: 'Get upcoming deadlines (7 days)',
    maxP50: 50,
    maxP95: 100,
    maxP99: 200,
    minThroughput: 100,
  },
  'getUpcomingDeadlines-30': {
    name: 'Get upcoming deadlines (30 days)',
    maxP50: 75,
    maxP95: 150,
    maxP99: 300,
    minThroughput: 80,
  },
  'getUpcomingDeadlines-90': {
    name: 'Get upcoming deadlines (90 days)',
    maxP50: 100,
    maxP95: 200,
    maxP99: 400,
    minThroughput: 60,
  },
  'getUpcomingDeadlines-365': {
    name: 'Get upcoming deadlines (365 days)',
    maxP50: 150,
    maxP95: 300,
    maxP99: 500,
    minThroughput: 40,
  },
  'getOverdueDeadlines': {
    name: 'Get overdue deadlines',
    maxP50: 50,
    maxP95: 100,
    maxP99: 200,
    minThroughput: 100,
  },
  'getDeadlinesByStatus': {
    name: 'Get deadlines by status',
    maxP50: 50,
    maxP95: 100,
    maxP99: 200,
    minThroughput: 100,
  },
  'getDeadlinesByAsset': {
    name: 'Get deadlines by asset',
    maxP50: 30,
    maxP95: 75,
    maxP99: 150,
    minThroughput: 150,
  },
  'concurrent-10': {
    name: 'Concurrent queries (10)',
    maxP50: 100,
    maxP95: 200,
    maxP99: 400,
  },
  'concurrent-50': {
    name: 'Concurrent queries (50)',
    maxP50: 150,
    maxP95: 300,
    maxP99: 500,
  },
  'concurrent-100': {
    name: 'Concurrent queries (100)',
    maxP50: 250,
    maxP95: 500,
    maxP99: 800,
  },
  'large-dataset-1000': {
    name: 'Large dataset (1,000 deadlines)',
    maxP50: 100,
    maxP95: 200,
    maxP99: 400,
  },
  'large-dataset-10000': {
    name: 'Large dataset (10,000 deadlines)',
    maxP50: 200,
    maxP95: 400,
    maxP99: 700,
  },
  'large-dataset-100000': {
    name: 'Large dataset (100,000 deadlines)',
    maxP50: 500,
    maxP95: 1000,
    maxP99: 2000,
  },
};

/**
 * Benchmark result entry.
 */
export interface BenchmarkResult {
  name: string;
  description?: string;
  timestamp: Date;
  statistics: Statistics;
  throughput?: number;
  memory?: MemoryTrackingResult;
  baseline?: PerformanceBaseline;
  passed?: boolean;
  violations?: string[];
}

/**
 * Complete benchmark report.
 */
export interface BenchmarkReport {
  title: string;
  description?: string;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpus: number;
    memory: string;
  };
  timestamp: Date;
  duration: number; // Total duration in ms
  results: BenchmarkResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: string;
  };
}

/**
 * Format comparison result.
 */
export type ComparisonStatus = 'pass' | 'fail' | 'warn';

/**
 * Compare value against threshold.
 */
function compareThreshold(
  value: number,
  threshold: number,
  warnThreshold?: number
): ComparisonStatus {
  if (value <= threshold) return 'pass';
  if (warnThreshold && value <= warnThreshold) return 'warn';
  return 'fail';
}

/**
 * Get status symbol for comparison result.
 */
function getStatusSymbol(status: ComparisonStatus): string {
  switch (status) {
    case 'pass':
      return '[PASS]';
    case 'fail':
      return '[FAIL]';
    case 'warn':
      return '[WARN]';
  }
}

/**
 * Benchmark Reporter class.
 */
export class BenchmarkReporter {
  private results: BenchmarkResult[] = [];
  private startTime: number = 0;

  /**
   * Start a new benchmark session.
   */
  startSession(): void {
    this.results = [];
    this.startTime = Date.now();
  }

  /**
   * Add a benchmark result.
   */
  addResult(result: BenchmarkResult): void {
    // Check against baseline if available
    const baseline = result.baseline ?? defaultBaselines[result.name];
    if (baseline) {
      const violations: string[] = [];

      if (result.statistics.p50 > baseline.maxP50) {
        violations.push(`p50 (${formatDuration(result.statistics.p50)}) exceeds max (${formatDuration(baseline.maxP50)})`);
      }
      if (result.statistics.p95 > baseline.maxP95) {
        violations.push(`p95 (${formatDuration(result.statistics.p95)}) exceeds max (${formatDuration(baseline.maxP95)})`);
      }
      if (result.statistics.p99 > baseline.maxP99) {
        violations.push(`p99 (${formatDuration(result.statistics.p99)}) exceeds max (${formatDuration(baseline.maxP99)})`);
      }
      if (baseline.minThroughput && result.throughput && result.throughput < baseline.minThroughput) {
        violations.push(`throughput (${result.throughput.toFixed(2)} req/s) below min (${baseline.minThroughput} req/s)`);
      }

      result.baseline = baseline;
      result.violations = violations;
      result.passed = violations.length === 0;
    }

    this.results.push(result);
  }

  /**
   * Add result from concurrent execution.
   */
  addConcurrentResult<T>(
    name: string,
    result: ConcurrentExecutionResult<T>,
    description?: string
  ): void {
    this.addResult({
      name,
      description,
      timestamp: new Date(),
      statistics: result.statistics,
      throughput: result.throughput,
    });
  }

  /**
   * Generate console output.
   */
  printToConsole(): void {
    const duration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(80));
    console.log(' BENCHMARK RESULTS');
    console.log('='.repeat(80));
    console.log(`Duration: ${formatDuration(duration)}`);
    console.log(`Total Tests: ${this.results.length}`);
    console.log('');

    for (const result of this.results) {
      this.printResult(result);
    }

    this.printSummary();
  }

  /**
   * Print a single result.
   */
  private printResult(result: BenchmarkResult): void {
    const passStatus = result.passed !== undefined
      ? (result.passed ? '[PASS]' : '[FAIL]')
      : '';

    console.log('-'.repeat(80));
    console.log(`${passStatus} ${result.name}`);
    if (result.description) {
      console.log(`  ${result.description}`);
    }
    console.log('');

    // Statistics table
    console.log('  Latency Statistics:');
    console.log(`    Count:     ${result.statistics.count}`);
    console.log(`    Success:   ${result.statistics.successCount} (${((result.statistics.successCount / result.statistics.count) * 100).toFixed(1)}%)`);
    console.log(`    Min:       ${formatDuration(result.statistics.min)}`);
    console.log(`    Max:       ${formatDuration(result.statistics.max)}`);
    console.log(`    Mean:      ${formatDuration(result.statistics.mean)}`);
    console.log(`    Std Dev:   ${formatDuration(result.statistics.standardDeviation)}`);
    console.log('');
    console.log('  Percentiles:');
    console.log(`    p50:       ${formatDuration(result.statistics.p50)}${this.formatComparison(result, 'p50')}`);
    console.log(`    p95:       ${formatDuration(result.statistics.p95)}${this.formatComparison(result, 'p95')}`);
    console.log(`    p99:       ${formatDuration(result.statistics.p99)}${this.formatComparison(result, 'p99')}`);

    if (result.throughput) {
      console.log('');
      console.log(`  Throughput:  ${result.throughput.toFixed(2)} req/s${this.formatThroughputComparison(result)}`);
    }

    if (result.memory) {
      console.log('');
      console.log('  Memory Usage:');
      console.log(`    Heap Used:  ${formatBytes(result.memory.after.heapUsed)} (delta: ${formatBytes(result.memory.delta.heapUsed)})`);
      console.log(`    Peak Heap:  ${formatBytes(result.memory.peakHeapUsed)}`);
      console.log(`    RSS:        ${formatBytes(result.memory.after.rss)} (delta: ${formatBytes(result.memory.delta.rss)})`);
    }

    if (result.violations && result.violations.length > 0) {
      console.log('');
      console.log('  Violations:');
      for (const violation of result.violations) {
        console.log(`    - ${violation}`);
      }
    }

    console.log('');
  }

  /**
   * Format comparison against baseline.
   */
  private formatComparison(result: BenchmarkResult, metric: 'p50' | 'p95' | 'p99'): string {
    if (!result.baseline) return '';

    const value = result.statistics[metric];
    const maxKey = `max${metric.charAt(0).toUpperCase()}${metric.slice(1)}` as keyof PerformanceBaseline;
    const max = result.baseline[maxKey] as number;

    const status = compareThreshold(value, max, max * 1.2);
    return ` ${getStatusSymbol(status)} (max: ${formatDuration(max)})`;
  }

  /**
   * Format throughput comparison against baseline.
   */
  private formatThroughputComparison(result: BenchmarkResult): string {
    if (!result.baseline?.minThroughput || !result.throughput) return '';

    const status = result.throughput >= result.baseline.minThroughput ? 'pass' : 'fail';
    return ` ${getStatusSymbol(status)} (min: ${result.baseline.minThroughput} req/s)`;
  }

  /**
   * Print summary.
   */
  private printSummary(): void {
    const resultsWithBaseline = this.results.filter(r => r.passed !== undefined);
    const passed = resultsWithBaseline.filter(r => r.passed).length;
    const failed = resultsWithBaseline.filter(r => !r.passed).length;

    console.log('='.repeat(80));
    console.log(' SUMMARY');
    console.log('='.repeat(80));
    console.log(`  Total Tests:   ${this.results.length}`);

    if (resultsWithBaseline.length > 0) {
      console.log(`  With Baseline: ${resultsWithBaseline.length}`);
      console.log(`  Passed:        ${passed}`);
      console.log(`  Failed:        ${failed}`);
      console.log(`  Pass Rate:     ${((passed / resultsWithBaseline.length) * 100).toFixed(1)}%`);
    }

    console.log('='.repeat(80));
    console.log('');
  }

  /**
   * Generate JSON report.
   */
  generateJsonReport(): BenchmarkReport {
    const duration = Date.now() - this.startTime;
    const resultsWithBaseline = this.results.filter(r => r.passed !== undefined);
    const passed = resultsWithBaseline.filter(r => r.passed).length;
    const failed = resultsWithBaseline.filter(r => !r.passed).length;

    const os = require('os');

    return {
      title: 'Deadline Query Load Test Results',
      description: 'Performance benchmarks for IP deadline database queries',
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        memory: formatBytes(os.totalmem()),
      },
      timestamp: new Date(),
      duration,
      results: this.results.map(r => ({
        ...r,
        timestamp: r.timestamp,
      })),
      summary: {
        total: this.results.length,
        passed,
        failed,
        passRate: resultsWithBaseline.length > 0
          ? `${((passed / resultsWithBaseline.length) * 100).toFixed(1)}%`
          : 'N/A',
      },
    };
  }

  /**
   * Save JSON report to file.
   */
  async saveJsonReport(filepath: string): Promise<void> {
    const fs = await import('fs/promises');
    const report = this.generateJsonReport();
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
  }

  /**
   * Get results for external use.
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }

  /**
   * Check if all tests passed.
   */
  allPassed(): boolean {
    const resultsWithBaseline = this.results.filter(r => r.passed !== undefined);
    return resultsWithBaseline.every(r => r.passed);
  }
}

/**
 * Create a pre-configured reporter instance.
 */
export function createReporter(): BenchmarkReporter {
  const reporter = new BenchmarkReporter();
  reporter.startSession();
  return reporter;
}

/**
 * Export format utilities for use in tests.
 */
export { formatBytes, formatDuration };
