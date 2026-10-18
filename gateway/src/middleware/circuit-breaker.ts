/**
 * Circuit Breaker Pattern Implementation
 *
 * Provides resilience for downstream service calls with:
 * - Circuit states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
 * - Failure threshold tracking
 * - Automatic recovery with half-open testing
 * - Fallback responses when circuit is open
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';

const logger = pino({ name: 'circuit-breaker' });

// =============================================================================
// TYPES
// =============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery */
  resetTimeoutMs: number;
  /** Number of successful requests in HALF_OPEN to close circuit */
  successThreshold: number;
  /** Request timeout in ms */
  requestTimeoutMs: number;
  /** Custom fallback response */
  fallbackResponse?: (serviceName: string) => object;
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  successThreshold: 3,
  requestTimeoutMs: 10000, // 10 seconds
  fallbackResponse: (serviceName) => ({
    error: 'Service Unavailable',
    message: `${serviceName} is temporarily unavailable. Please try again later.`,
    retryAfter: 30,
  }),
};

// =============================================================================
// CIRCUIT BREAKER CLASS
// =============================================================================

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(
    private readonly serviceName: string,
    private readonly config: CircuitBreakerConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Check if request should be allowed through
   */
  canRequest(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs
      ) {
        this.transitionTo('HALF_OPEN');
        return true;
      }
      return false;
    }

    // HALF_OPEN - allow limited requests for testing
    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    this.successes++;
    this.totalSuccesses++;
    this.totalRequests++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(error?: Error): void {
    this.failures++;
    this.totalFailures++;
    this.totalRequests++;
    this.lastFailureTime = Date.now();

    logger.warn(
      { service: this.serviceName, failures: this.failures, error: error?.message },
      'Circuit breaker recorded failure'
    );

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately opens circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * Get current circuit state and stats
   */
  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get fallback response when circuit is open
   */
  getFallbackResponse(): object {
    return this.config.fallbackResponse
      ? this.config.fallbackResponse(this.serviceName)
      : DEFAULT_CONFIG.fallbackResponse!(this.serviceName);
  }

  /**
   * Force circuit to a specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    logger.info(
      { service: this.serviceName, from: this.state, to: state },
      'Circuit breaker state forced'
    );
    this.state = state;
    if (state === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.failures = 0;
    this.successes = 0;

    logger.info(
      { service: this.serviceName, from: oldState, to: newState },
      'Circuit breaker state transition'
    );
  }
}

// =============================================================================
// CIRCUIT BREAKER REGISTRY
// =============================================================================

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(
        serviceName,
        new CircuitBreaker(serviceName, { ...DEFAULT_CONFIG, ...config })
      );
    }
    return this.breakers.get(serviceName)!;
  }

  getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  reset(serviceName?: string): void {
    if (serviceName) {
      this.breakers.get(serviceName)?.forceState('CLOSED');
    } else {
      for (const breaker of this.breakers.values()) {
        breaker.forceState('CLOSED');
      }
    }
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// =============================================================================
// RETRY WITH EXPONENTIAL BACKOFF
// =============================================================================

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  retryableStatuses: [502, 503, 504],
};

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000),
      });

      if (
        !response.ok &&
        retryConfig.retryableStatuses.includes(response.status) &&
        attempt < retryConfig.maxRetries
      ) {
        const delay = Math.min(
          retryConfig.baseDelayMs * Math.pow(2, attempt),
          retryConfig.maxDelayMs
        );
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retryConfig.maxRetries) {
        const delay = Math.min(
          retryConfig.baseDelayMs * Math.pow(2, attempt),
          retryConfig.maxDelayMs
        );
        logger.warn(
          { url, attempt, delay, error: lastError.message },
          'Retrying request'
        );
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// MIDDLEWARE FACTORY
// =============================================================================

export interface CircuitBreakerMiddlewareOptions {
  serviceName: string;
  config?: Partial<CircuitBreakerConfig>;
}

/**
 * Create circuit breaker pre-handler for a service
 */
export function createCircuitBreakerHandler(options: CircuitBreakerMiddlewareOptions) {
  const breaker = circuitBreakerRegistry.get(options.serviceName, options.config);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!breaker.canRequest()) {
      const stats = breaker.getStats();
      logger.warn(
        { service: options.serviceName, state: stats.state },
        'Circuit breaker rejected request'
      );

      reply
        .code(503)
        .header('Retry-After', '30')
        .send(breaker.getFallbackResponse());
      return;
    }

    // Store breaker reference for response handling
    (request as any).circuitBreaker = breaker;
  };
}

/**
 * Record response result to circuit breaker
 */
export function recordCircuitBreakerResult(
  request: FastifyRequest,
  reply: FastifyReply,
  error?: Error
): void {
  const breaker = (request as any).circuitBreaker as CircuitBreaker | undefined;
  if (!breaker) return;

  if (error || reply.statusCode >= 500) {
    breaker.recordFailure(error);
  } else {
    breaker.recordSuccess();
  }
}
