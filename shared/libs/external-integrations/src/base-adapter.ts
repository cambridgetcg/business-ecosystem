/**
 * Base External Adapter
 * Abstract base class for external API integrations with common functionality.
 */

import pino from 'pino';
import type {
  ExternalProvider,
  ExternalConnection,
  ExternalCredentials,
  HealthCheckResult,
  RateLimitInfo,
  ConnectionStatus,
} from './types.js';

const logger = pino({ name: 'external-integrations' });

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

export interface CircuitBreakerConfig {
  threshold: number;
  resetMs: number;
}

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  threshold: 5,
  resetMs: 30000,
};

/**
 * External adapter error with additional context
 */
export class ExternalAdapterError extends Error {
  constructor(
    message: string,
    public readonly provider: ExternalProvider,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ExternalAdapterError';
  }
}

/**
 * Abstract base class for external API adapters
 */
export abstract class BaseExternalAdapter<TCredentials extends ExternalCredentials = ExternalCredentials> {
  abstract readonly provider: ExternalProvider;

  protected connections: Map<string, ExternalConnection> = new Map();
  protected credentials: Map<string, TCredentials> = new Map();
  protected rateLimits: Map<string, RateLimitInfo> = new Map();
  protected circuitState: CircuitState = {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  };

  protected readonly retryConfig: RetryConfig;
  protected readonly circuitConfig: CircuitBreakerConfig;
  protected readonly log: pino.Logger;

