/**
 * Processing Activity Domain Tests
 * Tests for GDPR Art. 30 records of processing activities logic
 */

import { describe, it, expect } from 'vitest';
import {
  hasSpecialCategoryData,
  hasThirdCountryTransfers,
  shouldRequireDPIA,
  isReviewDue,
  calculateNextReviewDate,
  canArchive,
  validateSpecialCategoryBasis,
  type ProcessingActivity,
} from '../../src/domain/data-inventory/models/processing-activity.js';

describe('Processing Activity Domain Logic', () => {
  const baseActivity: Omit<ProcessingActivity, 'specialCategories' | 'thirdCountryTransfers' | 'status' | 'dataCategories' | 'purposes' | 'lawfulBasis' | 'transferSafeguards' | 'nextReviewDue'> = {
    id: '1',
    entityId: 'entity-1',
    name: 'Test Activity',
    description: 'Test processing activity',
    subjectCategories: ['customers'],
    recipients: [],
    technicalMeasures: [],
    organizationalMeasures: [],
    dpiaRequired: false,
    controller: 'Test Controller',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
  };

  describe('hasSpecialCategoryData', () => {
    it('should return false when no special categories', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(hasSpecialCategoryData(activity)).toBe(false);
    });

    it('should return true when special categories exist', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: ['HEALTH_DATA'],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(hasSpecialCategoryData(activity)).toBe(true);
    });

    it('should return true for multiple special categories', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: ['HEALTH_DATA', 'BIOMETRIC_DATA'],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(hasSpecialCategoryData(activity)).toBe(true);
    });
  });

  describe('hasThirdCountryTransfers', () => {
    it('should return false when no third country transfers', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(hasThirdCountryTransfers(activity)).toBe(false);
    });

    it('should return true when third country transfers exist', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: ['US', 'JP'],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(hasThirdCountryTransfers(activity)).toBe(true);
    });
  });

  describe('shouldRequireDPIA', () => {
    it('should return false for simple processing without risk factors', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY', 'CONTACT_DETAILS'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(shouldRequireDPIA(activity)).toBe(false);
    });

    it('should return true for special category data', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: ['HEALTH_DATA'],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONSENT'],
      };
      expect(shouldRequireDPIA(activity)).toBe(true);
    });

    it('should return true for behavioral data with profiling purpose', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BEHAVIORAL'],
        purposes: ['user profiling', 'personalization'],
        lawfulBasis: ['LEGITIMATE_INTEREST'],
      };
      expect(shouldRequireDPIA(activity)).toBe(true);
    });

    it('should return true for third country transfers without safeguards', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: ['US'],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(shouldRequireDPIA(activity)).toBe(true);
    });

    it('should return false for third country transfers with safeguards', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: ['US'],
        transferSafeguards: 'Standard Contractual Clauses',
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(shouldRequireDPIA(activity)).toBe(false);
    });
  });

  describe('isReviewDue', () => {
    it('should return false when no review date set', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(isReviewDue(activity)).toBe(false);
    });

    it('should return true when review date is past', () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 1);

      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
        nextReviewDue: pastDate,
      };
      expect(isReviewDue(activity)).toBe(true);
    });

    it('should return false when review date is in future', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);

      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
        nextReviewDue: futureDate,
      };
      expect(isReviewDue(activity)).toBe(false);
    });
  });

  describe('calculateNextReviewDate', () => {
    it('should return date 1 year from now when no date provided', () => {
      const nextReview = calculateNextReviewDate();
      const expectedYear = new Date().getFullYear() + 1;
      expect(nextReview.getFullYear()).toBe(expectedYear);
    });

    it('should return date 1 year from provided date', () => {
      const fromDate = new Date('2025-06-15');
      const nextReview = calculateNextReviewDate(fromDate);
      expect(nextReview.toISOString().slice(0, 10)).toBe('2026-06-15');
    });
  });

  describe('canArchive', () => {
    it('should return false for DRAFT status', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'DRAFT',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(canArchive(activity)).toBe(false);
    });

    it('should return false for ACTIVE status', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(canArchive(activity)).toBe(false);
    });

    it('should return true for SUSPENDED status', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'SUSPENDED',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(canArchive(activity)).toBe(true);
    });

    it('should return true for UNDER_REVIEW status', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'UNDER_REVIEW',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(canArchive(activity)).toBe(true);
    });

    it('should return false for ARCHIVED status', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ARCHIVED',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      expect(canArchive(activity)).toBe(false);
    });
  });

  describe('validateSpecialCategoryBasis', () => {
    it('should return valid when no special categories', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: [],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      const result = validateSpecialCategoryBasis(activity);
      expect(result.valid).toBe(true);
    });

    it('should return valid for special categories with CONSENT', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: ['HEALTH_DATA'],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['health services'],
        lawfulBasis: ['CONSENT'],
      };
      const result = validateSpecialCategoryBasis(activity);
      expect(result.valid).toBe(true);
    });

    it('should return valid for special categories with LEGAL_OBLIGATION', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: ['HEALTH_DATA'],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['legal compliance'],
        lawfulBasis: ['LEGAL_OBLIGATION'],
      };
      const result = validateSpecialCategoryBasis(activity);
      expect(result.valid).toBe(true);
    });

    it('should return valid for special categories with VITAL_INTEREST', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: ['HEALTH_DATA'],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['emergency services'],
        lawfulBasis: ['VITAL_INTEREST'],
      };
      const result = validateSpecialCategoryBasis(activity);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for special categories with CONTRACT only', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: ['HEALTH_DATA'],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['service delivery'],
        lawfulBasis: ['CONTRACT'],
      };
      const result = validateSpecialCategoryBasis(activity);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Art. 9(2)');
    });

    it('should return invalid for special categories with LEGITIMATE_INTEREST only', () => {
      const activity: ProcessingActivity = {
        ...baseActivity,
        specialCategories: ['BIOMETRIC_DATA'],
        thirdCountryTransfers: [],
        status: 'ACTIVE',
        dataCategories: ['BASIC_IDENTITY'],
        purposes: ['access control'],
        lawfulBasis: ['LEGITIMATE_INTEREST'],
      };
      const result = validateSpecialCategoryBasis(activity);
      expect(result.valid).toBe(false);
    });
  });
});
