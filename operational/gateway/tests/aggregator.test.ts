/**
 * The gateway's cross-domain views, built by the real DomainClient and
 * OperationalAggregator against a stubbed fetch: no domain service runs and
 * nothing leaves the process. Each stubbed URL answers with the JSON a domain
 * (or the compliance aggregator) would send.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDomainClients, DomainClient } from '../src/domain-client.js';
import { OperationalAggregator } from '../src/aggregator.js';

type Routes = Record<string, unknown>;

// Answers each known URL with its JSON body, an Error with a rejection (an
// unreachable service), and anything else with a 404.
function stubFetch(routes: Routes): string[] {
  const requested: string[] = [];
  vi.stubGlobal('fetch', (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requested.push(url);
    if (!(url in routes)) return Promise.resolve(new Response('not found', { status: 404 }));
    const body = routes[url];
    if (body instanceof Error) return Promise.reject(body);
    return Promise.resolve(Response.json(body));
  });
  return requested;
}

const CL = 'http://contracts.test';
const INS = 'http://insurance.test';
const COMPLIANCE = 'http://compliance.test';

function gateway(): OperationalAggregator {
  return new OperationalAggregator(
    createDomainClients({
      'contracts-legal': `${CL}/`,
      insurance: INS,
      'intellectual-property': 'http://ip.test',
      'data-privacy': 'http://privacy.test',
    }),
    { baseUrl: COMPLIANCE }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DomainClient', () => {
  it('drops a trailing slash from the base URL and tags actions with its domain', async () => {
    const requested = stubFetch({
      [`${CL}/entities/e-1/pending-actions`]: {
        actions: [
          { id: 'a-1', type: 'review', description: 'NDA', priority: 'high', reference: 'c-1' },
        ],
      },
    });
    const client = new DomainClient('contracts-legal', { baseUrl: `${CL}/` });
    const actions = await client.getPendingActions('e-1');
    expect(requested).toEqual([`${CL}/entities/e-1/pending-actions`]);
    expect(actions).toEqual([expect.objectContaining({ id: 'a-1', domain: 'contracts-legal' })]);
  });

  it('reports a domain it cannot reach as unhealthy', async () => {
    stubFetch({ [`${INS}/health`]: new Error('connect ECONNREFUSED') });
    const health = await new DomainClient('insurance', { baseUrl: INS }).getHealth();
    expect(health.status).toBe('unhealthy');
    stubFetch({ [`${INS}/health`]: { status: 'healthy', service: 'insurance' } });
    expect((await new DomainClient('insurance', { baseUrl: INS }).getHealth()).status).toBe(
      'healthy'
    );
  });
});

describe('OperationalAggregator', () => {
  const due = (day: number): string => new Date(Date.UTC(2026, 10, day)).toISOString();

  it('merges pending actions across domains, high priority first, then by due date', async () => {
    stubFetch({
      [`${CL}/entities/e-1/pending-actions`]: {
        actions: [
          {
            id: 'cl-low',
            type: 't',
            description: 'd',
            priority: 'low',
            dueDate: due(1),
            reference: 'r',
          },
          {
            id: 'cl-high-late',
            type: 't',
            description: 'd',
            priority: 'high',
            dueDate: due(20),
            reference: 'r',
          },
        ],
      },
      [`${INS}/entities/e-1/pending-actions`]: {
        actions: [
          {
            id: 'ins-high-soon',
            type: 't',
            description: 'd',
            priority: 'high',
            dueDate: due(5),
            reference: 'r',
          },
          { id: 'ins-high-undated', type: 't', description: 'd', priority: 'high', reference: 'r' },
          {
            id: 'ins-medium',
            type: 't',
            description: 'd',
            priority: 'medium',
            dueDate: due(2),
            reference: 'r',
          },
        ],
      },
      // intellectual-property and data-privacy answer 404: no actions from them.
    });
    const actions = await gateway().fetchPendingActions({ entityId: 'e-1' });
    expect(actions.map((a) => a.id)).toEqual([
      'ins-high-soon',
      'cl-high-late',
      'ins-high-undated',
      'ins-medium',
      'cl-low',
    ]);
    expect(actions.find((a) => a.id === 'cl-low')?.domain).toBe('contracts-legal');

    const high = await gateway().fetchPendingActions({
      entityId: 'e-1',
      priority: 'high',
      limit: 2,
      offset: 1,
    });
    expect(high.map((a) => a.id)).toEqual(['cl-high-late', 'ins-high-undated']);
  });

  it('orders expiring items soonest first and can keep only renewals', async () => {
    const inDays = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();
    stubFetch({
      [`${CL}/entities/e-1/expiring?days=90`]: {
        items: [
          {
            id: 'lease',
            type: 'contract',
            description: 'd',
            expirationDate: inDays(60),
            renewalRequired: true,
            reference: 'r',
          },
        ],
      },
      [`${INS}/entities/e-1/expiring?days=90`]: {
        items: [
          {
            id: 'policy',
            type: 'policy',
            description: 'd',
            expirationDate: inDays(10),
            renewalRequired: true,
            reference: 'r',
          },
          {
            id: 'quote',
            type: 'quote',
            description: 'd',
            expirationDate: inDays(3),
            renewalRequired: false,
            reference: 'r',
          },
        ],
      },
    });
    const items = await gateway().fetchExpiringItems({ entityId: 'e-1', withinDays: 90 });
    expect(items.map((i) => [i.id, i.daysUntilExpiry])).toEqual([
      ['quote', 3],
      ['policy', 10],
      ['lease', 60],
    ]);
    const renewals = await gateway().fetchExpiringItems({
      entityId: 'e-1',
      withinDays: 90,
      renewalRequiredOnly: true,
    });
    expect(renewals.map((i) => i.id)).toEqual(['policy', 'lease']);
  });

  it("reads each domain's status from the compliance aggregator's overview", async () => {
    // The body of the aggregator's GET /entities/:entityId/compliance
    // (operational/.orchestration/compliance/src/index.ts): each domain is its
    // DomainComplianceStatus, whose status is a plain string.
    stubFetch({
      [`${COMPLIANCE}/entities/e-1/compliance`]: {
        entityId: 'e-1',
        overallStatus: 'non-compliant',
        domains: {
          'data-privacy': {
            domain: 'data-privacy',
            status: 'non-compliant',
            regulations: {},
            openFindings: 2,
          },
          insurance: { domain: 'insurance', status: 'compliant', regulations: {}, openFindings: 0 },
        },
        totalFindings: 2,
        criticalFindings: 1,
        lastUpdated: '2026-10-19T00:00:00.000Z',
      },
    });
    const overview = await gateway().getEntityOverview({
      entityId: 'e-1',
      includePendingActions: false,
      includeExpiringItems: false,
    });
    expect(overview.complianceStatus).toEqual({
      overallStatus: 'non-compliant',
      domainStatuses: {
        'data-privacy': { status: 'non-compliant', openFindings: 2, criticalFindings: 0 },
        insurance: { status: 'compliant', openFindings: 0, criticalFindings: 0 },
      },
      totalFindings: 2,
      criticalFindings: 1,
    });
  });

  it('falls back to a pending compliance overview when the aggregator is down', async () => {
    stubFetch({ [`${COMPLIANCE}/entities/e-1/compliance`]: new Error('connect ECONNREFUSED') });
    const overview = await gateway().getEntityOverview({
      entityId: 'e-1',
      includePendingActions: false,
      includeExpiringItems: false,
    });
    expect(overview.complianceStatus).toEqual({
      overallStatus: 'pending',
      domainStatuses: {},
      totalFindings: 0,
      criticalFindings: 0,
    });
    // Every domain is still summarised, from defaults, when none answers.
    expect(Object.keys(overview.domains).sort()).toEqual([
      'contracts-legal',
      'data-privacy',
      'insurance',
      'intellectual-property',
    ]);
  });
});
