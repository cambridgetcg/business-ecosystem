/**
 * @ecosystem/compliance-aggregator
 * Cross-operational compliance status aggregation service
 */

export * from './types.js';
export { ComplianceAggregator, type ComplianceStore, type DomainComplianceClient } from './aggregator.js';

// ============================================================================
// Main Entry Point
// ============================================================================

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import pino from 'pino';
import { ComplianceAggregator, type DomainComplianceClient } from './aggregator.js';
import type { EntityComplianceOverview, ComplianceFinding, OperationalDomain } from './types.js';

const logger = pino({ name: 'compliance-service' });

// In-memory store for demo (replace with database in production)
class InMemoryComplianceStore {
  private entities = new Map<string, EntityComplianceOverview>();
  private findings = new Map<string, ComplianceFinding[]>();

  async getEntityCompliance(entityId: string) {
    return this.entities.get(entityId);
  }

  async saveEntityCompliance(overview: EntityComplianceOverview) {
    this.entities.set(overview.entityId, overview);
  }

  async getFindings(entityId: string, domain?: OperationalDomain) {
    const findings = this.findings.get(entityId) || [];
    if (domain) {
      return findings.filter(f => f.domain === domain);
    }
    return findings;
  }

  async saveFinding(finding: ComplianceFinding) {
    const existing = this.findings.get(finding.entityId) || [];
    existing.push(finding);
    this.findings.set(finding.entityId, existing);
  }

  async updateFinding(findingId: string, updates: Partial<ComplianceFinding>) {
    for (const [entityId, findings] of this.findings) {
      const finding = findings.find(f => f.id === findingId);
      if (finding) {
        Object.assign(finding, updates);
        return;
      }
    }
  }
}

// Mock domain client for domains without real compliance endpoints
class MockDomainClient {
  constructor(private domain: OperationalDomain) {}

  async getComplianceStatus(entityId: string) {
    return {
      domain: this.domain,
      status: 'compliant' as const,
      regulations: new Map(),
      openFindings: 0,
    };
  }

  async getFindings(entityId: string): Promise<ComplianceFinding[]> {
    return [];
  }
}

// Real HTTP client for domains with compliance endpoints
class HttpDomainClient {
  constructor(
    private domain: OperationalDomain,
    private baseUrl: string,
    private timeout: number = 10000
  ) {}

  async getComplianceStatus(entityId: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/compliance-status/${entityId}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        logger.warn({ domain: this.domain, entityId, status: response.status }, 'Domain compliance request failed');
        return this.fallbackStatus();
      }

      const data = await response.json() as {
        entityId: string;
        domain: string;
        status: 'compliant' | 'at_risk' | 'non_compliant';
        issues: string[];
        metrics: Record<string, number>;
      };

      // Map domain status to compliance status
      let status: 'compliant' | 'non-compliant' | 'pending' | 'not-applicable';
      if (data.status === 'compliant') {
        status = 'compliant';
      } else if (data.status === 'non_compliant') {
        status = 'non-compliant';
      } else {
        status = 'pending'; // 'at_risk' maps to 'pending'
      }

      // Build regulation status from issues
      const regulations = new Map<string, { regulation: string; status: typeof status; lastAssessment: Date; findings: string[] }>();
      if (this.domain === 'data-privacy') {
        regulations.set('GDPR', {
          regulation: 'GDPR',
          status,
          lastAssessment: new Date(),
          findings: data.issues,
        });
      }

      return {
        domain: this.domain,
        status,
        regulations,
        openFindings: data.issues.length,
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.warn({ domain: this.domain, entityId }, 'Domain compliance request timed out');
      } else {
        logger.error({ domain: this.domain, entityId, error }, 'Domain compliance request error');
      }
      return this.fallbackStatus();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private fallbackStatus() {
    return {
      domain: this.domain,
      status: 'pending' as const,
      regulations: new Map(),
      openFindings: 0,
    };
  }

  async getFindings(entityId: string): Promise<ComplianceFinding[]> {
    // TODO: Implement findings endpoint in data-privacy service
    return [];
  }
}

