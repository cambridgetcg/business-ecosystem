/**
 * Legal Entity Domain Model Tests
 */

import { describe, it, expect } from 'vitest';
import {
  LegalEntitySchema,
  CreateLegalEntityInputSchema,
  UpdateLegalEntityInputSchema,
  canDissolve,
  canMerge,
  isActive,
  type LegalEntity,
} from '../../../src/domain/entity/models/legal-entity.js';

describe('LegalEntity Domain Model', () => {
  // ==========================================================================
  // Test Fixtures
  // ==========================================================================

  const createTestEntity = (overrides: Partial<LegalEntity> = {}): LegalEntity => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Corp',
    legalName: 'Test Corporation Inc.',
    entityType: 'llc',
    status: 'active',
    jurisdiction: { country: 'US', state: 'DE' },
    incorporationDate: new Date('2024-01-01'),
    taxId: '12-3456789',
    registrationNumber: 'DE-12345',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  });

  // ==========================================================================
  // Schema Validation Tests
  // ==========================================================================

  describe('LegalEntitySchema', () => {
    it('should validate a complete legal entity', () => {
      const entity = createTestEntity();
      const result = LegalEntitySchema.safeParse(entity);
      expect(result.success).toBe(true);
    });

    it('should require id to be a valid UUID', () => {
      const entity = createTestEntity({ id: 'invalid-id' });
      const result = LegalEntitySchema.safeParse(entity);
      expect(result.success).toBe(false);
    });

    it('should require name to be non-empty', () => {
      const entity = createTestEntity({ name: '' });
      const result = LegalEntitySchema.safeParse(entity);
      expect(result.success).toBe(false);
    });

    it('should enforce name max length of 255', () => {
      const entity = createTestEntity({ name: 'a'.repeat(256) });
      const result = LegalEntitySchema.safeParse(entity);
      expect(result.success).toBe(false);
    });

    it('should accept valid entity types', () => {
      const types = ['corporation', 'llc', 'lp', 'llp', 'partnership', 'sole_proprietorship', 'nonprofit', 'trust', 'other'];
      for (const entityType of types) {
        const entity = createTestEntity({ entityType: entityType as LegalEntity['entityType'] });
        const result = LegalEntitySchema.safeParse(entity);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid entity types', () => {
      const entity = createTestEntity();
      (entity as any).entityType = 'invalid_type';
      const result = LegalEntitySchema.safeParse(entity);
      expect(result.success).toBe(false);
    });

    it('should accept valid status values', () => {
      const statuses = ['active', 'inactive', 'dissolved', 'merged', 'converted', 'suspended'];
      for (const status of statuses) {
        const entity = createTestEntity({ status: status as LegalEntity['status'] });
        const result = LegalEntitySchema.safeParse(entity);
        expect(result.success).toBe(true);
      }
    });

    it('should accept optional fields as undefined', () => {
      const entity = createTestEntity({
        incorporationDate: undefined,
        dissolutionDate: undefined,
        taxId: undefined,
        registrationNumber: undefined,
        metadata: undefined,
        createdBy: undefined,
        updatedBy: undefined,
        deletedAt: undefined,
      });
      const result = LegalEntitySchema.safeParse(entity);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateLegalEntityInputSchema', () => {
    it('should validate valid creation input', () => {
      const input = {
        name: 'New Corp',
        legalName: 'New Corporation Inc.',
        entityType: 'llc',
        jurisdictionCountry: 'US',
        jurisdictionState: 'DE',
      };
      const result = CreateLegalEntityInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require jurisdictionCountry to be 2 characters', () => {
      const input = {
        name: 'New Corp',
        legalName: 'New Corporation Inc.',
        entityType: 'llc',
        jurisdictionCountry: 'USA', // Too long
      };
      const result = CreateLegalEntityInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should make jurisdictionState optional', () => {
      const input = {
        name: 'New Corp',
        legalName: 'New Corporation Inc.',
        entityType: 'llc',
        jurisdictionCountry: 'UK',
      };
      const result = CreateLegalEntityInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateLegalEntityInputSchema', () => {
    it('should allow partial updates', () => {
      const input = { name: 'Updated Name' };
      const result = UpdateLegalEntityInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should allow empty update (no changes)', () => {
      const result = UpdateLegalEntityInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should allow status change', () => {
      const input = { status: 'inactive' };
      const result = UpdateLegalEntityInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Domain Logic Tests
  // ==========================================================================

  describe('canDissolve', () => {
    it('should return true for active entities', () => {
      const entity = createTestEntity({ status: 'active' });
      expect(canDissolve(entity)).toBe(true);
    });

    it('should return true for inactive entities', () => {
      const entity = createTestEntity({ status: 'inactive' });
      expect(canDissolve(entity)).toBe(true);
    });

    it('should return false for already dissolved entities', () => {
      const entity = createTestEntity({ status: 'dissolved' });
      expect(canDissolve(entity)).toBe(false);
    });

    it('should return false for merged entities', () => {
      const entity = createTestEntity({ status: 'merged' });
      expect(canDissolve(entity)).toBe(false);
    });

    it('should return false for suspended entities', () => {
      const entity = createTestEntity({ status: 'suspended' });
      expect(canDissolve(entity)).toBe(false);
    });
  });

  describe('canMerge', () => {
    it('should return true for active entities', () => {
      const entity = createTestEntity({ status: 'active' });
      expect(canMerge(entity)).toBe(true);
    });

    it('should return false for inactive entities', () => {
      const entity = createTestEntity({ status: 'inactive' });
      expect(canMerge(entity)).toBe(false);
    });

    it('should return false for dissolved entities', () => {
      const entity = createTestEntity({ status: 'dissolved' });
      expect(canMerge(entity)).toBe(false);
    });

    it('should return false for suspended entities', () => {
      const entity = createTestEntity({ status: 'suspended' });
      expect(canMerge(entity)).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return true for active entity without deletedAt', () => {
      const entity = createTestEntity({ status: 'active', deletedAt: undefined });
      expect(isActive(entity)).toBe(true);
    });

    it('should return false for active entity with deletedAt', () => {
      const entity = createTestEntity({ status: 'active', deletedAt: new Date() });
      expect(isActive(entity)).toBe(false);
    });

    it('should return false for inactive entity', () => {
      const entity = createTestEntity({ status: 'inactive' });
      expect(isActive(entity)).toBe(false);
    });

    it('should return false for dissolved entity', () => {
      const entity = createTestEntity({ status: 'dissolved' });
      expect(isActive(entity)).toBe(false);
    });
  });
});
