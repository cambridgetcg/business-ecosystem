/**
 * The aggregator's roll-up rules, with an in-memory store and stub domain
 * clients: how domain statuses combine into the entity's status, which
 * findings count as open, and how a status-change event is folded in. No
 * network: the HTTP domain client in src/index.ts is not used here.
 */
import { describe, expect, it } from 'vitest';
import {
  ComplianceAggregator,
  type ComplianceStore,
  type DomainComplianceClient,
} from '../src/aggregator.js';
import type {
  ComplianceFinding,
  ComplianceStatus,
  DomainComplianceStatus,
  EntityComplianceOverview,
  OperationalDomain,
  RegulationStatus,
} from '../src/types.js';

const ENTITY = 'entity-1';

class MemoryStore implements ComplianceStore {
  overviews = new Map<string, EntityComplianceOverview>();
  findings: ComplianceFinding[] = [];

  getEntityCompliance(entityId: string): Promise<EntityComplianceOverview | undefined> {
    return Promise.resolve(this.overviews.get(entityId));
  }
  saveEntityCompliance(overview: EntityComplianceOverview): Promise<void> {
    this.overviews.set(overview.entityId, overview);
    return Promise.resolve();
  }
  getFindings(entityId: string, domain?: OperationalDomain): Promise<ComplianceFinding[]> {
    return Promise.resolve(
      this.findings.filter((f) => f.entityId === entityId && (!domain || f.domain === domain))
    );
  }
  saveFinding(finding: ComplianceFinding): Promise<void> {
    this.findings.push(finding);
    return Promise.resolve();
  }
  updateFinding(): Promise<void> {
    return Promise.resolve();
  }
}

function client(
  domain: OperationalDomain,
  status: ComplianceStatus,
  options: {
    findings?: ComplianceFinding[];
    regulations?: RegulationStatus[];
    openFindings?: number;
  } = {}
): DomainComplianceClient {
  return {
    getComplianceStatus: (): Promise<DomainComplianceStatus> =>
      Promise.resolve({
        domain,
        status,
        regulations: new Map((options.regulations ?? []).map((r) => [r.regulation, r])),
        openFindings: options.openFindings ?? 0,
      }),
    getFindings: () => Promise.resolve(options.findings ?? []),
  };
}

function unreachable(): DomainComplianceClient {
  return {
    getComplianceStatus: () => Promise.reject(new Error('connect ECONNREFUSED')),
    getFindings: () => Promise.reject(new Error('connect ECONNREFUSED')),
  };
}

function finding(
  id: string,
  domain: OperationalDomain,
  severity: ComplianceFinding['severity'],
  status: ComplianceFinding['status']
): ComplianceFinding {
  return {
    id,
    entityId: ENTITY,
    domain,
    regulation: 'GDPR',
    requirement: 'Art. 33',
    severity,
    description: id,
    discoveredAt: new Date('2026-10-01T00:00:00Z'),
    status,
  };
}

function aggregator(
  clients: [OperationalDomain, DomainComplianceClient][],
  store = new MemoryStore()
): { aggregator: ComplianceAggregator; store: MemoryStore } {
  return { aggregator: new ComplianceAggregator(store, new Map(clients), []), store };
}

