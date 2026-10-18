/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by tracking service health and short-circuiting requests
 */

import pino from 'pino';

const logger = pino({ name: 'circuit-breaker' });

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN (default: 30000) */
  resetTimeout?: number;
  /** Number of successes in HALF_OPEN needed to close circuit (default: 2) */
  successThreshold?: number;
  /** Sliding window in ms for failure counting (default: 60000) */
  windowDuration?: number;
  /** Callback when state changes */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number[];
  successes: number;
  lastFailure: number | null;
  openedAt: number | null;
}

/**
 * Circuit Breaker for a single service
 */
export class CircuitBreaker {
  private name: string;
  private options: Required<Omit<CircuitBreakerOptions, 'onStateChange'>> & { onStateChange?: CircuitBreakerOptions['onStateChange'] };
  private state: CircuitBreakerState;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 30000,
      successThreshold: options.successThreshold ?? 2,
      windowDuration: options.windowDuration ?? 60000,
      onStateChange: options.onStateChange,
    };
    this.state = {
      state: 'CLOSED',
      failures: [],
      successes: 0,
      lastFailure: null,
      openedAt: null,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.pruneOldFailures();
    this.checkStateTransition();

    if (this.state.state === 'OPEN') {
      logger.warn({ name: this.name }, 'Circuit is OPEN, request rejected');
      throw new CircuitOpenError(this.name, this.getRemainingTimeout());
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Execute with a fallback when circuit is open
   */
  async executeWithFallback<T>(fn: () => Promise<T>, fallback: T | (() => T)): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
      }
      throw error;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state.state === 'HALF_OPEN') {
      this.state.successes++;
      logger.debug({
        name: this.name,
        successes: this.state.successes,
        threshold: this.options.successThreshold,
      }, 'Success in HALF_OPEN state');

      if (this.state.successes >= this.options.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state.state === 'CLOSED') {
      // Clear failures on success in closed state
      this.state.failures = [];
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    const now = Date.now();
    this.state.failures.push(now);
    this.state.lastFailure = now;

    if (this.state.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately opens circuit
      this.transitionTo('OPEN');
      return;
    }

    const recentFailures = this.getRecentFailureCount();
    logger.debug({
      name: this.name,
      recentFailures,
      threshold: this.options.failureThreshold,
    }, 'Failure recorded');

    if (recentFailures >= this.options.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    this.checkStateTransition();
    return this.state.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    name: string;
    state: CircuitState;
    recentFailures: number;
    successesInHalfOpen: number;
    lastFailure: Date | null;
    openedAt: Date | null;
    remainingTimeout: number | null;
  } {
    this.checkStateTransition();
    return {
      name: this.name,
      state: this.state.state,
      recentFailures: this.getRecentFailureCount(),
      successesInHalfOpen: this.state.successes,
      lastFailure: this.state.lastFailure ? new Date(this.state.lastFailure) : null,
      openedAt: this.state.openedAt ? new Date(this.state.openedAt) : null,
      remainingTimeout: this.getRemainingTimeout(),
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.state.failures = [];
    this.state.successes = 0;
    this.state.lastFailure = null;
    this.state.openedAt = null;
  }

  /**
   * Manually force circuit to OPEN state (useful for maintenance)
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state.state === newState) return;

    const oldState = this.state.state;

    logger.info({
      name: this.name,
      from: oldState,
      to: newState,
    }, 'Circuit breaker state change');

    if (newState === 'OPEN') {
      this.state.openedAt = Date.now();
      this.state.successes = 0;
    } else if (newState === 'HALF_OPEN') {
      this.state.successes = 0;
    } else if (newState === 'CLOSED') {
      this.state.failures = [];
      this.state.openedAt = null;
      this.state.successes = 0;
    }

    this.state.state = newState;

    if (this.options.onStateChange) {
      this.options.onStateChange(this.name, oldState, newState);
    }
  }

  private checkStateTransition(): void {
    if (this.state.state === 'OPEN') {
      const elapsed = Date.now() - (this.state.openedAt || 0);
      if (elapsed >= this.options.resetTimeout) {
        this.transitionTo('HALF_OPEN');
      }
    }
  }

  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.options.windowDuration;
    this.state.failures = this.state.failures.filter(ts => ts > cutoff);
  }

  private getRecentFailureCount(): number {
    const cutoff = Date.now() - this.options.windowDuration;
    return this.state.failures.filter(ts => ts > cutoff).length;
  }

  private getRemainingTimeout(): number | null {
    if (this.state.state !== 'OPEN' || !this.state.openedAt) return null;
    const remaining = this.options.resetTimeout - (Date.now() - this.state.openedAt);
    return Math.max(0, remaining);
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  public readonly serviceName: string;
  public readonly remainingTimeout: number | null;

  constructor(serviceName: string, remainingTimeout: number | null) {
    super(`Circuit breaker is OPEN for service: ${serviceName}`);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.remainingTimeout = remainingTimeout;
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers by service name
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private defaultOptions: CircuitBreakerOptions;

  constructor(defaultOptions: CircuitBreakerOptions = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Get or create a circuit breaker for a service
   */
  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, { ...this.defaultOptions, ...options }));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker stats
   */
  getAllStats(): ReturnType<CircuitBreaker['getStats']>[] {
    return Array.from(this.breakers.values()).map(b => b.getStats());
  }

  /**
   * Get all circuit breakers in a specific state
   */
  getByState(state: CircuitState): CircuitBreaker[] {
    return Array.from(this.breakers.values()).filter(b => b.getState() === state);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Check if any circuit is open
   */
  hasOpenCircuits(): boolean {
    return Array.from(this.breakers.values()).some(b => b.getState() === 'OPEN');
  }

  /**
   * Get count of circuits by state
   */
  getStateCounts(): Record<CircuitState, number> {
    const counts: Record<CircuitState, number> = { CLOSED: 0, OPEN: 0, HALF_OPEN: 0 };
    for (const breaker of this.breakers.values()) {
      counts[breaker.getState()]++;
    }
    return counts;
  }
}

// Default global registry
export const circuitRegistry = new CircuitBreakerRegistry({
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 2,
  windowDuration: 60000,
});
