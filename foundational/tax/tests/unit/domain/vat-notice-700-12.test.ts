/**
 * HMRC rules the calculator must follow, one test per rule, each citing its source.
 *
 * VAT Notice 700/12, "How to fill in and submit your VAT Return":
 * https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012
 * (gov.uk content last updated 2025-12-19, checked 2026-10-21)
 *
 * HMRC's VAT (MTD) end-to-end service guide, obligations:
 * https://developer.service.hmrc.gov.uk/guides/vat-mtd-end-to-end-service-guide/documentation/obligations.html
 */

import { describe, it, expect } from 'vitest';
import * as vat from '../../../src/domain/vat/index.js';
import {
  calculateVATReturn,
  calculateFlatRateVATReturn,
  getVATLiabilitySummary,
  validateVATBoxes,
} from '../../../src/domain/vat/services/calculator.js';
import {
  calculateVATDeadline,
  CreateVATReturnInputSchema,
} from '../../../src/domain/vat/models/return.js';
import type { VATTransaction } from '../../../src/domain/vat/models/return.js';

const iso = (d: Date): string => d.toISOString().slice(0, 10);

describe('VAT Notice 700/12', () => {
  // §3.6 "deduct the number in box 4 from the number in box 3, enter the difference in box 5";
  // §3.1 "not enter a minus sign in box 5".
  describe('box 5 is the unsigned difference between boxes 3 and 4 (§3.1, §3.6)', () => {
    it('standard return: a reclaim gives a positive box 5', () => {
      const transactions: VATTransaction[] = [
        { type: 'sale', netAmount: '1000', vatAmount: '200', rateType: 'standard', isEUSupply: false, isEUAcquisition: false, isReverseCharge: false },
        { type: 'purchase', netAmount: '3000', vatAmount: '600', rateType: 'standard', isEUSupply: false, isEUAcquisition: false, isReverseCharge: false },
      ];

      const boxes = calculateVATReturn(transactions);

      expect(boxes.box3).toBe('200.00');
      expect(boxes.box4).toBe('600.00');
      expect(boxes.box5).toBe('400.00');
      expect(validateVATBoxes(boxes)).toEqual({ valid: true, errors: [] });
      expect(getVATLiabilitySummary(boxes)).toMatchObject({ direction: 'reclaim', netVAT: '400.00' });
    });

    it('Flat Rate return: a capital goods claim larger than the flat rate VAT gives a positive box 5', () => {
      // 10% of £5,000 = £500 due; £800 VAT claimed on a capital good.
      const boxes = calculateFlatRateVATReturn(10, '5000', '800', '0', '0', '4000');

      expect(boxes.box3).toBe('500.00');
      expect(boxes.box4).toBe('800.00');
      expect(boxes.box5).toBe('300.00');
      expect(getVATLiabilitySummary(boxes).direction).toBe('reclaim');
    });

    it('validation rejects a minus sign in box 5', () => {
      const boxes = {
        box1: '300.00', box2: '0.00', box3: '300.00', box4: '1000.00', box5: '-700.00',
        box6: '0', box7: '0', box8: '0', box9: '0',
      };

      const result = validateVATBoxes(boxes);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Box 5 must not be negative');
    });
  });

  // §4.1, Flat Rate Scheme, box 6: "Enter the turnover that you applied your flat rate
  // percentage to, including VAT."
  it('Flat Rate box 6 is the flat rate turnover including VAT (§4.1)', () => {
    const boxes = calculateFlatRateVATReturn(12, '12000');

    expect(boxes.box1).toBe('1440.00');
    expect(boxes.box6).toBe('12000');
  });

  // §4.1, Flat Rate Scheme, box 7: a capital good claimed in box 4 goes in at its value
  // excluding VAT, and "Also include in box 7 any amount you've entered in box 9".
  describe('Flat Rate box 7 includes box 9 and any capital good claimed in box 4 (§4.1)', () => {
    it('includes the box 9 acquisitions', () => {
      const boxes = calculateFlatRateVATReturn(14.5, '10000', '0', '2000', '1000');

      expect(boxes.box9).toBe('1000');
      expect(boxes.box7).toBe('1000');
    });

    it('adds the net value of a capital good whose VAT is in box 4', () => {
      const boxes = calculateFlatRateVATReturn(14.5, '10000', '600', '0', '1000', '3000');

      expect(boxes.box4).toBe('600.00');
      expect(boxes.box7).toBe('4000');
    });

    it('is 0 when there is neither', () => {
      expect(calculateFlatRateVATReturn(12, '12000').box7).toBe('0');
    });
  });

  // §5: "1 calendar month and 7 days after the end of an accounting period". HMRC's obligations
  // example shows a period ending 2019-01-31 due 2019-03-07 and one ending 2018-10-31 due
  // 2018-12-07.
  describe('the deadline is 1 calendar month and 7 days after the period end (§5)', () => {
    it.each([
      ['2026-03-31', '2026-05-07'],
      ['2019-01-31', '2019-03-07'],
      ['2018-10-31', '2018-12-07'],
      ['2018-06-30', '2018-08-07'],
      ['2018-04-30', '2018-06-07'],
      ['2026-02-28', '2026-04-07'],
      ['2024-02-29', '2024-04-07'],
      ['2025-12-31', '2026-02-07'],
      ['2026-01-15', '2026-02-22'],
      ['2026-01-30', '2026-03-07'],
    ])('period ending %s is due %s', (periodEnd, due) => {
      expect(iso(calculateVATDeadline(new Date(periodEnd)))).toBe(due);
    });
  });

  // Obligations guide, "Period keys": the key is returned with each obligation; it is normally
  // four alphanumeric characters, sometimes four digits, sometimes with a '#'. A quarter ending
  // 30.04.2018 is "18A1", which no date formula produces reliably.
  describe('period keys come from HMRC obligations, never from dates', () => {
    it('the VAT module exports no period key generator', () => {
      expect('generatePeriodKey' in vat).toBe(false);
    });

    const base = {
      tenantId: '00000000-0000-4000-8000-000000000001',
      entityId: '00000000-0000-4000-8000-000000000002',
      registrationId: '00000000-0000-4000-8000-000000000003',
      periodStart: new Date('2018-02-01'),
      periodEnd: new Date('2018-04-30'),
    };

    it('a return cannot be created without the obligation period key', () => {
      expect(CreateVATReturnInputSchema.safeParse(base).success).toBe(false);
      expect(CreateVATReturnInputSchema.safeParse({ ...base, periodKey: '' }).success).toBe(false);
    });

    it.each(['18A1', '0418', '#001'])('accepts the HMRC-issued key %s as given', (periodKey) => {
      const parsed = CreateVATReturnInputSchema.parse({ ...base, periodKey });
      expect(parsed.periodKey).toBe(periodKey);
    });
  });
});
