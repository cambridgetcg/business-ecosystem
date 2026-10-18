# Load Testing for IP Deadline Queries

This directory contains load tests for deadline-related database queries in the Intellectual Property service.

## Overview

The load tests measure performance characteristics of deadline queries including:

- **Query Performance**: Response times for different query types and parameters
- **Concurrent Execution**: Behavior under parallel query load
- **Large Dataset Simulation**: Performance with varying data volumes
- **Memory Usage**: Memory patterns during normal and burst operations

## Files

| File | Description |
|------|-------------|
| `deadline-queries.load.test.ts` | Main load test suite |
| `benchmark-utils.ts` | Utilities for timing, concurrency, and statistics |
| `benchmark-reporter.ts` | Results formatting and baseline comparison |
| `README.md` | This documentation |

## Running Load Tests

### Prerequisites

1. Node.js 18+ installed
2. Project dependencies installed (`pnpm install`)

### Run Load Tests Only

```bash
# Run load tests
LOAD_TEST=true pnpm test test/load

# Run with report saving
LOAD_TEST=true SAVE_REPORT=true pnpm test test/load

# Run in CI mode (also enables load tests)
CI=true pnpm test test/load
```

### Run All Tests Including Load Tests

```bash
LOAD_TEST=true pnpm test
```

### Skip Load Tests (Default)

Load tests are skipped by default in normal test runs:

```bash
pnpm test  # Load tests are skipped
```

## Test Categories

### 1. Query Performance Tests

Tests individual query types with varying parameters:

- **getUpcomingDeadlines**: Tests with `daysAhead` of 7, 30, 90, 365
- **getOverdueDeadlines**: Tests with limits of 10, 50, 100, 500
- **getDeadlinesByStatus**: Tests all status types (pending, acknowledged, completed, missed, waived)
- **getDeadlinesByAsset**: Tests with 1, 5, 10, 25, 50 deadlines per asset

### 2. Concurrent Query Tests

Tests system behavior under parallel load:

- 10 concurrent requests
- 50 concurrent requests
- 100 concurrent requests
- Sustained load testing (multiple batches)

### 3. Large Dataset Simulation

Tests query performance against simulated large datasets:

- 1,000 deadlines
- 10,000 deadlines
- 100,000 deadlines

### 4. Memory Usage Tests

Monitors memory patterns:

- Memory leak detection over 100 iterations
- Peak memory during concurrent bursts

### 5. Stress Tests

Tests system under stress conditions:

- 500 rapid sequential queries
- Recovery after high concurrency burst

## Performance Baselines

Default baselines are defined in `benchmark-reporter.ts`. These represent acceptable performance thresholds:

| Query Type | p50 (max) | p95 (max) | p99 (max) | Min Throughput |
|------------|-----------|-----------|-----------|----------------|
| Upcoming (7 days) | 50ms | 100ms | 200ms | 100 req/s |
| Upcoming (30 days) | 75ms | 150ms | 300ms | 80 req/s |
| Upcoming (90 days) | 100ms | 200ms | 400ms | 60 req/s |
| Upcoming (365 days) | 150ms | 300ms | 500ms | 40 req/s |
| Overdue | 50ms | 100ms | 200ms | 100 req/s |
| By Status | 50ms | 100ms | 200ms | 100 req/s |
| By Asset | 30ms | 75ms | 150ms | 150 req/s |
| Concurrent (10) | 100ms | 200ms | 400ms | - |
| Concurrent (50) | 150ms | 300ms | 500ms | - |
| Concurrent (100) | 250ms | 500ms | 800ms | - |

### Custom Baselines

Override baselines by modifying `defaultBaselines` in `benchmark-reporter.ts` or providing custom baselines in test setup.

## Environment Requirements

### For Mocked Tests (Default)

Tests use mocked AWS SDK clients. No external dependencies required.

### For Integration Tests

To run against a real DynamoDB:

