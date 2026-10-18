/**
 * Error Handler Tests
 *
 * Tests for error middleware, graceful degradation,
 * and structured error responses.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Replicate the error handling logic for testing
class OperationalError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'OperationalError';
  }
}

function formatErrorResponse(error: Error | OperationalError) {
  if (error instanceof OperationalError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
}

function getStatusCode(error: Error | OperationalError): number {
  if (error instanceof OperationalError) {
    return error.statusCode;
  }
  return 500;
}

describe('OperationalError', () => {
  it('should create error with code and message', () => {
    const error = new OperationalError('ENTITY_NOT_FOUND', 'Entity not found');

    expect(error.code).toBe('ENTITY_NOT_FOUND');
    expect(error.message).toBe('Entity not found');
    expect(error.statusCode).toBe(500); // Default
    expect(error.name).toBe('OperationalError');
  });

  it('should create error with custom status code', () => {
    const error = new OperationalError('VALIDATION_ERROR', 'Invalid input', 400);

    expect(error.statusCode).toBe(400);
  });

  it('should create error with details', () => {
    const details = { field: 'entityId', reason: 'Must be a valid UUID' };
    const error = new OperationalError('VALIDATION_ERROR', 'Invalid input', 400, details);

    expect(error.details).toEqual(details);
  });

  it('should be an instance of Error', () => {
    const error = new OperationalError('TEST', 'Test error');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof OperationalError).toBe(true);
  });
});

describe('formatErrorResponse', () => {
  it('should format OperationalError with code and message', () => {
    const error = new OperationalError('ENTITY_NOT_FOUND', 'Entity not found', 404);

    const response = formatErrorResponse(error);

    expect(response).toEqual({
      error: {
        code: 'ENTITY_NOT_FOUND',
        message: 'Entity not found',
        details: undefined,
      },
    });
  });

  it('should include details when present', () => {
    const details = { entityId: '123', reason: 'Deleted' };
    const error = new OperationalError('ENTITY_NOT_FOUND', 'Entity not found', 404, details);

    const response = formatErrorResponse(error);

    expect(response.error.details).toEqual(details);
  });

  it('should format generic Error with internal error code', () => {
    const error = new Error('Something went wrong');

    const response = formatErrorResponse(error);

    expect(response).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  it('should not expose internal error message for generic errors', () => {
    const error = new Error('Database connection failed');

    const response = formatErrorResponse(error);

    expect(response.error.message).toBe('An unexpected error occurred');
    expect(response.error.message).not.toContain('Database');
  });
});

describe('getStatusCode', () => {
  it('should return status code from OperationalError', () => {
    const error = new OperationalError('NOT_FOUND', 'Not found', 404);

    expect(getStatusCode(error)).toBe(404);
  });

  it('should return 500 for generic Error', () => {
    const error = new Error('Something went wrong');

    expect(getStatusCode(error)).toBe(500);
  });

  it('should return custom status codes', () => {
    const badRequest = new OperationalError('BAD_REQUEST', 'Bad request', 400);
    const unauthorized = new OperationalError('UNAUTHORIZED', 'Unauthorized', 401);
    const forbidden = new OperationalError('FORBIDDEN', 'Forbidden', 403);
    const conflict = new OperationalError('CONFLICT', 'Conflict', 409);

    expect(getStatusCode(badRequest)).toBe(400);
    expect(getStatusCode(unauthorized)).toBe(401);
    expect(getStatusCode(forbidden)).toBe(403);
    expect(getStatusCode(conflict)).toBe(409);
  });
});

describe('Error scenarios', () => {
  it('should handle validation errors', () => {
    const error = new OperationalError(
      'VALIDATION_ERROR',
      'Invalid request body',
      400,
      {
        errors: [
          { field: 'entityId', message: 'Required' },
          { field: 'domain', message: 'Must be a valid domain' },
        ],
      }
    );

    const response = formatErrorResponse(error);

    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.details).toHaveProperty('errors');
  });

  it('should handle domain unavailable errors', () => {
    const error = new OperationalError(
      'DOMAIN_UNAVAILABLE',
      'Domain service is unavailable',
      503,
      { domain: 'contracts-legal', lastAttempt: new Date().toISOString() }
    );

    const response = formatErrorResponse(error);

    expect(response.error.code).toBe('DOMAIN_UNAVAILABLE');
    expect(getStatusCode(error)).toBe(503);
  });

  it('should handle timeout errors', () => {
    const error = new OperationalError(
      'TIMEOUT',
      'Request timed out',
      504,
      { timeout: 10000, domain: 'insurance' }
    );

    const response = formatErrorResponse(error);

    expect(response.error.code).toBe('TIMEOUT');
    expect(getStatusCode(error)).toBe(504);
  });

  it('should handle rate limit errors', () => {
    const error = new OperationalError(
      'RATE_LIMITED',
      'Too many requests',
      429,
      { retryAfter: 60 }
    );

    const response = formatErrorResponse(error);

    expect(response.error.code).toBe('RATE_LIMITED');
    expect(getStatusCode(error)).toBe(429);
    expect(response.error.details).toEqual({ retryAfter: 60 });
  });
});

describe('Graceful degradation patterns', () => {
  // Simulating the aggregator's graceful degradation behavior
  function fetchWithFallback<T>(
    fetchFn: () => Promise<T>,
    fallback: T
  ): Promise<T> {
    return fetchFn().catch(() => fallback);
  }

  it('should return fallback on domain failure', async () => {
    const failingFetch = () => Promise.reject(new Error('Domain unavailable'));
    const fallback = { data: [], count: 0 };

    const result = await fetchWithFallback(failingFetch, fallback);

    expect(result).toEqual(fallback);
  });

  it('should return actual data when available', async () => {
    const successfulFetch = () => Promise.resolve({ data: [1, 2, 3], count: 3 });
    const fallback = { data: [], count: 0 };

    const result = await fetchWithFallback(successfulFetch, fallback);

    expect(result).toEqual({ data: [1, 2, 3], count: 3 });
  });

  it('should handle partial failures in parallel fetches', async () => {
    const results = await Promise.allSettled([
      Promise.resolve({ domain: 'contracts-legal', data: [1] }),
      Promise.reject(new Error('Insurance unavailable')),
      Promise.resolve({ domain: 'ip', data: [2] }),
      Promise.reject(new Error('Privacy unavailable')),
    ]);

    const successful = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    expect(successful).toHaveLength(2);
    expect(successful.map(s => s.domain)).toContain('contracts-legal');
    expect(successful.map(s => s.domain)).toContain('ip');
  });
});

describe('404 handler', () => {
  function handleNotFound(path: string): { code: string; message: string; statusCode: number } {
    return {
      code: 'NOT_FOUND',
      message: `Route ${path} not found`,
      statusCode: 404,
    };
  }

  it('should return 404 for unknown routes', () => {
    const result = handleNotFound('/unknown/route');

    expect(result.code).toBe('NOT_FOUND');
    expect(result.statusCode).toBe(404);
    expect(result.message).toContain('/unknown/route');
  });
});

describe('Error response structure', () => {
  it('should always have error.code field', () => {
    const responses = [
      formatErrorResponse(new OperationalError('TEST', 'Test')),
      formatErrorResponse(new Error('Generic')),
    ];

    for (const response of responses) {
      expect(response).toHaveProperty('error.code');
      expect(typeof response.error.code).toBe('string');
    }
  });

  it('should always have error.message field', () => {
    const responses = [
      formatErrorResponse(new OperationalError('TEST', 'Test message')),
      formatErrorResponse(new Error('Generic')),
    ];

    for (const response of responses) {
      expect(response).toHaveProperty('error.message');
      expect(typeof response.error.message).toBe('string');
    }
  });

  it('should have consistent structure across error types', () => {
    const operationalResponse = formatErrorResponse(
      new OperationalError('OP_ERROR', 'Operational error', 400)
    );
    const genericResponse = formatErrorResponse(new Error('Generic error'));

    // Both should have the same top-level structure
    expect(Object.keys(operationalResponse)).toEqual(['error']);
    expect(Object.keys(genericResponse)).toEqual(['error']);
  });
});
