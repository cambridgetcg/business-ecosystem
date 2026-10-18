/**
 * Domain Clients
 * HTTP clients for operational domain services with circuit breaker protection
 */

import pino from 'pino';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitOpenError,
  type CircuitBreakerOptions,
  type CircuitState,
} from './middleware/circuit-breaker.js';
import type {
  OperationalDomain,
  DomainHealthResponse,
  DomainDocument,
  PendingAction,
  ExpiringItem,
  DomainSummary,
  RecentActivity,
} from './types.js';

const logger = pino({ name: 'operational-gateway-client' });

export interface DomainClientConfig {
  baseUrl: string;
  timeout?: number;
  circuitBreaker?: CircuitBreakerOptions;
}

// Global circuit breaker registry for all domain clients
const domainCircuitRegistry = new CircuitBreakerRegistry({
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 2,
  windowDuration: 60000,
  onStateChange: (name, from, to) => {
    logger.warn({ domain: name, from, to }, 'Domain circuit breaker state change');
  },
});

export { CircuitOpenError };

/**
 * Get circuit breaker stats for all domains
 */
export function getDomainCircuitStats(): ReturnType<CircuitBreaker['getStats']>[] {
  return domainCircuitRegistry.getAllStats();
}

/**
 * Check if any domain circuit is open
 */
export function hasOpenDomainCircuits(): boolean {
  return domainCircuitRegistry.hasOpenCircuits();
}

/**
 * Get circuit counts by state
 */
export function getDomainCircuitCounts(): Record<CircuitState, number> {
  return domainCircuitRegistry.getStateCounts();
}

/**
 * Reset a specific domain's circuit breaker
 */
export function resetDomainCircuit(domain: OperationalDomain): void {
  domainCircuitRegistry.get(domain).reset();
}

/**
 * Reset all domain circuit breakers
 */
export function resetAllDomainCircuits(): void {
  domainCircuitRegistry.resetAll();
}

export class DomainClient {
  private baseUrl: string;
  private timeout: number;
  private domain: OperationalDomain;
  private circuitBreaker: CircuitBreaker;

  constructor(domain: OperationalDomain, config: DomainClientConfig) {
    this.domain = domain;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 10000;
    this.circuitBreaker = domainCircuitRegistry.get(domain, config.circuitBreaker);
  }

  /**
   * Get the circuit breaker for this domain
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Check if this domain's circuit is open
   */
  isCircuitOpen(): boolean {
    return this.circuitBreaker.getState() === 'OPEN';
  }

  /**
   * Get circuit breaker statistics for this domain
   */
  getCircuitStats(): ReturnType<CircuitBreaker['getStats']> {
    return this.circuitBreaker.getStats();
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T | null> {
    // Check circuit state before making request
    const circuitState = this.circuitBreaker.getState();
    if (circuitState === 'OPEN') {
      logger.warn({ domain: this.domain, path }, 'Circuit OPEN, returning null');
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        logger.warn({
          domain: this.domain,
          path,
          status: response.status,
        }, 'Domain request failed');
        this.circuitBreaker.recordFailure();
        return null;
      }

      // Success - record it
      this.circuitBreaker.recordSuccess();
      return await response.json() as T;
    } catch (error) {
      // Record failure for circuit breaker
      this.circuitBreaker.recordFailure();

      if ((error as Error).name === 'AbortError') {
        logger.warn({ domain: this.domain, path }, 'Domain request timed out');
      } else {
        logger.error({ domain: this.domain, path, error }, 'Domain request error');
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getHealth(): Promise<DomainHealthResponse> {
    const result = await this.fetch<{ status: string }>('/health');
    return {
      domain: this.domain,
      status: result?.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
    };
  }

  async getDocuments(entityId: string): Promise<DomainDocument[]> {
    const result = await this.fetch<{ documents: DomainDocument[] }>(
      `/entities/${entityId}/documents`
    );
    return result?.documents || [];
  }

  async getPendingActions(entityId?: string): Promise<PendingAction[]> {
    const path = entityId
      ? `/entities/${entityId}/pending-actions`
      : '/pending-actions';
    const result = await this.fetch<{ actions: PendingAction[] }>(path);
    return (result?.actions || []).map(action => ({
      ...action,
      domain: this.domain,
    }));
  }

  async getExpiringItems(entityId: string, withinDays: number): Promise<ExpiringItem[]> {
    const result = await this.fetch<{ items: ExpiringItem[] }>(
      `/entities/${entityId}/expiring?days=${withinDays}`
    );
    return (result?.items || []).map(item => ({
      ...item,
      domain: this.domain,
    }));
  }

  async getSummary(entityId: string): Promise<DomainSummary> {
    const result = await this.fetch<{
      activeCount: number;
      pendingCount: number;
      recentActivity: RecentActivity[];
      healthStatus: 'healthy' | 'warning' | 'critical';
    }>(`/entities/${entityId}/summary`);

    return {
      domain: this.domain,
      activeCount: result?.activeCount || 0,
      pendingCount: result?.pendingCount || 0,
      recentActivity: result?.recentActivity || [],
      healthStatus: result?.healthStatus || 'healthy',
    };
  }
}

// Default domain endpoints
export const DEFAULT_DOMAIN_ENDPOINTS: Record<OperationalDomain, string> = {
  'contracts-legal': 'http://localhost:3011',
  'insurance': 'http://localhost:3013',
  'intellectual-property': 'http://localhost:3014',
  'data-privacy': 'http://localhost:3012',
};

export function createDomainClients(
  endpoints: Partial<Record<OperationalDomain, string>> = {}
): Map<OperationalDomain, DomainClient> {
  const clients = new Map<OperationalDomain, DomainClient>();

  for (const domain of Object.keys(DEFAULT_DOMAIN_ENDPOINTS) as OperationalDomain[]) {
    const baseUrl = endpoints[domain] || DEFAULT_DOMAIN_ENDPOINTS[domain];
    clients.set(domain, new DomainClient(domain, { baseUrl }));
  }

  return clients;
}
