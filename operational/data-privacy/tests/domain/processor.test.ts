/**
 * Data Processor Domain Tests
 * Tests for GDPR Art. 28 processor relationship logic
 */

import { describe, it, expect } from 'vitest';
import {
  isEUCountry,
  hasAdequacyDecision,
  requiresTransferMechanism,
  isDPAExpiringSoon,
  isDPAExpired,
  hasValidDPA,
  canActivate,
  isAuditOverdue,
  getComplianceRisk,
  type DataProcessor,
} from '../../src/domain/vendor-privacy/models/data-processor.js';

describe('Data Processor Domain Logic', () => {
  describe('isEUCountry', () => {
    it('should return true for EU countries', () => {
      expect(isEUCountry('DE')).toBe(true);
      expect(isEUCountry('FR')).toBe(true);
      expect(isEUCountry('IT')).toBe(true);
      expect(isEUCountry('ES')).toBe(true);
      expect(isEUCountry('NL')).toBe(true);
    });

    it('should return true for EEA countries', () => {
      expect(isEUCountry('NO')).toBe(true);
      expect(isEUCountry('IS')).toBe(true);
      expect(isEUCountry('LI')).toBe(true);
    });

    it('should return false for non-EU countries', () => {
      expect(isEUCountry('US')).toBe(false);
      expect(isEUCountry('CN')).toBe(false);
      expect(isEUCountry('IN')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isEUCountry('de')).toBe(true);
      expect(isEUCountry('De')).toBe(true);
    });
  });

  describe('hasAdequacyDecision', () => {
    it('should return true for countries with adequacy decisions', () => {
      expect(hasAdequacyDecision('GB')).toBe(true);
      expect(hasAdequacyDecision('JP')).toBe(true);
      expect(hasAdequacyDecision('CH')).toBe(true);
      expect(hasAdequacyDecision('NZ')).toBe(true);
      expect(hasAdequacyDecision('CA')).toBe(true);
    });

    it('should return false for countries without adequacy decisions', () => {
      expect(hasAdequacyDecision('CN')).toBe(false);
      expect(hasAdequacyDecision('IN')).toBe(false);
      expect(hasAdequacyDecision('BR')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(hasAdequacyDecision('gb')).toBe(true);
      expect(hasAdequacyDecision('Gb')).toBe(true);
    });
  });

  describe('requiresTransferMechanism', () => {
    const baseProcessor: Omit<DataProcessor, 'isEU' | 'country'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Processor',
      dataCategories: ['BASIC_IDENTITY'],
      purposes: ['service delivery'],
      hasSubProcessors: false,
      complianceStatus: 'COMPLIANT',
      certifications: [],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false for EU processor', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'DE',
        isEU: true,
      };
      expect(requiresTransferMechanism(processor)).toBe(false);
    });

    it('should return false for adequacy country', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'GB',
        isEU: false,
      };
      expect(requiresTransferMechanism(processor)).toBe(false);
    });

    it('should return true for non-EU without adequacy', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'CN',
        isEU: false,
      };
      expect(requiresTransferMechanism(processor)).toBe(true);
    });
  });

  describe('isDPAExpiringSoon', () => {
    const baseProcessor: Omit<DataProcessor, 'dpaExpiresAt'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Processor',
      country: 'DE',
      isEU: true,
      dataCategories: ['BASIC_IDENTITY'],
      purposes: ['service delivery'],
      hasSubProcessors: false,
      complianceStatus: 'COMPLIANT',
      certifications: [],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false when no expiry date set', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
      };
      expect(isDPAExpiringSoon(processor)).toBe(false);
    });

    it('should return true when expiring within 90 days', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const processor: DataProcessor = {
        ...baseProcessor,
        dpaExpiresAt: expiresAt,
      };
      expect(isDPAExpiringSoon(processor)).toBe(true);
    });

    it('should return false when expiring after 90 days', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 180);

      const processor: DataProcessor = {
        ...baseProcessor,
        dpaExpiresAt: expiresAt,
      };
      expect(isDPAExpiringSoon(processor)).toBe(false);
    });

    it('should respect custom threshold', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 45);

      const processor: DataProcessor = {
        ...baseProcessor,
        dpaExpiresAt: expiresAt,
      };

      expect(isDPAExpiringSoon(processor, 30)).toBe(false);
      expect(isDPAExpiringSoon(processor, 60)).toBe(true);
    });
  });

  describe('isDPAExpired', () => {
    const baseProcessor: Omit<DataProcessor, 'dpaExpiresAt'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Processor',
      country: 'DE',
      isEU: true,
      dataCategories: ['BASIC_IDENTITY'],
      purposes: ['service delivery'],
      hasSubProcessors: false,
      complianceStatus: 'COMPLIANT',
      certifications: [],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false when no expiry date set', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
      };
      expect(isDPAExpired(processor)).toBe(false);
    });

    it('should return true when past expiry date', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 30);

      const processor: DataProcessor = {
        ...baseProcessor,
        dpaExpiresAt: expiresAt,
      };
      expect(isDPAExpired(processor)).toBe(true);
    });

    it('should return false when before expiry date', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const processor: DataProcessor = {
        ...baseProcessor,
        dpaExpiresAt: expiresAt,
      };
      expect(isDPAExpired(processor)).toBe(false);
    });
  });

  describe('hasValidDPA', () => {
    const baseProcessor: Omit<DataProcessor, 'dpaSignedAt' | 'dpaExpiresAt'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Processor',
      country: 'DE',
      isEU: true,
      dataCategories: ['BASIC_IDENTITY'],
      purposes: ['service delivery'],
      hasSubProcessors: false,
      complianceStatus: 'COMPLIANT',
      certifications: [],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false when no DPA signed', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
      };
      expect(hasValidDPA(processor)).toBe(false);
    });

    it('should return true when DPA signed and not expired', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const processor: DataProcessor = {
        ...baseProcessor,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
      };
      expect(hasValidDPA(processor)).toBe(true);
    });

    it('should return false when DPA signed but expired', () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 30);

      const processor: DataProcessor = {
        ...baseProcessor,
        dpaSignedAt: new Date('2024-01-01'),
        dpaExpiresAt: expiresAt,
      };
      expect(hasValidDPA(processor)).toBe(false);
    });
  });

  describe('canActivate', () => {
    const baseProcessor: Omit<DataProcessor, 'dpaSignedAt' | 'dpaExpiresAt' | 'isEU' | 'country' | 'transferMechanism'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Processor',
      dataCategories: ['BASIC_IDENTITY'],
      purposes: ['service delivery'],
      hasSubProcessors: false,
      complianceStatus: 'COMPLIANT',
      certifications: [],
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return false without valid DPA', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'DE',
        isEU: true,
      };
      expect(canActivate(processor)).toBe(false);
    });

    it('should return true for EU processor with valid DPA', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'DE',
        isEU: true,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
      };
      expect(canActivate(processor)).toBe(true);
    });

    it('should return false for non-EU processor without transfer mechanism', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'CN',
        isEU: false,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
      };
      expect(canActivate(processor)).toBe(false);
    });

    it('should return true for non-EU processor with transfer mechanism', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'CN',
        isEU: false,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
        transferMechanism: 'STANDARD_CONTRACTUAL_CLAUSES',
      };
      expect(canActivate(processor)).toBe(true);
    });

    it('should return true for adequacy country without transfer mechanism', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'GB',
        isEU: false,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
      };
      expect(canActivate(processor)).toBe(true);
    });
  });

  describe('isAuditOverdue', () => {
    const baseProcessor: Omit<DataProcessor, 'lastAuditDate'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Processor',
      country: 'DE',
      isEU: true,
      dataCategories: ['BASIC_IDENTITY'],
      purposes: ['service delivery'],
      hasSubProcessors: false,
      complianceStatus: 'COMPLIANT',
      certifications: [],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return true when no audit date', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
      };
      expect(isAuditOverdue(processor)).toBe(true);
    });

    it('should return true when audit over 1 year ago', () => {
      const lastAuditDate = new Date();
      lastAuditDate.setFullYear(lastAuditDate.getFullYear() - 2);

      const processor: DataProcessor = {
        ...baseProcessor,
        lastAuditDate,
      };
      expect(isAuditOverdue(processor)).toBe(true);
    });

    it('should return false when audit within 1 year', () => {
      const lastAuditDate = new Date();
      lastAuditDate.setMonth(lastAuditDate.getMonth() - 6);

      const processor: DataProcessor = {
        ...baseProcessor,
        lastAuditDate,
      };
      expect(isAuditOverdue(processor)).toBe(false);
    });
  });

  describe('getComplianceRisk', () => {
    const baseProcessor: Omit<DataProcessor, 'dpaSignedAt' | 'dpaExpiresAt' | 'isEU' | 'country' | 'transferMechanism' | 'complianceStatus' | 'lastAuditDate' | 'hasSubProcessors' | 'subProcessors'> = {
      id: '1',
      entityId: 'entity-1',
      name: 'Test Processor',
      dataCategories: ['BASIC_IDENTITY'],
      purposes: ['service delivery'],
      certifications: [],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    it('should return LOW for compliant EU processor with all requirements', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const lastAuditDate = new Date();
      lastAuditDate.setMonth(lastAuditDate.getMonth() - 6);

      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'DE',
        isEU: true,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
        complianceStatus: 'COMPLIANT',
        lastAuditDate,
        hasSubProcessors: false,
      };
      expect(getComplianceRisk(processor)).toBe('LOW');
    });

    it('should return CRITICAL for processor without DPA and non-compliant', () => {
      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'DE',
        isEU: true,
        complianceStatus: 'NON_COMPLIANT',
        hasSubProcessors: false,
      };
      expect(getComplianceRisk(processor)).toBe('CRITICAL');
    });

    it('should return HIGH for non-EU processor without transfer mechanism and audit overdue', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Audit overdue (> 1 year ago) adds +1 to risk score
      // Non-EU without mechanism adds +3
      // Total = 4 = HIGH

      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'CN',
        isEU: false,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
        complianceStatus: 'COMPLIANT',
        hasSubProcessors: false,
        // No lastAuditDate = audit overdue (+1)
      };
      expect(getComplianceRisk(processor)).toBe('HIGH');
    });

    it('should increase risk for sub-processors without details', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const lastAuditDate = new Date();
      lastAuditDate.setMonth(lastAuditDate.getMonth() - 6);

      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'DE',
        isEU: true,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
        complianceStatus: 'COMPLIANT',
        lastAuditDate,
        hasSubProcessors: true,
        subProcessors: [],
      };
      expect(getComplianceRisk(processor)).toBe('MEDIUM');
    });

    it('should return MEDIUM for UNKNOWN compliance status', () => {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const processor: DataProcessor = {
        ...baseProcessor,
        country: 'DE',
        isEU: true,
        dpaSignedAt: new Date(),
        dpaExpiresAt: expiresAt,
        complianceStatus: 'UNKNOWN',
        hasSubProcessors: false,
      };
      expect(getComplianceRisk(processor)).toBe('MEDIUM');
    });
  });
});
