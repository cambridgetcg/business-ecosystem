import { Decimal } from 'decimal.js';
import {
  createMoney,
  zeroMoney,
} from '@foundational/shared';
import type {
  IAccountingService,
  GetAccountQuery,
  GetAccountResult,
  AccountInfo,
  GetChartOfAccountsQuery,
  GetChartOfAccountsResult,
  GetAccountBalanceQuery,
  GetAccountBalanceResult,
  GetTrialBalanceQuery,
  GetTrialBalanceResult,
  TrialBalanceEntry,
  GetJournalEntriesQuery,
  GetJournalEntriesResult,
  JournalEntryInfo,
  JournalLineInfo,
  GetPeriodStatusQuery,
  GetPeriodStatusResult,
  PeriodInfo,
  ListPeriodsQuery,
  ListPeriodsResult,
  GetIntercompanyBalanceQuery,
  GetIntercompanyBalanceResult,
  GetAllIntercompanyBalancesQuery,
  GetAllIntercompanyBalancesResult,
  GetReconciliationStatusQuery,
  GetReconciliationStatusResult,
  GetIncomeStatementQuery,
  GetIncomeStatementResult,
  GetBalanceSheetQuery,
  GetBalanceSheetResult,
  FinancialStatementLineItem,
  CurrencyCode,
} from '@foundational/shared';

import type { Account } from '../../domain/entities/account.js';
import type { JournalEntry, JournalLine } from '../../domain/entities/journal-entry.js';
import type { AccountingPeriod } from '../../domain/entities/accounting-period.js';

/**
 * Accounting Service Implementation
 *
 * Implements IAccountingService contract from @foundational/shared.
 * This is a reference implementation - production would use actual repositories.
 */
export class AccountingService implements IAccountingService {
  // In-memory stores for reference implementation
  private accounts: Map<string, Account> = new Map();
  private journalEntries: Map<string, JournalEntry> = new Map();
  private periods: Map<string, AccountingPeriod> = new Map();
  private balances: Map<string, Decimal> = new Map(); // accountId -> balance

  // Account queries
  async getAccount(query: GetAccountQuery): Promise<GetAccountResult> {
    const key = `${query.entityId}:${query.accountId}`;
    const account = this.accounts.get(key);

    if (!account) {
      return { account: null };
    }

    return {
      account: this.toAccountInfo(account),
    };
  }

  async getChartOfAccounts(query: GetChartOfAccountsQuery): Promise<GetChartOfAccountsResult> {
    const accounts = Array.from(this.accounts.values())
      .filter(a => a.entityId === query.entityId)
      .filter(a => !query.accountTypes || query.accountTypes.includes(a.accountType))
      .filter(a => !query.activeOnly || a.isActive);

    return {
      accounts: accounts.map(a => this.toAccountInfo(a)),
      total: accounts.length,
    };
  }

  // Balance queries
  async getAccountBalance(query: GetAccountBalanceQuery): Promise<GetAccountBalanceResult> {
    const balance = this.balances.get(query.accountId) ?? new Decimal(0);
    const account = Array.from(this.accounts.values()).find(a => a.id === query.accountId);
    const currency = account?.currency ?? 'USD';

    return {
      accountId: query.accountId,
      balance: createMoney(balance, currency),
      asOfDate: query.asOfDate,
    };
  }

  async getTrialBalance(query: GetTrialBalanceQuery): Promise<GetTrialBalanceResult> {
    const accounts = Array.from(this.accounts.values())
      .filter(a => a.entityId === query.entityId);

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);
    const currency: CurrencyCode = 'USD';

    const balances: TrialBalanceEntry[] = accounts.map(account => {
      const balance = this.balances.get(account.id) ?? new Decimal(0);
      const isDebit = account.normalBalance === 'debit';

      if (isDebit) {
        totalDebits = totalDebits.plus(balance.abs());
      } else {
        totalCredits = totalCredits.plus(balance.abs());
      }

      return {
        accountId: account.id,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        accountType: account.accountType,
        debitBalance: isDebit ? createMoney(balance.abs(), account.currency) : zeroMoney(account.currency),
        creditBalance: !isDebit ? createMoney(balance.abs(), account.currency) : zeroMoney(account.currency),
      };
    });

