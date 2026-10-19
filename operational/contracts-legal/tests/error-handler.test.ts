/**
 * The API's error mapping: errorHandler registered with onError, as
 * src/app.ts does, on a small Hono app whose routes throw what the services
 * and middleware throw. Each error becomes its status and the JSON error body,
 * with the request id when one is set.
 */
import type { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let app: Hono;

function prismaError(code: string): Error {
  return Object.assign(new Error(`prisma ${code}`), {
    name: 'PrismaClientKnownRequestError',
    code,
    meta: { target: ['contractNumber'] },
  });
}

beforeAll(async () => {
  vi.stubEnv('LOG_LEVEL', 'silent');
  vi.stubEnv('NODE_ENV', 'test');
  const { Hono } = await import('hono');
  const { errorHandler } = await import('../src/middleware/error.middleware.js');
  const { requestId } = await import('../src/middleware/audit.middleware.js');
  const errors = await import('../src/lib/errors.js');

  const throwing: Record<string, () => never> = {
    'not-found': () => {
      throw new errors.NotFoundError('Contract', 'c-1');
    },
    unauthenticated: () => {
      throw new errors.AuthenticationError();
    },
    conflict: () => {
      throw new errors.ConflictError('Contract number taken', 'Contract', 'contractNumber');
    },
    'business-rule': () => {
      throw new errors.ContractStatusError('draft', ['active', 'signed'], 'terminate');
    },
    zod: () => {
      z.object({ email: z.string().email() }).parse({ email: 'nope' });
      throw new Error('unreachable');
    },
    'prisma-unique': () => {
      throw prismaError('P2002');
    },
    'prisma-missing': () => {
      throw prismaError('P2025');
    },
    'prisma-other': () => {
      throw prismaError('P1001');
    },
    crash: () => {
      throw new TypeError('cannot read properties of undefined');
    },
    http: () => {
      throw new HTTPException(400, { message: 'Malformed JSON in request body' });
    },
  };

  app = new Hono();
  app.use('*', requestId);
  for (const [path, handler] of Object.entries(throwing)) app.get(`/${path}`, handler);
  app.onError(errorHandler);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const response = await app.request(`/${path}`, { headers: { 'x-request-id': 'req-1' } });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, body: text };
  }
}

describe('contracts-legal error mapping', () => {
  it('maps an AppError to its status, code, message and details', async () => {
    expect(await get('not-found')).toEqual({
      status: 404,
      body: {
        error: {
          code: 'NOT_FOUND',
          message: "Contract with identifier 'c-1' not found",
          details: { resource: 'Contract', identifier: 'c-1' },
          requestId: 'req-1',
        },
      },
    });
    expect(await get('unauthenticated')).toMatchObject({
      status: 401,
      body: { error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication required' } },
    });
    expect((await get('conflict')).status).toBe(409);
    expect(await get('business-rule')).toMatchObject({
      status: 422,
      body: { error: { code: 'CONTRACT_STATUS_ERROR' } },
    });
  });

  it('turns a Zod error into a 400 listing each invalid field', async () => {
    expect(await get('zod')).toMatchObject({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          details: { errors: [{ field: 'email', message: 'Invalid email' }] },
        },
      },
    });
  });

  it('maps known Prisma errors and hides the rest as a database error', async () => {
    expect(await get('prisma-unique')).toMatchObject({
      status: 409,
      body: { error: { code: 'UNIQUE_CONSTRAINT_VIOLATION' } },
    });
    expect(await get('prisma-missing')).toMatchObject({
      status: 404,
      body: { error: { code: 'RECORD_NOT_FOUND' } },
    });
    expect(await get('prisma-other')).toMatchObject({
      status: 500,
      body: { error: { code: 'DATABASE_ERROR', message: 'Database error' } },
    });
  });

  it('answers anything else with a 500, and hides its message in production', async () => {
    expect(await get('crash')).toMatchObject({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'cannot read properties of undefined' } },
    });
    vi.stubEnv('NODE_ENV', 'production');
    expect(await get('crash')).toMatchObject({
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    });
    vi.stubEnv('NODE_ENV', 'test');
  });

  it("keeps Hono's own client errors as they are", async () => {
    expect(await get('http')).toEqual({ status: 400, body: 'Malformed JSON in request body' });
  });
});
