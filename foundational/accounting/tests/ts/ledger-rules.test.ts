/**
 * The TypeScript domain rules of double-entry bookkeeping: an entry balances
 * when its debits equal its credits to the cent, every account type has one
 * normal balance, and only an open period takes postings. The Python ledger
 * (commerce posting, payment evidence) is tested by pytest in ../.
 */
import { describe, expect, it } from 'vitest';
import {
  AccountingService,
  JournalEntrySchema,
  calculateTotalCredits,
  calculateTotalDebits,
  canClosePeriod,
  canPostToPerod,
  canReopenPeriod,
  deriveNormalBalance,
  isDateInPeriod,
  validateJournalEntryBalance,
  type AccountingPeriod,
  type JournalLine,
} from '../../src/index.js';

const ENTITY = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
let lineNumber = 0;

function line(side: 'debit' | 'credit', amount: string): JournalLine {
  lineNumber += 1;
  return {
    id: `00000000-0000-4000-8000-${String(lineNumber).padStart(12, '0')}`,
    accountId: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a',
    ...(side === 'debit' ? { debitAmount: amount } : { creditAmount: amount }),
    currency: 'GBP',
    lineNumber,
  };
}

function period(status: AccountingPeriod['status']): AccountingPeriod {
  return {
    id: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b',
    entityId: ENTITY,
    periodName: 'October 2026',
    startDate: new Date('2026-10-01T00:00:00Z'),
    endDate: new Date('2026-10-31T23:59:59Z'),
    fiscalYear: 2026,
    fiscalQuarter: 4,
    fiscalMonth: 10,
    status,
    createdAt: new Date('2026-09-30T00:00:00Z'),
    updatedAt: new Date('2026-09-30T00:00:00Z'),
    version: 1,
  };
}

describe('journal entry balance', () => {
  it('balances decimal amounts exactly, where 0.1 + 0.2 in floating point would not', () => {
    const lines = [line('debit', '0.10'), line('debit', '0.20'), line('credit', '0.30')];
    expect(validateJournalEntryBalance(lines)).toBe(true);
    expect(calculateTotalDebits(lines).toFixed(2)).toBe('0.30');
    expect(calculateTotalCredits(lines).toFixed(2)).toBe('0.30');
  });

  it('rejects an entry that is out by a penny', () => {
    const lines = [line('debit', '120.00'), line('credit', '100.00'), line('credit', '19.99')];
    expect(validateJournalEntryBalance(lines)).toBe(false);
  });

  it('balances a sale split across revenue and VAT', () => {
    // A £120 sale at 20% VAT: cash debit, revenue and output VAT credits.
    const lines = [line('debit', '120.00'), line('credit', '100.00'), line('credit', '20.00')];
    expect(validateJournalEntryBalance(lines)).toBe(true);
  });

  it('needs at least two lines in an entry', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    const entry = {
      id: '4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c',
      entityId: ENTITY,
      periodId: period('open').id,
      entryNumber: 'JE-0001',
      entryDate: now,
      description: 'Sale',
      status: 'draft',
      lines: [line('debit', '10.00'), line('credit', '10.00')],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    expect(JournalEntrySchema.safeParse(entry).success).toBe(true);
    expect(JournalEntrySchema.safeParse({ ...entry, lines: entry.lines.slice(0, 1) }).success).toBe(
      false
    );
  });
});

describe('accounts and periods', () => {
  it.each([
    ['asset', 'debit'],
    ['expense', 'debit'],
    ['liability', 'credit'],
    ['equity', 'credit'],
    ['revenue', 'credit'],
  ] as const)('gives a %s account a %s normal balance', (type, normal) => {
    expect(deriveNormalBalance(type)).toBe(normal);
  });

  it('includes both ends of a period', () => {
    const october = period('open');
    expect(isDateInPeriod(october.startDate, october)).toBe(true);
    expect(isDateInPeriod(october.endDate, october)).toBe(true);
    expect(isDateInPeriod(new Date('2026-11-01T00:00:00Z'), october)).toBe(false);
  });

  it('posts to and closes only an open period, and reopens only a closed one', () => {
    expect([canPostToPerod(period('open')), canClosePeriod(period('open'))]).toEqual([true, true]);
    expect([canPostToPerod(period('closed')), canReopenPeriod(period('closed'))]).toEqual([
      false,
      true,
    ]);
    expect([canPostToPerod(period('locked')), canReopenPeriod(period('locked'))]).toEqual([
      false,
      false,
    ]);
  });

  it('reports an entity with no accounts as balanced at zero', async () => {
    const trial = await new AccountingService().getTrialBalance({
      entityId: ENTITY,
      asOfDate: '2026-10-31',
    });
    expect(trial.balances).toEqual([]);
    expect(trial.isBalanced).toBe(true);
  });
});
