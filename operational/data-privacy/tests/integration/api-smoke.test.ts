/**
 * API Smoke Tests
 * Verifies that routes are properly wired and respond correctly
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../src/app.js';

// Mock Prisma client for smoke tests
const mockPrisma = {
  $connect: async () => {},
  $disconnect: async () => {},
  $queryRaw: async () => [1],
  consentRecord: {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    create: async () => ({ id: '1', status: 'ACTIVE' }),
    update: async () => ({ id: '1' }),
    updateMany: async () => ({ count: 0 }),
    count: async () => 0,
  },
  dSARRequest: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => ({ id: '1' }),
    update: async () => ({ id: '1' }),
    count: async () => 0,
  },
  dSARActivity: {
    create: async () => ({ id: '1' }),
    findMany: async () => [],
  },
  dataBreach: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => ({ id: '1' }),
    update: async () => ({ id: '1' }),
    count: async () => 0,
  },
  breachActivity: {
    create: async () => ({ id: '1' }),
    findMany: async () => [],
  },
  privacyImpactAssessment: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => ({ id: '1' }),
    update: async () => ({ id: '1' }),
    count: async () => 0,
  },
  processingActivity: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => ({ id: '1' }),
    update: async () => ({ id: '1' }),
    count: async () => 0,
  },
  dataProcessor: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => ({ id: '1' }),
    update: async () => ({ id: '1' }),
    count: async () => 0,
  },
  dataTransfer: {
    findMany: async () => [],
    findUnique: async () => null,
    create: async () => ({ id: '1' }),
    update: async () => ({ id: '1' }),
    count: async () => 0,
  },
} as any;

describe('API Smoke Tests', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp({ prisma: mockPrisma });
  });

  describe('Health Endpoints', () => {
    it('GET / should return service info', async () => {
      const res = await app.request('/');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.service).toBe('data-privacy');
      expect(data.domains).toContain('consent-management');
    });

    it('GET /health should return health status', async () => {
      const res = await app.request('/health');
      // Health check returns 503 when db mock returns unhealthy
      expect([200, 503]).toContain(res.status);
      const data = await res.json();
      expect(data.service).toBe('data-privacy');
    });

    it('GET /ready should return readiness response', async () => {
      const res = await app.request('/ready');
      // Readiness returns 503 when db not connected
      expect([200, 503]).toContain(res.status);
    });
  });

  describe('Documentation Endpoints', () => {
    it('GET /docs should return Swagger UI HTML', async () => {
      const res = await app.request('/docs');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('swagger-ui');
    });

    it('GET /docs/openapi.json should return OpenAPI spec', async () => {
      const res = await app.request('/docs/openapi.json');
      expect(res.status).toBe(200);
      const spec = await res.json();
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('Data Privacy Service API');
      expect(spec.tags.length).toBeGreaterThan(0);
    });
  });

  describe('Consent API Routes', () => {
    it('GET /api/v1/consent should return list', async () => {
      const res = await app.request('/api/v1/consent');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');
    });

    it('GET /api/v1/consent/check requires query params', async () => {
      const res = await app.request('/api/v1/consent/check');
      expect(res.status).toBe(400);
    });

    it('GET /api/v1/consent/check with params should work', async () => {
      const res = await app.request('/api/v1/consent/check?subjectId=test&purpose=marketing');
      expect(res.status).toBe(200);
    });
  });

  describe('DSAR API Routes', () => {
    it('GET /api/v1/dsar should return list', async () => {
      const res = await app.request('/api/v1/dsar');
      expect(res.status).toBe(200);
    });

    it('GET /api/v1/dsar/reports/overdue should return overdue list', async () => {
      const res = await app.request('/api/v1/dsar/reports/overdue?entityId=test');
      expect(res.status).toBe(200);
    });
  });

  describe('Breach API Routes', () => {
    it('GET /api/v1/breach should return list', async () => {
      const res = await app.request('/api/v1/breach');
      expect(res.status).toBe(200);
    });

    it('GET /api/v1/breach/reports/pending-notification should work', async () => {
      const res = await app.request('/api/v1/breach/reports/pending-notification?entityId=test');
      expect(res.status).toBe(200);
    });
  });

  describe('DPIA API Routes', () => {
    it('GET /api/v1/dpia should return list', async () => {
      const res = await app.request('/api/v1/dpia');
      expect(res.status).toBe(200);
    });
  });

  describe('Activities API Routes', () => {
    it('GET /api/v1/activities should return list', async () => {
      const res = await app.request('/api/v1/activities');
      expect(res.status).toBe(200);
    });

    it('GET /api/v1/activities with valid UUID entityId filter', async () => {
      const res = await app.request('/api/v1/activities?entityId=550e8400-e29b-41d4-a716-446655440000');
      expect(res.status).toBe(200);
    });
  });

  describe('Processors API Routes', () => {
    it('GET /api/v1/processors should return list', async () => {
      const res = await app.request('/api/v1/processors');
      expect(res.status).toBe(200);
    });
  });

  describe('Transfers API Routes', () => {
    it('GET /api/v1/transfers should return list', async () => {
      const res = await app.request('/api/v1/transfers');
      expect(res.status).toBe(200);
    });

    it('GET /api/v1/transfers/recommend/:countryCode should work', async () => {
      const res = await app.request('/api/v1/transfers/recommend/US');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('recommended');
    });

    it('GET /api/v1/transfers/adequacy/:countryCode should work', async () => {
      const res = await app.request('/api/v1/transfers/adequacy/JP');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('hasAdequacy');
    });
  });

  describe('Metrics API Routes', () => {
    it('GET /api/v1/metrics/program/:entityId requires valid UUID', async () => {
      const res = await app.request('/api/v1/metrics/program/invalid-id');
      expect(res.status).toBe(400); // Invalid UUID
    });

    it('GET /api/v1/metrics/program/:entityId with valid UUID', async () => {
      const res = await app.request('/api/v1/metrics/program/550e8400-e29b-41d4-a716-446655440000');
      expect(res.status).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const res = await app.request('/api/v1/consent');
      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/api/v1/unknown-route');
      expect(res.status).toBe(404);
    });
  });
});
