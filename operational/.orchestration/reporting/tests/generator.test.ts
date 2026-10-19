/**
 * ReportGenerator run on the repo's own report definitions
 * (operational/.orchestration/reporting/definitions), with a stubbed fetch
 * standing in for the domain services: parameters and their defaults, the
 * query each source receives, section filters and sort order, the summary,
 * and a domain that fails or cannot be reached. No network.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportGenerator } from '../src/generator.js';
import type { ReportDefinition } from '../src/types.js';

const definition = (name: string): ReportDefinition =>
  parse(
    readFileSync(new URL(`../definitions/${name}.yaml`, import.meta.url), 'utf8')
  ) as ReportDefinition;

const ENDPOINTS = {
  'contracts-legal': 'http://contracts.test',
  insurance: 'http://insurance.test',
  'intellectual-property': 'http://ip.test',
  'data-privacy': 'http://privacy.test',
};

// Answers by path: an items array, a status code, or an Error (unreachable).
function stubFetch(byPath: Record<string, unknown[] | number | Error>): URL[] {
  const requested: URL[] = [];
  vi.stubGlobal('fetch', (input: string) => {
    const url = new URL(input);
    requested.push(url);
    const answer = byPath[`${url.origin}${url.pathname}`] ?? 404;
    if (answer instanceof Error) return Promise.reject(answer);
    if (typeof answer === 'number') return Promise.resolve(new Response('', { status: answer }));
    return Promise.resolve(Response.json({ items: answer }));
  });
  return requested;
}

const expiring = (id: string, type: string, days: number) => ({
  id,
  type,
  title: id,
  daysUntilExpiration: days,
  domain: 'wrong-domain',
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReportGenerator on the expiration forecast', () => {
  it('queries every source with the resolved parameters', async () => {
    const requested = stubFetch({});
    const report = await new ReportGenerator(ENDPOINTS).generate(
      definition('expiration-forecast'),
      {
        entityId: 'e-1',
      }
    );
    expect(report.parameters).toEqual({ entityId: 'e-1', daysAhead: 90 });
    expect(
      requested.map((url) => `${url.origin}${url.pathname}?${url.searchParams.toString()}`).sort()
    ).toEqual([
      'http://contracts.test/reports/getExpiringContracts?entityId=e-1&daysAhead=90',
      'http://insurance.test/reports/getExpiringPolicies?entityId=e-1&daysAhead=90',
      'http://ip.test/reports/getExpiringIP?entityId=e-1&daysAhead=90',
      'http://privacy.test/reports/getExpiringConsents?entityId=e-1&daysAhead=90',
    ]);
  });

  it('refuses to run without a required parameter', async () => {
    stubFetch({});
    await expect(
      new ReportGenerator(ENDPOINTS).generate(definition('expiration-forecast'), { daysAhead: 30 })
    ).rejects.toThrow('Missing required parameter: entityId');
  });

  it('files items into the 7, 30 and 90 day sections, boundaries included, despite failing sources', async () => {
    stubFetch({
      'http://contracts.test/reports/getExpiringContracts': [
        expiring('lease', 'contract', 30),
        expiring('nda', 'contract', 7),
      ],
      'http://insurance.test/reports/getExpiringPolicies': [
        expiring('cyber', 'policy', 90),
        expiring('liability', 'policy', 3),
        expiring('fire', 'policy', 120),
      ],
      'http://ip.test/reports/getExpiringIP': 500,
      'http://privacy.test/reports/getExpiringConsents': new Error('connect ECONNREFUSED'),
    });
    const report = await new ReportGenerator(ENDPOINTS).generate(
      definition('expiration-forecast'),
      {
        entityId: 'e-1',
        daysAhead: 120,
      }
    );
    const sections = Object.fromEntries(
      report.sections.map((s) => [s.title, s.items.map((i) => i.id)])
    );
    expect(sections).toEqual({
      'Critical (7 days)': ['liability', 'nda'],
      'Warning (30 days)': ['liability', 'nda', 'lease'],
      'Notice (90 days)': ['liability', 'nda', 'lease', 'cyber'],
    });
    expect(report.summary).toMatchObject({
      totalItems: 5,
      byDomain: {
        'contracts-legal': 2,
        insurance: 3,
        'intellectual-property': 0,
        'data-privacy': 0,
      },
      byType: { contract: 2, policy: 3 },
    });
    // Each item is attributed to the source that returned it.
    expect(report.sections[2]?.items.find((i) => i.id === 'cyber')?.domain).toBe('insurance');
  });
});

describe('ReportGenerator sections', () => {
  const custom: ReportDefinition = {
    id: 'custom',
    name: 'Custom',
    description: 'Section options the shipped definitions do not use',
    parameters: [],
    sources: [{ domain: 'contracts-legal', query: 'all' }],
    output: {
      sections: [
        {
          title: 'Largest first',
          filter: 'value > 100',
          sortBy: 'value',
          sortOrder: 'desc',
          fields: ['value'],
        },
        { title: 'Not draft', filter: "status != 'draft'", sortBy: 'meta.rank' },
      ],
    },
    formats: ['json'],
  };

  it('sorts descending, keeps only the named fields, and reads nested sort keys', async () => {
    stubFetch({
      'http://contracts.test/reports/all': [
        { id: 'a', type: 'contract', title: 'A', value: 150, status: 'draft', meta: { rank: 2 } },
        { id: 'b', type: 'contract', title: 'B', value: 900, status: 'active', meta: { rank: 3 } },
        { id: 'c', type: 'contract', title: 'C', value: 50, status: 'active', meta: { rank: 1 } },
      ],
    });
    const report = await new ReportGenerator(ENDPOINTS).generate(custom, {});
    expect(report.sections[0]?.items).toEqual([
      { domain: 'contracts-legal', type: 'contract', id: 'b', value: 900 },
      { domain: 'contracts-legal', type: 'contract', id: 'a', value: 150 },
    ]);
    expect(report.sections[1]?.items.map((i) => i.id)).toEqual(['c', 'b']);
    expect(report.summary).toBeUndefined();
  });
});
