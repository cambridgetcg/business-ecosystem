/**
 * VAT Calculator Tests
 *
 * Tests for UK VAT calculation including:
 * - Standard 9-box calculation
 * - Flat Rate Scheme
 * - EU supplies and acquisitions
 * - Validation
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  calculateVATReturn,
  calculateFlatRateVATReturn,
  calculateVATOnNet,
  extractVATFromGross,
  validateVATBoxes,
  getVATLiabilitySummary,
  emptyVATBoxes,
} from '../../../src/domain/vat/services/calculator.js';
import type { VATTransaction } from '../../../src/domain/vat/models/return.js';

describe('VAT Calculator', () => {
  describe('calculateVATReturn', () => {
    it('should calculate basic sales and purchases', () => {
      const transactions: VATTransaction[] = [
        { type: 'sale', netAmount: '10000', vatAmount: '2000', rateType: 'standard', isEUSupply: false, isEUAcquisition: false, isReverseCharge: false },
        { type: 'purchase', netAmount: '5000', vatAmount: '1000', rateType: 'standard', isEUSupply: false, isEUAcquisition: false, isReverseCharge: false },
      ];

      const result = calculateVATReturn(transactions);

      expect(result.box1).toBe('2000.00'); // Output VAT
      expect(result.box2).toBe('0.00');    // Acquisition VAT
      expect(result.box3).toBe('2000.00'); // Total output VAT
      expect(result.box4).toBe('1000.00'); // Input VAT
      expect(result.box5).toBe('1000.00'); // Net VAT to pay
      expect(result.box6).toBe('10000');   // Total sales
      expect(result.box7).toBe('5000');    // Total purchases
    });

    it('should handle zero-rated sales', () => {
      const transactions: VATTransaction[] = [
        { type: 'sale', netAmount: '5000', vatAmount: '0', rateType: 'zero', isEUSupply: false, isEUAcquisition: false, isReverseCharge: false },
        { type: 'purchase', netAmount: '2000', vatAmount: '400', rateType: 'standard', isEUSupply: false, isEUAcquisition: false, isReverseCharge: false },
      ];

      const result = calculateVATReturn(transactions);

      expect(result.box1).toBe('0.00');
      expect(result.box4).toBe('400.00');
      expect(result.box5).toBe('400.00'); // Reclaim: box 5 is unsigned (VAT Notice 700/12 §3.6)
      expect(result.box6).toBe('5000');
    });

    it('should handle EU supplies', () => {
      const transactions: VATTransaction[] = [
        { type: 'eu_supply', netAmount: '8000', vatAmount: '0', rateType: 'zero', isEUSupply: true, isEUAcquisition: false, isReverseCharge: false },
      ];

      const result = calculateVATReturn(transactions);

      expect(result.box6).toBe('8000');  // Total sales
      expect(result.box8).toBe('8000');  // EU supplies
    });

    it('should handle EU acquisitions', () => {
      const transactions: VATTransaction[] = [
        { type: 'eu_acquisition', netAmount: '6000', vatAmount: '1200', rateType: 'standard', isEUSupply: false, isEUAcquisition: true, isReverseCharge: false },
      ];

      const result = calculateVATReturn(transactions);

      expect(result.box2).toBe('1200.00'); // Acquisition VAT (output)
      expect(result.box4).toBe('1200.00'); // Can reclaim (input)
      expect(result.box5).toBe('0.00');    // Net zero
      expect(result.box7).toBe('6000');    // Purchases
      expect(result.box9).toBe('6000');    // EU acquisitions
    });

    it('should handle reverse charge', () => {
      const transactions: VATTransaction[] = [
        { type: 'purchase', netAmount: '3000', vatAmount: '600', rateType: 'standard', isEUSupply: false, isEUAcquisition: false, isReverseCharge: true },
      ];

      const result = calculateVATReturn(transactions);

      expect(result.box1).toBe('600.00'); // Output (reverse charge)
      expect(result.box4).toBe('600.00'); // Input (reclaim)
      expect(result.box5).toBe('0.00');   // Net zero
      expect(result.box7).toBe('3000');
    });

    it('should handle mixed transactions', () => {
      const transactions: VATTransaction[] = [
        // UK sales
        { type: 'sale', netAmount: '20000', vatAmount: '4000', rateType: 'standard', isEUSupply: false, isEUAcquisition: false, isReverseCharge: false },
        // EU supply
        { type: 'eu_supply', netAmount: '5000', vatAmount: '0', rateType: 'zero', isEUSupply: true, isEUAcquisition: false, isReverseCharge: false },
        // UK purchases
        { type: 'purchase', netAmount: '8000', vatAmount: '1600', rateType: 'standard', isEUSupply: false, isEUAcquisition: false, isReverseCharge: false },
        // EU acquisition
        { type: 'eu_acquisition', netAmount: '3000', vatAmount: '600', rateType: 'standard', isEUSupply: false, isEUAcquisition: true, isReverseCharge: false },
      ];

      const result = calculateVATReturn(transactions);

      expect(result.box1).toBe('4000.00');  // UK sales VAT
      expect(result.box2).toBe('600.00');   // EU acquisition VAT
      expect(result.box3).toBe('4600.00');  // Total output
      expect(result.box4).toBe('2200.00');  // 1600 + 600
      expect(result.box5).toBe('2400.00');  // Net to pay
      expect(result.box6).toBe('25000');    // 20000 + 5000
      expect(result.box7).toBe('11000');    // 8000 + 3000
      expect(result.box8).toBe('5000');     // EU supplies
      expect(result.box9).toBe('3000');     // EU acquisitions
    });

    it('should handle empty transactions', () => {
      const result = calculateVATReturn([]);

      expect(result.box1).toBe('0.00');
      expect(result.box5).toBe('0.00');
    });
  });

  describe('calculateFlatRateVATReturn', () => {
    it('should calculate using flat rate percentage', () => {
      const result = calculateFlatRateVATReturn(
        12.0, // 12% flat rate
        '12000', // VAT-inclusive turnover
        '0',
        '0',
        '0'
      );

      expect(result.box1).toBe('1440.00'); // £12,000 × 12%
    });

    it('should include capital asset VAT in box 4', () => {
      const result = calculateFlatRateVATReturn(
        12.0,
        '12000',
        '500', // Capital asset VAT
        '0',
        '0'
      );

      expect(result.box4).toBe('500.00');
      // Net = 1440 - 500 = 940
      expect(result.box5).toBe('940.00');
    });

    it('should include EU figures', () => {
      const result = calculateFlatRateVATReturn(
        14.5,
        '10000',
        '0',
        '2000', // EU supplies
        '1000' // EU acquisitions
      );

      expect(result.box8).toBe('2000');
      expect(result.box9).toBe('1000');
      // Box 2 = EU acquisition VAT at standard rate
      expect(parseFloat(result.box2)).toBeCloseTo(200, 0); // £1000 × 20%
    });
  });

  describe('calculateVATOnNet', () => {
    it('should calculate standard rate VAT', () => {
      const result = calculateVATOnNet('1000', 'standard');

      expect(result.net).toBe('1000.00');
      expect(result.vat).toBe('200.00');
      expect(result.gross).toBe('1200.00');
    });

    it('should calculate reduced rate VAT', () => {
      const result = calculateVATOnNet('1000', 'reduced');

      expect(result.net).toBe('1000.00');
      expect(result.vat).toBe('50.00');
      expect(result.gross).toBe('1050.00');
    });

    it('should calculate zero rate VAT', () => {
      const result = calculateVATOnNet('1000', 'zero');

      expect(result.net).toBe('1000.00');
      expect(result.vat).toBe('0.00');
      expect(result.gross).toBe('1000.00');
    });
  });

  describe('extractVATFromGross', () => {
    it('should extract standard rate VAT', () => {
      const result = extractVATFromGross('1200', 'standard');

      expect(result.gross).toBe('1200.00');
      expect(result.net).toBe('1000.00');
      expect(result.vat).toBe('200.00');
    });

    it('should extract reduced rate VAT', () => {
      const result = extractVATFromGross('1050', 'reduced');

      expect(result.gross).toBe('1050.00');
      expect(result.net).toBe('1000.00');
      expect(result.vat).toBe('50.00');
    });

    it('should handle fractional amounts', () => {
      const result = extractVATFromGross('120.50', 'standard');

      // 120.50 / 1.2 = 100.4167
      // VAT = 120.50 × (0.2 / 1.2) = 20.0833
      expect(parseFloat(result.net)).toBeCloseTo(100.42, 2);
      expect(parseFloat(result.vat)).toBeCloseTo(20.08, 2);
    });
  });

  describe('validateVATBoxes', () => {
    it('should validate correct boxes', () => {
      const boxes = {
        box1: '1000.00',
        box2: '200.00',
        box3: '1200.00',
        box4: '500.00',
        box5: '700.00',
        box6: '5000',
        box7: '2500',
        box8: '1000',
        box9: '500',
      };

      const result = validateVATBoxes(boxes);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect box 3 calculation error', () => {
      const boxes = {
        box1: '1000.00',
        box2: '200.00',
        box3: '1100.00', // Wrong! Should be 1200
        box4: '500.00',
        box5: '600.00',
        box6: '5000',
        box7: '2500',
        box8: '1000',
        box9: '500',
      };

      const result = validateVATBoxes(boxes);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Box 3 must equal Box 1 + Box 2');
    });

    it('should detect box 5 calculation error', () => {
      const boxes = {
        box1: '1000.00',
        box2: '200.00',
        box3: '1200.00',
        box4: '500.00',
        box5: '800.00', // Wrong! Should be 700
        box6: '5000',
        box7: '2500',
        box8: '1000',
        box9: '500',
      };

      const result = validateVATBoxes(boxes);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Box 5 must equal the difference between Box 3 and Box 4');
    });

    it('should detect non-whole number in boxes 6-9', () => {
      const boxes = {
        box1: '1000.00',
        box2: '200.00',
        box3: '1200.00',
        box4: '500.00',
        box5: '700.00',
        box6: '5000.50', // Wrong! Should be whole number
        box7: '2500',
        box8: '1000',
        box9: '500',
      };

      const result = validateVATBoxes(boxes);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('whole number'))).toBe(true);
    });
  });

  describe('getVATLiabilitySummary', () => {
    it('should identify payment due', () => {
      const boxes = emptyVATBoxes();
      boxes.box3 = '1000.00';
      boxes.box4 = '300.00';
      boxes.box5 = '700.00';

      const summary = getVATLiabilitySummary(boxes);

      expect(summary.direction).toBe('pay');
      expect(summary.netVAT).toBe('700.00');
    });

    it('should identify reclaim due', () => {
      const boxes = emptyVATBoxes();
      boxes.box3 = '300.00';
      boxes.box4 = '1000.00';
      boxes.box5 = '700.00'; // Unsigned; the direction comes from box 3 < box 4

      const summary = getVATLiabilitySummary(boxes);

      expect(summary.direction).toBe('reclaim');
      expect(summary.netVAT).toBe('700.00');
    });

    it('should identify nil return', () => {
      const boxes = emptyVATBoxes();

      const summary = getVATLiabilitySummary(boxes);

      expect(summary.direction).toBe('nil');
      expect(summary.netVAT).toBe('0.00');
    });
  });

  describe('emptyVATBoxes', () => {
    it('should return all zeros', () => {
      const boxes = emptyVATBoxes();

      expect(boxes.box1).toBe('0.00');
      expect(boxes.box2).toBe('0.00');
      expect(boxes.box3).toBe('0.00');
      expect(boxes.box4).toBe('0.00');
      expect(boxes.box5).toBe('0.00');
      expect(boxes.box6).toBe('0');
      expect(boxes.box7).toBe('0');
      expect(boxes.box8).toBe('0');
      expect(boxes.box9).toBe('0');
    });
  });
});
