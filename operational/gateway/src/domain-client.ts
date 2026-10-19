/**
 * Domain Clients
 * HTTP clients for operational domain services
 */

import { pino } from 'pino';
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
}

export class DomainClient {
  private baseUrl: string;
  private timeout: number;
  private domain: OperationalDomain;

  constructor(domain: OperationalDomain, config: DomainClientConfig) {
    this.domain = domain;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 10000;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T | null> {
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
        return null;
      }

      return await response.json() as T;
    } catch (error) {
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
  endpoints: Partial<Record<OperationalDomain, string | undefined>> = {}
): Map<OperationalDomain, DomainClient> {
  const clients = new Map<OperationalDomain, DomainClient>();

  for (const domain of Object.keys(DEFAULT_DOMAIN_ENDPOINTS) as OperationalDomain[]) {
    const baseUrl = endpoints[domain] || DEFAULT_DOMAIN_ENDPOINTS[domain];
    clients.set(domain, new DomainClient(domain, { baseUrl }));
  }

  return clients;
}
