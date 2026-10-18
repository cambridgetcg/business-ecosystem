/**
 * PAYE/NI Calculator Tests
 *
 * Tests for UK PAYE and National Insurance calculations including:
 * - National Insurance contributions
 * - PAYE tax deductions
 * - Student loan deductions
 * - Tax code parsing
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateWeeklyNI,
  calculatePeriodNI,
  calculatePAYE,
  calculateStudentLoan,
  getNIThresholdsForPeriod,
} from '../../../src/domain/paye/services/calculator.js';
import {
  parseTaxCode,
  getStarterTaxCode,
} from '../../../src/domain/paye/models/employee.js';
import {
  NIThresholds2024,
  NIRates2024,
  TaxRegion,
} from '../../../src/domain/value-objects/index.js';

describe('National Insurance Calculator', () => {
  describe('calculateWeeklyNI - Category A', () => {
    it('should calculate zero NI below LEL', () => {
      const result = calculateWeeklyNI(100, 'A'); // Below LEL (£123)

      expect(parseFloat(result.employeeNI)).toBe(0);
      expect(parseFloat(result.employerNI)).toBe(0);
    });

    it('should calculate zero employee NI between LEL and PT', () => {
      const result = calculateWeeklyNI(200, 'A'); // Between LEL (£123) and PT (£242)

      expect(parseFloat(result.employeeNI)).toBe(0);
      // Employer pays from ST (£175)
      expect(parseFloat(result.employerNI)).toBeGreaterThan(0);
    });

    it('should calculate employer NI from ST', () => {
      const weeklyPay = 300;
      const result = calculateWeeklyNI(weeklyPay, 'A');

      // Employer: (300 - 175) × 13.8% = 125 × 0.138 = £17.25
      expect(parseFloat(result.employerNI)).toBeCloseTo(17.25, 2);
    });

    it('should calculate employee NI at 8% between PT and UEL', () => {
      const weeklyPay = 500;
      const result = calculateWeeklyNI(weeklyPay, 'A');

      // Employee: (500 - 242) × 8% = 258 × 0.08 = £20.64
      expect(parseFloat(result.employeeNI)).toBeCloseTo(20.64, 2);
    });

    it('should calculate employee NI at 2% above UEL', () => {
      const weeklyPay = 1200;
      const result = calculateWeeklyNI(weeklyPay, 'A');

      // Employee:
      // (967 - 242) × 8% = 725 × 0.08 = £58.00
      // (1200 - 967) × 2% = 233 × 0.02 = £4.66
      // Total = £62.66
      expect(parseFloat(result.employeeNI)).toBeCloseTo(62.66, 2);
    });

    it('should provide breakdown', () => {
      const weeklyPay = 500;
      const result = calculateWeeklyNI(weeklyPay, 'A');

      expect(parseFloat(result.breakdown.earningsToLEL)).toBeCloseTo(123, 0);
      expect(parseFloat(result.breakdown.earningsLELtoPT)).toBeCloseTo(119, 0); // 242 - 123
      expect(parseFloat(result.breakdown.earningsPTtoUEL)).toBeCloseTo(258, 0); // 500 - 242
    });
  });

  describe('calculateWeeklyNI - Other Categories', () => {
    it('should calculate zero employee NI for Category C (over pension age)', () => {
      const result = calculateWeeklyNI(500, 'C');

      expect(parseFloat(result.employeeNI)).toBe(0);
      // Employer still pays
      expect(parseFloat(result.employerNI)).toBeGreaterThan(0);
    });

    it('should calculate reduced employer NI for Category M (under 21)', () => {
      const weeklyPay = 800;
      const result = calculateWeeklyNI(weeklyPay, 'M');

      // Employer: 0% up to UST (£967), only pays above
      // Since 800 < 967, employer NI should be 0
      expect(parseFloat(result.employerNI)).toBe(0);
      // Employee pays normal rate
      expect(parseFloat(result.employeeNI)).toBeGreaterThan(0);
    });

    it('should calculate reduced employer NI for Category H (apprentice)', () => {
      const weeklyPay = 800;
      const result = calculateWeeklyNI(weeklyPay, 'H');

      // Employer: 0% up to AUST (£967)
      expect(parseFloat(result.employerNI)).toBe(0);
      // Employee pays normal rate
      expect(parseFloat(result.employeeNI)).toBeGreaterThan(0);
    });

    it('should calculate deferment rate for Category J', () => {
      const weeklyPay = 1200;
      const result = calculateWeeklyNI(weeklyPay, 'J');

      // Employee: only 2% above UEL
      // (1200 - 967) × 2% = £4.66
      expect(parseFloat(result.employeeNI)).toBeCloseTo(4.66, 2);
    });
  });

  describe('calculatePeriodNI', () => {
    it('should calculate monthly NI', () => {
      const monthlyPay = 3000;
      const result = calculatePeriodNI(monthlyPay, 'monthly', 'A');

      expect(parseFloat(result.employeeNI)).toBeGreaterThan(0);
      expect(parseFloat(result.employerNI)).toBeGreaterThan(0);
      expect(result.niablePay).toBe('3000');
    });

    it('should scale correctly for weekly vs monthly', () => {
      const weeklyResult = calculateWeeklyNI(500, 'A');
      const monthlyResult = calculatePeriodNI(500 * (52/12), 'monthly', 'A');

      // Monthly should be approximately 4.33 times weekly
      const weeklyEeNI = parseFloat(weeklyResult.employeeNI);
      const monthlyEeNI = parseFloat(monthlyResult.employeeNI);

      expect(monthlyEeNI / weeklyEeNI).toBeCloseTo(52/12, 1);
    });
  });

  describe('getNIThresholdsForPeriod', () => {
    it('should calculate monthly thresholds', () => {
      const thresholds = getNIThresholdsForPeriod('monthly');

      // Monthly = weekly × (52/12)
      expect(thresholds.PT).toBeCloseTo(NIThresholds2024.PT * (52/12), -1);
      expect(thresholds.UEL).toBeCloseTo(NIThresholds2024.UEL * (52/12), -1);
    });

    it('should calculate weekly thresholds', () => {
      const thresholds = getNIThresholdsForPeriod('weekly');

      expect(thresholds.PT).toBe(NIThresholds2024.PT);
      expect(thresholds.UEL).toBe(NIThresholds2024.UEL);
    });
  });
});

describe('PAYE Calculator', () => {
  describe('calculatePAYE - Basic', () => {
    it('should calculate tax for standard tax code', () => {
      // Monthly salary of £3000 with tax code 1257L
      const result = calculatePAYE(
        3000,
        '1257L',
        1, // Month 1
        0,
        0,
        'monthly'
      );

      // Annual allowance: £12,570 / 12 = £1,047.50 per month
      // Taxable: £3,000 - £1,047.50 = £1,952.50
      // Tax at 20%: £390.50
      expect(parseFloat(result.grossPay)).toBe(3000);
      expect(parseFloat(result.taxDeducted)).toBeGreaterThan(0);
      expect(parseFloat(result.taxDeducted)).toBeLessThan(600); // Basic rate only
    });

    it('should handle BR (Basic Rate) tax code', () => {
      const result = calculatePAYE(
        3000,
        'BR',
        1,
        0,
        0,
        'monthly'
      );

      // All earnings taxed at 20%
      expect(parseFloat(result.taxDeducted)).toBeCloseTo(600, 1);
    });

    it('should handle NT (No Tax) code', () => {
      const result = calculatePAYE(
        3000,
        'NT',
        1,
        0,
        0,
        'monthly'
      );

      expect(parseFloat(result.taxDeducted)).toBe(0);
      expect(parseFloat(result.taxablePay)).toBe(0);
    });

    it('should handle D0 (Higher Rate) code', () => {
      const result = calculatePAYE(
        3000,
        'D0',
        1,
        0,
        0,
        'monthly'
      );

      // All earnings taxed at 40%
      expect(parseFloat(result.taxDeducted)).toBeCloseTo(1200, 1);
    });

    it('should handle D1 (Additional Rate) code', () => {
      const result = calculatePAYE(
        3000,
        'D1',
        1,
        0,
        0,
        'monthly'
      );

      // All earnings taxed at 45%
      expect(parseFloat(result.taxDeducted)).toBeCloseTo(1350, 1);
    });
  });

  describe('calculatePAYE - Cumulative', () => {
    it('should calculate cumulative tax correctly', () => {
      // Month 2 with prior YTD
      const result = calculatePAYE(
        3000,
        '1257L',
        2, // Month 2
        390, // Prior tax paid
        1952.50, // Prior taxable pay
        'monthly'
      );

      // Should calculate based on cumulative figures
      expect(parseFloat(result.taxDue)).toBeGreaterThan(parseFloat(result.taxDeducted));
    });
  });

  describe('calculatePAYE - Week 1/Month 1', () => {
    it('should calculate non-cumulative tax', () => {
      const result = calculatePAYE(
        3000,
        '1257L',
        6,
        2000, // Would affect cumulative
        10000, // Would affect cumulative
        'monthly',
        true // Week 1/Month 1
      );

      // Should ignore YTD figures
      // Same result as month 1
      const month1Result = calculatePAYE(
        3000,
        '1257L',
        1,
        0,
        0,
        'monthly',
        true
      );

      expect(result.taxDeducted).toBe(month1Result.taxDeducted);
    });
  });

  describe('calculatePAYE - Scottish Tax', () => {
    it('should apply Scottish rates for S prefix', () => {
      const result = calculatePAYE(
        5000,
        'S1257L',
        1,
        0,
        0,
        'monthly'
      );

      // Should have different tax due to Scottish bands
      const rUKResult = calculatePAYE(
        5000,
        '1257L',
        1,
        0,
        0,
        'monthly'
      );

      // Scottish has more bands, so tax will differ for same income
      expect(result.taxDeducted).not.toBe(rUKResult.taxDeducted);
    });

    it('should return Scotland tax region for S prefix', () => {
      const result = calculatePAYE(
        3000,
        'S1257L',
        1,
        0,
        0,
        'monthly'
      );

      expect(result.taxRegion).toBe(TaxRegion.SCOTLAND);
    });

    it('should include starter and intermediate rate breakdown for Scottish tax', () => {
      const result = calculatePAYE(
        5000,
        'S1257L',
        1,
        0,
        0,
        'monthly'
      );

      // Scottish breakdown should include starter and intermediate
      expect(result.breakdown.starterRateTax).toBeDefined();
      expect(result.breakdown.intermediateRateTax).toBeDefined();
    });

    it('should calculate correct Scottish 5-band tax for high income', () => {
      // Test with higher income that hits multiple bands
      const result = calculatePAYE(
        10000, // High monthly income
        'S1257L',
        1,
        0,
        0,
        'monthly'
      );

      expect(result.taxRegion).toBe(TaxRegion.SCOTLAND);
      // Should have tax in multiple bands
      expect(parseFloat(result.breakdown.starterRateTax!)).toBeGreaterThan(0);
      expect(parseFloat(result.breakdown.basicRateTax)).toBeGreaterThan(0);
      expect(parseFloat(result.taxDeducted)).toBeGreaterThan(0);
    });
  });

  describe('calculatePAYE - Welsh Tax', () => {
    it('should apply Welsh rates for C prefix', () => {
      const result = calculatePAYE(
        3000,
        'C1257L',
        1,
        0,
        0,
        'monthly'
      );

      // Currently Welsh rates match rUK, so tax should be same
      const rUKResult = calculatePAYE(
        3000,
        '1257L',
        1,
        0,
        0,
        'monthly'
      );

      // Same tax amount (until Wales diverges from rUK)
      expect(result.taxDeducted).toBe(rUKResult.taxDeducted);
      // But tax region should be different
      expect(result.taxRegion).toBe(TaxRegion.WALES);
      expect(rUKResult.taxRegion).toBe(TaxRegion.REST_OF_UK);
    });

    it('should return Wales tax region for C prefix', () => {
      const result = calculatePAYE(
        3000,
        'C1257L',
        1,
        0,
        0,
        'monthly'
      );

      expect(result.taxRegion).toBe(TaxRegion.WALES);
    });

    it('should handle Welsh BR code', () => {
      const result = calculatePAYE(
        3000,
        'CBR',
        1,
        0,
        0,
        'monthly'
      );

      // All earnings at basic rate
      expect(parseFloat(result.taxDeducted)).toBeCloseTo(600, 1);
      expect(result.taxRegion).toBe(TaxRegion.WALES);
    });

    it('should not include Scottish breakdown fields for Welsh tax', () => {
      const result = calculatePAYE(
        3000,
        'C1257L',
        1,
        0,
        0,
        'monthly'
      );

      // Welsh uses rUK bands, no starter/intermediate breakdown
      expect(result.breakdown.starterRateTax).toBeUndefined();
      expect(result.breakdown.intermediateRateTax).toBeUndefined();
    });
  });

  describe('calculatePAYE - Tax Region', () => {
    it('should return rest_of_uk for standard codes', () => {
      const result = calculatePAYE(
        3000,
        '1257L',
        1,
        0,
        0,
        'monthly'
      );

      expect(result.taxRegion).toBe(TaxRegion.REST_OF_UK);
    });

    it('should return correct region for NT codes', () => {
      const scottishNT = calculatePAYE(3000, 'SNT', 1, 0, 0, 'monthly');
      const welshNT = calculatePAYE(3000, 'CNT', 1, 0, 0, 'monthly');
      const rUKNT = calculatePAYE(3000, 'NT', 1, 0, 0, 'monthly');

      expect(scottishNT.taxRegion).toBe(TaxRegion.SCOTLAND);
      expect(welshNT.taxRegion).toBe(TaxRegion.WALES);
      expect(rUKNT.taxRegion).toBe(TaxRegion.REST_OF_UK);
    });
  });

  describe('calculatePAYE - K Codes', () => {
    it('should add to taxable income for K codes', () => {
      const result = calculatePAYE(
        3000,
        'K500',
        1,
        0,
        0,
        'monthly'
      );

      // K500 means ADD £5,000 to annual income
      // Monthly: £3,000 + (£5,000 / 12) = £3,416.67 taxable
      expect(parseFloat(result.taxablePay)).toBeGreaterThan(3000);
    });

    it('should handle Scottish K codes (SK prefix)', () => {
      const result = calculatePAYE(
        3000,
        'SK500',
        1,
        0,
        0,
        'monthly'
      );

      expect(result.taxRegion).toBe(TaxRegion.SCOTLAND);
      expect(parseFloat(result.taxablePay)).toBeGreaterThan(3000);
      // Should use Scottish tax bands
      expect(result.breakdown.starterRateTax).toBeDefined();
    });

    it('should handle Welsh K codes (CK prefix)', () => {
      const result = calculatePAYE(
        3000,
        'CK500',
        1,
        0,
        0,
        'monthly'
      );

      expect(result.taxRegion).toBe(TaxRegion.WALES);
      expect(parseFloat(result.taxablePay)).toBeGreaterThan(3000);
      // Should not have Scottish breakdown
      expect(result.breakdown.starterRateTax).toBeUndefined();
    });
  });

  describe('calculatePAYE - Edge Cases', () => {
    it('should handle very low income below all thresholds', () => {
      const result = calculatePAYE(
        500, // Very low monthly income
        '1257L',
        1,
        0,
        0,
        'monthly'
      );

      // Personal allowance (£12,570/12 = £1,047.50) exceeds pay
      // So taxable pay should be 0
      expect(parseFloat(result.taxablePay)).toBe(0);
      expect(parseFloat(result.taxDeducted)).toBe(0);
    });

    it('should handle very high income hitting all tax bands', () => {
      const result = calculatePAYE(
        20000, // £240k annual equivalent - hits additional rate
        '1257L',
        1,
        0,
        0,
        'monthly'
      );

      // Should have tax in all three bands
      expect(parseFloat(result.breakdown.basicRateTax)).toBeGreaterThan(0);
      expect(parseFloat(result.breakdown.higherRateTax)).toBeGreaterThan(0);
      expect(parseFloat(result.breakdown.additionalRateTax)).toBeGreaterThan(0);
    });

    it('should handle Scottish very high income hitting all 5 bands', () => {
      const result = calculatePAYE(
        15000, // High monthly income
        'S1257L',
        1,
        0,
        0,
        'monthly'
      );

      expect(result.taxRegion).toBe(TaxRegion.SCOTLAND);
      // Should have tax in starter, basic, intermediate, and higher bands
      expect(parseFloat(result.breakdown.starterRateTax!)).toBeGreaterThan(0);
      expect(parseFloat(result.breakdown.basicRateTax)).toBeGreaterThan(0);
      expect(parseFloat(result.breakdown.intermediateRateTax!)).toBeGreaterThan(0);
      expect(parseFloat(result.breakdown.higherRateTax)).toBeGreaterThan(0);
    });

    it('should handle 0T code (no personal allowance)', () => {
      const result = calculatePAYE(
        3000,
        '0T',
        1,
        0,
        0,
        'monthly'
      );

      // All income is taxable from £0
      expect(parseFloat(result.taxablePay)).toBe(3000);
      expect(parseFloat(result.taxDeducted)).toBeGreaterThan(0);
    });

    it('should handle Scottish 0T code', () => {
      const result = calculatePAYE(
        3000,
        'S0T',
        1,
        0,
        0,
        'monthly'
      );

      expect(result.taxRegion).toBe(TaxRegion.SCOTLAND);
      expect(parseFloat(result.taxablePay)).toBe(3000);
    });
  });
});

describe('Student Loan Calculator', () => {
  describe('calculateStudentLoan', () => {
    it('should calculate Plan 1 deduction', () => {
      // Monthly pay £3,000
      // Plan 1 threshold: £24,990/12 = £2,082.50
      // Deduction: (£3,000 - £2,082.50) × 9% = £82.58
      const result = calculateStudentLoan('3000', ['plan1'], 'monthly');

      expect(parseFloat(result.plan1)).toBeGreaterThan(0);
      expect(parseFloat(result.plan1)).toBeCloseTo(82.58, 0);
      expect(result.total).toBe(result.plan1);
    });

    it('should calculate Plan 2 deduction', () => {
      // Plan 2 threshold: £27,295/12 = £2,274.58
      const result = calculateStudentLoan('3000', ['plan2'], 'monthly');

      expect(parseFloat(result.plan2)).toBeGreaterThan(0);
      expect(parseFloat(result.plan2)).toBeLessThan(parseFloat(calculateStudentLoan('3000', ['plan1'], 'monthly').plan1));
    });

    it('should calculate postgraduate loan deduction', () => {
      // Postgrad threshold: £21,000/12 = £1,750
      // Rate: 6%
      const result = calculateStudentLoan('3000', ['postgrad'], 'monthly');

      // (£3,000 - £1,750) × 6% = £75
      expect(parseFloat(result.postgrad)).toBeCloseTo(75, 0);
    });

    it('should calculate multiple loan deductions', () => {
      const result = calculateStudentLoan('3000', ['plan1', 'postgrad'], 'monthly');

      expect(parseFloat(result.plan1)).toBeGreaterThan(0);
      expect(parseFloat(result.postgrad)).toBeGreaterThan(0);
      expect(parseFloat(result.total)).toBe(
        parseFloat(result.plan1) + parseFloat(result.postgrad)
      );
    });

    it('should return zero below threshold', () => {
      const result = calculateStudentLoan('1500', ['plan1'], 'monthly');

      expect(parseFloat(result.plan1)).toBe(0);
      expect(parseFloat(result.total)).toBe(0);
    });

    it('should calculate Plan 4 deduction (Scottish)', () => {
      // Plan 4 threshold: £31,395/12 = £2,616.25
      const result = calculateStudentLoan('4000', ['plan4'], 'monthly');

      // (£4,000 - £2,616.25) × 9% = £124.54
      expect(parseFloat(result.plan4)).toBeGreaterThan(0);
      expect(parseFloat(result.plan4)).toBeCloseTo(124.54, 0);
    });

    it('should calculate Plan 5 deduction (post-2023)', () => {
      // Plan 5 threshold: £25,000/12 = £2,083.33
      const result = calculateStudentLoan('3000', ['plan5'], 'monthly');

      // (£3,000 - £2,083.33) × 9% = £82.50
      expect(parseFloat(result.plan5)).toBeGreaterThan(0);
      expect(parseFloat(result.plan5)).toBeCloseTo(82.50, 0);
    });

    it('should calculate all loan types simultaneously', () => {
      const result = calculateStudentLoan('5000', ['plan1', 'plan2', 'plan4', 'plan5', 'postgrad'], 'monthly');

      // All plans should have deductions at this high income
      expect(parseFloat(result.plan1)).toBeGreaterThan(0);
      expect(parseFloat(result.plan2)).toBeGreaterThan(0);
      expect(parseFloat(result.plan4)).toBeGreaterThan(0);
      expect(parseFloat(result.plan5)).toBeGreaterThan(0);
      expect(parseFloat(result.postgrad)).toBeGreaterThan(0);

      // Total should be sum of all plans
      const expectedTotal = parseFloat(result.plan1) + parseFloat(result.plan2) +
        parseFloat(result.plan4) + parseFloat(result.plan5) + parseFloat(result.postgrad);
      expect(parseFloat(result.total)).toBeCloseTo(expectedTotal, 2);
    });

    it('should handle weekly payment frequency', () => {
      const weeklyResult = calculateStudentLoan('750', ['plan1'], 'weekly');
      const monthlyResult = calculateStudentLoan('3250', ['plan1'], 'monthly'); // ~4.33 weeks

      // Weekly thresholds are lower, so deduction should occur at lower absolute pay
      expect(parseFloat(weeklyResult.plan1)).toBeGreaterThan(0);
    });
  });
});

describe('Tax Code Parser', () => {
  describe('parseTaxCode', () => {
    it('should parse standard tax code', () => {
      const result = parseTaxCode('1257L');

      expect(result.allowance).toBe(12570);
      expect(result.isScottish).toBe(false);
      expect(result.isWelsh).toBe(false);
      expect(result.isKCode).toBe(false);
      expect(result.suffix).toBe('L');
    });

    it('should parse Scottish tax code', () => {
      const result = parseTaxCode('S1257L');

      expect(result.allowance).toBe(12570);
      expect(result.isScottish).toBe(true);
      expect(result.isWelsh).toBe(false);
    });

    it('should parse Welsh tax code', () => {
      const result = parseTaxCode('C1257L');

      expect(result.allowance).toBe(12570);
      expect(result.isScottish).toBe(false);
      expect(result.isWelsh).toBe(true);
    });

    it('should parse K code as negative allowance', () => {
      const result = parseTaxCode('K500');

      expect(result.allowance).toBe(-5000);
      expect(result.isKCode).toBe(true);
    });

    it('should parse BR code', () => {
      const result = parseTaxCode('BR');

      expect(result.allowance).toBe(0);
      expect(result.suffix).toBe('BR');
    });

    it('should parse D0 code', () => {
      const result = parseTaxCode('D0');

      expect(result.allowance).toBe(0);
      expect(result.suffix).toBe('D0');
    });

    it('should parse NT code', () => {
      const result = parseTaxCode('NT');

      expect(result.allowance).toBe(Infinity);
      expect(result.suffix).toBe('NT');
    });

    it('should parse 0T code', () => {
      const result = parseTaxCode('0T');

      expect(result.allowance).toBe(0);
      expect(result.suffix).toBe('0T');
    });

    it('should parse Scottish K code (SK)', () => {
      const result = parseTaxCode('SK500');

      expect(result.allowance).toBe(-5000);
      expect(result.isScottish).toBe(true);
      expect(result.isWelsh).toBe(false);
      expect(result.isKCode).toBe(true);
    });

    it('should parse Welsh K code (CK)', () => {
      const result = parseTaxCode('CK500');

      expect(result.allowance).toBe(-5000);
      expect(result.isScottish).toBe(false);
      expect(result.isWelsh).toBe(true);
      expect(result.isKCode).toBe(true);
    });

    it('should parse lowercase tax codes', () => {
      const result = parseTaxCode('s1257l');

      expect(result.allowance).toBe(12570);
      expect(result.isScottish).toBe(true);
      expect(result.suffix).toBe('L');
    });

    it('should handle Scottish D0 code', () => {
      const result = parseTaxCode('SD0');

      expect(result.isScottish).toBe(true);
      expect(result.suffix).toBe('D0');
    });

    it('should handle Welsh D1 code', () => {
      const result = parseTaxCode('CD1');

      expect(result.isWelsh).toBe(true);
      expect(result.suffix).toBe('D1');
    });
  });

  describe('getStarterTaxCode', () => {
    it('should return 1257L for declaration A', () => {
      expect(getStarterTaxCode('A')).toBe('1257L');
    });

    it('should return 1257L for declaration B', () => {
      expect(getStarterTaxCode('B')).toBe('1257L');
    });

    it('should return BR for declaration C', () => {
      expect(getStarterTaxCode('C')).toBe('BR');
    });
  });
});