1. Set up local DynamoDB:
   ```bash
   docker run -p 8000:8000 amazon/dynamodb-local
   ```

2. Create required tables (see `infrastructure/terraform` for schema)

3. Configure environment:
   ```bash
   export AWS_REGION=us-east-1
   export DYNAMODB_ENDPOINT=http://localhost:8000
   export LOAD_TEST=true
   pnpm test test/load
   ```

## Interpreting Results

### Console Output

Results are printed to console after each test run:

```
================================================================================
 BENCHMARK RESULTS
================================================================================
Duration: 45.23s
Total Tests: 25

--------------------------------------------------------------------------------
[PASS] getUpcomingDeadlines-30
  Query deadlines due within 30 days

  Latency Statistics:
    Count:     50
    Success:   50 (100.0%)
    Min:       12.34ms
    Max:       45.67ms
    Mean:      23.45ms
    Std Dev:   8.12ms

  Percentiles:
    p50:       22.10ms [PASS] (max: 75.00ms)
    p95:       38.50ms [PASS] (max: 150.00ms)
    p99:       44.20ms [PASS] (max: 300.00ms)

  Throughput:  42.35 req/s [PASS] (min: 80 req/s)
```

### JSON Report

Enable JSON report generation:

```bash
LOAD_TEST=true SAVE_REPORT=true pnpm test test/load
```

Reports are saved as `benchmark-report-{timestamp}.json`.

JSON report structure:
```json
{
  "title": "Deadline Query Load Test Results",
  "environment": {
    "nodeVersion": "v20.10.0",
    "platform": "darwin",
    "cpus": 10,
    "memory": "32.00 GB"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "duration": 45230,
  "results": [...],
  "summary": {
    "total": 25,
    "passed": 24,
    "failed": 1,
    "passRate": "96.0%"
  }
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
load-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: pnpm install
    - run: LOAD_TEST=true SAVE_REPORT=true pnpm test test/load
    - uses: actions/upload-artifact@v4
      with:
        name: load-test-report
        path: benchmark-report-*.json
```

### Failure Thresholds

The test suite will fail if:

1. Any query test fails (errors during execution)
2. Performance metrics exceed baseline thresholds
3. Memory usage exceeds limits (50MB growth, 200MB peak)

## Extending Tests

### Adding New Query Tests

```typescript
it('should test my new query', async () => {
  // Arrange
  const testData = generateDynamoDBDeadlines(50, { daysAhead: 30 });
  mockDocClient.send.mockResolvedValue({ Items: testData });

  // Act
  const results = await sequentialExecutor(
    () => store.myNewQuery(params),
    50
  );

  const statistics = calculateStatistics(
    results.map(r => r.duration),
    results.filter(r => r.success).length,
    results.filter(r => !r.success).length
  );

  // Report
  reporter.addResult({
    name: 'my-new-query',
    description: 'Description of my new query',
    timestamp: new Date(),
    statistics,
  });

  // Assert
  expect(statistics.successCount).toBe(50);
});
```

### Adding Custom Baselines

```typescript
// In benchmark-reporter.ts
export const defaultBaselines: Record<string, PerformanceBaseline> = {
  // ... existing baselines
  'my-new-query': {
    name: 'My new query',
    maxP50: 30,
    maxP95: 60,
    maxP99: 100,
    minThroughput: 200,
  },
};
```

## Troubleshooting

### Tests Timeout

Increase timeout in `vitest.config.ts`:
```typescript
testTimeout: 120000, // 2 minutes
```

### Memory Issues

Run with garbage collection enabled:
```bash
node --expose-gc node_modules/.bin/vitest run test/load
```

### Flaky Results

- Increase warmup iterations
- Reduce concurrency levels
- Run multiple times and average results

## Contributing

When adding new deadline queries:

1. Add load test coverage
2. Define appropriate baselines
3. Update this documentation
4. Ensure tests pass in CI
