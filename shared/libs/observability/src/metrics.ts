/**
 * Prometheus metrics setup
 */

import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { metrics, Counter, Histogram, Gauge, Meter } from '@opentelemetry/api';
import type { ObservabilityConfig } from './types.js';

let meterProvider: MeterProvider | null = null;
let exporter: PrometheusExporter | null = null;

export function initMetrics(config: ObservabilityConfig): void {
  if (!config.metrics?.enabled) return;

  exporter = new PrometheusExporter({
    port: config.metrics.port || 9464,
  });

  meterProvider = new MeterProvider();
  meterProvider.addMetricReader(exporter);
  metrics.setGlobalMeterProvider(meterProvider);
}

export function getMeter(name: string): Meter {
  return metrics.getMeter(name);
}

// Pre-defined metrics for common use cases
export function createHttpMetrics(meter: Meter) {
  const requestCounter = meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
  });

  const requestDuration = meter.createHistogram('http_request_duration_seconds', {
    description: 'HTTP request duration in seconds',
  });

  const activeRequests = meter.createUpDownCounter('http_active_requests', {
    description: 'Number of active HTTP requests',
  });

  return {
    requestCounter,
    requestDuration,
    activeRequests,
  };
}

export function createDatabaseMetrics(meter: Meter) {
  const queryCounter = meter.createCounter('db_queries_total', {
    description: 'Total number of database queries',
  });

  const queryDuration = meter.createHistogram('db_query_duration_seconds', {
    description: 'Database query duration in seconds',
  });

  const connectionPool = meter.createObservableGauge('db_connections_active', {
    description: 'Number of active database connections',
  });

  return {
    queryCounter,
    queryDuration,
    connectionPool,
  };
}

export function createBusinessMetrics(meter: Meter) {
  return {
    entitiesCreated: meter.createCounter('business_entities_created_total', {
      description: 'Total number of entities created',
    }),
    eventsPublished: meter.createCounter('business_events_published_total', {
      description: 'Total number of domain events published',
    }),
    sagasStarted: meter.createCounter('business_sagas_started_total', {
      description: 'Total number of sagas started',
    }),
    sagasCompleted: meter.createCounter('business_sagas_completed_total', {
      description: 'Total number of sagas completed',
    }),
    sagasFailed: meter.createCounter('business_sagas_failed_total', {
      description: 'Total number of sagas failed',
    }),
  };
}

export async function shutdownMetrics(): Promise<void> {
  await meterProvider?.shutdown();
}

export { Counter, Histogram, Gauge, Meter };
