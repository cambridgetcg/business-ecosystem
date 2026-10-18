/**
 * OperationalAggregator Tests
 *
 * Tests for the aggregator's parallel fetching, partial failures,
 * and data aggregation logic.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OperationalAggregator } from '../src/aggregator.js';
import {
  createMockDomainClients,
  createMockDomainSummary,
  createMockPendingAction,
  createMockExpiringItem,
  mockFetch,
  clearMocks,
  MockDomainClient,
} from './setup.js';
import type { OperationalDomain } from '../src/types.js';

describe('OperationalAggregator', () => {
  let aggregator: OperationalAggregator;
  let mockClients: Map<OperationalDomain, MockDomainClient>;

  beforeEach(() => {
    clearMocks();
    mockClients = createMockDomainClients();
    aggregator = new OperationalAggregator(
      mockClients as any,
      { baseUrl: 'http://localhost:3021', timeout: 5000 }
    );
  });

  afterEach(() => {
    clearMocks();
  });

  describe('getEntityOverview', () => {
    it('should fetch data from all domains in parallel', async () => {
      const entityId = 'entity-123';

      // Mock compliance service
      const originalFetch = global.fetch;
      global.fetch = mockFetch({
        overallStatus: 'compliant',
        domains: {},
        totalFindings: 0,
        criticalFindings: 0,
      });

      const result = await aggregator.getEntityOverview({ entityId });

      expect(result.entityId).toBe(entityId);
      expect(Object.keys(result.domains)).toHaveLength(4);
      expect(result.domains['contracts-legal']).toBeDefined();
      expect(result.domains['insurance']).toBeDefined();
      expect(result.domains['intellectual-property']).toBeDefined();
      expect(result.domains['data-privacy']).toBeDefined();
      expect(result.pendingActions.length).toBeGreaterThan(0);
      expect(result.expiringItems.length).toBeGreaterThan(0);
      expect(result.complianceStatus.overallStatus).toBe('compliant');
      expect(result.lastUpdated).toBeInstanceOf(Date);

      global.fetch = originalFetch;
    });

    it('should filter by specific domains when requested', async () => {
      const entityId = 'entity-123';
      const includeDomains: OperationalDomain[] = ['contracts-legal', 'insurance'];

      const originalFetch = global.fetch;
      global.fetch = mockFetch({
        overallStatus: 'compliant',
        domains: {},
        totalFindings: 0,
        criticalFindings: 0,
      });

      const result = await aggregator.getEntityOverview({
        entityId,
        includeDomains,
      });

      expect(Object.keys(result.domains)).toHaveLength(2);
      expect(result.domains['contracts-legal']).toBeDefined();
      expect(result.domains['insurance']).toBeDefined();
      expect(result.domains['intellectual-property']).toBeUndefined();
      expect(result.domains['data-privacy']).toBeUndefined();

      global.fetch = originalFetch;
    });

    it('should handle optional flags correctly', async () => {
      const entityId = 'entity-123';

      const originalFetch = global.fetch;
      global.fetch = mockFetch({});

      const result = await aggregator.getEntityOverview({
        entityId,
        includeCompliance: false,
        includePendingActions: false,
        includeExpiringItems: false,
      });

      expect(result.pendingActions).toEqual([]);
      expect(result.expiringItems).toEqual([]);
      expect(result.complianceStatus.overallStatus).toBe('pending');

      global.fetch = originalFetch;
    });

    it('should handle partial domain failures gracefully', async () => {
      // Create clients where some fail
      mockClients = createMockDomainClients({
        'contracts-legal': { shouldFail: true },
        'insurance': { shouldFail: true },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const originalFetch = global.fetch;
      global.fetch = mockFetch({
        overallStatus: 'compliant',
        domains: {},
        totalFindings: 0,
        criticalFindings: 0,
      });

      const result = await aggregator.getEntityOverview({ entityId: 'entity-123' });

      // Should still return results for successful domains
      expect(result.domains['intellectual-property']).toBeDefined();
      expect(result.domains['data-privacy']).toBeDefined();

      // Failed domains should have critical status
      expect(result.domains['contracts-legal']?.healthStatus).toBe('critical');
      expect(result.domains['insurance']?.healthStatus).toBe('critical');

      global.fetch = originalFetch;
    });
  });

  describe('fetchPendingActions', () => {
    it('should aggregate pending actions from all domains', async () => {
      const result = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
      });

      // Each domain returns 2 actions by default
      expect(result.length).toBe(8);
    });

    it('should filter by priority', async () => {
      const result = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
        priority: 'high',
      });

      expect(result.every(a => a.priority === 'high')).toBe(true);
    });

    it('should filter by assignee', async () => {
      const testAssignee = 'test@example.com';

      // Create mock with specific assignee
      mockClients = createMockDomainClients({
        'contracts-legal': {
          mockData: {
            pendingActions: [
              createMockPendingAction('contracts-legal', { assignee: testAssignee }),
              createMockPendingAction('contracts-legal', { assignee: 'other@example.com' }),
            ],
          },
        },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const result = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
        assignee: testAssignee,
      });

      expect(result.every(a => a.assignee === testAssignee)).toBe(true);
    });

    it('should filter by due date', async () => {
      const dueBefore = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      mockClients = createMockDomainClients({
        'contracts-legal': {
          mockData: {
            pendingActions: [
              createMockPendingAction('contracts-legal', {
                dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
              }),
              createMockPendingAction('contracts-legal', {
                dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
              }),
            ],
          },
        },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const result = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
        domains: ['contracts-legal'],
        dueBefore,
      });

      expect(result.length).toBe(1);
      expect(result[0].dueDate).toBeDefined();
      expect(new Date(result[0].dueDate!).getTime()).toBeLessThanOrEqual(dueBefore.getTime());
    });

    it('should sort by priority then due date', async () => {
      mockClients = createMockDomainClients({
        'contracts-legal': {
          mockData: {
            pendingActions: [
              createMockPendingAction('contracts-legal', {
                priority: 'low',
                dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
              }),
              createMockPendingAction('contracts-legal', {
                priority: 'high',
                dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              }),
              createMockPendingAction('contracts-legal', {
                priority: 'high',
                dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
              }),
            ],
          },
        },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const result = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
        domains: ['contracts-legal'],
      });

      expect(result[0].priority).toBe('high');
      expect(result[1].priority).toBe('high');
      expect(result[2].priority).toBe('low');
      // Within high priority, earlier due date comes first
      expect(new Date(result[0].dueDate!).getTime()).toBeLessThan(
        new Date(result[1].dueDate!).getTime()
      );
    });

    it('should apply pagination correctly', async () => {
      const allResults = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
      });

      const page1 = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
        limit: 3,
        offset: 0,
      });

      const page2 = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
        limit: 3,
        offset: 3,
      });

      expect(page1.length).toBe(3);
      expect(page2.length).toBe(3);
      // Pages should have different items
      const page1Ids = page1.map(a => a.id);
      const page2Ids = page2.map(a => a.id);
      expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false);
    });

    it('should return empty array on domain failures', async () => {
      mockClients = createMockDomainClients({
        'contracts-legal': { shouldFail: true },
        'insurance': { shouldFail: true },
        'intellectual-property': { shouldFail: true },
        'data-privacy': { shouldFail: true },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const result = await aggregator.fetchPendingActions({
        entityId: 'entity-123',
      });

      expect(result).toEqual([]);
    });
  });

  describe('fetchExpiringItems', () => {
    it('should aggregate expiring items from all domains', async () => {
      const result = await aggregator.fetchExpiringItems({
        entityId: 'entity-123',
        withinDays: 30,
      });

      expect(result.length).toBe(8); // 2 per domain
    });

    it('should filter by renewal required only', async () => {
      mockClients = createMockDomainClients({
        'contracts-legal': {
          mockData: {
            expiringItems: [
              createMockExpiringItem('contracts-legal', 10, { renewalRequired: true }),
              createMockExpiringItem('contracts-legal', 15, { renewalRequired: false }),
            ],
          },
        },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const result = await aggregator.fetchExpiringItems({
        entityId: 'entity-123',
        domains: ['contracts-legal'],
        withinDays: 30,
        renewalRequiredOnly: true,
      });

      expect(result.every(i => i.renewalRequired)).toBe(true);
    });

    it('should sort by expiration date (soonest first)', async () => {
      mockClients = createMockDomainClients({
        'contracts-legal': {
          mockData: {
            expiringItems: [
              createMockExpiringItem('contracts-legal', 20),
              createMockExpiringItem('contracts-legal', 5),
              createMockExpiringItem('contracts-legal', 15),
            ],
          },
        },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const result = await aggregator.fetchExpiringItems({
        entityId: 'entity-123',
        domains: ['contracts-legal'],
        withinDays: 30,
      });

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].daysUntilExpiry).toBeLessThanOrEqual(result[i + 1].daysUntilExpiry);
      }
    });

    it('should calculate days until expiry correctly', async () => {
      const now = new Date();
      const expirationDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      mockClients = createMockDomainClients({
        'contracts-legal': {
          mockData: {
            expiringItems: [
              {
                id: 'item-1',
                domain: 'contracts-legal',
                type: 'contract',
                description: 'Test contract',
                expirationDate,
                daysUntilExpiry: 0, // Will be recalculated
                renewalRequired: true,
                reference: 'CONTRACT-1',
              },
            ],
          },
        },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const result = await aggregator.fetchExpiringItems({
        entityId: 'entity-123',
        domains: ['contracts-legal'],
        withinDays: 30,
      });

      expect(result[0].daysUntilExpiry).toBeCloseTo(10, 0);
    });

    it('should apply pagination correctly', async () => {
      const page1 = await aggregator.fetchExpiringItems({
        entityId: 'entity-123',
        withinDays: 30,
        limit: 2,
        offset: 0,
      });

      const page2 = await aggregator.fetchExpiringItems({
        entityId: 'entity-123',
        withinDays: 30,
        limit: 2,
        offset: 2,
      });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
    });
  });

  describe('getDomainsHealth', () => {
    it('should return health status for all domains', async () => {
      const result = await aggregator.getDomainsHealth();

      expect(result.size).toBe(4);
      expect(result.get('contracts-legal')?.status).toBe('healthy');
      expect(result.get('insurance')?.status).toBe('healthy');
      expect(result.get('intellectual-property')?.status).toBe('healthy');
      expect(result.get('data-privacy')?.status).toBe('healthy');
    });

    it('should handle unhealthy domains', async () => {
      mockClients = createMockDomainClients({
        'insurance': { shouldFail: true },
      });
      aggregator = new OperationalAggregator(mockClients as any);

      const result = await aggregator.getDomainsHealth();

      expect(result.get('contracts-legal')?.status).toBe('healthy');
      // When domain client fails, it should still be in the map
      // but with the error handled
    });
  });

  describe('compliance service integration', () => {
    it('should fetch compliance data from external service', async () => {
      const originalFetch = global.fetch;
      global.fetch = mockFetch({
        overallStatus: 'non-compliant',
        domains: {
          'contracts-legal': { status: { status: 'compliant' }, openFindings: 2 },
          'insurance': { status: { status: 'non-compliant' }, openFindings: 5 },
        },
        totalFindings: 7,
        criticalFindings: 2,
      });

      const result = await aggregator.getEntityOverview({ entityId: 'entity-123' });

      expect(result.complianceStatus.overallStatus).toBe('non-compliant');
      expect(result.complianceStatus.totalFindings).toBe(7);
      expect(result.complianceStatus.criticalFindings).toBe(2);

      global.fetch = originalFetch;
    });

    it('should handle compliance service failure gracefully', async () => {
      const originalFetch = global.fetch;
      global.fetch = mockFetch({}, { ok: false, status: 500 });

      const result = await aggregator.getEntityOverview({ entityId: 'entity-123' });

      expect(result.complianceStatus.overallStatus).toBe('pending');
      expect(result.complianceStatus.totalFindings).toBe(0);

      global.fetch = originalFetch;
    });

    it('should handle compliance service timeout', async () => {
      const originalFetch = global.fetch;

      // Create aggregator with very short timeout
      aggregator = new OperationalAggregator(
        mockClients as any,
        { baseUrl: 'http://localhost:3021', timeout: 100 }
      );

      // Mock that takes longer than timeout
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { ok: true, json: async () => ({}) };
      });

      const result = await aggregator.getEntityOverview({ entityId: 'entity-123' });

      // Should return default compliance on timeout
      expect(result.complianceStatus.overallStatus).toBe('pending');

      global.fetch = originalFetch;
    });
  });
});