  constructor(
    retryConfig?: Partial<RetryConfig>,
    circuitConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.circuitConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...circuitConfig };
    this.log = logger.child({ provider: this.provider });
  }

  // ==========================================================================
  // ABSTRACT METHODS (must be implemented by subclasses)
  // ==========================================================================

  /**
   * Connect to the external service with credentials
   */
  abstract connect(credentials: TCredentials): Promise<ExternalConnection>;

  /**
   * Perform provider-specific health check
   */
  protected abstract performHealthCheck(connectionId: string): Promise<void>;

  /**
   * Refresh OAuth tokens or update credentials
   */
  abstract refreshCredentials(connectionId: string): Promise<void>;

  /**
   * Get base URL for API requests
   */
  protected abstract getBaseUrl(): string;

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  /**
   * Disconnect from the external service
   */
  async disconnect(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new ExternalAdapterError(
        `Connection not found: ${connectionId}`,
        this.provider,
        'CONNECTION_NOT_FOUND'
      );
    }

    await this.onDisconnect(connectionId);
    this.connections.delete(connectionId);
    this.credentials.delete(connectionId);
    this.rateLimits.delete(connectionId);

    this.log.info({ connectionId }, 'Disconnected');
  }

  /**
   * Override for provider-specific disconnect logic
   */
  protected async onDisconnect(_connectionId: string): Promise<void> {
    // Default: no-op
  }

  /**
   * Check connection health
   */
  async checkHealth(connectionId: string): Promise<HealthCheckResult> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return {
        connectionId,
        isHealthy: false,
        latencyMs: 0,
        lastSuccessfulOperation: new Date(0),
        issues: ['Connection not found'],
        checkedAt: new Date(),
      };
    }

    const startTime = Date.now();

    try {
      await this.performHealthCheck(connectionId);
      const latencyMs = Date.now() - startTime;

      this.updateConnectionStatus(connectionId, 'connected');

      return {
        connectionId,
        isHealthy: true,
        latencyMs,
        lastSuccessfulOperation: new Date(),
        issues: [],
        checkedAt: new Date(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.updateConnectionStatus(connectionId, 'error');

      return {
        connectionId,
        isHealthy: false,
        latencyMs,
        lastSuccessfulOperation: connection.lastUsedAt,
        issues: [message],
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Get all active connections
   */
  getConnections(): ExternalConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get rate limit info for a connection
   */
  getRateLimitInfo(connectionId: string): RateLimitInfo | undefined {
    return this.rateLimits.get(connectionId);
  }

  // ==========================================================================
  // HTTP REQUEST HANDLING
  // ==========================================================================

  /**
   * Make an authenticated HTTP request with retry and circuit breaker
   */
  protected async request<T>(
    connectionId: string,
    method: string,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      query?: Record<string, string | number | boolean>;
    }
  ): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new ExternalAdapterError(
        'Circuit breaker is open',
        this.provider,
        'CIRCUIT_OPEN',
        503
      );
    }

    const creds = this.credentials.get(connectionId);
    if (!creds) {
      throw new ExternalAdapterError(
        'No credentials found for connection',
        this.provider,
        'NO_CREDENTIALS'
      );
    }

    // Check if token needs refresh
    if (creds.type === 'oauth' && creds.tokenExpiresAt) {
      const expiresIn = creds.tokenExpiresAt.getTime() - Date.now();
      if (expiresIn < 60000) { // Refresh if less than 1 minute remaining
        await this.refreshCredentials(connectionId);
      }
    }

    const url = this.buildUrl(path, options?.query);
    const headers = await this.buildHeaders(connectionId, options?.headers);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });

        // Update rate limit info from headers
        this.updateRateLimitFromResponse(connectionId, response);

        if (!response.ok) {
          // Check for rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : this.retryConfig.baseDelayMs * Math.pow(2, attempt);

            this.updateConnectionStatus(connectionId, 'rate_limited');

            if (attempt < this.retryConfig.maxRetries) {
              this.log.warn({ attempt, delayMs }, 'Rate limited, retrying');
              await this.delay(delayMs);
              continue;
            }
          }

          const shouldRetry = this.retryConfig.retryableStatuses.includes(response.status);
          if (shouldRetry && attempt < this.retryConfig.maxRetries) {
            await this.delay(this.calculateDelay(attempt));
            continue;
          }

          this.recordFailure();
          const errorBody = await response.text();
          throw new ExternalAdapterError(
            errorBody || response.statusText,
            this.provider,
            'HTTP_ERROR',
            response.status,
            { url, method }
          );
        }

        this.recordSuccess();
        this.updateConnectionStatus(connectionId, 'connected');

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json() as T;
        }
        return await response.text() as unknown as T;

      } catch (error) {
        lastError = error as Error;
        if (error instanceof ExternalAdapterError) throw error;

        if (attempt < this.retryConfig.maxRetries) {
          this.log.warn({ attempt, error: lastError.message }, 'Request failed, retrying');
          await this.delay(this.calculateDelay(attempt));
          continue;
        }
        this.recordFailure();
      }
    }

    throw new ExternalAdapterError(
      lastError?.message || 'Request failed after retries',
      this.provider,
      'NETWORK_ERROR',
      0,
      { url, method }
    );
  }

  /**
   * Build full URL with query parameters
   */
  protected buildUrl(path: string, query?: Record<string, string | number | boolean>): string {
    const baseUrl = this.getBaseUrl();
    const url = new URL(path, baseUrl);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Build request headers including authentication
   */
  protected async buildHeaders(
    connectionId: string,
    additionalHeaders?: Record<string, string>
  ): Promise<Record<string, string>> {
    const creds = this.credentials.get(connectionId);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...additionalHeaders,
    };

    if (creds) {
      switch (creds.type) {
        case 'oauth':
          if (creds.accessToken) {
            headers['Authorization'] = `Bearer ${creds.accessToken}`;
          }
          break;
        case 'api_key':
          headers['X-API-Key'] = creds.apiKey;
          if (creds.apiSecret) {
            headers['X-API-Secret'] = creds.apiSecret;
          }
          break;
        case 'basic':
          const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
          break;
      }
    }

    return headers;
  }

  // ==========================================================================
  // CIRCUIT BREAKER
  // ==========================================================================

  protected isCircuitOpen(): boolean {
    if (this.circuitState.state === 'closed') return false;

    if (this.circuitState.state === 'open') {
      const now = Date.now();
      if (now - this.circuitState.lastFailure > this.circuitConfig.resetMs) {
        this.circuitState.state = 'half-open';
        this.log.info('Circuit breaker moved to half-open');
        return false;
      }
      return true;
    }

    return false;
  }

  protected recordFailure(): void {
    this.circuitState.failures++;
    this.circuitState.lastFailure = Date.now();

    if (this.circuitState.failures >= this.circuitConfig.threshold) {
      this.circuitState.state = 'open';
      this.log.warn('Circuit breaker opened');
    }
  }

  protected recordSuccess(): void {
    this.circuitState.failures = 0;
    if (this.circuitState.state === 'half-open') {
      this.circuitState.state = 'closed';
      this.log.info('Circuit breaker closed');
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Generate unique connection ID
   */
  protected generateConnectionId(...parts: string[]): string {
    return `${this.provider}:${parts.join(':')}`;
  }

  /**
   * Update connection status
   */
  protected updateConnectionStatus(connectionId: string, status: ConnectionStatus): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.set(connectionId, {
        ...connection,
        status,
        lastUsedAt: new Date(),
      });
    }
  }

  /**
   * Get connection or throw
   */
  protected getConnectionOrThrow(connectionId: string): ExternalConnection {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new ExternalAdapterError(
        `Connection not found: ${connectionId}`,
        this.provider,
        'CONNECTION_NOT_FOUND'
      );
    }
    return connection;
  }

  /**
   * Calculate delay for retry attempt
   */
  protected calculateDelay(attempt: number): number {
    return Math.min(
      this.retryConfig.baseDelayMs * Math.pow(2, attempt),
      this.retryConfig.maxDelayMs
    );
  }

  /**
   * Delay execution
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update rate limit info from response headers
   */
  protected updateRateLimitFromResponse(connectionId: string, response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const limit = response.headers.get('X-RateLimit-Limit');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (remaining !== null && limit !== null) {
      this.rateLimits.set(connectionId, {
        remaining: parseInt(remaining),
        limit: parseInt(limit),
        resetAt: reset ? new Date(parseInt(reset) * 1000) : new Date(Date.now() + 60000),
      });
    }
  }
}
