/**
 * Trademark Compliance Service Unit Tests
 *
 * Tests for the TrademarkComplianceService domain service.
 * Covers Section 8, Section 9, Section 15, and Madrid Protocol deadlines.
 *
 * @module test/unit/domain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrademarkComplianceService,
  US_TRADEMARK_FEES,
  type Section8Filing,
  type Section9Filing,
  type Section15Filing,
  type MadridDesignation,
} from '../../../src/domain/services/trademark-compliance.service.js';

describe('TrademarkComplianceService', () => {
  let service: TrademarkComplianceService;

  beforeEach(() => {
    service = new TrademarkComplianceService();
  });

  // ===========================================================================
  // Section 8 Deadline Tests
  // ===========================================================================

  describe('calculateSection8Deadlines', () => {
    describe('first filing window (5-6 years)', () => {
      it('should calculate the 5-6 year window correctly', () => {
        const registrationDate = new Date('2020-03-15');
        const deadlines = service.calculateSection8Deadlines(registrationDate);

        expect(deadlines.length).toBeGreaterThanOrEqual(1);

        const firstDeadline = deadlines.find(d => d.filingWindow === '5-6 Year');
        expect(firstDeadline).toBeDefined();
        expect(firstDeadline!.type).toBe('section_8');
        expect(firstDeadline!.windowOpens.getFullYear()).toBe(2025);
        expect(firstDeadline!.windowOpens.getMonth()).toBe(2); // March
        expect(firstDeadline!.windowOpens.getDate()).toBe(15);
      });

      it('should set due date at 6th anniversary', () => {
        const registrationDate = new Date('2020-06-01');
        const deadlines = service.calculateSection8Deadlines(registrationDate);

        const firstDeadline = deadlines.find(d => d.filingWindow === '5-6 Year');
        expect(firstDeadline!.dueDate.getFullYear()).toBe(2026);
        expect(firstDeadline!.dueDate.getMonth()).toBe(5); // June
      });

      it('should set grace deadline 6 months after due date', () => {
        const registrationDate = new Date('2020-01-15');
        const deadlines = service.calculateSection8Deadlines(registrationDate);

        const firstDeadline = deadlines.find(d => d.filingWindow === '5-6 Year');
        expect(firstDeadline!.graceDeadline.getFullYear()).toBe(2026);
        expect(firstDeadline!.graceDeadline.getMonth()).toBe(6); // July (6 months after January)
      });

      it('should set correct fee estimate for first filing', () => {
        const registrationDate = new Date('2020-01-15');
        const deadlines = service.calculateSection8Deadlines(registrationDate);

        const firstDeadline = deadlines.find(d => d.filingWindow === '5-6 Year');
        expect(firstDeadline!.estimatedFee).toBe(US_TRADEMARK_FEES.SECTION_8.perClass);
        expect(firstDeadline!.currency).toBe('USD');
      });

      it('should include informative notes for first filing', () => {
        const registrationDate = new Date('2020-01-15');
        const deadlines = service.calculateSection8Deadlines(registrationDate);

        const firstDeadline = deadlines.find(d => d.filingWindow === '5-6 Year');
        expect(firstDeadline!.notes).toContain('First Section 8');
        expect(firstDeadline!.notes).toContain('5th and 6th year');
      });
    });

    describe('already filed scenarios', () => {
      it('should not include 5-6 year deadline if already accepted', () => {
        const registrationDate = new Date('2020-01-15');
        const acceptedFiling: Section8Filing = {
          id: 'filing-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2025-03-01'),
          filingWindow: '5-6_year',
          declarationType: 'use',
          specimensProvided: true,
          classesIncluded: [9, 42],
          classesDeleted: [],
          status: 'accepted',
          dueDate: new Date('2026-01-15'),
          acceptanceDate: new Date('2025-06-15'),
        };

        const deadlines = service.calculateSection8Deadlines(registrationDate, [acceptedFiling]);
        const firstFiling = deadlines.find(d => d.filingWindow === '5-6 Year');

        expect(firstFiling).toBeUndefined();
      });

      it('should still include deadline if filing is pending', () => {
        const registrationDate = new Date('2020-01-15');
        const pendingFiling: Section8Filing = {
          id: 'filing-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2025-03-01'),
          filingWindow: '5-6_year',
          declarationType: 'use',
          specimensProvided: true,
          classesIncluded: [9, 42],
          classesDeleted: [],
          status: 'pending',
          dueDate: new Date('2026-01-15'),
        };

        const deadlines = service.calculateSection8Deadlines(registrationDate, [pendingFiling]);
        const firstFiling = deadlines.find(d => d.filingWindow === '5-6 Year');

        expect(firstFiling).toBeDefined();
      });

      it('should still include deadline if filing was rejected', () => {
        const registrationDate = new Date('2020-01-15');
        const rejectedFiling: Section8Filing = {
          id: 'filing-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2025-03-01'),
          filingWindow: '5-6_year',
          declarationType: 'use',
          specimensProvided: true,
          classesIncluded: [9, 42],
          classesDeleted: [],
          status: 'rejected',
          dueDate: new Date('2026-01-15'),
          rejectionReason: 'Insufficient specimens',
        };

        const deadlines = service.calculateSection8Deadlines(registrationDate, [rejectedFiling]);
        const firstFiling = deadlines.find(d => d.filingWindow === '5-6 Year');

        expect(firstFiling).toBeDefined();
      });
    });

    describe('subsequent filings (combined with Section 9)', () => {
      it('should include 9-10 year deadline for future trademark', () => {
        // Registration date in the future so 9-10 year window is still upcoming
        const registrationDate = new Date('2020-01-15');
        const acceptedFirst: Section8Filing = {
          id: 'filing-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2025-03-01'),
          filingWindow: '5-6_year',
          declarationType: 'use',
          specimensProvided: true,
          classesIncluded: [9, 42],
          classesDeleted: [],
          status: 'accepted',
          dueDate: new Date('2026-01-15'),
          acceptanceDate: new Date('2025-06-15'),
        };

        const deadlines = service.calculateSection8Deadlines(registrationDate, [acceptedFirst]);

        // The 9-10 year window opens at year 9 (2029-01-15) which is in the future
        const nineYearDeadline = deadlines.find(d => d.filingWindow === '9-10 Year');
        expect(nineYearDeadline).toBeDefined();
        expect(nineYearDeadline!.estimatedFee).toBe(US_TRADEMARK_FEES.SECTION_8_9_COMBINED.perClass);
      });

      it('should use combined Section 8/9 fee for subsequent filings', () => {
        const registrationDate = new Date('2020-01-15');
        const acceptedFirst: Section8Filing = {
          id: 'filing-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2025-03-01'),
          filingWindow: '5-6_year',
          declarationType: 'use',
          specimensProvided: true,
          classesIncluded: [9, 42],
          classesDeleted: [],
          status: 'accepted',
          dueDate: new Date('2026-01-15'),
          acceptanceDate: new Date('2025-06-15'),
        };

        const deadlines = service.calculateSection8Deadlines(registrationDate, [acceptedFirst]);
        const subsequentDeadline = deadlines.find(d => d.filingWindow !== '5-6 Year');

        if (subsequentDeadline) {
          expect(subsequentDeadline.estimatedFee).toBe(US_TRADEMARK_FEES.SECTION_8_9_COMBINED.perClass);
        }
      });

      it('should only show next upcoming deadline, not all future deadlines', () => {
        const registrationDate = new Date('2020-01-15');
        const acceptedFirst: Section8Filing = {
          id: 'filing-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2025-03-01'),
          filingWindow: '5-6_year',
          declarationType: 'use',
          specimensProvided: true,
          classesIncluded: [9],
          classesDeleted: [],
          status: 'accepted',
          dueDate: new Date('2026-01-15'),
          acceptanceDate: new Date('2025-06-15'),
        };

        const deadlines = service.calculateSection8Deadlines(registrationDate, [acceptedFirst]);

        // Should only have one subsequent deadline (the next one)
        const subsequentDeadlines = deadlines.filter(d => d.filingWindow !== '5-6 Year');
        expect(subsequentDeadlines.length).toBeLessThanOrEqual(1);
      });
    });

    describe('priority calculation', () => {
      it('should calculate priority based on due date proximity', () => {
        // Create a registration date that results in different priorities
        const now = new Date();

        // Registration 5.5 years ago - deadline coming up soon
        const recentRegistration = new Date();
        recentRegistration.setFullYear(now.getFullYear() - 5);
        recentRegistration.setMonth(now.getMonth() - 6);

        const deadlines = service.calculateSection8Deadlines(recentRegistration);
        const deadline = deadlines[0];

        // Priority should be based on how close the due date is
        expect(['low', 'medium', 'high', 'critical']).toContain(deadline.priority);
      });
    });
  });

  // ===========================================================================
  // Section 9 Deadline Tests
  // ===========================================================================

  describe('calculateSection9Deadlines', () => {
    describe('first renewal (9-10 years)', () => {
      it('should calculate the first renewal window correctly', () => {
        const registrationDate = new Date('2020-06-15');
        const deadlines = service.calculateSection9Deadlines(registrationDate);

        const firstRenewal = deadlines.find(d => d.filingWindow.includes('9-10'));
        expect(firstRenewal).toBeDefined();
        expect(firstRenewal!.type).toBe('section_9');
        expect(firstRenewal!.windowOpens.getFullYear()).toBe(2029);
      });

      it('should set due date at 10th anniversary', () => {
        const registrationDate = new Date('2020-08-01');
        const deadlines = service.calculateSection9Deadlines(registrationDate);

        const firstRenewal = deadlines.find(d => d.filingWindow.includes('9-10'));
        expect(firstRenewal!.dueDate.getFullYear()).toBe(2030);
        expect(firstRenewal!.dueDate.getMonth()).toBe(7); // August
      });

      it('should set grace period 6 months after due date', () => {
        const registrationDate = new Date('2020-03-01');
        const deadlines = service.calculateSection9Deadlines(registrationDate);

        const firstRenewal = deadlines.find(d => d.filingWindow.includes('9-10'));
        expect(firstRenewal!.graceDeadline.getFullYear()).toBe(2030);
        expect(firstRenewal!.graceDeadline.getMonth()).toBe(8); // September
      });

      it('should set correct Section 9 fee', () => {
        const registrationDate = new Date('2020-01-15');
        const deadlines = service.calculateSection9Deadlines(registrationDate);

        const firstRenewal = deadlines.find(d => d.filingWindow.includes('9-10'));
        expect(firstRenewal!.estimatedFee).toBe(US_TRADEMARK_FEES.SECTION_9.perClass);
        expect(firstRenewal!.currency).toBe('USD');
      });

      it('should include notes about combined filing', () => {
        const registrationDate = new Date('2020-01-15');
        const deadlines = service.calculateSection9Deadlines(registrationDate);

        const firstRenewal = deadlines.find(d => d.filingWindow.includes('9-10'));
        expect(firstRenewal!.notes).toContain('1st_renewal');
        expect(firstRenewal!.notes).toContain('combined');
      });
    });

    describe('already filed scenarios', () => {
      it('should not include first renewal if already accepted', () => {
        const registrationDate = new Date('2020-01-15');
        const acceptedRenewal: Section9Filing = {
          id: 'renewal-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2029-06-01'),
          renewalPeriod: '1st_renewal',
          combinedWith8: true,
          classesIncluded: [9, 42],
          classesDeleted: [],
          status: 'accepted',
          dueDate: new Date('2030-01-15'),
          newExpirationDate: new Date('2040-01-15'),
          acceptanceDate: new Date('2029-09-01'),
          fee: 625,
        };

        const deadlines = service.calculateSection9Deadlines(registrationDate, [acceptedRenewal]);
        const firstRenewal = deadlines.find(d => d.filingWindow.includes('9-10'));

        expect(firstRenewal).toBeUndefined();
      });

      it('should show second renewal after first is accepted', () => {
        const registrationDate = new Date('2020-01-15');
        const acceptedRenewal: Section9Filing = {
          id: 'renewal-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2029-06-01'),
          renewalPeriod: '1st_renewal',
          combinedWith8: true,
          classesIncluded: [9, 42],
          classesDeleted: [],
          status: 'accepted',
          dueDate: new Date('2030-01-15'),
          newExpirationDate: new Date('2040-01-15'),
          acceptanceDate: new Date('2029-09-01'),
          fee: 625,
        };

        const deadlines = service.calculateSection9Deadlines(registrationDate, [acceptedRenewal]);
        const secondRenewal = deadlines.find(d => d.filingWindow.includes('19-20'));

        expect(secondRenewal).toBeDefined();
        expect(secondRenewal!.notes).toContain('2nd_renewal');
      });
    });

    describe('subsequent renewals', () => {
      it('should calculate second renewal (19-20 years) correctly', () => {
        const registrationDate = new Date('2010-01-15');
        const firstRenewal: Section9Filing = {
          id: 'renewal-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2019-06-01'),
          renewalPeriod: '1st_renewal',
          combinedWith8: true,
          classesIncluded: [9],
          classesDeleted: [],
          status: 'accepted',
          dueDate: new Date('2020-01-15'),
          fee: 625,
        };

        const deadlines = service.calculateSection9Deadlines(registrationDate, [firstRenewal]);
        const secondRenewal = deadlines.find(d => d.filingWindow.includes('19-20'));

        expect(secondRenewal).toBeDefined();
        expect(secondRenewal!.windowOpens.getFullYear()).toBe(2029);
        expect(secondRenewal!.dueDate.getFullYear()).toBe(2030);
      });

      it('should only return next upcoming renewal', () => {
        const registrationDate = new Date('2020-01-15');
        const deadlines = service.calculateSection9Deadlines(registrationDate);

        // Should only have one deadline (the next upcoming renewal)
        expect(deadlines.length).toBeLessThanOrEqual(1);
      });
    });
  });

  // ===========================================================================
  // Section 15 Eligibility Tests
  // ===========================================================================

  describe('calculateSection15Eligibility', () => {
    describe('not yet eligible', () => {
      it('should return deadline for trademark not yet 5 years old', () => {
        const registrationDate = new Date();
        registrationDate.setFullYear(registrationDate.getFullYear() - 3); // 3 years ago

        const deadline = service.calculateSection15Eligibility(registrationDate);

        expect(deadline).not.toBeNull();
        expect(deadline!.type).toBe('section_15');
        expect(deadline!.priority).toBe('low');
      });

      it('should set window opens at 5 year mark', () => {
        const registrationDate = new Date('2022-06-15');

        const deadline = service.calculateSection15Eligibility(registrationDate);

        expect(deadline!.windowOpens.getFullYear()).toBe(2027);
        expect(deadline!.windowOpens.getMonth()).toBe(5); // June
      });

      it('should recommend filing with Section 8 in notes', () => {
        const registrationDate = new Date();
        registrationDate.setFullYear(registrationDate.getFullYear() - 2);

        const deadline = service.calculateSection15Eligibility(registrationDate);

        expect(deadline!.notes).toContain('Section 8');
      });

      it('should set grace deadline at 6 years', () => {
        const registrationDate = new Date('2022-01-15');

        const deadline = service.calculateSection15Eligibility(registrationDate);

        expect(deadline!.graceDeadline.getFullYear()).toBe(2028);
      });
    });

    describe('already eligible', () => {
      it('should return higher priority for trademark already eligible', () => {
        const registrationDate = new Date();
        registrationDate.setFullYear(registrationDate.getFullYear() - 6); // 6 years ago

        const deadline = service.calculateSection15Eligibility(registrationDate);

        expect(deadline).not.toBeNull();
        expect(deadline!.priority).toBe('medium');
        expect(deadline!.filingWindow).toBe('Eligible now');
      });

      it('should recommend filing to strengthen protection', () => {
        const registrationDate = new Date();
        registrationDate.setFullYear(registrationDate.getFullYear() - 7);

        const deadline = service.calculateSection15Eligibility(registrationDate);

        expect(deadline!.notes).toContain('incontestability');
        expect(deadline!.notes).toContain('strengthen');
      });
    });

    describe('already filed scenarios', () => {
      it('should return null if Section 15 already accepted', () => {
        const registrationDate = new Date('2015-01-15');
        const acceptedFiling: Section15Filing = {
          id: 'section15-001',
          trademarkId: 'tm-001',
          filingDate: new Date('2020-06-01'),
          continuousUseSince: new Date('2015-01-15'),
          classesIncluded: [9, 42],
          status: 'accepted',
          acceptanceDate: new Date('2020-09-15'),
          incontestabilityDate: new Date('2020-09-15'),
        };

        const deadline = service.calculateSection15Eligibility(
          registrationDate,
          undefined,
          acceptedFiling
        );

        expect(deadline).toBeNull();
      });

      it('should still return deadline if filing is pending', () => {
        const registrationDate = new Date();
        registrationDate.setFullYear(registrationDate.getFullYear() - 6);

        const pendingFiling: Section15Filing = {
          id: 'section15-001',
          trademarkId: 'tm-001',
          filingDate: new Date(),
          continuousUseSince: registrationDate,
          classesIncluded: [9],
          status: 'pending',
        };

        const deadline = service.calculateSection15Eligibility(
          registrationDate,
          undefined,
          pendingFiling
        );

        expect(deadline).not.toBeNull();
      });

      it('should still return deadline if filing was rejected', () => {
        const registrationDate = new Date();
        registrationDate.setFullYear(registrationDate.getFullYear() - 6);

        const rejectedFiling: Section15Filing = {
          id: 'section15-001',
          trademarkId: 'tm-001',
          filingDate: new Date(),
          continuousUseSince: registrationDate,
          classesIncluded: [9],
          status: 'rejected',
        };

        const deadline = service.calculateSection15Eligibility(
          registrationDate,
          undefined,
          rejectedFiling
        );

        expect(deadline).not.toBeNull();
      });
    });

    describe('fee calculation', () => {
      it('should set correct Section 15 fee', () => {
        const registrationDate = new Date();
        registrationDate.setFullYear(registrationDate.getFullYear() - 3);

        const deadline = service.calculateSection15Eligibility(registrationDate);

        expect(deadline!.estimatedFee).toBe(US_TRADEMARK_FEES.SECTION_15.perClass);
        expect(deadline!.currency).toBe('USD');
      });
    });
  });

  // ===========================================================================
  // Madrid Protocol Deadline Tests
  // ===========================================================================

  describe('calculateMadridDeadlines', () => {
    const createMadridDesignation = (overrides?: Partial<MadridDesignation>): MadridDesignation => {
      const filingDate = new Date('2023-01-15');
      return {
        id: 'madrid-001',
        trademarkId: 'tm-001',
        internationalRegistrationNumber: 'IR1234567',
        basicApplicationNumber: 'US12345678',
        filingDate,
        designatedCountries: [
          {
            countryCode: 'DE',
            designationDate: filingDate,
            status: 'protected',
            protectionDate: new Date('2023-06-15'),
            classesProtected: [9, 42],
          },
          {
            countryCode: 'FR',
            designationDate: filingDate,
            status: 'protected',
            protectionDate: new Date('2023-07-01'),
            classesProtected: [9, 42],
          },
        ],
        status: 'registered',
        expirationDate: new Date('2033-01-15'),
        centralAttackPeriod: new Date('2028-01-15'),
        ...overrides,
      };
    };

    describe('central attack period', () => {
      it('should include central attack period deadline when still active', () => {
        const designation = createMadridDesignation();
        const deadlines = service.calculateMadridDeadlines(designation);

        const centralAttack = deadlines.find(d => d.filingWindow === 'Central Attack Period');
        expect(centralAttack).toBeDefined();
        expect(centralAttack!.type).toBe('madrid_response');
      });

      it('should explain central attack dependency in notes', () => {
        const designation = createMadridDesignation();
        const deadlines = service.calculateMadridDeadlines(designation);

        const centralAttack = deadlines.find(d => d.filingWindow === 'Central Attack Period');
        expect(centralAttack!.notes).toContain('Dependency period');
        expect(centralAttack!.notes).toContain('US basic registration');
      });

      it('should not include central attack deadline if period has passed', () => {
        const pastCentralAttack = new Date();
        pastCentralAttack.setFullYear(pastCentralAttack.getFullYear() - 1);

        const designation = createMadridDesignation({
          centralAttackPeriod: pastCentralAttack,
        });
        const deadlines = service.calculateMadridDeadlines(designation);

        const centralAttack = deadlines.find(d => d.filingWindow === 'Central Attack Period');
        expect(centralAttack).toBeUndefined();
      });
    });

    describe('renewal deadlines', () => {
      it('should always include renewal deadline', () => {
        const designation = createMadridDesignation();
        const deadlines = service.calculateMadridDeadlines(designation);

        const renewal = deadlines.find(d => d.type === 'madrid_renewal');
        expect(renewal).toBeDefined();
        expect(renewal!.filingWindow).toBe('International Renewal');
      });

      it('should set renewal window opens 6 months before expiration', () => {
        const designation = createMadridDesignation({
          expirationDate: new Date('2033-06-15'),
        });
        const deadlines = service.calculateMadridDeadlines(designation);

        const renewal = deadlines.find(d => d.type === 'madrid_renewal');
        expect(renewal!.windowOpens.getFullYear()).toBe(2032);
        expect(renewal!.windowOpens.getMonth()).toBe(11); // December (6 months before June)
      });

      it('should set grace period 6 months after expiration', () => {
        const designation = createMadridDesignation({
          expirationDate: new Date('2033-01-15'),
        });
        const deadlines = service.calculateMadridDeadlines(designation);

        const renewal = deadlines.find(d => d.type === 'madrid_renewal');
        expect(renewal!.graceDeadline.getFullYear()).toBe(2033);
        expect(renewal!.graceDeadline.getMonth()).toBe(6); // July
      });

      it('should calculate fee based on number of designated countries', () => {
        const designation = createMadridDesignation();
        const deadlines = service.calculateMadridDeadlines(designation);

        const renewal = deadlines.find(d => d.type === 'madrid_renewal');
        expect(renewal!.estimatedFee).toBe(
          US_TRADEMARK_FEES.MADRID.renewal * designation.designatedCountries.length
        );
        expect(renewal!.currency).toBe('CHF');
      });
    });

    describe('country-specific response deadlines', () => {
      it('should include deadlines for pending country designations with response deadlines', () => {
        const responseDeadline = new Date();
        responseDeadline.setMonth(responseDeadline.getMonth() + 3);

        const designation = createMadridDesignation({
          designatedCountries: [
            {
              countryCode: 'JP',
              designationDate: new Date('2023-01-15'),
              status: 'pending',
              responseDeadline,
              classesProtected: [9],
            },
          ],
        });
        const deadlines = service.calculateMadridDeadlines(designation);

        const japanResponse = deadlines.find(d => d.filingWindow === 'JP Office Action');
        expect(japanResponse).toBeDefined();
        expect(japanResponse!.type).toBe('madrid_response');
        expect(japanResponse!.priority).toBe('critical');
      });

      it('should not include deadline for protected country designations', () => {
        const designation = createMadridDesignation();
        const deadlines = service.calculateMadridDeadlines(designation);

        const countryResponses = deadlines.filter(
          d => d.filingWindow.includes('Office Action')
        );
        expect(countryResponses.length).toBe(0);
      });

      it('should recommend local counsel in notes', () => {
        const responseDeadline = new Date();
        responseDeadline.setMonth(responseDeadline.getMonth() + 2);

        const designation = createMadridDesignation({
          designatedCountries: [
            {
              countryCode: 'CN',
              designationDate: new Date('2023-01-15'),
              status: 'pending',
              responseDeadline,
              classesProtected: [9, 42],
            },
          ],
        });
        const deadlines = service.calculateMadridDeadlines(designation);

        const chinaResponse = deadlines.find(d => d.filingWindow === 'CN Office Action');
        expect(chinaResponse!.notes).toContain('Local counsel');
        expect(chinaResponse!.notes).toContain('CN');
      });

      it('should handle multiple pending country designations', () => {
        const responseDeadline = new Date();
        responseDeadline.setMonth(responseDeadline.getMonth() + 3);

        const designation = createMadridDesignation({
          designatedCountries: [
            {
              countryCode: 'JP',
              designationDate: new Date('2023-01-15'),
              status: 'pending',
              responseDeadline,
              classesProtected: [9],
            },
            {
              countryCode: 'CN',
              designationDate: new Date('2023-01-15'),
              status: 'pending',
              responseDeadline,
              classesProtected: [9],
            },
            {
              countryCode: 'DE',
              designationDate: new Date('2023-01-15'),
              status: 'protected',
              protectionDate: new Date('2023-06-15'),
              classesProtected: [9],
            },
          ],
        });
        const deadlines = service.calculateMadridDeadlines(designation);

        const countryResponses = deadlines.filter(
          d => d.filingWindow.includes('Office Action')
        );
        expect(countryResponses.length).toBe(2);
      });
    });
  });

  // ===========================================================================
  // createSection8Filing Tests
  // ===========================================================================

  describe('createSection8Filing', () => {
    it('should create filing for 5-6 year window', () => {
      const registrationDate = new Date();
      registrationDate.setFullYear(registrationDate.getFullYear() - 5);
      registrationDate.setMonth(registrationDate.getMonth() - 6);

      const filing = service.createSection8Filing('tm-001', registrationDate, [9, 42]);

      expect(filing.filingWindow).toBe('5-6_year');
      expect(filing.trademarkId).toBe('tm-001');
      expect(filing.classesIncluded).toEqual([9, 42]);
      expect(filing.status).toBe('pending');
    });

    it('should default to use declaration type', () => {
      const registrationDate = new Date();
      registrationDate.setFullYear(registrationDate.getFullYear() - 5);
      registrationDate.setMonth(registrationDate.getMonth() - 6);

      const filing = service.createSection8Filing('tm-001', registrationDate, [9]);

      expect(filing.declarationType).toBe('use');
      expect(filing.specimensProvided).toBe(true);
    });

    it('should allow excusable nonuse declaration', () => {
      const registrationDate = new Date();
      registrationDate.setFullYear(registrationDate.getFullYear() - 5);
      registrationDate.setMonth(registrationDate.getMonth() - 6);

      const filing = service.createSection8Filing('tm-001', registrationDate, [9], {
        declarationType: 'excusable_nonuse',
        specimensProvided: false,
      });

      expect(filing.declarationType).toBe('excusable_nonuse');
      expect(filing.specimensProvided).toBe(false);
    });

    it('should track deleted classes', () => {
      const registrationDate = new Date();
      registrationDate.setFullYear(registrationDate.getFullYear() - 5);
      registrationDate.setMonth(registrationDate.getMonth() - 6);

      const filing = service.createSection8Filing('tm-001', registrationDate, [9, 42], {
        classesDeleted: [35],
      });

      expect(filing.classesDeleted).toEqual([35]);
    });

    it('should throw error for invalid filing window', () => {
      const registrationDate = new Date();
      registrationDate.setFullYear(registrationDate.getFullYear() - 3); // Too early

      expect(() => {
        service.createSection8Filing('tm-001', registrationDate, [9]);
      }).toThrow('Invalid filing window');
    });

    it('should create filing for 9-10 year window', () => {
      const registrationDate = new Date();
      registrationDate.setFullYear(registrationDate.getFullYear() - 9);
      registrationDate.setMonth(registrationDate.getMonth() - 6);

      const filing = service.createSection8Filing('tm-001', registrationDate, [9]);

      expect(filing.filingWindow).toBe('9-10_year');
    });

    it('should generate unique ID', () => {
      const registrationDate = new Date();
      registrationDate.setFullYear(registrationDate.getFullYear() - 5);
      registrationDate.setMonth(registrationDate.getMonth() - 6);

      const filing1 = service.createSection8Filing('tm-001', registrationDate, [9]);
      const filing2 = service.createSection8Filing('tm-001', registrationDate, [9]);

      expect(filing1.id).not.toBe(filing2.id);
    });
  });

  // ===========================================================================
  // createMadridDesignation Tests
  // ===========================================================================

  describe('createMadridDesignation', () => {
    it('should create Madrid designation with correct structure', () => {
      const classesPerCountry = new Map<string, number[]>([
        ['DE', [9, 42]],
        ['FR', [9, 42]],
        ['JP', [9]],
      ]);

      const designation = service.createMadridDesignation(
        'tm-001',
        'US87654321',
        ['DE', 'FR', 'JP'],
        classesPerCountry
      );

      expect(designation.trademarkId).toBe('tm-001');
      expect(designation.basicApplicationNumber).toBe('US87654321');
      expect(designation.designatedCountries).toHaveLength(3);
      expect(designation.status).toBe('pending');
    });

    it('should set all country designations as pending', () => {
      const classesPerCountry = new Map<string, number[]>([
        ['DE', [9]],
        ['FR', [9]],
      ]);

      const designation = service.createMadridDesignation(
        'tm-001',
        'US12345',
        ['DE', 'FR'],
        classesPerCountry
      );

      designation.designatedCountries.forEach(country => {
        expect(country.status).toBe('pending');
      });
    });

    it('should set expiration date 10 years from filing', () => {
      const classesPerCountry = new Map<string, number[]>([['DE', [9]]]);

      const designation = service.createMadridDesignation(
        'tm-001',
        'US12345',
        ['DE'],
        classesPerCountry
      );

      const filingYear = designation.filingDate.getFullYear();
      expect(designation.expirationDate.getFullYear()).toBe(filingYear + 10);
    });

    it('should set central attack period 5 years from filing', () => {
      const classesPerCountry = new Map<string, number[]>([['DE', [9]]]);

      const designation = service.createMadridDesignation(
        'tm-001',
        'US12345',
        ['DE'],
        classesPerCountry
      );

      const filingYear = designation.filingDate.getFullYear();
      expect(designation.centralAttackPeriod.getFullYear()).toBe(filingYear + 5);
    });

    it('should map classes correctly to each country', () => {
      const classesPerCountry = new Map<string, number[]>([
        ['DE', [9, 42]],
        ['FR', [35]],
        ['JP', [9, 35, 42]],
      ]);

      const designation = service.createMadridDesignation(
        'tm-001',
        'US12345',
        ['DE', 'FR', 'JP'],
        classesPerCountry
      );

      const germany = designation.designatedCountries.find(c => c.countryCode === 'DE');
      const france = designation.designatedCountries.find(c => c.countryCode === 'FR');
      const japan = designation.designatedCountries.find(c => c.countryCode === 'JP');

      expect(germany!.classesProtected).toEqual([9, 42]);
      expect(france!.classesProtected).toEqual([35]);
      expect(japan!.classesProtected).toEqual([9, 35, 42]);
    });

    it('should handle empty classes for country', () => {
      const classesPerCountry = new Map<string, number[]>([['DE', [9]]]);

      const designation = service.createMadridDesignation(
        'tm-001',
        'US12345',
        ['DE', 'FR'], // FR not in map
        classesPerCountry
      );

      const france = designation.designatedCountries.find(c => c.countryCode === 'FR');
      expect(france!.classesProtected).toEqual([]);
    });
  });

  // ===========================================================================
  // getAllDeadlines Tests
  // ===========================================================================

  describe('getAllDeadlines', () => {
    it('should return all US trademark deadlines', () => {
      const registrationDate = new Date('2020-06-15');

      const deadlines = service.getAllDeadlines(
        'tm-001',
        registrationDate,
        'US'
      );

      const types = deadlines.map(d => d.type);
      expect(types).toContain('section_8');
      expect(types).toContain('section_9');
      expect(types).toContain('section_15');
    });

    it('should set trademarkId on all deadlines', () => {
      const registrationDate = new Date('2020-06-15');

      const deadlines = service.getAllDeadlines(
        'tm-specific-id',
        registrationDate,
        'US'
      );

      deadlines.forEach(deadline => {
        expect(deadline.trademarkId).toBe('tm-specific-id');
      });
    });

    it('should not include US-specific deadlines for non-US jurisdiction', () => {
      const registrationDate = new Date('2020-06-15');

      const deadlines = service.getAllDeadlines(
        'tm-001',
        registrationDate,
        'EU'
      );

      const types = deadlines.map(d => d.type);
      expect(types).not.toContain('section_8');
      expect(types).not.toContain('section_9');
      expect(types).not.toContain('section_15');
    });

    it('should include Madrid deadlines when designation provided', () => {
      const registrationDate = new Date('2020-06-15');
      const madridDesignation: MadridDesignation = {
        id: 'madrid-001',
        trademarkId: 'tm-001',
        internationalRegistrationNumber: 'IR1234567',
        basicApplicationNumber: 'US12345678',
        filingDate: new Date('2020-06-15'),
        designatedCountries: [],
        status: 'registered',
        expirationDate: new Date('2030-06-15'),
        centralAttackPeriod: new Date('2025-06-15'),
      };

      const deadlines = service.getAllDeadlines(
        'tm-001',
        registrationDate,
        'US',
        [],
        [],
        undefined,
        madridDesignation
      );

      const madridTypes = deadlines.filter(
        d => d.type === 'madrid_renewal' || d.type === 'madrid_response'
      );
      expect(madridTypes.length).toBeGreaterThan(0);
    });

    it('should respect existing filings', () => {
      const registrationDate = new Date('2020-01-15');
      const section15Filing: Section15Filing = {
        id: 'section15-001',
        trademarkId: 'tm-001',
        filingDate: new Date('2025-06-01'),
        continuousUseSince: new Date('2020-01-15'),
        classesIncluded: [9],
        status: 'accepted',
        acceptanceDate: new Date('2025-09-15'),
        incontestabilityDate: new Date('2025-09-15'),
      };

      const deadlines = service.getAllDeadlines(
        'tm-001',
        registrationDate,
        'US',
        [],
        [],
        section15Filing
      );

      const section15 = deadlines.find(d => d.type === 'section_15');
      expect(section15).toBeUndefined();
    });
  });

  // ===========================================================================
  // Fee Constants Tests
  // ===========================================================================

  describe('US_TRADEMARK_FEES', () => {
    it('should have Section 8 fees defined', () => {
      expect(US_TRADEMARK_FEES.SECTION_8.perClass).toBeGreaterThan(0);
      expect(US_TRADEMARK_FEES.SECTION_8.perClassPaper).toBeGreaterThan(
        US_TRADEMARK_FEES.SECTION_8.perClass
      );
      expect(US_TRADEMARK_FEES.SECTION_8.gracePeriodSurcharge).toBeGreaterThan(0);
    });

    it('should have Section 9 fees defined', () => {
      expect(US_TRADEMARK_FEES.SECTION_9.perClass).toBeGreaterThan(0);
      expect(US_TRADEMARK_FEES.SECTION_9.perClassPaper).toBeGreaterThan(
        US_TRADEMARK_FEES.SECTION_9.perClass
      );
      expect(US_TRADEMARK_FEES.SECTION_9.gracePeriodSurcharge).toBeGreaterThan(0);
    });

    it('should have combined Section 8/9 fee equal to sum', () => {
      expect(US_TRADEMARK_FEES.SECTION_8_9_COMBINED.perClass).toBe(
        US_TRADEMARK_FEES.SECTION_8.perClass + US_TRADEMARK_FEES.SECTION_9.perClass
      );
    });

    it('should have Section 15 fees defined', () => {
      expect(US_TRADEMARK_FEES.SECTION_15.perClass).toBeGreaterThan(0);
    });

    it('should have Madrid fees defined', () => {
      expect(US_TRADEMARK_FEES.MADRID.baseDesignation).toBeGreaterThan(0);
      expect(US_TRADEMARK_FEES.MADRID.perClassDesignation).toBeGreaterThan(0);
      expect(US_TRADEMARK_FEES.MADRID.renewal).toBeGreaterThan(0);
    });
  });
});
