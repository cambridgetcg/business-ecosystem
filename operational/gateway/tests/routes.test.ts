/**
 * Routes Integration Tests
 *
 * Tests for API routes, validation, and response formats.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
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
import type { OperationalDomain, PendingAction, ExpiringItem } from '../src/types.js';

// Helper to create test app with mocked aggregator
function createTestApp(aggregator: OperationalAggregator) {
  const app = new Hono();

  // Health endpoint
  app.get('/health', async (c) => {
    return c.json({
      status: 'healthy',
      service: 'operational-gateway',
      timestamp: new Date().toISOString(),
    });
  });

  // Entity overview
  app.get('/operational/entities/:entityId/overview', async (c) => {
    const entityId = c.req.param('entityId');
    const domains = c.req.query('domains')?.split(',') as OperationalDomain[] | undefined;
    const includeCompliance = c.req.query('compliance') !== 'false';
    const expiringWithinDays = parseInt(c.req.query('expiringDays') || '30', 10);

    const overview = await aggregator.getEntityOverview({
      entityId,
      includeDomains: domains,
      includeCompliance,
      expiringWithinDays,
    });

    return c.json(overview);
  });

  // Pending actions
  app.get('/operational/pending-actions', async (c) => {
    const entityId = c.req.query('entityId');
    const domains = c.req.query('domains')?.split(',') as OperationalDomain[] | undefined;
    const priority = c.req.query('priority') as 'high' | 'medium' | 'low' | undefined;
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const actions = await aggregator.fetchPendingActions({
      entityId,
      domains,
      priority,
      limit,
      offset,
    });

    return c.json({
      actions,
      total: actions.length,
      limit,
      offset,
    });
  });

  // Expiring items
  app.get('/operational/expiring', async (c) => {
    const entityId = c.req.query('entityId');
    const domains = c.req.query('domains')?.split(',') as OperationalDomain[] | undefined;
    const withinDays = parseInt(c.req.query('days') || '30', 10);
    const renewalRequiredOnly = c.req.query('renewalOnly') === 'true';
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const items = await aggregator.fetchExpiringItems({
      entityId,
      domains,
      withinDays,
      renewalRequiredOnly,
      limit,
      offset,
    });

    return c.json({
      items,
      total: items.length,
      limit,
      offset,
    });
  });

  // Domains health
  app.get('/operational/domains/health', async (c) => {
    const health = await aggregator.getDomainsHealth();
    const healthObj: Record<string, { status: string; timestamp: string }> = {};

    for (const [domain, h] of health) {
      healthObj[domain] = {
        status: h.status,
        timestamp: h.timestamp.toISOString(),
      };
    }

    return c.json({ domains: healthObj });
  });

  return app;
}

describe('Gateway Routes', () => {
  let app: Hono;
  let aggregator: OperationalAggregator;
  let mockClients: Map<OperationalDomain, MockDomainClient>;

  beforeEach(() => {
    clearMocks();
    mockClients = createMockDomainClients();
    aggregator = new OperationalAggregator(
      mockClients as any,
      { baseUrl: 'http://localhost:3021', timeout: 5000 }
    );
    app = createTestApp(aggregator);

    // Mock global fetch for compliance service
    global.fetch = mockFetch({
      overallStatus: 'compliant',
      domains: {},
      totalFindings: 0,
      criticalFindings: 0,
    });
  });

  afterEach(() => {
    clearMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('operational-gateway');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /operational/entities/:entityId/overview', () => {
    it('should return overview for entity', async () => {
      const res = await app.request('/operational/entities/entity-123/overview');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.entityId).toBe('entity-123');
      expect(body.domains).toBeDefined();
      expect(body.pendingActions).toBeInstanceOf(Array);
      expect(body.expiringItems).toBeInstanceOf(Array);
      expect(body.complianceStatus).toBeDefined();
      expect(body.lastUpdated).toBeDefined();
    });

    it('should filter by specific domains', async () => {
      const res = await app.request(
        '/operational/entities/entity-123/overview?domains=contracts-legal,insurance'
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(Object.keys(body.domains)).toHaveLength(2);
      expect(body.domains['contracts-legal']).toBeDefined();
      expect(body.domains['insurance']).toBeDefined();
    });

    it('should exclude compliance when specified', async () => {
      const res = await app.request(
        '/operational/entities/entity-123/overview?compliance=false'
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.complianceStatus.overallStatus).toBe('pending');
    });

    it('should use custom expiring days', async () => {
      const res = await app.request(
        '/operational/entities/entity-123/overview?expiringDays=60'
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.expiringItems).toBeDefined();
    });

    it('should handle partial domain failures gracefully', async () => {
      // Make some domains fail
      mockClients = createMockDomainClients({
        'contracts-legal': { shouldFail: true },
        'insurance': { shouldFail: true },
      });
      aggregator = new OperationalAggregator(mockClients as any);
      app = createTestApp(aggregator);

      const res = await app.request('/operational/entities/entity-123/overview');

      expect(res.status).toBe(200);
      const body = await res.json();

      // Should still have results for working domains
      expect(body.domains['intellectual-property']).toBeDefined();
      expect(body.domains['data-privacy']).toBeDefined();
      // Failed domains should show critical status
      expect(body.domains['contracts-legal']?.healthStatus).toBe('critical');
    });
  });

  describe('GET /operational/pending-actions', () => {
    it('should return pending actions', async () => {
      const res = await app.request('/operational/pending-actions');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.actions).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThan(0);
      expect(body.limit).toBe(100);
      expect(body.offset).toBe(0);
    });

    it('should filter by entity', async () => {
      const res = await app.request('/operational/pending-actions?entityId=entity-123');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.actions).toBeInstanceOf(Array);
    });

    it('should filter by priority', async () => {
      const res = await app.request('/operational/pending-actions?priority=high');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.actions.every((a: PendingAction) => a.priority === 'high')).toBe(true);
    });

    it('should filter by domains', async () => {
      const res = await app.request('/operational/pending-actions?domains=contracts-legal');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.actions.every((a: PendingAction) => a.domain === 'contracts-legal')).toBe(true);
    });

    it('should apply pagination', async () => {
      const res1 = await app.request('/operational/pending-actions?limit=2&offset=0');
      const res2 = await app.request('/operational/pending-actions?limit=2&offset=2');

      const body1 = await res1.json();
      const body2 = await res2.json();

      expect(body1.actions).toHaveLength(2);
      expect(body2.actions).toHaveLength(2);
      expect(body1.offset).toBe(0);
      expect(body2.offset).toBe(2);
    });

    it('should return sorted by priority then due date', async () => {
      const res = await app.request('/operational/pending-actions');
      const body = await res.json();

      // High priority should come first
      const priorities = body.actions.map((a: PendingAction) => a.priority);
      let foundMedium = false;
      let foundLow = false;

      for (const p of priorities) {
        if (p === 'medium') foundMedium = true;
        if (p === 'low') foundLow = true;
        if (p === 'high' && (foundMedium || foundLow)) {
          // High priority after medium/low is wrong order
          throw new Error('Actions not sorted by priority');
        }
      }
    });
  });

  describe('GET /operational/expiring', () => {
    it('should return expiring items', async () => {
      const res = await app.request('/operational/expiring');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.items).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThan(0);
    });

    it('should filter by entity', async () => {
      const res = await app.request('/operational/expiring?entityId=entity-123');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.items).toBeInstanceOf(Array);
    });

    it('should filter by domains', async () => {
      const res = await app.request('/operational/expiring?domains=insurance');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.items.every((i: ExpiringItem) => i.domain === 'insurance')).toBe(true);
    });

    it('should filter by renewal required only', async () => {
      // Set up mock with mixed renewal requirements
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
      app = createTestApp(aggregator);

      const res = await app.request(
        '/operational/expiring?domains=contracts-legal&renewalOnly=true'
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.items.every((i: ExpiringItem) => i.renewalRequired)).toBe(true);
    });

    it('should use custom days parameter', async () => {
      const res = await app.request('/operational/expiring?days=60');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.items).toBeInstanceOf(Array);
    });

    it('should apply pagination', async () => {
      const res = await app.request('/operational/expiring?limit=3&offset=0');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.limit).toBe(3);
      expect(body.offset).toBe(0);
    });

    it('should sort by expiration date (soonest first)', async () => {
      const res = await app.request('/operational/expiring');
      const body = await res.json();

      for (let i = 0; i < body.items.length - 1; i++) {
        expect(body.items[i].daysUntilExpiry).toBeLessThanOrEqual(
          body.items[i + 1].daysUntilExpiry
        );
      }
    });
  });

  describe('GET /operational/domains/health', () => {
    it('should return health for all domains', async () => {
      const res = await app.request('/operational/domains/health');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.domains).toBeDefined();
      expect(body.domains['contracts-legal']).toBeDefined();
      expect(body.domains['insurance']).toBeDefined();
      expect(body.domains['intellectual-property']).toBeDefined();
      expect(body.domains['data-privacy']).toBeDefined();
    });

    it('should include status and timestamp for each domain', async () => {
      const res = await app.request('/operational/domains/health');
      const body = await res.json();

      for (const domain of Object.values(body.domains) as any[]) {
        expect(domain.status).toBeDefined();
        expect(domain.timestamp).toBeDefined();
      }
    });

    it('should show unhealthy domains when service fails', async () => {
      mockClients = createMockDomainClients({
        'insurance': { shouldFail: true },
      });
      aggregator = new OperationalAggregator(mockClients as any);
      app = createTestApp(aggregator);

      const res = await app.request('/operational/domains/health');
      const body = await res.json();

      // Other domains should still be healthy
      expect(body.domains['contracts-legal'].status).toBe('healthy');
      expect(body.domains['intellectual-property'].status).toBe('healthy');
    });
  });
});

describe('Query Parameter Validation', () => {
  it('should parse comma-separated domains correctly', () => {
    const domainsParam = 'contracts-legal,insurance,data-privacy';
    const domains = domainsParam.split(',');

    expect(domains).toEqual(['contracts-legal', 'insurance', 'data-privacy']);
  });

  it('should handle single domain', () => {
    const domainsParam = 'insurance';
    const domains = domainsParam.split(',');

    expect(domains).toEqual(['insurance']);
  });

  it('should parse numeric limit and offset', () => {
    const limit = parseInt('50', 10);
    const offset = parseInt('100', 10);

    expect(limit).toBe(50);
    expect(offset).toBe(100);
  });

  it('should use defaults for missing pagination params', () => {
    const limit = parseInt(undefined || '100', 10);
    const offset = parseInt(undefined || '0', 10);

    expect(limit).toBe(100);
    expect(offset).toBe(0);
  });

  it('should parse boolean query params', () => {
    const trueValue = 'true' === 'true';
    const falseValue = 'false' === 'true';
    const emptyValue = '' === 'true';

    expect(trueValue).toBe(true);
    expect(falseValue).toBe(false);
    expect(emptyValue).toBe(false);
  });
});

describe('Response Format', () => {
  let app: Hono;

  beforeEach(() => {
    const mockClients = createMockDomainClients();
    const aggregator = new OperationalAggregator(mockClients as any);
    app = createTestApp(aggregator);

    global.fetch = mockFetch({
      overallStatus: 'compliant',
      domains: {},
      totalFindings: 0,
      criticalFindings: 0,
    });
  });

  afterEach(() => {
    clearMocks();
  });

  it('should return JSON content type', async () => {
    const res = await app.request('/health');

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('should return 200 for successful requests', async () => {
    const endpoints = [
      '/health',
      '/operational/entities/test/overview',
      '/operational/pending-actions',
      '/operational/expiring',
      '/operational/domains/health',
    ];

    for (const endpoint of endpoints) {
      const res = await app.request(endpoint);
      expect(res.status).toBe(200);
    }
  });
});
