/**
 * The REST API's error mapping, through the real Fastify app and inject():
 * no server listens and no database is touched. The query handler's database
 * methods are replaced per test; requests that fail before them (a missing
 * tenant header, an invalid body) never reach one.
 *
 * DATABASE_URL is required by src/env.ts at import. It is set to an address
 * nothing is asked to connect to, before the app's modules load.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const IDENTITY = '8c1f2e3d-4b5a-4697-8a1b-2c3d4e5f6a7b';
const TENANT = { 'x-tenant-id': '9d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a' };

let app: FastifyInstance;
let queries: typeof import('../src/application/handlers/query-handlers.js');

beforeAll(async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://kyc:kyc@db.invalid:5432/kyc');
  vi.stubEnv('LOG_LEVEL', 'error');
  queries = await import('../src/application/handlers/query-handlers.js');
  const { buildApp } = await import('../src/api/rest/app.js');
  app = await buildApp();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await app.close();
  vi.unstubAllEnvs();
});

describe('kyc-identity REST errors', () => {
  it('answers the health check', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('returns 404 for an identity the tenant does not have', async () => {
    const lookup = vi
      .spyOn(queries.IdentityQueryHandler.prototype, 'getIdentity')
      .mockResolvedValue(null);
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/identities/${IDENTITY}`,
      headers: TENANT,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Identity not found' });
    expect(lookup).toHaveBeenCalledWith({ identityId: IDENTITY, tenantId: TENANT['x-tenant-id'] });
  });

  it('rejects an identity id that is not a uuid with 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/identities/not-a-uuid',
      headers: TENANT,
    });
    expect(response.statusCode).toBe(400);
  });
});
