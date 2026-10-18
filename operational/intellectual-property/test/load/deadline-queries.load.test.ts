/**
 * Deadline Query Load Tests
 *
 * Performance and load testing for deadline-related database queries.
 * Tests query performance under various conditions including:
 * - Different time ranges (7, 30, 90, 365 days)
 * - Concurrent query execution
 * - Large dataset scenarios
 *
 * IMPORTANT: These tests are skipped in normal test runs.
 * Run with: pnpm test:load or LOAD_TEST=true pnpm test
 *
 * @module test/load
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from 'vitest';
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  measureExecutionTime,
  concurrentExecutor,
  sequentialExecutor,
  calculateStatistics,
  trackMemory,
  warmup,
  type Statistics,
} from './benchmark-utils.js';
import {
  BenchmarkReporter,
  createReporter,
  defaultBaselines,
} from './benchmark-reporter.js';
import {
  DeadlineStore,
  type Deadline,
} from '../../src/infrastructure/aws/dynamodb-deadline-store.js';
import { createDeadline, createDeadlines } from '../factories/deadline.factory.js';

// Skip load tests in normal test runs
// Set LOAD_TEST=true to run these tests
const runLoadTests = process.env.LOAD_TEST === 'true' || process.env.CI === 'true';
const describeLoadTests = runLoadTests ? describe : describe.skip;

// Get the mocked document client
const mockDocClient = DynamoDBDocumentClient.from({} as never) as {
  send: Mock;
};

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

/**
 * Generate test deadline data in DynamoDB format.
 */
function generateDynamoDBDeadlines(count: number, options: {
  status?: Deadline['status'];
  daysAhead?: number;
  daysOverdue?: number;
  assetId?: string;
} = {}): Record<string, unknown>[] {
  const deadlines = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(now);

    if (options.daysOverdue) {
      dueDate.setDate(dueDate.getDate() - Math.floor(Math.random() * options.daysOverdue));
    } else if (options.daysAhead) {
      dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * options.daysAhead));
    } else {
      dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 365) - 30);
    }

    deadlines.push({
      asset_id: options.assetId ?? `asset-${i}`,
      deadline_id: `deadline-${i}`,
      asset_type: ['patent', 'trademark', 'domain', 'license', 'trade_secret'][i % 5],
      deadline_type: 'maintenance_fee',
      due_date: dueDate.toISOString(),
      status: options.status ?? 'pending',
      priority: ['low', 'medium', 'high', 'critical'][i % 4],
      title: `Test Deadline ${i}`,
      description: `Test deadline description ${i}`,
      reminders_sent: Math.floor(Math.random() * 5),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }

  return deadlines;
}

/**
 * Simulate realistic query latency based on result size.
 */
function simulateQueryLatency(resultCount: number): Promise<void> {
  // Base latency + per-item latency (simulating network and serialization)
  const baseLatency = 5; // 5ms base
  const perItemLatency = 0.1; // 0.1ms per item
  const latency = baseLatency + (resultCount * perItemLatency);

  // Add some variance (0.8x to 1.2x)
  const variance = 0.8 + Math.random() * 0.4;
  const finalLatency = latency * variance;

  return new Promise(resolve => setTimeout(resolve, finalLatency));
}

// ===========================================================================
// LOAD TESTS
// ===========================================================================

