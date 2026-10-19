/**
 * The insurance service is a stub: its entry point serves a health check and
 * a description of the domains it will cover. These tests pin that contract
 * (what the operational gateway's health check reads) and the port setting.
 * serve() is mocked, so importing the entry point opens no socket; requests go
 * straight to the fetch handler it was given.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serve = vi.hoisted(() => vi.fn());
vi.mock('@hono/node-server', () => ({ serve }));

type Fetch = (request: Request) => Response | Promise<Response>;

async function start(port?: string): Promise<{ fetch: Fetch; port: number }> {
  vi.resetModules();
  serve.mockClear();
  if (port === undefined) vi.stubEnv('PORT', '');
  else vi.stubEnv('PORT', port);
  await import('../src/index.js');
  expect(serve).toHaveBeenCalledTimes(1);
  return serve.mock.calls[0]?.[0] as { fetch: Fetch; port: number };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('insurance service', () => {
  it('listens on 3013 unless PORT says otherwise', async () => {
    expect((await start()).port).toBe(3013);
    expect((await start('4013')).port).toBe(4013);
  });

  it('reports itself healthy, the shape the gateway health check reads', async () => {
    const { fetch } = await start();
    const response = await fetch(new Request('http://insurance.test/health'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; service: string; timestamp: string };
    expect(body).toMatchObject({ status: 'healthy', service: 'insurance' });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('describes the insurance domains it is meant to cover', async () => {
    const { fetch } = await start();
    const response = await fetch(new Request('http://insurance.test/'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      service: 'insurance',
      version: '0.1.0',
      description: 'Insurance policy and claims management',
      domains: [
        'policy-management',
        'claims-management',
        'general-liability',
        'professional-liability',
        'property-insurance',
        'cyber-insurance',
        'workers-compensation',
        'product-liability',
      ],
    });
  });

  it('answers 404 for anything else', async () => {
    const { fetch } = await start();
    expect((await fetch(new Request('http://insurance.test/policies'))).status).toBe(404);
  });
});