    return {
      entityId: query.entityId,
      asOfDate: query.asOfDate,
      periodId: query.periodId,
      balances,
      totalDebits: createMoney(totalDebits, currency),
      totalCredits: createMoney(totalCredits, currency),
      isBalanced: totalDebits.equals(totalCredits),
    };
  }

  // Journal entry queries
  async getJournalEntries(query: GetJournalEntriesQuery): Promise<GetJournalEntriesResult> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    let entries = Array.from(this.journalEntries.values())
      .filter(e => e.entityId === query.entityId)
      .filter(e => e.entryDate >= startDate && e.entryDate <= endDate);

    if (query.accountId) {
      entries = entries.filter(e =>
        e.lines.some(l => l.accountId === query.accountId)
      );
    }

    const total = entries.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    entries = entries.slice(offset, offset + limit);

    return {
      entries: entries.map(e => this.toJournalEntryInfo(e)),
      total,
    };
  }

  // Period queries
  async getPeriodStatus(query: GetPeriodStatusQuery): Promise<GetPeriodStatusResult> {
    let period: AccountingPeriod | undefined;

    if (query.periodId) {
      period = this.periods.get(query.periodId);
    } else if (query.asOfDate) {
      const date = new Date(query.asOfDate);
      period = Array.from(this.periods.values()).find(
        p => p.entityId === query.entityId && date >= p.startDate && date <= p.endDate
      );
    } else {
      // Return current open period
      period = Array.from(this.periods.values()).find(
        p => p.entityId === query.entityId && p.status === 'open'
      );
    }

    return {
      period: period ? this.toPeriodInfo(period) : null,
    };
  }

  async listPeriods(query: ListPeriodsQuery): Promise<ListPeriodsResult> {
    let periods = Array.from(this.periods.values())
      .filter(p => p.entityId === query.entityId);

    if (query.fiscalYear) {
      periods = periods.filter(p => p.fiscalYear === query.fiscalYear);
    }
    if (query.status) {
      periods = periods.filter(p => p.status === query.status);
    }

    return {
      periods: periods.map(p => this.toPeriodInfo(p)),
    };
  }

  // Intercompany queries
  async getIntercompanyBalance(query: GetIntercompanyBalanceQuery): Promise<GetIntercompanyBalanceResult> {
    const currency: CurrencyCode = 'USD';
    // Reference implementation returns zero balances
    return {
      fromEntityId: query.fromEntityId,
      toEntityId: query.toEntityId,
      receivableBalance: zeroMoney(currency),
      payableBalance: zeroMoney(currency),
      netPosition: zeroMoney(currency),
      asOfDate: query.asOfDate,
    };
  }

  async getAllIntercompanyBalances(query: GetAllIntercompanyBalancesQuery): Promise<GetAllIntercompanyBalancesResult> {
    const currency: CurrencyCode = 'USD';
    return {
      entityId: query.entityId,
      balances: [],
      totalReceivables: zeroMoney(currency),
      totalPayables: zeroMoney(currency),
      netPosition: zeroMoney(currency),
    };
  }

  // Reconciliation queries
  async getReconciliationStatus(query: GetReconciliationStatusQuery): Promise<GetReconciliationStatusResult> {
    const balance = this.balances.get(query.accountId) ?? new Decimal(0);
    const account = Array.from(this.accounts.values()).find(a => a.id === query.accountId);
    const currency = account?.currency ?? 'USD';

    return {
      accountId: query.accountId,
      currentBalance: createMoney(balance, currency),
      unreconciledItems: 0,
      unreconciledAmount: zeroMoney(currency),
      daysSinceLastReconciliation: 0,
    };
  }

  // Financial statement queries
  async getIncomeStatement(query: GetIncomeStatementQuery): Promise<GetIncomeStatementResult> {
    const currency: CurrencyCode = 'USD';
    const accounts = Array.from(this.accounts.values())
      .filter(a => a.entityId === query.entityId);

    const revenueAccounts = accounts.filter(a => a.accountType === 'revenue');
    const expenseAccounts = accounts.filter(a => a.accountType === 'expense');

    const revenueItems = this.buildLineItems(revenueAccounts);
    const expenseItems = this.buildLineItems(expenseAccounts);

    const totalRevenue = revenueItems.reduce(
      (sum, item) => sum.plus(item.amount.amount),
      new Decimal(0)
    );
    const totalExpenses = expenseItems.reduce(
      (sum, item) => sum.plus(item.amount.amount),
      new Decimal(0)
    );

    return {
      entityId: query.entityId,
      periodStart: query.startDate ?? new Date().toISOString(),
      periodEnd: query.endDate ?? new Date().toISOString(),
      revenue: {
        total: createMoney(totalRevenue, currency),
        lineItems: revenueItems,
      },
      expenses: {
        total: createMoney(totalExpenses, currency),
        lineItems: expenseItems,
      },
      netIncome: createMoney(totalRevenue.minus(totalExpenses), currency),
    };
  }

  async getBalanceSheet(query: GetBalanceSheetQuery): Promise<GetBalanceSheetResult> {
    const currency: CurrencyCode = 'USD';
    const accounts = Array.from(this.accounts.values())
      .filter(a => a.entityId === query.entityId);

    const assetAccounts = accounts.filter(a => a.accountType === 'asset');
    const liabilityAccounts = accounts.filter(a => a.accountType === 'liability');
    const equityAccounts = accounts.filter(a => a.accountType === 'equity');

    const assetItems = this.buildLineItems(assetAccounts);
    const liabilityItems = this.buildLineItems(liabilityAccounts);
    const equityItems = this.buildLineItems(equityAccounts);

    const totalAssets = assetItems.reduce(
      (sum, item) => sum.plus(item.amount.amount),
      new Decimal(0)
    );
    const totalLiabilities = liabilityItems.reduce(
      (sum, item) => sum.plus(item.amount.amount),
      new Decimal(0)
    );
    const totalEquity = equityItems.reduce(
      (sum, item) => sum.plus(item.amount.amount),
      new Decimal(0)
    );

    return {
      entityId: query.entityId,
      asOfDate: query.asOfDate,
      assets: {
        total: createMoney(totalAssets, currency),
        lineItems: assetItems,
      },
      liabilities: {
        total: createMoney(totalLiabilities, currency),
        lineItems: liabilityItems,
      },
      equity: {
        total: createMoney(totalEquity, currency),
        lineItems: equityItems,
      },
      totalAssets: createMoney(totalAssets, currency),
      totalLiabilitiesAndEquity: createMoney(totalLiabilities.plus(totalEquity), currency),
      isBalanced: totalAssets.equals(totalLiabilities.plus(totalEquity)),
    };
  }

  // Helper methods
  private toAccountInfo(account: Account): AccountInfo {
    return {
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      accountType: account.accountType,
      normalBalance: account.normalBalance,
      currency: account.currency,
      isActive: account.isActive,
      parentAccountId: account.parentAccountId,
    };
  }

  private toJournalEntryInfo(entry: JournalEntry): JournalEntryInfo {
    const totalDebits = entry.lines.reduce(
      (sum, l) => l.debitAmount ? sum.plus(l.debitAmount) : sum,
      new Decimal(0)
    );
    const totalCredits = entry.lines.reduce(
      (sum, l) => l.creditAmount ? sum.plus(l.creditAmount) : sum,
      new Decimal(0)
    );
    const currency = entry.lines[0]?.currency ?? 'USD';

    return {
      entryId: entry.id,
      entryDate: entry.entryDate.toISOString(),
      description: entry.description,
      reference: entry.sourceDocument?.reference,
      lines: entry.lines.map(l => this.toJournalLineInfo(l)),
      totalDebits: createMoney(totalDebits, currency),
      totalCredits: createMoney(totalCredits, currency),
      isReversed: entry.status === 'reversed',
      reversalOfEntryId: entry.reversalOfEntryId,
    };
  }

  private toJournalLineInfo(line: JournalLine): JournalLineInfo {
    return {
      lineId: line.id,
      accountId: line.accountId,
      accountNumber: '', // Would be looked up from account
      debitAmount: line.debitAmount ? createMoney(line.debitAmount, line.currency) : undefined,
      creditAmount: line.creditAmount ? createMoney(line.creditAmount, line.currency) : undefined,
      memo: line.memo,
    };
  }

  private toPeriodInfo(period: AccountingPeriod): PeriodInfo {
    return {
      periodId: period.id,
      periodName: period.periodName,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      status: period.status,
      fiscalYear: period.fiscalYear,
      fiscalQuarter: period.fiscalQuarter,
      closedAt: period.closedAt?.toISOString(),
      closedBy: period.closedBy,
    };
  }

  private buildLineItems(accounts: Account[]): FinancialStatementLineItem[] {
    return accounts.map(account => {
      const balance = this.balances.get(account.id) ?? new Decimal(0);
      return {
        accountId: account.id,
        accountName: account.accountName,
        amount: createMoney(balance.abs(), account.currency),
      };
    });
  }
}