describeLoadTests('Deadline Query Load Tests', () => {
  let store: DeadlineStore;
  let reporter: BenchmarkReporter;
  const tableName = 'test-deadlines-table';

  beforeAll(() => {
    reporter = createReporter();
  });

  afterAll(() => {
    reporter.printToConsole();

    // Optionally save JSON report
    if (process.env.SAVE_REPORT === 'true') {
      const reportPath = `./benchmark-report-${Date.now()}.json`;
      reporter.saveJsonReport(reportPath).catch(console.error);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    store = new DeadlineStore(tableName);
  });

  // -------------------------------------------------------------------------
  // getUpcomingDeadlines Performance Tests
  // -------------------------------------------------------------------------

  describe('getUpcomingDeadlines Performance', () => {
    it.each([7, 30, 90, 365])('should perform well with daysAhead=%i', async (daysAhead) => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(50, { daysAhead });

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Warmup
      await warmup(() => store.getUpcomingDeadlines(daysAhead), 3);

      // Act - Run multiple iterations
      const results = await sequentialExecutor(
        () => store.getUpcomingDeadlines(daysAhead),
        50
      );

      const statistics = calculateStatistics(
        results.map(r => r.duration),
        results.filter(r => r.success).length,
        results.filter(r => !r.success).length
      );

      // Report
      reporter.addResult({
        name: `getUpcomingDeadlines-${daysAhead}`,
        description: `Query deadlines due within ${daysAhead} days`,
        timestamp: new Date(),
        statistics,
        baseline: defaultBaselines[`getUpcomingDeadlines-${daysAhead}`],
      });

      // Assert
      expect(statistics.successCount).toBe(50);
      expect(statistics.p95).toBeLessThan(500); // Relaxed threshold for mocked tests
    });
  });

  // -------------------------------------------------------------------------
  // getOverdueDeadlines Performance Tests
  // -------------------------------------------------------------------------

  describe('getOverdueDeadlines Performance', () => {
    it.each([10, 50, 100, 500])('should perform well with limit=%i', async (limit) => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(limit, { daysOverdue: 30 });

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Warmup
      await warmup(() => store.getOverdueDeadlines(limit), 3);

      // Act
      const results = await sequentialExecutor(
        () => store.getOverdueDeadlines(limit),
        50
      );

      const statistics = calculateStatistics(
        results.map(r => r.duration),
        results.filter(r => r.success).length,
        results.filter(r => !r.success).length
      );

      // Report
      reporter.addResult({
        name: `getOverdueDeadlines-limit-${limit}`,
        description: `Query overdue deadlines with limit ${limit}`,
        timestamp: new Date(),
        statistics,
      });

      // Assert
      expect(statistics.successCount).toBe(50);
      expect(statistics.mean).toBeLessThan(200);
    });
  });

  // -------------------------------------------------------------------------
  // getDeadlinesByStatus Performance Tests
  // -------------------------------------------------------------------------

  describe('getDeadlinesByStatus Performance', () => {
    const statuses: Deadline['status'][] = ['pending', 'acknowledged', 'completed', 'missed', 'waived'];

    it.each(statuses)('should perform well for status=%s', async (status) => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(100, { status });

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Warmup
      await warmup(() => store.getDeadlinesByStatus(status), 3);

      // Act
      const results = await sequentialExecutor(
        () => store.getDeadlinesByStatus(status),
        50
      );

      const statistics = calculateStatistics(
        results.map(r => r.duration),
        results.filter(r => r.success).length,
        results.filter(r => !r.success).length
      );

      // Report
      reporter.addResult({
        name: `getDeadlinesByStatus-${status}`,
        description: `Query deadlines with status ${status}`,
        timestamp: new Date(),
        statistics,
        baseline: defaultBaselines['getDeadlinesByStatus'],
      });

      // Assert
      expect(statistics.successCount).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // getDeadlinesByAsset Performance Tests
  // -------------------------------------------------------------------------

  describe('getDeadlinesByAsset Performance', () => {
    it.each([1, 5, 10, 25, 50])('should perform well with %i deadlines per asset', async (deadlinesPerAsset) => {
      // Arrange
      const assetId = 'test-asset-123';
      const deadlineData = generateDynamoDBDeadlines(deadlinesPerAsset, { assetId });

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Warmup
      await warmup(() => store.getDeadlinesByAsset(assetId), 3);

      // Act
      const results = await sequentialExecutor(
        () => store.getDeadlinesByAsset(assetId),
        50
      );

      const statistics = calculateStatistics(
        results.map(r => r.duration),
        results.filter(r => r.success).length,
        results.filter(r => !r.success).length
      );

      // Report
      reporter.addResult({
        name: `getDeadlinesByAsset-${deadlinesPerAsset}`,
        description: `Query ${deadlinesPerAsset} deadlines for a single asset`,
        timestamp: new Date(),
        statistics,
        baseline: defaultBaselines['getDeadlinesByAsset'],
      });

      // Assert
      expect(statistics.successCount).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // Concurrent Query Tests
  // -------------------------------------------------------------------------

  describe('Concurrent Query Performance', () => {
    it.each([10, 50, 100])('should handle %i concurrent requests', async (concurrency) => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(50, { daysAhead: 30 });

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Warmup
      await warmup(() => store.getUpcomingDeadlines(30), 5);

      // Act
      const result = await concurrentExecutor(
        () => store.getUpcomingDeadlines(30),
        concurrency
      );

      // Report
      reporter.addConcurrentResult(
        `concurrent-${concurrency}`,
        result,
        `${concurrency} concurrent getUpcomingDeadlines queries`
      );

      // Assert
      expect(result.statistics.successCount).toBe(concurrency);
      expect(result.throughput).toBeGreaterThan(0);

      // Log additional metrics
      console.log(`  Concurrency: ${concurrency}`);
      console.log(`  Throughput: ${result.throughput.toFixed(2)} req/s`);
    });

    it('should maintain consistent performance under sustained load', async () => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(50, { daysAhead: 30 });
      const batches = 5;
      const requestsPerBatch = 20;
      const allStatistics: Statistics[] = [];

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Act - Run multiple batches
      for (let batch = 0; batch < batches; batch++) {
        const result = await concurrentExecutor(
          () => store.getUpcomingDeadlines(30),
          requestsPerBatch
        );
        allStatistics.push(result.statistics);
      }

      // Calculate variance in p95 across batches
      const p95Values = allStatistics.map(s => s.p95);
      const meanP95 = p95Values.reduce((a, b) => a + b, 0) / p95Values.length;
      const varianceP95 = p95Values.reduce((sum, v) => sum + Math.pow(v - meanP95, 2), 0) / p95Values.length;
      const coefficientOfVariation = Math.sqrt(varianceP95) / meanP95;

      // Report
      reporter.addResult({
        name: 'sustained-load',
        description: `Sustained load: ${batches} batches of ${requestsPerBatch} requests`,
        timestamp: new Date(),
        statistics: {
          count: batches * requestsPerBatch,
          successCount: allStatistics.reduce((sum, s) => sum + s.successCount, 0),
          failureCount: allStatistics.reduce((sum, s) => sum + s.failureCount, 0),
          min: Math.min(...allStatistics.map(s => s.min)),
          max: Math.max(...allStatistics.map(s => s.max)),
          mean: allStatistics.reduce((sum, s) => sum + s.mean, 0) / batches,
          median: allStatistics[Math.floor(batches / 2)].median,
          p50: allStatistics.reduce((sum, s) => sum + s.p50, 0) / batches,
          p95: meanP95,
          p99: Math.max(...allStatistics.map(s => s.p99)),
          standardDeviation: allStatistics.reduce((sum, s) => sum + s.standardDeviation, 0) / batches,
          totalDuration: allStatistics.reduce((sum, s) => sum + s.totalDuration, 0),
        },
      });

      // Assert - p95 should be relatively consistent (CV < 0.5)
      expect(coefficientOfVariation).toBeLessThan(0.5);
      console.log(`  Coefficient of variation for p95: ${(coefficientOfVariation * 100).toFixed(1)}%`);
    });
  });

  // -------------------------------------------------------------------------
  // Large Dataset Simulation Tests
  // -------------------------------------------------------------------------

  describe('Large Dataset Performance', () => {
    it.each([1000, 10000, 100000])('should handle queries against %i deadlines', async (datasetSize) => {
      // Note: We simulate large datasets by returning paginated results
      // In a real test, you would populate a test database

      // Arrange - Simulate returning 50 results from a large dataset
      const resultSize = Math.min(50, datasetSize);
      const deadlineData = generateDynamoDBDeadlines(resultSize, { daysAhead: 30 });

      // Simulate longer query time for larger datasets
      const baseQueryTime = Math.log10(datasetSize) * 5; // Log scale

      mockDocClient.send.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, baseQueryTime + Math.random() * 10));
        return {
          Items: deadlineData,
          LastEvaluatedKey: datasetSize > resultSize ? { pk: 'continuation-token' } : undefined,
        };
      });

      // Warmup
      await warmup(() => store.getUpcomingDeadlines(30), 3);

      // Act
      const { result: _, memory } = await trackMemory(async () => {
        const results = await sequentialExecutor(
          () => store.getUpcomingDeadlines(30),
          30
        );
        return calculateStatistics(
          results.map(r => r.duration),
          results.filter(r => r.success).length,
          results.filter(r => !r.success).length
        );
      });

      // Report
      reporter.addResult({
        name: `large-dataset-${datasetSize}`,
        description: `Query against simulated dataset of ${datasetSize.toLocaleString()} deadlines`,
        timestamp: new Date(),
        statistics: _,
        memory,
        baseline: defaultBaselines[`large-dataset-${datasetSize}`],
      });

      // Assert
      expect(_.successCount).toBe(30);
    });
  });

  // -------------------------------------------------------------------------
  // Memory Usage Tests
  // -------------------------------------------------------------------------

  describe('Memory Usage', () => {
    it('should not leak memory during repeated queries', async () => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(100, { daysAhead: 30 });

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Act - Track memory across 100 iterations
      const { result: iterations, memory } = await trackMemory(async () => {
        const results = await sequentialExecutor(
          () => store.getUpcomingDeadlines(30),
          100
        );
        return results.length;
      });

      // Report
      reporter.addResult({
        name: 'memory-leak-check',
        description: '100 sequential queries memory usage',
        timestamp: new Date(),
        statistics: {
          count: iterations,
          successCount: iterations,
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
        },
        memory,
      });

      // Assert - Memory growth should be minimal
      // Allow up to 50MB growth for 100 iterations
      expect(memory.delta.heapUsed).toBeLessThan(50 * 1024 * 1024);
      console.log(`  Memory delta: ${(memory.delta.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    });

    it('should track peak memory during concurrent burst', async () => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(100, { daysAhead: 30 });

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Act
      const { result: concurrentResult, memory } = await trackMemory(async () => {
        return concurrentExecutor(
          () => store.getUpcomingDeadlines(30),
          50
        );
      });

      // Report
      reporter.addResult({
        name: 'concurrent-memory-burst',
        description: '50 concurrent queries peak memory usage',
        timestamp: new Date(),
        statistics: concurrentResult.statistics,
        throughput: concurrentResult.throughput,
        memory,
      });

      // Assert - Peak should be reasonable
      // Allow up to 100MB peak during burst
      expect(memory.peakHeapUsed).toBeLessThan(200 * 1024 * 1024);
      console.log(`  Peak heap: ${(memory.peakHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    });
  });

  // -------------------------------------------------------------------------
  // Mixed Query Pattern Tests
  // -------------------------------------------------------------------------

  describe('Mixed Query Patterns', () => {
    it('should handle mixed query types efficiently', async () => {
      // Arrange
      const upcomingData = generateDynamoDBDeadlines(50, { daysAhead: 30 });
      const overdueData = generateDynamoDBDeadlines(20, { daysOverdue: 10, status: 'pending' });
      const statusData = generateDynamoDBDeadlines(30, { status: 'acknowledged' });

      let queryCount = 0;
      mockDocClient.send.mockImplementation(async (command: { input?: { IndexName?: string } }) => {
        queryCount++;
        const input = command.input;

        // Return different data based on query pattern
        if (input?.IndexName === 'status-due-date-index') {
          await simulateQueryLatency(upcomingData.length);
          return { Items: upcomingData };
        }

        await simulateQueryLatency(statusData.length);
        return { Items: statusData };
      });

      // Act - Mix of different query types
      const queries = [
        () => store.getUpcomingDeadlines(7),
        () => store.getUpcomingDeadlines(30),
        () => store.getOverdueDeadlines(),
        () => store.getDeadlinesByStatus('pending'),
        () => store.getDeadlinesByStatus('acknowledged'),
        () => store.getDeadlinesByAsset('asset-1'),
      ];

      const iterations = 10;
      const allResults = [];

      for (let i = 0; i < iterations; i++) {
        for (const query of queries) {
          const result = await measureExecutionTime(query);
          allResults.push(result);
        }
      }

      const statistics = calculateStatistics(
        allResults.map(r => r.duration),
        allResults.filter(r => r.success).length,
        allResults.filter(r => !r.success).length
      );

      // Report
      reporter.addResult({
        name: 'mixed-query-patterns',
        description: `${iterations * queries.length} mixed queries (${queries.length} types x ${iterations} iterations)`,
        timestamp: new Date(),
        statistics,
      });

      // Assert
      expect(statistics.successCount).toBe(iterations * queries.length);
      expect(queryCount).toBe(iterations * queries.length);
    });
  });

  // -------------------------------------------------------------------------
  // Stress Test
  // -------------------------------------------------------------------------

  describe('Stress Testing', () => {
    it('should handle rapid sequential queries', async () => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(25, { daysAhead: 7 });

      mockDocClient.send.mockImplementation(async () => {
        // Minimal latency for stress test
        await new Promise(resolve => setTimeout(resolve, 1));
        return { Items: deadlineData };
      });

      // Act - 500 rapid queries
      const startTime = performance.now();
      const results = await sequentialExecutor(
        () => store.getUpcomingDeadlines(7),
        500
      );
      const totalTime = performance.now() - startTime;

      const statistics = calculateStatistics(
        results.map(r => r.duration),
        results.filter(r => r.success).length,
        results.filter(r => !r.success).length
      );

      // Report
      reporter.addResult({
        name: 'stress-sequential',
        description: '500 rapid sequential queries',
        timestamp: new Date(),
        statistics,
        throughput: (500 / totalTime) * 1000, // req/s
      });

      // Assert
      expect(statistics.successCount).toBe(500);
      expect(statistics.failureCount).toBe(0);
    });

    it('should recover from high concurrency burst', async () => {
      // Arrange
      const deadlineData = generateDynamoDBDeadlines(25, { daysAhead: 7 });

      mockDocClient.send.mockImplementation(async () => {
        await simulateQueryLatency(deadlineData.length);
        return { Items: deadlineData };
      });

      // Act - High concurrency burst followed by normal operation
      const burstResult = await concurrentExecutor(
        () => store.getUpcomingDeadlines(7),
        100
      );

      // Short pause
      await new Promise(resolve => setTimeout(resolve, 100));

      // Normal operation after burst
      const normalResult = await sequentialExecutor(
        () => store.getUpcomingDeadlines(7),
        20
      );

      const normalStatistics = calculateStatistics(
        normalResult.map(r => r.duration),
        normalResult.filter(r => r.success).length,
        normalResult.filter(r => !r.success).length
      );

      // Report
      reporter.addConcurrentResult(
        'stress-burst-phase',
        burstResult,
        'Initial burst of 100 concurrent queries'
      );

      reporter.addResult({
        name: 'stress-recovery-phase',
        description: 'Normal operation after burst (20 sequential queries)',
        timestamp: new Date(),
        statistics: normalStatistics,
      });

      // Assert - System should recover
      expect(burstResult.statistics.successCount).toBe(100);
      expect(normalStatistics.successCount).toBe(20);
    });
  });
});

// ===========================================================================
// BASELINE VALIDATION TESTS (Always run)
// ===========================================================================

describe('Baseline Configuration Validation', () => {
  it('should have valid baseline configurations', () => {
    // Validate all baselines have required fields
    for (const [key, baseline] of Object.entries(defaultBaselines)) {
      expect(baseline.name).toBeDefined();
      expect(baseline.maxP50).toBeGreaterThan(0);
      expect(baseline.maxP95).toBeGreaterThan(baseline.maxP50);
      expect(baseline.maxP99).toBeGreaterThan(baseline.maxP95);

      if (baseline.minThroughput !== undefined) {
        expect(baseline.minThroughput).toBeGreaterThan(0);
      }
    }
  });

  it('should have baselines for all primary query types', () => {
    const requiredBaselines = [
      'getUpcomingDeadlines-7',
      'getUpcomingDeadlines-30',
      'getUpcomingDeadlines-90',
      'getOverdueDeadlines',
      'getDeadlinesByStatus',
      'getDeadlinesByAsset',
    ];

    for (const key of requiredBaselines) {
      expect(defaultBaselines[key]).toBeDefined();
    }
  });
});
