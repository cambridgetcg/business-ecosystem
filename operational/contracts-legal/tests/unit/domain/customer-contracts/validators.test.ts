/**
 * Customer Contracts Validators - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  CreateContractSchema,
  UpdateContractSchema,
  ContractQuerySchema,
  SignContractSchema,
  ContractStatusEnum,
  PartyRoleEnum,
} from '../../../../src/domain/customer-contracts/validators.js';

describe('Customer Contracts Validators', () => {
  describe('ContractStatusEnum', () => {
    it('should accept valid statuses', () => {
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
        expect(ContractStatusEnum.parse(status)).toBe(status);
      });
    });

    it('should reject invalid status', () => {
      expect(() => ContractStatusEnum.parse('INVALID')).toThrow();
    });
  });

  describe('PartyRoleEnum', () => {
    it('should accept valid roles', () => {
      const validRoles = ['BUYER', 'SELLER', 'SERVICE_PROVIDER', 'CLIENT', 'EMPLOYER'];

      validRoles.forEach((role) => {
        expect(PartyRoleEnum.parse(role)).toBe(role);
      });
    });
  });

  describe('CreateContractSchema', () => {
    const validInput = {
      title: 'Software Development Agreement',
      description: 'Agreement for custom software development services',
      effectiveDate: new Date('2024-01-01'),
      expiryDate: new Date('2025-01-01'),
      value: 50000,
      currency: 'USD',
      paymentTerms: 'Net 30',
      autoRenewal: false,
      renewalTermDays: 365,
      renewalNoticeDays: 30,
      parties: [
        { partyId: 'clxxxxxxxxxxxxxxxxxx1', role: 'BUYER', isPrimary: true },
        { partyId: 'clxxxxxxxxxxxxxxxxxx2', role: 'SELLER', isPrimary: false },
      ],
    };

    it('should accept valid input', () => {
      const result = CreateContractSchema.parse(validInput);
      expect(result.title).toBe(validInput.title);
      expect(result.parties).toHaveLength(2);
    });

    it('should require title', () => {
      const input = { ...validInput, title: '' };
      expect(() => CreateContractSchema.parse(input)).toThrow();
    });

    it('should require at least one party', () => {
      const input = { ...validInput, parties: [] };
      expect(() => CreateContractSchema.parse(input)).toThrow();
    });

    it('should validate expiry date is after effective date', () => {
      const input = {
        ...validInput,
        effectiveDate: new Date('2025-01-01'),
        expiryDate: new Date('2024-01-01'),
      };
      expect(() => CreateContractSchema.parse(input)).toThrow(/expiry date must be after effective date/i);
    });

    it('should enforce title max length', () => {
      const input = { ...validInput, title: 'x'.repeat(501) };
      expect(() => CreateContractSchema.parse(input)).toThrow();
    });

    it('should default currency to USD', () => {
      const input = { title: 'Test', parties: [{ partyId: 'clxxxxxxxxxxxxxxxxxx1', role: 'BUYER' }] };
      const result = CreateContractSchema.parse(input);
      expect(result.currency).toBe('USD');
    });

    it('should require currency to be 3 characters', () => {
      const input = { ...validInput, currency: 'US' };
      expect(() => CreateContractSchema.parse(input)).toThrow();
    });

    it('should reject negative values', () => {
      const input = { ...validInput, value: -100 };
      expect(() => CreateContractSchema.parse(input)).toThrow();
    });

    it('should coerce date strings to Date objects', () => {
      const input = {
        ...validInput,
        effectiveDate: '2024-01-01',
        expiryDate: '2025-01-01',
      };
      const result = CreateContractSchema.parse(input);
      expect(result.effectiveDate).toBeInstanceOf(Date);
      expect(result.expiryDate).toBeInstanceOf(Date);
    });
  });

  describe('UpdateContractSchema', () => {
    it('should accept partial updates', () => {
      const result = UpdateContractSchema.parse({ title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });

    it('should accept empty object (no updates)', () => {
      const result = UpdateContractSchema.parse({});
      expect(result).toEqual({});
    });

    it('should validate optional fields when provided', () => {
      expect(() => UpdateContractSchema.parse({ value: -100 })).toThrow();
    });
  });

  describe('ContractQuerySchema', () => {
    it('should provide defaults', () => {
      const result = ContractQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('desc');
    });

    it('should accept valid query parameters', () => {
      const result = ContractQuerySchema.parse({
        status: 'ACTIVE',
        search: 'software',
        page: 2,
        limit: 50,
        sortBy: 'title',
        sortOrder: 'asc',
      });

      expect(result.status).toBe('ACTIVE');
      expect(result.search).toBe('software');
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should enforce limit max of 100', () => {
      expect(() => ContractQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('should coerce string numbers', () => {
      const result = ContractQuerySchema.parse({ page: '3', limit: '25' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
    });

    it('should reject invalid sort fields', () => {
      expect(() => ContractQuerySchema.parse({ sortBy: 'invalid' })).toThrow();
    });
  });

  describe('SignContractSchema', () => {
    it('should accept valid signature input', () => {
      const result = SignContractSchema.parse({
        partyId: 'clxxxxxxxxxxxxxxxxxx1',
        signedBy: 'John Doe',
        signatureRef: 'sig-123',
      });

      expect(result.partyId).toBe('clxxxxxxxxxxxxxxxxxx1');
      expect(result.signedBy).toBe('John Doe');
      expect(result.signatureRef).toBe('sig-123');
    });

    it('should require partyId', () => {
      expect(() => SignContractSchema.parse({ signedBy: 'John' })).toThrow();
    });

    it('should require signedBy', () => {
      expect(() => SignContractSchema.parse({ partyId: 'clxxxxxxxxxxxxxxxxxx1' })).toThrow();
    });

    it('should allow optional signatureRef', () => {
      const result = SignContractSchema.parse({
        partyId: 'clxxxxxxxxxxxxxxxxxx1',
        signedBy: 'John Doe',
      });
      expect(result.signatureRef).toBeUndefined();
    });
  });
});
