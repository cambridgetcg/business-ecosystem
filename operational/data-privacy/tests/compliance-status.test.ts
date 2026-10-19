/**
 * GET /api/v1/compliance-status/:entityId, the endpoint the compliance
 * aggregator's data-privacy client reads (operational/.orchestration/
 * compliance/src/index.ts). The routes run on a stub Prisma client that
 * answers the three counts, so the status rule is tested without a database.
 */
import type { Hono } from 'hono';
import type { PrismaClient } from '#prisma';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

interface Counts {
  pendingDsars: number;
  unresolvedBreaches: number;
  pendingNotifications: number;
}

interface CountArgs {
  where: Record<string, unknown> & { deadline?: { lt: Date } };
}

let counts: Counts;
const calls: { model: string; args: CountArgs }[] = [];
let routes: Hono;

// Only the two models and the one method the endpoint uses.
const prisma = {
  dSARRequest: {
    count: (args: CountArgs) => {
      calls.push({ model: 'dSARRequest', args });
      return Promise.resolve(counts.pendingDsars);
    },
  },
  dataBreach: {
    count: (args: CountArgs) => {
      calls.push({ model: 'dataBreach', args });
      return Promise.resolve(
        'authorityNotificationRequired' in args.where
          ? counts.pendingNotifications
          : counts.unresolvedBreaches
      );
    },
  },
};

beforeAll(async () => {
  vi.stubEnv('LOG_LEVEL', 'silent');
  const { createRoutes } = await import('../src/routes/index.js');
  routes = createRoutes(prisma as unknown as PrismaClient);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

async function status(
  next: Counts
): Promise<{ status: string; issues: string[]; metrics: Counts }> {
  counts = next;
  calls.length = 0;
  const response = await routes.request('/compliance-status/entity-1');
  expect(response.status).toBe(200);
  return (await response.json()) as { status: string; issues: string[]; metrics: Counts };
}

describe('data-privacy compliance status', () => {
  it('is compliant with nothing pending', async () => {
    expect(
      await status({ pendingDsars: 0, unresolvedBreaches: 0, pendingNotifications: 0 })
    ).toMatchObject({
      status: 'compliant',
      issues: [],
    });
  });

  it('is non-compliant while a breach awaits authority notification', async () => {
    const result = await status({
      pendingDsars: 0,
      unresolvedBreaches: 1,
      pendingNotifications: 1,
    });
    expect(result.status).toBe('non_compliant');
    expect(result.issues).toEqual([
      '1 breach(es) pending authority notification',
      '1 unresolved breach(es)',
    ]);
  });

  it('is at risk with an unresolved breach or a DSAR due within 7 days', async () => {
    expect(
      (await status({ pendingDsars: 0, unresolvedBreaches: 2, pendingNotifications: 0 })).status
    ).toBe('at_risk');
    const dsars = await status({ pendingDsars: 3, unresolvedBreaches: 0, pendingNotifications: 0 });
    expect(dsars).toMatchObject({
      status: 'at_risk',
      issues: ['3 DSAR(s) due within 7 days'],
      metrics: { pendingDsars: 3, unresolvedBreaches: 0, pendingNotifications: 0 },
    });
  });

  it('counts only open DSARs for the entity whose deadline is within 7 days', async () => {
    const before = Date.now();
    await status({ pendingDsars: 0, unresolvedBreaches: 0, pendingNotifications: 0 });
    const dsar = calls.find((call) => call.model === 'dSARRequest')?.args.where;
    expect(dsar).toMatchObject({
      entityId: 'entity-1',
      status: { notIn: ['COMPLETED', 'REJECTED', 'CLOSED'] },
    });
    const window = (dsar?.deadline?.lt.getTime() ?? 0) - before;
    expect(window).toBeGreaterThanOrEqual(7 * 86_400_000);
    expect(window).toBeLessThan(7 * 86_400_000 + 60_000);
  });
});