async function main() {
  const store = new InMemoryComplianceStore();

  // Domain service URLs from environment or defaults
  const dataPrivacyUrl = process.env.DATA_PRIVACY_URL || 'http://localhost:3012';

  const domainClients = new Map<OperationalDomain, DomainComplianceClient>([
    ['contracts-legal', new MockDomainClient('contracts-legal')],
    ['insurance', new MockDomainClient('insurance')],
    ['intellectual-property', new MockDomainClient('intellectual-property')],
    // data-privacy now uses real HTTP client
    ['data-privacy', new HttpDomainClient('data-privacy', dataPrivacyUrl)],
  ]);

  const aggregator = new ComplianceAggregator(store, domainClients, []);

  const app = new Hono();

  app.use('*', cors());
  app.use('*', honoLogger());

  // Health check
  app.get('/health', (c) => c.json({
    status: 'healthy',
    service: 'compliance-aggregator',
    timestamp: new Date().toISOString(),
  }));

  // Get entity compliance overview
  app.get('/entities/:entityId/compliance', async (c) => {
    const entityId = c.req.param('entityId');
    const overview = await aggregator.getEntityOverview(entityId);

    // Convert Map to object for JSON serialization
    const domainsObj: Record<string, unknown> = {};
    for (const [domain, status] of overview.domains) {
      const regulationsObj: Record<string, unknown> = {};
      for (const [reg, regStatus] of status.regulations) {
        regulationsObj[reg] = regStatus;
      }
      domainsObj[domain] = { ...status, regulations: regulationsObj };
    }

    return c.json({
      ...overview,
      domains: domainsObj,
    });
  });

  // Refresh entity compliance
  app.post('/entities/:entityId/compliance/refresh', async (c) => {
    const entityId = c.req.param('entityId');
    const overview = await aggregator.refreshEntityCompliance(entityId);

    const domainsObj: Record<string, unknown> = {};
    for (const [domain, status] of overview.domains) {
      domainsObj[domain] = status;
    }

    return c.json({
      ...overview,
      domains: domainsObj,
    });
  });

  // Get entity compliance dashboard
  app.get('/entities/:entityId/compliance/dashboard', async (c) => {
    const entityId = c.req.param('entityId');
    const dashboard = await aggregator.getDashboard(entityId);

    const byDomainObj: Record<string, unknown> = {};
    for (const [domain, data] of dashboard.byDomain) {
      byDomainObj[domain] = data;
    }

    const domainsObj: Record<string, unknown> = {};
    for (const [domain, status] of dashboard.overview.domains) {
      domainsObj[domain] = status;
    }

    return c.json({
      overview: { ...dashboard.overview, domains: domainsObj },
      findings: dashboard.findings,
      byDomain: byDomainObj,
      upcomingAssessments: dashboard.upcomingAssessments,
    });
  });

  // Get entity findings
  app.get('/entities/:entityId/findings', async (c) => {
    const entityId = c.req.param('entityId');
    const domain = c.req.query('domain') as OperationalDomain | undefined;
    const status = c.req.query('status') as 'open' | 'resolved' | 'all' | undefined;
    const severity = c.req.query('severity') as 'critical' | 'high' | 'medium' | 'low' | undefined;

    const findings = await aggregator.getFindings(entityId, { domain, status, severity });
    return c.json({ findings });
  });

  // Handle compliance status change event
  app.post('/events/status-change', async (c) => {
    const { entityId, domain, regulation, newStatus } = await c.req.json();
    await aggregator.handleStatusChange(entityId, domain, regulation, newStatus);
    return c.json({ success: true });
  });

  // Handle new finding event
  app.post('/events/finding', async (c) => {
    const finding = await c.req.json();
    await aggregator.handleFinding(finding);
    return c.json({ success: true });
  });

  const port = parseInt(process.env.PORT || '3021', 10);

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ port: info.port }, 'Compliance aggregator service started');
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error({ error }, 'Failed to start compliance aggregator');
    process.exit(1);
  });
}
