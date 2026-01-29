/**
 * Banking-Treasury Error System
 *
 * Unified error types for the entire domain.
 * All errors extend from BankingTreasuryError for consistent handling.
 *
 * @module core/errors
 */

/**
 * Base error class for all banking-treasury errors.
 * Provides structured error information for API responses and logging.
 */
export abstract class BankingTreasuryError extends Error {
  abstract code: string;
  abstract statusCode: number;
  readonly timestamp: Date = new Date();
  readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

// =============================================================================
// VALIDATION ERRORS (400)
// =============================================================================

export class ValidationError extends BankingTreasuryError {
  code = 'VALIDATION_ERROR';
  statusCode = 400;
  readonly fieldErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    fieldErrors: Array<{ field: string; message: string }> = [],
    context: Record<string, unknown> = {}
  ) {
    super(message, context);
    this.fieldErrors = fieldErrors;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      fieldErrors: this.fieldErrors,
    };
  }
}

export class InvalidAmountError extends ValidationError {
  constructor(amount: number, currency: string, reason: string) {
    super(`Invalid amount: ${amount} ${currency} - ${reason}`, [], { amount, currency, reason });
    this.code = 'INVALID_AMOUNT';
  }
}

export class InvalidCurrencyError extends ValidationError {
  constructor(currency: string) {
    super(`Invalid currency code: ${currency}`, [], { currency });
    this.code = 'INVALID_CURRENCY';
  }
}

export class InvalidAccountStateError extends ValidationError {
  constructor(accountId: string, currentState: string, attemptedAction: string) {
    super(
      `Cannot ${attemptedAction} on account in ${currentState} state`,
      [],
      { accountId, currentState, attemptedAction }
    );
    this.code = 'INVALID_ACCOUNT_STATE';
  }
}

// =============================================================================
// NOT FOUND ERRORS (404)
// =============================================================================

export class NotFoundError extends BankingTreasuryError {
  code = 'NOT_FOUND';
  statusCode = 404;
  readonly resourceType: string;
  readonly resourceId: string;

  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} not found: ${resourceId}`, { resourceType, resourceId });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

export class AccountNotFoundError extends NotFoundError {
  constructor(accountId: string) {
    super('BankAccount', accountId);
    this.code = 'ACCOUNT_NOT_FOUND';
  }
}

export class PaymentNotFoundError extends NotFoundError {
  constructor(paymentId: string) {
    super('Payment', paymentId);
    this.code = 'PAYMENT_NOT_FOUND';
  }
}

export class EntityNotFoundError extends NotFoundError {
  constructor(entityId: string) {
    super('Entity', entityId);
    this.code = 'ENTITY_NOT_FOUND';
  }
}

// =============================================================================
// CONFLICT ERRORS (409)
// =============================================================================

export class ConflictError extends BankingTreasuryError {
  code = 'CONFLICT';
  statusCode = 409;
}

export class ConcurrencyError extends ConflictError {
  constructor(resourceType: string, resourceId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Concurrency conflict on ${resourceType} ${resourceId}: expected version ${expectedVersion}, found ${actualVersion}`,
      { resourceType, resourceId, expectedVersion, actualVersion }
    );
    this.code = 'CONCURRENCY_ERROR';
  }
}

export class DuplicateAccountError extends ConflictError {
  constructor(accountNumber: string, bankName: string) {
    super(
      `Account already exists: ${accountNumber} at ${bankName}`,
      { accountNumber, bankName }
    );
    this.code = 'DUPLICATE_ACCOUNT';
  }
}

// =============================================================================
// BUSINESS RULE ERRORS (422)
// =============================================================================

export class BusinessRuleError extends BankingTreasuryError {
  code = 'BUSINESS_RULE_VIOLATION';
  statusCode = 422;
  readonly ruleCode: string;

  constructor(ruleCode: string, message: string, context: Record<string, unknown> = {}) {
    super(message, { ...context, ruleCode });
    this.ruleCode = ruleCode;
  }
}

export class InsufficientFundsError extends BusinessRuleError {
  constructor(accountId: string, available: number, required: number, currency: string) {
    super(
      'INSUFFICIENT_FUNDS',
      `Insufficient funds: available ${available} ${currency}, required ${required} ${currency}`,
      { accountId, available, required, currency }
    );
    this.code = 'INSUFFICIENT_FUNDS';
  }
}

export class CutoffMissedError extends BusinessRuleError {
  constructor(railId: string, cutoffTime: Date, currentTime: Date) {
    super(
      'CUTOFF_MISSED',
      `Payment cutoff missed for rail ${railId}: cutoff was ${cutoffTime.toISOString()}`,
      { railId, cutoffTime: cutoffTime.toISOString(), currentTime: currentTime.toISOString() }
    );
    this.code = 'CUTOFF_MISSED';
  }
}

export class ComplianceBlockError extends BusinessRuleError {
  constructor(entityId: string, reason: string, findings: string[]) {
    super(
      'COMPLIANCE_BLOCK',
      `Payment blocked by compliance: ${reason}`,
      { entityId, reason, findings }
    );
    this.code = 'COMPLIANCE_BLOCK';
  }
}

export class PaymentLimitExceededError extends BusinessRuleError {
  constructor(limitType: string, current: number, limit: number, currency: string) {
    super(
      'PAYMENT_LIMIT_EXCEEDED',
      `${limitType} limit exceeded: ${current} ${currency} exceeds ${limit} ${currency}`,
      { limitType, current, limit, currency }
    );
    this.code = 'PAYMENT_LIMIT_EXCEEDED';
  }
}

// =============================================================================
// INFRASTRUCTURE ERRORS (500+)
// =============================================================================

export class InfrastructureError extends BankingTreasuryError {
  code = 'INFRASTRUCTURE_ERROR';
  statusCode = 500;
}

export class DatabaseError extends InfrastructureError {
  constructor(operation: string, details?: string) {
    super(`Database error during ${operation}${details ? `: ${details}` : ''}`, { operation });
    this.code = 'DATABASE_ERROR';
  }
}

export class ExternalServiceError extends InfrastructureError {
  constructor(serviceName: string, operation: string, details?: string) {
    super(
      `External service error: ${serviceName} failed during ${operation}${details ? `: ${details}` : ''}`,
      { serviceName, operation }
    );
    this.code = 'EXTERNAL_SERVICE_ERROR';
  }
}

export class RailUnavailableError extends InfrastructureError {
  constructor(railId: string, reason: string) {
    super(`Payment rail ${railId} is unavailable: ${reason}`, { railId, reason });
    this.code = 'RAIL_UNAVAILABLE';
    this.statusCode = 503;
  }
}

// =============================================================================
// ERROR TYPE GUARDS
// =============================================================================

export function isBankingTreasuryError(error: unknown): error is BankingTreasuryError {
  return error instanceof BankingTreasuryError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isBusinessRuleError(error: unknown): error is BusinessRuleError {
  return error instanceof BusinessRuleError;
}

export function isInfrastructureError(error: unknown): error is InfrastructureError {
  return error instanceof InfrastructureError;
}
