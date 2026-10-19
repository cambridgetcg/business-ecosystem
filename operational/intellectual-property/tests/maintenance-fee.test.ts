/**
 * US patent maintenance fees: the 3.5, 7.5 and 11.5 year schedule from the
 * grant date (each payable from six months before it, with a six-month grace
 * period after), the status a fee moves through as time passes, and the
 * payment rules (a surcharge after the due date, no payment once paid or
 * missed). The clock is fixed per test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaintenanceFee } from '../src/domain/entities/maintenance-fee.entity.js';

const PATENT = 'patent-1';
// Local dates: the schedule is computed in local time.
const day = (year: number, month: number, date: number): Date => new Date(year, month - 1, date);
const GRANT = day(2020, 1, 15);

function firstFee(): MaintenanceFee {
  const [input] = MaintenanceFee.calculateUSMaintenanceFees(PATENT, GRANT);
  if (!input) throw new Error('no fee schedule');
  return MaintenanceFee.create(input);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('US maintenance fee schedule', () => {
  it('falls due 3.5, 7.5 and 11.5 years after grant', () => {
    const fees = MaintenanceFee.calculateUSMaintenanceFees(PATENT, GRANT);
    expect(fees.map((f) => [f.feeNumber, f.jurisdiction])).toEqual([
      [1, 'US'],
      [2, 'US'],
      [3, 'US'],
    ]);
    expect(fees.map((f) => f.dueDate)).toEqual([
      day(2023, 7, 15),
      day(2027, 7, 15),
      day(2031, 7, 15),
    ]);
    expect(fees.map((f) => f.windowOpensDate)).toEqual([
      day(2023, 1, 15),
      day(2027, 1, 15),
      day(2031, 1, 15),
    ]);
    expect(fees.map((f) => f.gracePeriodEndsDate)).toEqual([
      day(2024, 1, 15),
      day(2028, 1, 15),
      day(2032, 1, 15),
    ]);
  });

  it('starts upcoming, labelled by its year, and announces itself', () => {
    const fee = firstFee();
    expect(fee.status).toBe('upcoming');
    expect(fee.feeLabel).toBe('3.5 Year');
    expect(fee.pullDomainEvents().map((e) => e.type)).toEqual(['ip.maintenance_fee.created']);
  });
});

describe('maintenance fee status over time', () => {
  it.each([
    [day(2022, 12, 1), 'upcoming'],
    [day(2023, 3, 1), 'payable'],
    [day(2023, 9, 1), 'grace_period'],
    [day(2024, 2, 1), 'missed'],
  ])('on %s is %s', (now, status) => {
    vi.useFakeTimers({ now });
    const fee = firstFee();
    fee.updateStatus('scheduler');
    expect(fee.status).toBe(status);
  });

  it('records a missed fee once, and keeps it missed', () => {
    vi.useFakeTimers({ now: day(2024, 2, 1) });
    const fee = firstFee();
    fee.pullDomainEvents();
    fee.updateStatus();
    fee.updateStatus();
    expect(fee.status).toBe('missed');
    expect(fee.pullDomainEvents().map((e) => e.type)).toEqual(['ip.maintenance_fee.missed']);
    expect(fee.isOverdue).toBe(false);
  });

  it('is overdue and in its grace period after the due date', () => {
    vi.useFakeTimers({ now: day(2023, 9, 1) });
    const fee = firstFee();
    expect([fee.isOverdue, fee.isInGracePeriod]).toEqual([true, true]);
    expect(fee.daysUntilDue).toBeLessThan(0);
  });
});

describe('paying a maintenance fee', () => {
  it('charges no surcharge on or before the due date', () => {
    const fee = firstFee();
    fee.pay({ paidDate: day(2023, 7, 15), paidAmount: 200_000, entitySize: 'small' });
    expect(fee.status).toBe('paid');
    expect(fee.surchargeApplied).toBe(false);
    const paid = fee.pullDomainEvents().at(-1);
    expect(paid?.type).toBe('ip.maintenance_fee.paid');
  });

  it('applies the surcharge when paid in the grace period', () => {
    const fee = firstFee();
    fee.pay({
      paidDate: day(2023, 8, 1),
      paidAmount: 250_000,
      entitySize: 'large',
      receiptNumber: 'R-1',
    });
    expect(fee).toMatchObject({ status: 'paid', surchargeApplied: true, receiptNumber: 'R-1' });
  });

  it('cannot be paid twice, or after it was missed', () => {
    const paid = firstFee();
    paid.pay({ paidDate: day(2023, 7, 1), paidAmount: 1, entitySize: 'micro' });
    expect(() =>
      paid.pay({ paidDate: day(2023, 7, 2), paidAmount: 1, entitySize: 'micro' })
    ).toThrow('already been paid');

    vi.useFakeTimers({ now: day(2024, 2, 1) });
    const missed = firstFee();
    missed.updateStatus();
    expect(() =>
      missed.pay({ paidDate: day(2024, 2, 1), paidAmount: 1, entitySize: 'micro' })
    ).toThrow('Cannot pay a missed maintenance fee');
  });
});
