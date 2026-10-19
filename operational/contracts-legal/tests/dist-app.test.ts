/**
 * The built service as `node dist/index.js` would load it: plain Node runs
 * dist/app.js, which imports the generated Prisma client through the
 * package's "#prisma" import (F7), and sends it requests with app.request().
 * Nothing listens and no database is used: PrismaClient connects lazily and
 * the child gets no DATABASE_URL. Needs the build (turbo runs it before test).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

interface Reply {
  status: number;
  type: string | null;
  body: unknown;
}

// Each request is [path, headers]. The child prints its replies as one JSON line
// after a marker: the service's logger writes to stdout too.
function requestDist(requests: [string, Record<string, string>?][]): Reply[] {
  const script = `
    const { PrismaClient } = await import('#prisma');
    const { createApp } = await import('./dist/app.js');
    const app = createApp({ prisma: new PrismaClient() });
    const replies = [];
    for (const [path, headers] of ${JSON.stringify(requests)}) {
      const response = await app.request(path, { headers: headers ?? {} });
      const text = await response.text();
      let body = text;
      try { body = JSON.parse(text); } catch {}
      replies.push({ status: response.status, type: response.headers.get('content-type'), body });
    }
    console.log('REPLIES ' + JSON.stringify(replies));
  `;
  const env: NodeJS.ProcessEnv = { ...process.env, LOG_LEVEL: 'error', NODE_ENV: 'test' };
  delete env.DATABASE_URL;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: PACKAGE,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  });
  const line = stdout.split('\n').find((l) => l.startsWith('REPLIES '));
  if (line === undefined) throw new Error(`no replies from the built app:\n${stdout}`);
  return JSON.parse(line.slice('REPLIES '.length)) as Reply[];
}

beforeAll(() => {
  if (!existsSync(new URL('../dist/app.js', import.meta.url))) {
    throw new Error('dist/app.js is missing: build the package first (pnpm run build)');
  }
});

describe('contracts-legal built app, without a database', () => {
  it('loads from dist and describes the service', () => {
    const [root] = requestDist([['/']]);
    expect(root?.status).toBe(200);
    expect(root?.body).toMatchObject({
      service: 'contracts-legal',
      domains: expect.arrayContaining(['customer-contracts', 'contract-lifecycle']),
    });
  });

  it('reports itself unhealthy and not ready while the database is not initialised', () => {
    const [health, ready] = requestDist([['/health'], ['/ready']]);
    expect(health?.status).toBe(503);
    expect(health?.body).toMatchObject({
      status: 'unhealthy',
      checks: { database: { healthy: false, error: 'Prisma client not initialized' } },
    });
    expect(ready).toMatchObject({
      status: 503,
      body: { ready: false, reason: 'Database not connected' },
    });
  });

  it('answers an unknown route with a JSON 404 that carries the request id', () => {
    const [missing] = requestDist([['/api/v1/nothing-here', { 'x-request-id': 'req-404' }]]);
    expect(missing?.status).toBe(404);
    expect(missing?.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /api/v1/nothing-here not found',
        requestId: 'req-404',
      },
    });
  });
});
