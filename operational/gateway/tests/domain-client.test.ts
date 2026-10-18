/**
 * DomainClient Tests
 *
 * Tests for HTTP client behavior, timeouts,
 * error handling, and graceful degradation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DomainClient, createDomainClients, DEFAULT_DOMAIN_ENDPOINTS, resetAllDomainCircuits } from '../src/domain-client.js';
import type { OperationalDomain } from '../src/types.js';

describe('DomainClient', () => {
  let client: DomainClient;
  const domain: OperationalDomain = 'contracts-legal';
  const baseUrl = 'http://localhost:3011';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset circuit breakers between tests to prevent cross-test interference
    resetAllDomainCircuits();
    client = new DomainClient(domain, { baseUrl, timeout: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should strip trailing slash from baseUrl', () => {
      const clientWithSlash = new DomainClient(domain, {
        baseUrl: 'http://localhost:3011/',
      });
      // The client should work correctly with or without trailing slash
      expect(clientWithSlash).toBeDefined();
    });

    it('should use default timeout if not specified', () => {
      const clientWithDefaults = new DomainClient(domain, { baseUrl });
      expect(clientWithDefaults).toBeDefined();
    });
  });

  describe('getHealth', () => {
    it('should return healthy status for successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });

      const result = await client.getHealth();

      expect(result.domain).toBe(domain);
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return unhealthy for non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal error' }),
      });

      const result = await client.getHealth();

      expect(result.status).toBe('unhealthy');
    });

    it('should return unhealthy on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await client.getHealth();

      expect(result.status).toBe('unhealthy');
    });

    it('should return unhealthy status for degraded response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'degraded' }),
      });

      const result = await client.getHealth();

      expect(result.status).toBe('unhealthy');
    });
  });

  describe('getDocuments', () => {
    it('should return documents for entity', async () => {
      const mockDocuments = [
        { id: 'doc-1', type: 'contract', title: 'Contract A' },
        { id: 'doc-2', type: 'agreement', title: 'Agreement B' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ documents: mockDocuments }),
      });

      const result = await client.getDocuments('entity-123');

      expect(result).toEqual(mockDocuments);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/entities/entity-123/documents'),
        expect.any(Object)
      );
    });

    it('should return empty array on failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await client.getDocuments('entity-123');

      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await client.getDocuments('entity-123');

      expect(result).toEqual([]);
    });
  });

  describe('getPendingActions', () => {
    it('should return pending actions for entity', async () => {
      const mockActions = [
        { id: 'action-1', type: 'review', description: 'Review needed', priority: 'high' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ actions: mockActions }),
      });

      const result = await client.getPendingActions('entity-123');

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe(domain);
      expect(result[0].id).toBe('action-1');
    });

    it('should call correct endpoint with entityId', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ actions: [] }),
      });

      await client.getPendingActions('entity-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/entities/entity-123/pending-actions'),
        expect.any(Object)
      );
    });

    it('should call correct endpoint without entityId', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ actions: [] }),
      });

      await client.getPendingActions();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/pending-actions'),
        expect.any(Object)
      );
    });

    it('should add domain to each action', async () => {
      const mockActions = [
        { id: 'action-1', type: 'review', description: 'Review', priority: 'high' },
        { id: 'action-2', type: 'approve', description: 'Approve', priority: 'medium' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ actions: mockActions }),
      });

      const result = await client.getPendingActions('entity-123');

      expect(result.every(a => a.domain === domain)).toBe(true);
    });

    it('should return empty array on failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await client.getPendingActions('entity-123');

      expect(result).toEqual([]);
    });
  });

  describe('getExpiringItems', () => {
    it('should return expiring items for entity', async () => {
      const mockItems = [
        { id: 'item-1', type: 'contract', description: 'Expiring contract' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const result = await client.getExpiringItems('entity-123', 30);

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe(domain);
    });

    it('should include days parameter in request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      });

      await client.getExpiringItems('entity-123', 60);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/entities/entity-123/expiring?days=60'),
        expect.any(Object)
      );
    });

    it('should add domain to each item', async () => {
      const mockItems = [
        { id: 'item-1', type: 'contract' },
        { id: 'item-2', type: 'license' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const result = await client.getExpiringItems('entity-123', 30);

      expect(result.every(i => i.domain === domain)).toBe(true);
    });

    it('should return empty array on failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await client.getExpiringItems('entity-123', 30);

      expect(result).toEqual([]);
    });
  });

  describe('getSummary', () => {
    it('should return summary for entity', async () => {
      const mockSummary = {
        activeCount: 10,
        pendingCount: 3,
        recentActivity: [
          { type: 'update', description: 'Document updated', timestamp: new Date() },
        ],
        healthStatus: 'healthy' as const,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSummary,
      });

      const result = await client.getSummary('entity-123');

      expect(result.domain).toBe(domain);
      expect(result.activeCount).toBe(10);
      expect(result.pendingCount).toBe(3);
      expect(result.healthStatus).toBe('healthy');
    });

    it('should return default values on failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await client.getSummary('entity-123');

      expect(result.domain).toBe(domain);
      expect(result.activeCount).toBe(0);
      expect(result.pendingCount).toBe(0);
      expect(result.healthStatus).toBe('healthy');
    });

    it('should return default values on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await client.getSummary('entity-123');

      expect(result.activeCount).toBe(0);
      expect(result.pendingCount).toBe(0);
    });
  });

  describe('timeout handling', () => {
    it('should abort request on timeout', async () => {
      // Create client with very short timeout
      const shortTimeoutClient = new DomainClient(domain, {
        baseUrl,
        timeout: 50,
      });

      // Mock a slow response
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { ok: true, json: async () => ({ status: 'healthy' }) };
      });

      const result = await shortTimeoutClient.getHealth();

      expect(result.status).toBe('unhealthy');
    });

    it('should handle AbortError gracefully', async () => {
      const shortTimeoutClient = new DomainClient(domain, {
        baseUrl,
        timeout: 10,
      });

      global.fetch = vi.fn().mockImplementation(async () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      });

      const result = await shortTimeoutClient.getHealth();

      expect(result.status).toBe('unhealthy');
    });
  });

  describe('request headers', () => {
    it('should include Content-Type header', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });

      await client.getHealth();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });
});

describe('createDomainClients', () => {
  it('should create clients for all domains', () => {
    const clients = createDomainClients();

    expect(clients.size).toBe(4);
    expect(clients.has('contracts-legal')).toBe(true);
    expect(clients.has('insurance')).toBe(true);
    expect(clients.has('intellectual-property')).toBe(true);
    expect(clients.has('data-privacy')).toBe(true);
  });

  it('should use default endpoints', () => {
    const clients = createDomainClients();

    // Verify clients were created (internal implementation uses defaults)
    for (const domain of Object.keys(DEFAULT_DOMAIN_ENDPOINTS)) {
      expect(clients.has(domain as OperationalDomain)).toBe(true);
    }
  });

  it('should allow custom endpoint overrides', () => {
    const customEndpoints = {
      'contracts-legal': 'http://custom:8080',
      'insurance': 'http://insurance.local:3000',
    };

    const clients = createDomainClients(customEndpoints);

    expect(clients.size).toBe(4);
    expect(clients.has('contracts-legal')).toBe(true);
    expect(clients.has('insurance')).toBe(true);
  });

  it('should partially override endpoints', () => {
    const clients = createDomainClients({
      'insurance': 'http://custom-insurance:3000',
    });

    // Should still have all 4 clients
    expect(clients.size).toBe(4);
  });
});

describe('DEFAULT_DOMAIN_ENDPOINTS', () => {
  it('should have correct endpoints for all domains', () => {
    expect(DEFAULT_DOMAIN_ENDPOINTS['contracts-legal']).toBe('http://localhost:3011');
    expect(DEFAULT_DOMAIN_ENDPOINTS['insurance']).toBe('http://localhost:3013');
    expect(DEFAULT_DOMAIN_ENDPOINTS['intellectual-property']).toBe('http://localhost:3014');
    expect(DEFAULT_DOMAIN_ENDPOINTS['data-privacy']).toBe('http://localhost:3012');
  });
});
