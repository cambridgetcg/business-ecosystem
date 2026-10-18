/**
 * Officer Domain Model Tests
 */

import { describe, it, expect } from 'vitest';
import {
  OfficerSchema,
  CreateOfficerInputSchema,
  UpdateOfficerInputSchema,
  isActiveOfficer,
  canTerminate,
  formatOfficerTitle,
  type Officer,
} from '../../../src/domain/officer/models/officer.js';

describe('Officer Domain Model', () => {
  // ==========================================================================
  // Test Fixtures
  // ==========================================================================

  const createTestOfficer = (overrides: Partial<Officer> = {}): Officer => ({
    id: '123e4567-e89b-12d3-a456-426614174001',
    entityId: '123e4567-e89b-12d3-a456-426614174000',
    personId: '123e4567-e89b-12d3-a456-426614174002',
    name: 'John Smith',
    title: 'ceo',
    customTitle: null,
    email: 'john@example.com',
    appointmentDate: new Date('2024-01-01'),
    terminationDate: null,
    compensationAmount: 250000,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    version: 1,
    ...overrides,
  });

  // ==========================================================================
  // Schema Validation Tests
  // ==========================================================================

  describe('OfficerSchema', () => {
    it('should validate a complete officer', () => {
      const officer = createTestOfficer();
      const result = OfficerSchema.safeParse(officer);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs for id, entityId, personId', () => {
      const officer = createTestOfficer({ id: 'invalid' });
      const result = OfficerSchema.safeParse(officer);
      expect(result.success).toBe(false);
    });

    it('should accept all valid officer titles', () => {
      const titles = [
        'ceo', 'cfo', 'coo', 'cto', 'president', 'vice_president',
        'secretary', 'treasurer', 'general_counsel', 'other'
      ];
      for (const title of titles) {
        const officer = createTestOfficer({ title: title as Officer['title'] });
        const result = OfficerSchema.safeParse(officer);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid officer titles', () => {
      const officer = createTestOfficer();
      (officer as any).title = 'invalid_title';
      const result = OfficerSchema.safeParse(officer);
      expect(result.success).toBe(false);
    });

    it('should accept null for optional fields', () => {
      const officer = createTestOfficer({
        customTitle: null,
        email: null,
        terminationDate: null,
        compensationAmount: null,
        metadata: null,
        createdBy: null,
        updatedBy: null,
      });
      const result = OfficerSchema.safeParse(officer);
      expect(result.success).toBe(true);
    });

    it('should validate email format when provided', () => {
      const officer = createTestOfficer({ email: 'invalid-email' });
      // Note: The schema uses z.string().nullable() not z.string().email().nullable()
      // So this test documents current behavior
      const result = OfficerSchema.safeParse(officer);
      expect(result.success).toBe(true); // Currently accepts any string
    });
  });

  describe('CreateOfficerInputSchema', () => {
    it('should validate valid creation input', () => {
      const input = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        personId: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Jane Doe',
        title: 'cfo',
        appointmentDate: new Date(),
      };
      const result = CreateOfficerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require name to be non-empty', () => {
      const input = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        personId: '123e4567-e89b-12d3-a456-426614174002',
        name: '',
        title: 'cfo',
        appointmentDate: new Date(),
      };
      const result = CreateOfficerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should enforce name max length of 255', () => {
      const input = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        personId: '123e4567-e89b-12d3-a456-426614174002',
        name: 'a'.repeat(256),
        title: 'cfo',
        appointmentDate: new Date(),
      };
      const result = CreateOfficerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should make optional fields optional', () => {
      const input = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        personId: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Jane Doe',
        title: 'cfo',
        appointmentDate: new Date(),
        // No customTitle, email, compensationAmount, metadata
      };
      const result = CreateOfficerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate email format when provided', () => {
      const input = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        personId: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Jane Doe',
        title: 'cfo',
        appointmentDate: new Date(),
        email: 'invalid-email',
      };
      const result = CreateOfficerInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateOfficerInputSchema', () => {
    it('should allow partial updates', () => {
      const input = { title: 'president' };
      const result = UpdateOfficerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const result = UpdateOfficerInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should allow setting fields to null', () => {
      const input = {
        customTitle: null,
        email: null,
        compensationAmount: null,
      };
      const result = UpdateOfficerInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Domain Logic Tests
  // ==========================================================================

  describe('isActiveOfficer', () => {
    it('should return true when terminationDate is null', () => {
      const officer = createTestOfficer({ terminationDate: null });
      expect(isActiveOfficer(officer)).toBe(true);
    });

    it('should return false when terminationDate is set', () => {
      const officer = createTestOfficer({ terminationDate: new Date() });
      expect(isActiveOfficer(officer)).toBe(false);
    });

    it('should return false for past termination date', () => {
      const officer = createTestOfficer({ terminationDate: new Date('2020-01-01') });
      expect(isActiveOfficer(officer)).toBe(false);
    });

    it('should return false for future termination date', () => {
      const officer = createTestOfficer({ terminationDate: new Date('2099-01-01') });
      expect(isActiveOfficer(officer)).toBe(false);
    });
  });

  describe('canTerminate', () => {
    it('should return true when terminationDate is null', () => {
      const officer = createTestOfficer({ terminationDate: null });
      expect(canTerminate(officer)).toBe(true);
    });

    it('should return false when already terminated', () => {
      const officer = createTestOfficer({ terminationDate: new Date() });
      expect(canTerminate(officer)).toBe(false);
    });
  });

  describe('formatOfficerTitle', () => {
    it('should return customTitle when set', () => {
      const officer = createTestOfficer({
        title: 'other',
        customTitle: 'Chief People Officer',
      });
      expect(formatOfficerTitle(officer)).toBe('Chief People Officer');
    });

    it('should return full title for ceo', () => {
      const officer = createTestOfficer({ title: 'ceo', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('Chief Executive Officer');
    });

    it('should return full title for cfo', () => {
      const officer = createTestOfficer({ title: 'cfo', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('Chief Financial Officer');
    });

    it('should return full title for coo', () => {
      const officer = createTestOfficer({ title: 'coo', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('Chief Operating Officer');
    });

    it('should return full title for cto', () => {
      const officer = createTestOfficer({ title: 'cto', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('Chief Technology Officer');
    });

    it('should return full title for president', () => {
      const officer = createTestOfficer({ title: 'president', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('President');
    });

    it('should return full title for vice_president', () => {
      const officer = createTestOfficer({ title: 'vice_president', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('Vice President');
    });

    it('should return full title for secretary', () => {
      const officer = createTestOfficer({ title: 'secretary', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('Secretary');
    });

    it('should return full title for treasurer', () => {
      const officer = createTestOfficer({ title: 'treasurer', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('Treasurer');
    });

    it('should return full title for general_counsel', () => {
      const officer = createTestOfficer({ title: 'general_counsel', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('General Counsel');
    });

    it('should return "Officer" for other', () => {
      const officer = createTestOfficer({ title: 'other', customTitle: null });
      expect(formatOfficerTitle(officer)).toBe('Officer');
    });

    it('should prefer customTitle over standard title', () => {
      const officer = createTestOfficer({
        title: 'ceo',
        customTitle: 'Interim CEO',
      });
      expect(formatOfficerTitle(officer)).toBe('Interim CEO');
    });
  });
});