describe('ComplianceAggregator roll-up', () => {
  it('is compliant only when every applicable domain is compliant', async () => {
    const { aggregator: agg } = aggregator([
      ['contracts-legal', client('contracts-legal', 'compliant')],
      ['insurance', client('insurance', 'not-applicable')],
    ]);
    const overview = await agg.refreshEntityCompliance(ENTITY);
    expect(overview.overallStatus).toBe('compliant');
    expect(overview.domains.get('insurance')?.status).toBe('not-applicable');
  });

  it('is non-compliant when any domain is, even if another is pending', async () => {
    const { aggregator: agg } = aggregator([
      ['contracts-legal', client('contracts-legal', 'pending')],
      ['insurance', client('insurance', 'non-compliant')],
      ['data-privacy', client('data-privacy', 'compliant')],
    ]);
    expect((await agg.refreshEntityCompliance(ENTITY)).overallStatus).toBe('non-compliant');
  });

  it('records a domain it cannot reach as pending, never as compliant', async () => {
    const { aggregator: agg } = aggregator([
      ['contracts-legal', client('contracts-legal', 'compliant')],
      ['data-privacy', unreachable()],
    ]);
    const overview = await agg.refreshEntityCompliance(ENTITY);
    expect(overview.domains.get('data-privacy')).toMatchObject({
      status: 'pending',
      openFindings: 0,
    });
    expect(overview.overallStatus).toBe('pending');
  });

  it('counts open and in-progress findings, and critical ones among them', async () => {
    const { aggregator: agg } = aggregator([
      [
        'contracts-legal',
        client('contracts-legal', 'non-compliant', {
          findings: [
            finding('f-open-critical', 'contracts-legal', 'critical', 'open'),
            finding('f-progress-high', 'contracts-legal', 'high', 'in-progress'),
            finding('f-resolved-critical', 'contracts-legal', 'critical', 'resolved'),
            finding('f-accepted-low', 'contracts-legal', 'low', 'accepted'),
          ],
        }),
      ],
    ]);
    const overview = await agg.refreshEntityCompliance(ENTITY);
    expect(overview.domains.get('contracts-legal')?.openFindings).toBe(2);
    expect(overview.totalFindings).toBe(2);
    expect(overview.criticalFindings).toBe(1);
  });

  it('counts the issues a domain reports only as text', async () => {
    // data-privacy's compliance-status endpoint reports issues as strings; the
    // HTTP client puts them on the GDPR regulation and sends no findings.
    const gdpr: RegulationStatus = {
      regulation: 'GDPR',
      status: 'non-compliant',
      findings: [],
      issues: ['1 breach(es) pending authority notification', '2 unresolved breach(es)'],
    };
    const { aggregator: agg } = aggregator([
      [
        'data-privacy',
        client('data-privacy', 'non-compliant', { regulations: [gdpr], openFindings: 2 }),
      ],
    ]);
    const overview = await agg.refreshEntityCompliance(ENTITY);
    expect(overview.domains.get('data-privacy')?.openFindings).toBe(2);
    expect(overview.totalFindings).toBe(2);
    expect(overview.criticalFindings).toBe(0);
  });

  it('serves the stored overview until it is refreshed', async () => {
    let status: ComplianceStatus = 'compliant';
    const changing: DomainComplianceClient = {
      getComplianceStatus: () =>
        Promise.resolve({ domain: 'insurance', status, regulations: new Map(), openFindings: 0 }),
      getFindings: () => Promise.resolve([]),
    };
    const { aggregator: agg } = aggregator([['insurance', changing]]);
    expect((await agg.getEntityOverview(ENTITY)).overallStatus).toBe('compliant');
    status = 'non-compliant';
    expect((await agg.getEntityOverview(ENTITY)).overallStatus).toBe('compliant');
    expect((await agg.refreshEntityCompliance(ENTITY)).overallStatus).toBe('non-compliant');
  });
});

describe('ComplianceAggregator events and queries', () => {
  it('folds a status change into the domain and the entity, and saves it', async () => {
    const { aggregator: agg, store } = aggregator([
      ['contracts-legal', client('contracts-legal', 'compliant')],
      ['insurance', client('insurance', 'compliant')],
    ]);
    await agg.handleStatusChange(ENTITY, 'insurance', 'Employers Liability', 'non-compliant');
    const saved = store.overviews.get(ENTITY);
    expect(saved?.domains.get('insurance')?.status).toBe('non-compliant');
    expect(saved?.domains.get('insurance')?.regulations.get('Employers Liability')?.status).toBe(
      'non-compliant'
    );
    expect(saved?.overallStatus).toBe('non-compliant');

    await agg.handleStatusChange(ENTITY, 'insurance', 'Employers Liability', 'compliant');
    expect(store.overviews.get(ENTITY)?.overallStatus).toBe('compliant');
  });

  it('filters findings: open includes in-progress, resolved includes accepted', async () => {
    const store = new MemoryStore();
    store.findings = [
      finding('a', 'data-privacy', 'critical', 'open'),
      finding('b', 'data-privacy', 'high', 'in-progress'),
      finding('c', 'insurance', 'high', 'resolved'),
      finding('d', 'insurance', 'low', 'accepted'),
    ];
    const { aggregator: agg } = aggregator([], store);
    const ids = (list: ComplianceFinding[]): string[] => list.map((f) => f.id).sort();

    expect(ids(await agg.getFindings(ENTITY, { status: 'open' }))).toEqual(['a', 'b']);
    expect(ids(await agg.getFindings(ENTITY, { status: 'resolved' }))).toEqual(['c', 'd']);
    expect(ids(await agg.getFindings(ENTITY, { status: 'all', severity: 'high' }))).toEqual([
      'b',
      'c',
    ]);
    expect(ids(await agg.getFindings(ENTITY, { domain: 'insurance' }))).toEqual(['c', 'd']);
  });
});
