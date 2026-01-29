/**
 * Error Handler Middleware
 *
 * Unified error handling for all API requests.
 * Transforms domain errors into appropriate HTTP responses.
 *
 * @module api/rest/middleware
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import {
  isBankingTreasuryError,
  isValidationError,
  type BankingTreasuryError,
} from '../../../core/errors/index.js';

/**
 * API error response format.
 */
interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

/**
 * Create error response from BankingTreasuryError.
 */
function fromDomainError(
  error: BankingTreasuryError,
  requestId: string,
  isDevelopment: boolean
): ErrorResponse {
  const response: ErrorResponse = {
    error: error.name,
    code: error.code,
    message: error.message,
    requestId,
    timestamp: new Date().toISOString(),
  };

  // Add field errors for validation errors
  if (isValidationError(error)) {
    response.details = { fieldErrors: error.fieldErrors };
  }

  // Add context in development
  if (isDevelopment) {
    const existingDetails = typeof response.details === 'object' && response.details !== null
      ? response.details as Record<string, unknown>
      : {};
    response.details = { ...existingDetails, context: error.context };
  }

  return response;
}

/**
 * Create error response from Fastify error.
 */
function fromFastifyError(error: FastifyError, requestId: string): ErrorResponse {
  const response: ErrorResponse = {
    error: error.name,
    code: error.code ?? 'UNKNOWN_ERROR',
    message: error.message,
    requestId,
    timestamp: new Date().toISOString(),
  };

  if (error.validation) {
    response.code = 'VALIDATION_ERROR';
    response.details = { fieldErrors: error.validation };
  }

  return response;
}

/**
 * Create error response from unknown error.
 */
function fromUnknownError(error: unknown, requestId: string, isDevelopment: boolean): ErrorResponse {
  const message = isDevelopment && error instanceof Error
    ? error.message
    : 'An unexpected error occurred';

  return {
    error: 'InternalServerError',
    code: 'INTERNAL_ERROR',
    message,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Determine HTTP status code from error.
 */
function getStatusCode(error: unknown): number {
  if (isBankingTreasuryError(error)) {
    return error.statusCode;
  }

  if (error && typeof error === 'object' && 'statusCode' in error) {
    return (error as { statusCode: number }).statusCode;
  }

  return 500;
}

/**
 * Fastify error handler factory.
 */
export function createErrorHandler(isDevelopment: boolean = false) {
  return function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ): void {
    const requestId = request.id;

    // Log error
    request.log.error({
      err: error,
      requestId,
      path: request.url,
      method: request.method,
    }, 'Request error');

    // Determine response
    let response: ErrorResponse;
    let statusCode: number;

    if (isBankingTreasuryError(error)) {
      response = fromDomainError(error, requestId, isDevelopment);
      statusCode = error.statusCode;
    } else if (error.validation) {
      // Fastify validation error
      response = fromFastifyError(error, requestId);
      statusCode = 400;
    } else if (error.statusCode === 404) {
      response = {
        error: 'NotFound',
        code: 'NOT_FOUND',
        message: error.message,
        requestId,
        timestamp: new Date().toISOString(),
      };
      statusCode = 404;
    } else {
      response = fromUnknownError(error, requestId, isDevelopment);
      statusCode = getStatusCode(error);
    }

    reply.status(statusCode).send(response);
  };
}

/**
 * Not found handler.
 */
export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  reply.status(404).send({
    error: 'NotFound',
    code: 'ROUTE_NOT_FOUND',
    message: `Route ${request.method} ${request.url} not found`,
    requestId: request.id,
    timestamp: new Date().toISOString(),
  });
}
