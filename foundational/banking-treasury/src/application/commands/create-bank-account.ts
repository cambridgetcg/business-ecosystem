import { randomUUID } from 'crypto';
import { BankAccount } from '../../domain/entities/bank-account.js';
import { BankAccountRepository } from '../../infrastructure/persistence/bank-account.repository.js';
import type { Money, BankAccountType } from '../../types/index.js';

export interface CreateBankAccountCommand {
  entityId: string;
  accountName: string;
  accountType: BankAccountType;
  bankName: string;
  accountNumber: string;
  currency: string;
  isPrimary: boolean;
  userId?: string;
}

export interface CreateBankAccountResult {
  id: string;
  accountName: string;
  status: string;
}

export class CreateBankAccountHandler {
  constructor(private readonly repository: BankAccountRepository) {}

  async execute(command: CreateBankAccountCommand): Promise<CreateBankAccountResult> {
    const initialBalance: Money = { amount: 0, currency: command.currency };

    const account = new BankAccount({
      id: randomUUID(),
      entityId: command.entityId,
      accountName: command.accountName,
      accountType: command.accountType,
      bankName: command.bankName,
      accountNumber: command.accountNumber,
      currency: command.currency,
      balance: initialBalance,
      status: 'active',
      isPrimary: command.isPrimary,
      createdAt: new Date(),
    });

    const saved = await this.repository.saveAggregate(account);
    const events = account.pullDomainEvents();
    // Events would be dispatched here in production

    return { id: saved.id, accountName: saved.accountName, status: saved.status };
  }
}
