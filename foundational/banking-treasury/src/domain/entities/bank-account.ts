import type { Money, BankAccountType, BankAccountStatus } from '../../types/index.js';
import type { DomainEvent } from '../events/domain-event.js';

/**
 * BankAccount Entity
 * Core aggregate for cash management in banking-treasury domain
 */
export class BankAccount {
  private readonly _id: string;
  private readonly _entityId: string;
  private _accountName: string;
  private readonly _accountType: BankAccountType;
  private readonly _bankName: string;
  private readonly _accountNumber: string;
  private readonly _currency: string;
  private _balance: Money;
  private _status: BankAccountStatus;
  private readonly _isPrimary: boolean;
  private readonly _createdAt: Date;
  
  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: {
    id: string;
    entityId: string;
    accountName: string;
    accountType: BankAccountType;
    bankName: string;
    accountNumber: string;
    currency: string;
    balance: Money;
    status: BankAccountStatus;
    isPrimary: boolean;
    createdAt: Date;
  }) {
    this._id = props.id;
    this._entityId = props.entityId;
    this._accountName = props.accountName;
    this._accountType = props.accountType;
    this._bankName = props.bankName;
    this._accountNumber = props.accountNumber;
    this._currency = props.currency;
    this._balance = props.balance;
    this._status = props.status;
    this._isPrimary = props.isPrimary;
    this._createdAt = props.createdAt;
  }

  updateBalance(newBalance: Money, transactionId: string): void {
    if (newBalance.currency !== this._balance.currency) {
      throw new Error('Currency mismatch on balance update');
    }
    if (this._status === 'frozen' || this._status === 'closed') {
      throw new Error(`Cannot update balance on ${this._status} account`);
    }

    const previousBalance = { ...this._balance };
    this._balance = newBalance;

    this.addDomainEvent({
      type: 'account.balance_changed',
      aggregateId: this._id,
      aggregateType: 'BankAccount',
      payload: { previousBalance, newBalance, transactionId },
      occurredAt: new Date(),
    });
  }

  freeze(reason: string): void {
    if (this._status === 'closed') throw new Error('Cannot freeze a closed account');
    if (this._status === 'frozen') return;

    this._status = 'frozen';
    this.addDomainEvent({
      type: 'account.frozen',
      aggregateId: this._id,
      aggregateType: 'BankAccount',
      payload: { reason },
      occurredAt: new Date(),
    });
  }

  unfreeze(): void {
    if (this._status !== 'frozen') throw new Error('Account is not frozen');
    this._status = 'active';
    this.addDomainEvent({
      type: 'account.unfrozen',
      aggregateId: this._id,
      aggregateType: 'BankAccount',
      payload: {},
      occurredAt: new Date(),
    });
  }

  close(reason: string): void {
    if (this._status === 'closed') return;
    if (this._balance.amount !== 0) throw new Error('Cannot close account with non-zero balance');

    this._status = 'closed';
    this.addDomainEvent({
      type: 'account.closed',
      aggregateId: this._id,
      aggregateType: 'BankAccount',
      payload: { reason },
      occurredAt: new Date(),
    });
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  get id(): string { return this._id; }
  get entityId(): string { return this._entityId; }
  get accountName(): string { return this._accountName; }
  get accountType(): BankAccountType { return this._accountType; }
  get bankName(): string { return this._bankName; }
  get accountNumber(): string { return this._accountNumber; }
  get currency(): string { return this._currency; }
  get balance(): Money { return { ...this._balance }; }
  get status(): BankAccountStatus { return this._status; }
  get isPrimary(): boolean { return this._isPrimary; }
  get createdAt(): Date { return this._createdAt; }
}
