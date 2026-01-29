import type { Money, PaymentMethod, TransactionStatus } from '../../types/index.js';
import type { DomainEvent } from '../events/domain-event.js';

export type PaymentStatus = TransactionStatus;

/**
 * Payment Entity
 */
export class Payment {
  private readonly _id: string;
  private readonly _invoiceId: string | undefined;
  private readonly _transactionId: string;
  private readonly _amount: Money;
  private readonly _method: PaymentMethod;
  private _status: PaymentStatus;
  private _paidAt: Date | undefined;
  private _failureReason: string | undefined;
  private readonly _createdAt: Date;

  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: {
    id: string;
    transactionId: string;
    amount: Money;
    method: PaymentMethod;
    invoiceId?: string;
    status?: PaymentStatus;
    paidAt?: Date;
    failureReason?: string;
    createdAt: Date;
  }) {
    this._id = props.id;
    this._transactionId = props.transactionId;
    this._amount = props.amount;
    this._method = props.method;
    this._invoiceId = props.invoiceId;
    this._status = props.status ?? 'pending';
    this._paidAt = props.paidAt;
    this._failureReason = props.failureReason;
    this._createdAt = props.createdAt;
  }

  startProcessing(): void {
    this.assertStatus('pending', 'Only pending payments can be processed');
    this._status = 'processing';
    this.addDomainEvent({
      type: 'payment.processing_started',
      aggregateId: this._id,
      aggregateType: 'Payment',
      payload: { transactionId: this._transactionId, amount: this._amount, method: this._method },
      occurredAt: new Date(),
    });
  }

  complete(): void {
    this.assertStatus('processing', 'Only processing payments can be completed');
    this._status = 'completed';
    this._paidAt = new Date();
    this.addDomainEvent({
      type: 'payment.completed',
      aggregateId: this._id,
      aggregateType: 'Payment',
      payload: { transactionId: this._transactionId, amount: this._amount, paidAt: this._paidAt, invoiceId: this._invoiceId },
      occurredAt: new Date(),
    });
  }

  fail(reason: string): void {
    if (this._status === 'completed' || this._status === 'cancelled' || this._status === 'reversed') {
      throw new Error(`Cannot fail payment with status: ${this._status}`);
    }
    this._status = 'failed';
    this._failureReason = reason;
    this.addDomainEvent({
      type: 'payment.failed',
      aggregateId: this._id,
      aggregateType: 'Payment',
      payload: { transactionId: this._transactionId, reason },
      occurredAt: new Date(),
    });
  }

  cancel(reason: string): void {
    if (this._status === 'completed' || this._status === 'reversed' || this._status === 'cancelled') {
      throw new Error(`Cannot cancel payment with status: ${this._status}`);
    }
    this._status = 'cancelled';
    this.addDomainEvent({
      type: 'payment.cancelled',
      aggregateId: this._id,
      aggregateType: 'Payment',
      payload: { transactionId: this._transactionId, reason },
      occurredAt: new Date(),
    });
  }

  private assertStatus(expected: PaymentStatus, message: string): void {
    if (this._status !== expected) throw new Error(message);
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
  get invoiceId(): string | undefined { return this._invoiceId; }
  get transactionId(): string { return this._transactionId; }
  get amount(): Money { return { ...this._amount }; }
  get method(): PaymentMethod { return this._method; }
  get status(): PaymentStatus { return this._status; }
  get paidAt(): Date | undefined { return this._paidAt; }
  get failureReason(): string | undefined { return this._failureReason; }
  get createdAt(): Date { return this._createdAt; }
  get isPaid(): boolean { return this._status === 'completed'; }
}

export type { PaymentMethod };
