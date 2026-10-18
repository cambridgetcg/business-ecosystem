/**
 * Test Setup and Mock Utilities
 */

import { vi } from 'vitest';
import type {
  OperationalDomain,
  DomainSummary,
  PendingAction,
  ExpiringItem,
  DomainHealthResponse,
} from '../src/types.js';

// Mock domain data generators
export function createMockDomainSummary(
  domain: OperationalDomain,
  overrides: Partial<DomainSummary> = {}
): DomainSummary {
  return {
    domain,
    activeCount: 5,
    pendingCount: 2,
    recentActivity: [
      {
        type: 'update',
        description: 'Document updated',
        timestamp: new Date(),
      },
    ],
    healthStatus: 'healthy',
    ...overrides,
  };
}

export function createMockPendingAction(
  domain: OperationalDomain,
  overrides: Partial<PendingAction> = {}
): PendingAction {
  return {
    id: `action-${Date.now()}`,
    domain,
    type: 'review',
    description: 'Requires review',
    priority: 'medium',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    assignee: 'user@example.com',
    reference: `REF-${Date.now()}`,
    ...overrides,
  };
}

export function createMockExpiringItem(
  domain: OperationalDomain,
  daysUntil: number,
  overrides: Partial<ExpiringItem> = {}
): ExpiringItem {
  const expirationDate = new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000);
  return {
    id: `item-${Date.now()}`,
    domain,
    type: 'contract',
    description: 'Contract expiring soon',
    expirationDate,
    daysUntilExpiry: daysUntil,
    renewalRequired: true,
    reference: `CONTRACT-${Date.now()}`,
    ...overrides,
  };
}

export function createMockHealthResponse(
  domain: OperationalDomain,
  status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
): DomainHealthResponse {
  return {
    domain,
    status,
    timestamp: new Date(),
  };
}

// Mock DomainClient for testing
export class MockDomainClient {
  private domain: OperationalDomain;
  private shouldFail: boolean;
  private failureDelay: number;
  private mockData: {
    summary?: DomainSummary;
    pendingActions?: PendingAction[];
    expiringItems?: ExpiringItem[];
    health?: DomainHealthResponse;
  };

  constructor(domain: OperationalDomain, options: {
    shouldFail?: boolean;
    failureDelay?: number;
    mockData?: {
      summary?: DomainSummary;
      pendingActions?: PendingAction[];
      expiringItems?: ExpiringItem[];
      health?: DomainHealthResponse;
    };
  } = {}) {
    this.domain = domain;
    this.shouldFail = options.shouldFail || false;
    this.failureDelay = options.failureDelay || 0;
    this.mockData = options.mockData || {};
  }

  private async maybeDelay() {
    if (this.failureDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.failureDelay));
    }
  }

  private maybeThrow() {
    if (this.shouldFail) {
      throw new Error(`Mock failure for ${this.domain}`);
    }
  }

  async getSummary(entityId: string): Promise<DomainSummary> {
    await this.maybeDelay();
    this.maybeThrow();
    return this.mockData.summary || createMockDomainSummary(this.domain);
  }

  async getPendingActions(entityId?: string): Promise<PendingAction[]> {
    await this.maybeDelay();
    this.maybeThrow();
    return this.mockData.pendingActions || [
      createMockPendingAction(this.domain, { priority: 'high' }),
      createMockPendingAction(this.domain, { priority: 'low' }),
    ];
  }

  async getExpiringItems(entityId: string, withinDays: number): Promise<ExpiringItem[]> {
    await this.maybeDelay();
    this.maybeThrow();
    return this.mockData.expiringItems || [
      createMockExpiringItem(this.domain, 10),
      createMockExpiringItem(this.domain, 25),
    ];
  }

  async getHealth(): Promise<DomainHealthResponse> {
    await this.maybeDelay();
    this.maybeThrow();
    return this.mockData.health || createMockHealthResponse(this.domain);
  }
}

// Create a map of mock domain clients
export function createMockDomainClients(
  options: Partial<Record<OperationalDomain, {
    shouldFail?: boolean;
    failureDelay?: number;
    mockData?: any;
  }>> = {}
): Map<OperationalDomain, MockDomainClient> {
  const clients = new Map<OperationalDomain, MockDomainClient>();
  const domains: OperationalDomain[] = [
    'contracts-legal',
    'insurance',
    'intellectual-property',
    'data-privacy',
  ];

  for (const domain of domains) {
    const domainOptions = options[domain] || {};
    clients.set(domain, new MockDomainClient(domain, domainOptions));
  }

  return clients;
}

// Mock fetch for testing external compliance service
export function mockFetch(response: any, options: { ok?: boolean; status?: number; delay?: number } = {}) {
  const { ok = true, status = 200, delay = 0 } = options;

  return vi.fn().mockImplementation(async () => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return {
      ok,
      status,
      json: async () => response,
      clone: function() { return this; },
    };
  });
}

// Clear all mocks between tests
export function clearMocks() {
  vi.clearAllMocks();
  vi.restoreAllMocks();
}
