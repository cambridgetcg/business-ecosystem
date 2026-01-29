import { BankAccountRepository } from '../../infrastructure/persistence/bank-account.repository.js';
import type { Money } from '../../types/index.js';

export interface GetCashPositionQuery {
  entityId: string;
  currency?: string | undefined;
}

export interface CashPosition {
  entityId: string;
  totalBalance: Money;
  accountCount: number;
  byAccount: Array<{
    accountId: string;
    accountName: string;
    balance: Money;
    status: string;
  }>;
  asOfDate: Date;
}

export class GetCashPositionHandler {
  constructor(private readonly repository: BankAccountRepository) {}

  async execute(query: GetCashPositionQuery): Promise<CashPosition> {
    const accounts = await this.repository.findByEntityId(query.entityId);

    const filtered = query.currency
      ? accounts.filter((a) => a.currency === query.currency)
      : accounts;

    const currency = query.currency ?? filtered[0]?.currency ?? 'USD';
    const totalAmount = filtered
      .filter((a) => a.status === 'active')
      .reduce((sum, a) => sum + a.balance.amount, 0);

    return {
      entityId: query.entityId,
      totalBalance: { amount: totalAmount, currency },
      accountCount: filtered.length,
      byAccount: filtered.map((a) => ({
        accountId: a.id,
        accountName: a.accountName,
        balance: a.balance,
        status: a.status,
      })),
      asOfDate: new Date(),
    };
  }
}
