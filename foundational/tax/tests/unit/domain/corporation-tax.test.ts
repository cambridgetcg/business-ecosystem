/**
 * Corporation Tax Calculator Tests
 *
 * Tests for UK Corporation Tax calculation including:
 * - Small profits rate (19%)
 * - Main rate (25%)
 * - Marginal relief
 * - Associated companies
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateCorporationTax,
  calculateCTPeriod,
  getEffectiveTaxRate,
} from '../../../src/domain/corporation-tax/services/calculator.js';
import { CorporationTaxRates } from '../../../src/domain/value-objects/index.js';

describe('Corporation Tax Calculator', () => {
  describe('calculateCorporationTax', () => {
    describe('Small Profits Rate (19%)', () => {
      it('should apply 19% rate for profits at £50,000', () => {
        const result = calculateCorporationTax(50000);

        expect(result.rateApplied).toBe('small_profits');
        expect(result.tax.toNumber()).toBeCloseTo(9500, 2); // £50,000 × 19%
        expect(result.effectiveRate.toNumber()).toBeCloseTo(0.19, 4);
        expect(result.marginalRelief.toNumber()).toBe(0);
      });

      it('should apply 19% rate for profits of £10,000', () => {
        const result = calculateCorporationTax(10000);

        expect(result.rateApplied).toBe('small_profits');
        expect(result.tax.toNumber()).toBeCloseTo(1900, 2);
        expect(result.effectiveRate.toNumber()).toBeCloseTo(0.19, 4);
      });

      it('should apply 19% rate for profits of £1', () => {
        const result = calculateCorporationTax(1);

        expect(result.rateApplied).toBe('small_profits');
        expect(result.tax.toNumber()).toBeCloseTo(0.19, 2);
      });

      it('should handle zero profits', () => {
        const result = calculateCorporationTax(0);

        expect(result.tax.toNumber()).toBe(0);
        expect(result.effectiveRate.toNumber()).toBe(0);
      });

      it('should handle negative profits as zero tax', () => {
        const result = calculateCorporationTax(-5000);

        expect(result.tax.toNumber()).toBe(0);
        expect(result.rateApplied).toBe('small_profits');
      });
    });

    describe('Main Rate (25%)', () => {
      it('should apply 25% rate for profits at £250,000', () => {
        const result = calculateCorporationTax(250000);

        expect(result.rateApplied).toBe('main');
        expect(result.tax.toNumber()).toBeCloseTo(62500, 2); // £250,000 × 25%
        expect(result.effectiveRate.toNumber()).toBeCloseTo(0.25, 4);
        expect(result.marginalRelief.toNumber()).toBe(0);
      });

      it('should apply 25% rate for profits of £500,000', () => {
        const result = calculateCorporationTax(500000);

        expect(result.rateApplied).toBe('main');
        expect(result.tax.toNumber()).toBeCloseTo(125000, 2);
        expect(result.effectiveRate.toNumber()).toBeCloseTo(0.25, 4);
      });

      it('should apply 25% rate for profits of £1,000,000', () => {
        const result = calculateCorporationTax(1000000);

        expect(result.rateApplied).toBe('main');
        expect(result.tax.toNumber()).toBeCloseTo(250000, 2);
      });
    });

    describe('Marginal Relief', () => {
      it('should apply marginal relief for profits of £100,000', () => {
        const result = calculateCorporationTax(100000);

        expect(result.rateApplied).toBe('marginal');

        // Main rate tax: £100,000 × 25% = £25,000
        // Marginal relief: (£250,000 - £100,000) × 3/200 = £2,250
        // Net tax: £25,000 - £2,250 = £22,750
        expect(result.marginalRelief.toNumber()).toBeCloseTo(2250, 2);
        expect(result.tax.toNumber()).toBeCloseTo(22750, 2);
        expect(result.effectiveRate.toNumber()).toBeCloseTo(0.2275, 4);
      });

      it('should apply marginal relief for profits of £150,000', () => {
        const result = calculateCorporationTax(150000);

        expect(result.rateApplied).toBe('marginal');

        // Main rate tax: £150,000 × 25% = £37,500
        // Marginal relief: (£250,000 - £150,000) × 3/200 = £1,500
        // Net tax: £37,500 - £1,500 = £36,000
        expect(result.marginalRelief.toNumber()).toBeCloseTo(1500, 2);
        expect(result.tax.toNumber()).toBeCloseTo(36000, 2);
        expect(result.effectiveRate.toNumber()).toBeCloseTo(0.24, 4);
      });

      it('should apply marginal relief for profits of £200,000', () => {
        const result = calculateCorporationTax(200000);

        expect(result.rateApplied).toBe('marginal');

        // Main rate tax: £200,000 × 25% = £50,000
        // Marginal relief: (£250,000 - £200,000) × 3/200 = £750
        // Net tax: £50,000 - £750 = £49,250
        expect(result.marginalRelief.toNumber()).toBeCloseTo(750, 2);
        expect(result.tax.toNumber()).toBeCloseTo(49250, 2);
        expect(result.effectiveRate.toNumber()).toBeCloseTo(0.24625, 5);
      });

      it('should apply marginal relief for profits just above £50,000', () => {
        const result = calculateCorporationTax(50001);

        expect(result.rateApplied).toBe('marginal');
        expect(result.marginalRelief.toNumber()).toBeGreaterThan(0);
      });

      it('should apply marginal relief for profits just below £250,000', () => {
        const result = calculateCorporationTax(249999);

        expect(result.rateApplied).toBe('marginal');
        expect(result.marginalRelief.toNumber()).toBeGreaterThan(0);
      });
    });

    describe('Associated Companies', () => {
      it('should halve thresholds with 1 associated company', () => {
        // With 1 associated company:
        // Lower limit: £50,000 / 2 = £25,000
        // Upper limit: £250,000 / 2 = £125,000

        const result = calculateCorporationTax(50000, 1);

        expect(result.adjustedLowerLimit.toNumber()).toBe(25000);
        expect(result.adjustedUpperLimit.toNumber()).toBe(125000);
        expect(result.rateApplied).toBe('marginal'); // £50k is now in marginal band
      });

      it('should quarter thresholds with 3 associated companies', () => {
        // With 3 associated companies:
        // Lower limit: £50,000 / 4 = £12,500
        // Upper limit: £250,000 / 4 = £62,500

        const result = calculateCorporationTax(50000, 3);

        expect(result.adjustedLowerLimit.toNumber()).toBe(12500);
        expect(result.adjustedUpperLimit.toNumber()).toBe(62500);
        expect(result.rateApplied).toBe('marginal');
      });

      it('should apply small profits rate below adjusted lower limit', () => {
        const result = calculateCorporationTax(10000, 4);

        // Lower limit: £50,000 / 5 = £10,000
        expect(result.adjustedLowerLimit.toNumber()).toBe(10000);
        expect(result.rateApplied).toBe('small_profits');
        expect(result.tax.toNumber()).toBeCloseTo(1900, 2);
      });

      it('should apply main rate above adjusted upper limit', () => {
        const result = calculateCorporationTax(150000, 1);

        // Upper limit: £250,000 / 2 = £125,000
        expect(result.adjustedUpperLimit.toNumber()).toBe(125000);
        expect(result.rateApplied).toBe('main');
        expect(result.tax.toNumber()).toBeCloseTo(37500, 2); // £150,000 × 25%
      });
    });
  });

  describe('calculateCTPeriod', () => {
    it('should calculate full CT period with deductions', () => {
      const result = calculateCTPeriod({
        periodId: 'test-period',
        tradingProfits: '300000',
        tradingLossesBroughtForward: '50000',
        tradingLossesCarriedBack: '0',
        investmentIncome: '10000',
        propertyIncome: '5000',
        otherIncome: '0',
        chargeableGains: '20000',
        capitalLossesBroughtForward: '5000',
        tradingLossesRelief: '0',
        groupRelief: '0',
        managementExpenses: '0',
        qualifyingCharitableDonations: '10000',
      });

      // Net trading: £300,000 - £50,000 = £250,000
      // Net gains: £20,000 - £5,000 = £15,000
      // Total before deductions: £250,000 + £10,000 + £5,000 + £15,000 = £280,000
      // After charitable donations: £280,000 - £10,000 = £270,000
      expect(parseFloat(result.totalProfitsBeforeDeductions)).toBeCloseTo(280000, 0);
      expect(parseFloat(result.profitsChargeableToCT)).toBeCloseTo(270000, 0);
      expect(result.rateApplied).toBe('main');
    });

    it('should handle R&D tax credits', () => {
      const result = calculateCTPeriod({
        periodId: 'test-period',
        tradingProfits: '100000',
        tradingLossesBroughtForward: '0',
        tradingLossesCarriedBack: '0',
        investmentIncome: '0',
        propertyIncome: '0',
        otherIncome: '0',
        chargeableGains: '0',
        capitalLossesBroughtForward: '0',
        tradingLossesRelief: '0',
        groupRelief: '0',
        managementExpenses: '0',
        qualifyingCharitableDonations: '0',
        rdTaxCredits: '5000',
      });

      // Tax liability before credits (marginal relief applies)
      const grossTax = parseFloat(result.corporationTaxLiability);
      const taxDue = parseFloat(result.taxDue);

      expect(taxDue).toBe(grossTax - 5000);
      expect(parseFloat(result.totalCredits)).toBe(5000);
    });

    it('should not result in negative tax due', () => {
      const result = calculateCTPeriod({
        periodId: 'test-period',
        tradingProfits: '10000',
        tradingLossesBroughtForward: '0',
        tradingLossesCarriedBack: '0',
        investmentIncome: '0',
        propertyIncome: '0',
        otherIncome: '0',
        chargeableGains: '0',
        capitalLossesBroughtForward: '0',
        tradingLossesRelief: '0',
        groupRelief: '0',
        managementExpenses: '0',
        qualifyingCharitableDonations: '0',
        rdTaxCredits: '50000', // More credits than tax
      });

      expect(parseFloat(result.taxDue)).toBe(0);
    });
  });

  describe('getEffectiveTaxRate', () => {
    it('should return 19% for small profits', () => {
      const rate = getEffectiveTaxRate(30000);
      expect(rate).toBe('19.00%');
    });

    it('should return 25% for main rate', () => {
      const rate = getEffectiveTaxRate(300000);
      expect(rate).toBe('25.00%');
    });

    it('should return rate between 19% and 25% for marginal', () => {
      const rate = getEffectiveTaxRate(150000);
      const numericRate = parseFloat(rate);
      expect(numericRate).toBeGreaterThan(19);
      expect(numericRate).toBeLessThan(25);
    });
  });

  describe('Edge Cases', () => {
    it('should handle string inputs', () => {
      const result = calculateCorporationTax('100000');

      expect(result.rateApplied).toBe('marginal');
      expect(result.tax.toNumber()).toBeGreaterThan(0);
    });

    it('should handle Decimal inputs', () => {
      const result = calculateCorporationTax(new Decimal(100000));

      expect(result.rateApplied).toBe('marginal');
      expect(result.tax.toNumber()).toBeGreaterThan(0);
    });

    it('should handle very large profits', () => {
      const result = calculateCorporationTax(100000000); // £100m

      expect(result.rateApplied).toBe('main');
      expect(result.tax.toNumber()).toBeCloseTo(25000000, 0);
      expect(result.effectiveRate.toNumber()).toBeCloseTo(0.25, 4);
    });

    it('should handle fractional profits', () => {
      const result = calculateCorporationTax(12345.67);

      expect(result.tax.toNumber()).toBeCloseTo(2345.68, 0); // 12345.67 × 19%
    });
  });
});
