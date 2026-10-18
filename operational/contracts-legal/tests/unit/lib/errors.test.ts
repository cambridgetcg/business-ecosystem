/**
 * Error Classes - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ContractStatusError,
  isAppError,
  isOperationalError,
  normalizeError,
} from '../../../src/lib/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with defaults', () => {
      const error = new AppError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom properties', () => {
      const error = new AppError('Custom error', 400, 'CUSTOM_CODE', false, { key: 'value' });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.isOperational).toBe(false);
      expect(error.metadata).toEqual({ key: 'value' });
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', 400, 'TEST', true, { detail: 'extra' });
      const json = error.toJSON();
      expect(json).toEqual({
        error: {
          code: 'TEST',
          message: 'Test error',
          details: { detail: 'extra' },
        },
      });
    });

    it('should omit details when metadata is empty', () => {
      const error = new AppError('Test');
      const json = error.toJSON();
      expect(json.error).not.toHaveProperty('details');
    });
  });

  describe('ValidationError', () => {
    it('should create with default message', () => {
      const error = new ValidationError();
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should create from Zod error', () => {
      const zodError = {
        issues: [
          { path: ['field1'], message: 'Required' },
          { path: ['nested', 'field2'], message: 'Invalid' },
        ],
      };
      const error = ValidationError.fromZodError(zodError);
      expect(error.errors).toEqual([
        { field: 'field1', message: 'Required' },
        { field: 'nested.field2', message: 'Invalid' },
      ]);
    });
  });

  describe('AuthenticationError', () => {
    it('should have correct status and code', () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.message).toBe('Authentication required');
    });
  });

  describe('AuthorizationError', () => {
    it('should have correct status and code', () => {
      const error = new AuthorizationError('Cannot access', 'contract', 'delete');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.metadata).toEqual({ resource: 'contract', action: 'delete' });
    });
  });

  describe('NotFoundError', () => {
    it('should format message with resource only', () => {
      const error = new NotFoundError('Contract');
      expect(error.message).toBe('Contract not found');
      expect(error.statusCode).toBe(404);
    });

    it('should format message with resource and identifier', () => {
      const error = new NotFoundError('Contract', 'abc-123');
      expect(error.message).toBe("Contract with identifier 'abc-123' not found");
    });
  });

  describe('ConflictError', () => {
    it('should have correct status', () => {
      const error = new ConflictError('Already exists', 'contract', 'contractNumber');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('BusinessRuleError', () => {
    it('should have correct status', () => {
      const error = new BusinessRuleError('Cannot delete active contract', 'no-delete-active');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(error.metadata.rule).toBe('no-delete-active');
    });
  });

  describe('ContractStatusError', () => {
    it('should format message for single required status', () => {
      const error = new ContractStatusError('DRAFT', 'ACTIVE', 'sign');
      expect(error.message).toContain("Cannot sign: contract is in 'DRAFT' status, but must be 'ACTIVE'");
    });

    it('should format message for multiple required statuses', () => {
      const error = new ContractStatusError('DRAFT', ['ACTIVE', 'EXPIRED'], 'renew');
      expect(error.message).toContain("Cannot renew: contract is in 'DRAFT' status, but must be 'ACTIVE or EXPIRED'");
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError('Test'))).toBe(true);
      expect(isAppError(new NotFoundError('Test'))).toBe(true);
      expect(isAppError(new ValidationError())).toBe(true);
    });

    it('should return false for non-AppError', () => {
      expect(isAppError(new Error('Regular error'))).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      expect(isOperationalError(new NotFoundError('Test'))).toBe(true);
      expect(isOperationalError(new ValidationError())).toBe(true);
    });

    it('should return false for non-operational errors', () => {
      const error = new AppError('Test', 500, 'ERROR', false);
      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('normalizeError', () => {
    it('should return AppError as-is', () => {
      const original = new NotFoundError('Test');
      expect(normalizeError(original)).toBe(original);
    });

    it('should wrap standard Error', () => {
      const original = new Error('Regular error');
      const normalized = normalizeError(original);
      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe('Regular error');
      expect(normalized.isOperational).toBe(false);
    });

    it('should handle non-Error values', () => {
      const normalized = normalizeError('string error');
      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe('An unexpected error occurred');
    });
  });
});
