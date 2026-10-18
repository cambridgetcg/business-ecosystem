import { describe, it, expect } from 'vitest';
import {
  isRequirementActive,
  meetsApplicabilityConditions,
  calculateDeadline,
  getRegulatorDisplayName,
  UK_SYSTEM_REQUIREMENTS,
  type RegulatoryRequirement,
} from '../../src/domain/entities/regulatory-requirement.js';

describe('Regulatory Requirement Domain Logic', () => {
  describe('isRequirementActive', () => {
    const baseRequirement: RegulatoryRequirement = {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: null,
      regulator: 'hmrc',
      regulationName: 'Test Requirement',
      regulationReference: 'Test Act 2024',
      jurisdiction: 'uk',
      category: 'corporation_tax',
      subCategory: null,
      description: 'Test description',
      applicabilityConditions: null,
      applicableEntityTypes: null,
      thresholds: null,
      frequency: 'annual',
      deadlineRule: null,
      gracePeriodDays: null,
      penaltyDescription: null,
      maxPenaltyAmount: null,
      penaltyCurrency: 'GBP',
      exemptions: null,
      exemptionConditions: null,
      effectiveDate: new Date('2020-01-01'),
      sunsetDate: null,
      isActive: true,
      guidanceUrl: null,
      formReference: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      version: 1,
    };

    it('should return true for active requirement with no sunset date', () => {
      expect(isRequirementActive(baseRequirement)).toBe(true);
    });

    it('should return false for inactive requirement', () => {
      const inactive = { ...baseRequirement, isActive: false };
      expect(isRequirementActive(inactive)).toBe(false);
    });

    it('should return false for requirement not yet effective', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const notYetEffective = { ...baseRequirement, effectiveDate: futureDate };
      expect(isRequirementActive(notYetEffective)).toBe(false);
    });

    it('should return false for requirement past sunset date', () => {
      const pastDate = new Date('2020-01-01');
      const sunset = { ...baseRequirement, sunsetDate: pastDate };
      expect(isRequirementActive(sunset)).toBe(false);
    });

    it('should return true for requirement with future sunset date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const activeSunset = { ...baseRequirement, sunsetDate: futureDate };
      expect(isRequirementActive(activeSunset)).toBe(true);
    });
  });

  describe('meetsApplicabilityConditions', () => {
    const baseRequirement: RegulatoryRequirement = {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: null,
      regulator: 'hmrc',
      regulationName: 'Test Requirement',
      regulationReference: null,
      jurisdiction: 'uk',
      category: 'corporation_tax',
      subCategory: null,
      description: 'Test',
      applicabilityConditions: null,
      applicableEntityTypes: null,
      thresholds: null,
      frequency: 'annual',
      deadlineRule: null,
      gracePeriodDays: null,
      penaltyDescription: null,
      maxPenaltyAmount: null,
      penaltyCurrency: 'GBP',
      exemptions: null,
      exemptionConditions: null,
      effectiveDate: new Date('2020-01-01'),
      sunsetDate: null,
      isActive: true,
      guidanceUrl: null,
      formReference: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      version: 1,
    };

    it('should return true when no conditions are specified', () => {
      expect(meetsApplicabilityConditions(baseRequirement, {})).toBe(true);
    });

    it('should return true when entity type matches', () => {
      const withEntityTypes = {
        ...baseRequirement,
        applicableEntityTypes: ['limited_company', 'llp'],
      };
      expect(meetsApplicabilityConditions(withEntityTypes, { entityType: 'limited_company' })).toBe(true);
    });

    it('should return false when entity type does not match', () => {
      const withEntityTypes = {
        ...baseRequirement,
        applicableEntityTypes: ['limited_company', 'llp'],
      };
      expect(meetsApplicabilityConditions(withEntityTypes, { entityType: 'sole_trader' })).toBe(false);
    });

    it('should check thresholds correctly', () => {
      const withThresholds = {
        ...baseRequirement,
        thresholds: { turnover: 10200000 },
      };
      expect(meetsApplicabilityConditions(withThresholds, { turnover: 15000000 })).toBe(true);
      expect(meetsApplicabilityConditions(withThresholds, { turnover: 5000000 })).toBe(false);
    });
  });

  describe('calculateDeadline', () => {
    const baseRequirement: RegulatoryRequirement = {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: null,
      regulator: 'companies_house',
      regulationName: 'Test',
      regulationReference: null,
      jurisdiction: 'uk',
      category: 'company_filing',
      subCategory: null,
      description: 'Test',
      applicabilityConditions: null,
      applicableEntityTypes: null,
      thresholds: null,
      frequency: 'annual',
      deadlineRule: null,
      gracePeriodDays: null,
      penaltyDescription: null,
      maxPenaltyAmount: null,
      penaltyCurrency: 'GBP',
      exemptions: null,
      exemptionConditions: null,
      effectiveDate: new Date('2020-01-01'),
      sunsetDate: null,
      isActive: true,
      guidanceUrl: null,
      formReference: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      version: 1,
    };

    it('should return period end when no deadline rule', () => {
      const periodEnd = new Date('2024-12-31');
      expect(calculateDeadline(baseRequirement, periodEnd)).toEqual(periodEnd);
    });

    it('should calculate months after correctly', () => {
      const withMonthsRule = {
        ...baseRequirement,
        deadlineRule: '9 months after accounting reference date',
      };
      const periodEnd = new Date('2024-03-31');
      const deadline = calculateDeadline(withMonthsRule, periodEnd);
      expect(deadline.getMonth()).toBe(11); // December (0-indexed)
      expect(deadline.getFullYear()).toBe(2024);
    });

    it('should calculate days after correctly', () => {
      const withDaysRule = {
        ...baseRequirement,
        deadlineRule: '14 days after review period end',
      };
      const periodEnd = new Date('2024-06-30');
      const deadline = calculateDeadline(withDaysRule, periodEnd);
      expect(deadline.getDate()).toBe(14);
      expect(deadline.getMonth()).toBe(6); // July
    });
  });

  describe('getRegulatorDisplayName', () => {
    it('should return correct display name for HMRC', () => {
      expect(getRegulatorDisplayName('hmrc')).toBe('HM Revenue & Customs');
    });

    it('should return correct display name for Companies House', () => {
      expect(getRegulatorDisplayName('companies_house')).toBe('Companies House');
    });

    it('should return correct display name for ICO', () => {
      expect(getRegulatorDisplayName('ico')).toBe("Information Commissioner's Office");
    });

    it('should return correct display name for FCA', () => {
      expect(getRegulatorDisplayName('fca')).toBe('Financial Conduct Authority');
    });
  });

  describe('UK_SYSTEM_REQUIREMENTS', () => {
    it('should have annual accounts requirement', () => {
      expect(UK_SYSTEM_REQUIREMENTS.ANNUAL_ACCOUNTS).toBeDefined();
      expect(UK_SYSTEM_REQUIREMENTS.ANNUAL_ACCOUNTS.regulator).toBe('companies_house');
      expect(UK_SYSTEM_REQUIREMENTS.ANNUAL_ACCOUNTS.frequency).toBe('annual');
    });

    it('should have VAT return requirement', () => {
      expect(UK_SYSTEM_REQUIREMENTS.VAT_RETURN).toBeDefined();
      expect(UK_SYSTEM_REQUIREMENTS.VAT_RETURN.regulator).toBe('hmrc');
      expect(UK_SYSTEM_REQUIREMENTS.VAT_RETURN.frequency).toBe('quarterly');
      expect(UK_SYSTEM_REQUIREMENTS.VAT_RETURN.formReference).toBe('VAT100');
    });

    it('should have data breach notification requirement', () => {
      expect(UK_SYSTEM_REQUIREMENTS.DATA_BREACH_NOTIFICATION).toBeDefined();
      expect(UK_SYSTEM_REQUIREMENTS.DATA_BREACH_NOTIFICATION.regulator).toBe('ico');
      expect(UK_SYSTEM_REQUIREMENTS.DATA_BREACH_NOTIFICATION.frequency).toBe('event_driven');
      expect(UK_SYSTEM_REQUIREMENTS.DATA_BREACH_NOTIFICATION.deadlineRule).toContain('72 hours');
    });
  });
});
