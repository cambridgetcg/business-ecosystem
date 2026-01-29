/**
 * Observability types and configuration
 */

export interface ObservabilityConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  
  tracing?: {
    enabled?: boolean;
    endpoint?: string; // OTLP endpoint (default: http://localhost:4318)
    sampleRate?: number; // 0-1 (default: 1)
  };
  
  metrics?: {
    enabled?: boolean;
    endpoint?: string; // Prometheus endpoint
    port?: number; // Metrics server port (default: 9464)
  };
  
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    prettyPrint?: boolean;
  };
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  correlationId: string;
}

export const defaultConfig: ObservabilityConfig = {
  serviceName: 'unknown-service',
  serviceVersion: '0.0.0',
  environment: process.env.NODE_ENV || 'development',
  tracing: {
    enabled: true,
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    sampleRate: 1,
  },
  metrics: {
    enabled: true,
    port: 9464,
  },
  logging: {
    level: 'info',
    prettyPrint: process.env.NODE_ENV !== 'production',
  },
};
