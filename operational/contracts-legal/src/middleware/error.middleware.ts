/**
 * Error Handling Middleware
 */

import { Context, MiddlewareHandler } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { AppError, isAppError, isOperationalError, ValidationError } from '../lib/errors.js';
import { logger, logError } from '../lib/logger.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

function buildErrorResponse(error: AppError, requestId?: string): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(Object.keys(error.metadata).length > 0 && { details: error.metadata }),
      ...(requestId && { requestId }),
    },
  };
}

function handleZodError(error: ZodError): AppError {
  return ValidationError.fromZodError(error);
}

function handlePrismaError(error: Error): AppError {
  const prismaError = error as Error & { code?: string; meta?: unknown };
  if (prismaError.code === 'P2002') {
    return new AppError('A record with this value already exists', 409, 'UNIQUE_CONSTRAINT_VIOLATION', true, { meta: prismaError.meta });
  }
  if (prismaError.code === 'P2025') {
    return new AppError('Record not found', 404, 'RECORD_NOT_FOUND', true);
  }
  if (prismaError.code === 'P2003') {
    return new AppError('Referenced record does not exist', 400, 'FOREIGN_KEY_VIOLATION', true, { meta: prismaError.meta });
  }
  return new AppError('Database error', 500, 'DATABASE_ERROR', false);
}

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
    return;
  } catch (error) {
    const requestId = c.get('requestId') as string | undefined;
    let appError: AppError;

    if (isAppError(error)) {
      appError = error;
    } else if (error instanceof ZodError) {
      appError = handleZodError(error);
    } else if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
      appError = handlePrismaError(error);
    } else if (error instanceof Error) {
      appError = new AppError(
        process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
        500, 'INTERNAL_ERROR', false
      );
    } else {
      appError = new AppError('An unexpected error occurred', 500, 'INTERNAL_ERROR', false);
    }

    if (!isOperationalError(appError)) {
      logError(error, { requestId, errorCode: appError.code });
    } else {
      const logLevel = appError.statusCode >= 500 ? 'error' : 'warn';
      logger[logLevel]({ requestId, errorCode: appError.code, statusCode: appError.statusCode, message: appError.message }, 'Request error: ' + appError.message);
    }

    const response = buildErrorResponse(appError, requestId);
    const status = appError.statusCode as ContentfulStatusCode;
    return c.json(response, status);
  }
};

export const notFoundHandler = (c: Context) => {
  const requestId = c.get('requestId') as string | undefined;
  return c.json({ error: { code: 'NOT_FOUND', message: 'Route ' + c.req.method + ' ' + c.req.path + ' not found', ...(requestId && { requestId }) } }, 404);
};

export default errorHandler;
