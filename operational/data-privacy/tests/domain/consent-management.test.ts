/**
 * Consent Management Domain Tests
 * Tests for GDPR Art. 6-7 consent logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isExpired,
  isValid,
  canWithdraw,
  type ConsentRecord,
} from '../../src/domain/consent-management/models/consent-record.js';

describe('Consent Management Domain Logic', () => {
  describe('isExpired', () => {
    it('should return false when expiresAt is not set', () => {
      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'ACTIVE',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isExpired(consent)).toBe(false);
    });

    it('should return false when expiresAt is in the future', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);

      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'ACTIVE',
        grantedAt: new Date(),
        expiresAt: future,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isExpired(consent)).toBe(false);
    });

    it('should return true when expiresAt is in the past', () => {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 1);

      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'ACTIVE',
        grantedAt: new Date(),
        expiresAt: past,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isExpired(consent)).toBe(true);
    });
  });

  describe('isValid', () => {
    it('should return true for ACTIVE consent that is not expired', () => {
      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'ACTIVE',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isValid(consent)).toBe(true);
    });

    it('should return false for WITHDRAWN consent', () => {
      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'WITHDRAWN',
        grantedAt: new Date(),
        withdrawnAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isValid(consent)).toBe(false);
    });

    it('should return false for EXPIRED consent', () => {
      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'EXPIRED',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isValid(consent)).toBe(false);
    });

    it('should return false for ACTIVE consent that has expired', () => {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 1);

      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'ACTIVE',
        grantedAt: new Date(),
        expiresAt: past,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(isValid(consent)).toBe(false);
    });
  });

  describe('canWithdraw', () => {
    it('should return true for ACTIVE consent', () => {
      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'ACTIVE',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canWithdraw(consent)).toBe(true);
    });

    it('should return false for WITHDRAWN consent', () => {
      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'WITHDRAWN',
        grantedAt: new Date(),
        withdrawnAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canWithdraw(consent)).toBe(false);
    });

    it('should return false for SUPERSEDED consent', () => {
      const consent: ConsentRecord = {
        id: '1',
        entityId: 'entity-1',
        subjectId: 'subject-1',
        purpose: 'marketing',
        lawfulBasis: 'CONSENT',
        status: 'SUPERSEDED',
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canWithdraw(consent)).toBe(false);
    });
  });
});
