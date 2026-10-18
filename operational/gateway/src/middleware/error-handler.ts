/**
 * Error Handling Middleware
 */

import type { Context, Next } from 'hono';
import pino from 'pino';

const logger = pino({ name: 'operational-gateway-error' });

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class OperationalError extends Error {
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

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    if (error instanceof OperationalError) {
      logger.warn({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
      }, 'Operational error');

      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        error.statusCode as 400 | 404 | 500 | 503
      );
    }

    if (error instanceof Error) {
      logger.error({ error: error.message, stack: error.stack }, 'Unexpected error');
      return c.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        },
        500
      );
    }

    logger.error({ error }, 'Unknown error');
    return c.json(
      {
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
        },
      },
      500
    );
  }
}

export function notFoundHandler(c: Context) {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.path} not found`,
      },
    },
    404
  );
}
