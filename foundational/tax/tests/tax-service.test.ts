/**
 * TaxService's calculations, in exact decimals: quarterly estimates,
 * withholding on cross-border payments and the CFC ownership threshold, plus
 * the format rules the jurisdiction schema enforces.
 */
import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { TaxJurisdictionSchema, TaxService, type TaxJurisdiction } from '../src/index.js';

const ENTITY = '5f1d7a2b-3c4e-4d6f-8a9b-0c1d2e3f4a5b';
const PARENT = '6a2e8b3c-4d5f-4e7a-9b0c-1d2e3f4a5b6c';

const jurisdiction: TaxJurisdiction = {
  id: '7b3f9c4d-5e6a-4f8b-8c1d-2e3f4a5b6c7d',
  name: 'United States (federal)',
  code: 'US-FED',
  authorityType: 'federal',
  country: 'US',
  currency: 'USD',
  fiscalYearEnd: '12-31',
  taxTypes: ['income', 'estimated'],
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('TaxService calculations', () => {
  const service = new TaxService();

  it('estimates a quarter as a quarter of 21% of annual taxable income', () => {
    const estimate = service.calculateQuarterlyEstimate(new Decimal('1000000'), jurisdiction, 2);
    expect(estimate.toString()).toBe('52500');
  });

  it('keeps cents exact where binary floating point would not', () => {
    const estimate = service.calculateQuarterlyEstimate(new Decimal('100.04'), jurisdiction, 1);
    expect(estimate.toString()).toBe('5.2521');
  });

  it.each([
    ['dividend', '300.03'],
    ['interest', '300.03'],
    ['royalty', '300.03'],
    ['services', '0'],
  ] as const)('withholds on a %s payment at the default rate', (paymentType, amount) => {
    const result = service.calculateWithholding(new Decimal('1000.10'), 'US', 'GB', paymentType);
    expect(result.amount.toString()).toBe(amount);
    expect(result.rate.toString()).toBe(paymentType === 'services' ? '0' : '0.3');
  });

  it('treats more than 50% ownership as a controlled foreign corporation', async () => {
    const over = await service.checkCFCStatus(ENTITY, PARENT, new Decimal('50.01'));
    expect(over).toEqual({ isCFC: true, reason: 'Ownership of 50.01% exceeds 50% threshold' });
    expect(await service.checkCFCStatus(ENTITY, PARENT, new Decimal('50'))).toEqual({
      isCFC: false,
    });
  });

  it('reports a zero USD unrecognized tax benefit for an entity with no positions', async () => {
    const utb = await service.getTotalUTB(ENTITY);
    expect(utb.amount.isZero()).toBe(true);
    expect(utb.currency).toBe('USD');
  });
});

describe('TaxJurisdictionSchema', () => {
  it('accepts a jurisdiction with an MM-DD fiscal year end', () => {
    expect(TaxJurisdictionSchema.safeParse(jurisdiction).success).toBe(true);
  });

  it.each([
    ['a fiscal year end that is not MM-DD', { fiscalYearEnd: '31/12' }],
    ['a three-letter country code', { country: 'USA' }],
    ['an unknown tax type', { taxTypes: ['income', 'tithe'] }],
  ])('rejects %s', (_case, change) => {
    expect(TaxJurisdictionSchema.safeParse({ ...jurisdiction, ...change }).success).toBe(false);
  });
});
