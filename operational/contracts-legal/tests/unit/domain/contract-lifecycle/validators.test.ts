/**
 * Contract Lifecycle Validators - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  LifecycleStatusEnum,
  TransitionRequestSchema,
  RenewalRequestSchema,
  ExpirationQuerySchema,
  BulkRenewalRequestSchema,
  isValidTransition,
  getAllowedTransitions,
  getActionForTransition,
  VALID_TRANSITIONS,
} from '../../../../src/domain/contract-lifecycle/validators.js';

describe('Contract Lifecycle Validators', () => {
  describe('LifecycleStatusEnum', () => {
    it('should accept all valid statuses', () => {
      const validStatuses = [
        'DRAFT',
        'PENDING_REVIEW',
        'IN_NEGOTIATION',
        'PENDING_APPROVAL',
        'PENDING_SIGNATURE',
        'ACTIVE',
        'SUSPENDED',
        'EXPIRED',
        'TERMINATED',
        'RENEWED',
        'ARCHIVED',
      ];

      validStatuses.forEach((status) => {
        expect(LifecycleStatusEnum.parse(status)).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      expect(() => LifecycleStatusEnum.parse('INVALID')).toThrow();
    });
  });

  describe('TransitionRequestSchema', () => {
    it('should accept valid transition request', () => {
      const result = TransitionRequestSchema.parse({
        contractId: 'clxxxxxxxxxxxxxxxxxx1',
        action: 'SUBMIT_FOR_REVIEW',
        reason: 'Ready for legal review',
      });

      expect(result.contractId).toBe('clxxxxxxxxxxxxxxxxxx1');
      expect(result.action).toBe('SUBMIT_FOR_REVIEW');
    });

    it('should reject invalid action', () => {
      expect(() =>
        TransitionRequestSchema.parse({
          contractId: 'clxxxxxxxxxxxxxxxxxx1',
          action: 'INVALID_ACTION',
        })
      ).toThrow();
    });

    it('should allow optional fields', () => {
      const result = TransitionRequestSchema.parse({
        contractId: 'clxxxxxxxxxxxxxxxxxx1',
        action: 'APPROVE',
      });

      expect(result.reason).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('RenewalRequestSchema', () => {
    it('should accept valid renewal request', () => {
      const result = RenewalRequestSchema.parse({
        contractId: 'clxxxxxxxxxxxxxxxxxx1',
        newExpiryDate: '2027-01-01',
        updateValue: 50000,
        updateCurrency: 'USD',
      });

      expect(result.contractId).toBe('clxxxxxxxxxxxxxxxxxx1');
      expect(result.newExpiryDate).toBeInstanceOf(Date);
    });

    it('should accept minimal renewal request', () => {
      const result = RenewalRequestSchema.parse({
        contractId: 'clxxxxxxxxxxxxxxxxxx1',
      });

      expect(result.contractId).toBe('clxxxxxxxxxxxxxxxxxx1');
    });

    it('should validate currency length', () => {
      expect(() =>
        RenewalRequestSchema.parse({
          contractId: 'clxxxxxxxxxxxxxxxxxx1',
          updateCurrency: 'USDD',
        })
      ).toThrow();
    });
  });

  describe('ExpirationQuerySchema', () => {
    it('should provide defaults', () => {
      const result = ExpirationQuerySchema.parse({});

      expect(result.daysAhead).toBe(30);
      expect(result.includeAutoRenewal).toBe(true);
    });

    it('should accept custom values', () => {
      const result = ExpirationQuerySchema.parse({
        daysAhead: 60,
        includeAutoRenewal: false,
        status: 'ACTIVE',
      });

      expect(result.daysAhead).toBe(60);
      expect(result.includeAutoRenewal).toBe(false);
      expect(result.status).toBe('ACTIVE');
    });

    it('should enforce max daysAhead', () => {
      expect(() => ExpirationQuerySchema.parse({ daysAhead: 400 })).toThrow();
    });
  });

  describe('BulkRenewalRequestSchema', () => {
    it('should accept valid bulk request', () => {
      const result = BulkRenewalRequestSchema.parse({
        contractIds: ['clxxxxxxxxxxxxxxxxxx1', 'clxxxxxxxxxxxxxxxxxx2'],
        renewalTermDays: 365,
        skipInvalid: true,
      });

      expect(result.contractIds).toHaveLength(2);
      expect(result.skipInvalid).toBe(true);
    });

    it('should require at least one contract', () => {
      expect(() =>
        BulkRenewalRequestSchema.parse({
          contractIds: [],
        })
      ).toThrow();
    });

    it('should enforce max contracts limit', () => {
      const tooMany = Array(101)
        .fill(null)
        .map((_, i) => `clx${i.toString().padStart(17, '0')}`);

      expect(() =>
        BulkRenewalRequestSchema.parse({
          contractIds: tooMany,
        })
      ).toThrow();
    });
  });

  describe('isValidTransition', () => {
    it('should return true for valid transitions', () => {
      expect(isValidTransition('DRAFT', 'PENDING_REVIEW')).toBe(true);
      expect(isValidTransition('ACTIVE', 'TERMINATED')).toBe(true);
      expect(isValidTransition('ACTIVE', 'SUSPENDED')).toBe(true);
      expect(isValidTransition('EXPIRED', 'RENEWED')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(isValidTransition('DRAFT', 'ACTIVE')).toBe(false);
      expect(isValidTransition('ARCHIVED', 'ACTIVE')).toBe(false);
      expect(isValidTransition('TERMINATED', 'ACTIVE')).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return allowed transitions for DRAFT', () => {
      const allowed = getAllowedTransitions('DRAFT');
      expect(allowed).toContain('PENDING_REVIEW');
      expect(allowed).toContain('ARCHIVED');
      expect(allowed).not.toContain('ACTIVE');
    });

    it('should return allowed transitions for ACTIVE', () => {
      const allowed = getAllowedTransitions('ACTIVE');
      expect(allowed).toContain('SUSPENDED');
      expect(allowed).toContain('TERMINATED');
      expect(allowed).toContain('EXPIRED');
      expect(allowed).toContain('RENEWED');
    });

    it('should return empty array for ARCHIVED', () => {
      const allowed = getAllowedTransitions('ARCHIVED');
      expect(allowed).toHaveLength(0);
    });
  });

  describe('getActionForTransition', () => {
    it('should return action for valid transition', () => {
      expect(getActionForTransition('DRAFT', 'PENDING_REVIEW')).toBe('SUBMIT_FOR_REVIEW');
      expect(getActionForTransition('ACTIVE', 'TERMINATED')).toBe('TERMINATE');
      expect(getActionForTransition('ACTIVE', 'SUSPENDED')).toBe('SUSPEND');
    });

    it('should return null for invalid transition', () => {
      expect(getActionForTransition('DRAFT', 'ACTIVE')).toBeNull();
      expect(getActionForTransition('ARCHIVED', 'DRAFT')).toBeNull();
    });
  });

  describe('VALID_TRANSITIONS', () => {
    it('should have transitions defined for all statuses', () => {
      const allStatuses = [
        'DRAFT',
        'PENDING_REVIEW',
        'IN_NEGOTIATION',
        'PENDING_APPROVAL',
        'PENDING_SIGNATURE',
        'ACTIVE',
        'SUSPENDED',
        'EXPIRED',
        'TERMINATED',
        'RENEWED',
        'ARCHIVED',
      ];

      allStatuses.forEach((status) => {
        expect(VALID_TRANSITIONS[status as keyof typeof VALID_TRANSITIONS]).toBeDefined();
      });
    });

    it('should not allow circular transitions back to DRAFT from final states', () => {
      expect(VALID_TRANSITIONS['TERMINATED']).not.toContain('DRAFT');
      expect(VALID_TRANSITIONS['ARCHIVED']).not.toContain('DRAFT');
    });
  });
});
