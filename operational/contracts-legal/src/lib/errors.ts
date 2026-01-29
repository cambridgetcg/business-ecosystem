/**
 * Custom Error Classes
 */

import { StatusCode } from 'hono/utils/http-status';

export class AppError extends Error {
  public readonly statusCode: StatusCode;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly metadata: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: StatusCode = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.metadata = metadata || {};
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(Object.keys(this.metadata).length > 0 && { details: this.metadata }),
      },
    };
  }
}

export class ValidationError extends AppError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(message: string = 'Validation failed', errors: Array<{ field: string; message: string }> = []) {
    super(message, 400, 'VALIDATION_ERROR', true, { errors });
    this.errors = errors;
  }

  static fromZodError(zodError: { issues: Array<{ path: (string | number)[]; message: string }> }): ValidationError {
    const errors = zodError.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return new ValidationError('Validation failed', errors);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied', resource?: string, action?: string) {
    super(message, 403, 'AUTHORIZATION_ERROR', true, { resource: resource || '', action: action || '' });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? resource + " with identifier '" + identifier + "' not found"
      : resource + ' not found';
    super(message, 404, 'NOT_FOUND', true, { resource, identifier: identifier || '' });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, resource?: string, conflictingField?: string) {
    super(message, 409, 'CONFLICT', true, { resource: resource || '', conflictingField: conflictingField || '' });
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;
  constructor(retryAfter: number = 60) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', true, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, rule?: string) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', true, { rule: rule || '' });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error') {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', true, { service });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', operation?: string) {
    super(message, 500, 'DATABASE_ERROR', false, { operation: operation || '' });
  }
}

export class ContractError extends AppError {
  constructor(message: string, code: string, metadata?: Record<string, unknown>) {
    super(message, 422, code, true, metadata);
  }
}

export class ContractStatusError extends ContractError {
  constructor(currentStatus: string, requiredStatus: string | string[], action: string) {
    const required = Array.isArray(requiredStatus) ? requiredStatus.join(' or ') : requiredStatus;
    super(
      "Cannot " + action + ": contract is in '" + currentStatus + "' status, but must be '" + required + "'",
      'CONTRACT_STATUS_ERROR',
      { currentStatus, requiredStatus, action }
    );
  }
}

export class ContractExpiredError extends ContractError {
  constructor(contractId: string, expiryDate: Date) {
    super('Contract ' + contractId + ' expired on ' + expiryDate.toISOString(), 'CONTRACT_EXPIRED', {
      contractId,
      expiryDate: expiryDate.toISOString(),
    });
  }
}

export class ContractSignatureError extends ContractError {
  constructor(message: string, partyId?: string) {
    super(message, 'CONTRACT_SIGNATURE_ERROR', { partyId: partyId || '' });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  return isAppError(error) && error.isOperational;
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    return new AppError(error.message, 500, 'INTERNAL_ERROR', false, { originalName: error.name });
  }
  return new AppError('An unexpected error occurred', 500, 'INTERNAL_ERROR', false);
}
