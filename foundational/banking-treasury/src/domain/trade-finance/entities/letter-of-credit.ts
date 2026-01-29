/**
 * Letter of Credit Entity
 *
 * Trade finance instrument guaranteeing payment upon document presentation.
 * Critical for physical goods trading with international suppliers.
 *
 * @module trade-finance/entities
 */

import type { Money } from '../../../types/financial.js';
import type { DomainEvent } from '../../events/domain-event.js';
import type {
  LCType,
  LCStatus,
  LCDocument,
  LCStatusChange,
  TradeTerms,
} from '../types.js';

/**
 * Letter of Credit entity properties.
 */
export interface LetterOfCreditProps {
  readonly id: string;
  readonly businessUnitId: string;
  readonly bankRelationshipId: string;
  readonly lcNumber: string;
  readonly type: LCType;
  readonly role: 'applicant' | 'beneficiary';
  readonly amount: Money;
  readonly tolerance?: number | undefined;
  readonly counterpartyName: string;
  readonly counterpartyCountry: string;
  readonly issuingBank: string;
  readonly issuingBankSwift: string;
  readonly advisingBank?: string | undefined;
  readonly advisingBankSwift?: string | undefined;
  readonly issueDate: Date;
  readonly expiryDate: Date;
  readonly latestShipmentDate?: Date | undefined;
  readonly requiredDocuments: LCDocument[];
  readonly description: string;
  readonly portOfLoading?: string | undefined;
  readonly portOfDestination?: string | undefined;
  readonly tradeTerms: TradeTerms;
  readonly issuanceFee?: Money | undefined;
  readonly confirmationFee?: Money | undefined;
  readonly amendmentFee?: Money | undefined;
  readonly status: LCStatus;
  readonly statusHistory: LCStatusChange[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Letter of Credit Entity
 */
export class LetterOfCredit {
  private readonly _id: string;
  private readonly _businessUnitId: string;
  private readonly _bankRelationshipId: string;
  private readonly _lcNumber: string;
  private readonly _type: LCType;
  private readonly _role: 'applicant' | 'beneficiary';
  private readonly _amount: Money;
  private readonly _tolerance?: number | undefined;
  private readonly _counterpartyName: string;
  private readonly _counterpartyCountry: string;
  private readonly _issuingBank: string;
  private readonly _issuingBankSwift: string;
  private _advisingBank?: string | undefined;
  private _advisingBankSwift?: string | undefined;
  private readonly _issueDate: Date;
  private _expiryDate: Date;
  private _latestShipmentDate?: Date | undefined;
  private _requiredDocuments: LCDocument[];
  private readonly _description: string;
  private _portOfLoading?: string | undefined;
  private _portOfDestination?: string | undefined;
  private readonly _tradeTerms: TradeTerms;
  private _issuanceFee?: Money | undefined;
  private _confirmationFee?: Money | undefined;
  private _amendmentFee?: Money | undefined;
  private _status: LCStatus;
  private _statusHistory: LCStatusChange[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: LetterOfCreditProps) {
    this._id = props.id;
    this._businessUnitId = props.businessUnitId;
    this._bankRelationshipId = props.bankRelationshipId;
    this._lcNumber = props.lcNumber;
    this._type = props.type;
    this._role = props.role;
    this._amount = props.amount;
    this._tolerance = props.tolerance;
    this._counterpartyName = props.counterpartyName;
    this._counterpartyCountry = props.counterpartyCountry;
    this._issuingBank = props.issuingBank;
    this._issuingBankSwift = props.issuingBankSwift;
    this._advisingBank = props.advisingBank;
    this._advisingBankSwift = props.advisingBankSwift;
    this._issueDate = props.issueDate;
    this._expiryDate = props.expiryDate;
    this._latestShipmentDate = props.latestShipmentDate;
    this._requiredDocuments = [...props.requiredDocuments];
    this._description = props.description;
    this._portOfLoading = props.portOfLoading;
    this._portOfDestination = props.portOfDestination;
    this._tradeTerms = props.tradeTerms;
    this._issuanceFee = props.issuanceFee;
    this._confirmationFee = props.confirmationFee;
    this._amendmentFee = props.amendmentFee;
    this._status = props.status;
    this._statusHistory = [...props.statusHistory];
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Transition to a new status.
   */
  transitionTo(newStatus: LCStatus, changedBy: string, notes?: string): void {
    const validTransitions: Record<LCStatus, LCStatus[]> = {
      draft: ['applied', 'cancelled'],
      applied: ['issued', 'cancelled'],
      issued: ['advised', 'amended', 'cancelled'],
      advised: ['documents_presented', 'amended', 'expired', 'cancelled'],
      amended: ['documents_presented', 'expired', 'cancelled'],
      documents_presented: ['documents_accepted', 'cancelled'],
      documents_accepted: ['paid'],
      paid: [],
      expired: [],
      cancelled: [],
    };

    if (!validTransitions[this._status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this._status} to ${newStatus}`);
    }

    const previousStatus = this._status;
    this._status = newStatus;
    this._updatedAt = new Date();

    const change: LCStatusChange = {
      from: previousStatus,
      to: newStatus,
      changedAt: new Date(),
      changedBy,
      notes,
    };
    this._statusHistory.push(change);

    this.addDomainEvent({
      type: 'letter_of_credit.status_changed',
      aggregateId: this._id,
      aggregateType: 'LetterOfCredit',
      payload: { previousStatus, newStatus, changedBy },
      occurredAt: new Date(),
    });
  }

  /**
   * Amend the LC (requires bank approval).
   */
  amendExpiry(newExpiryDate: Date, changedBy: string): void {
    if (this._status !== 'issued' && this._status !== 'advised') {
      throw new Error(`Cannot amend LC in status ${this._status}`);
    }

    this._expiryDate = newExpiryDate;
    this.transitionTo('amended', changedBy, `Expiry extended to ${newExpiryDate.toISOString()}`);
  }

  /**
   * Check if LC is expired.
   */
  isExpired(): boolean {
    return new Date() > this._expiryDate;
  }

  /**
   * Check if LC is active (can still be drawn).
   */
  isActive(): boolean {
    return ['issued', 'advised', 'amended', 'documents_presented'].includes(this._status)
      && !this.isExpired();
  }

  /**
   * Calculate maximum drawable amount with tolerance.
   */
  maxDrawableAmount(): Money {
    if (!this._tolerance) {
      return this._amount;
    }

    return {
      amount: this._amount.amount * (1 + this._tolerance / 100),
      currency: this._amount.currency,
    };
  }

  /**
   * Days until expiry.
   */
  daysUntilExpiry(): number {
    const now = new Date();
    const diff = this._expiryDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  // Getters
  get id(): string { return this._id; }
  get businessUnitId(): string { return this._businessUnitId; }
  get bankRelationshipId(): string { return this._bankRelationshipId; }
  get lcNumber(): string { return this._lcNumber; }
  get type(): LCType { return this._type; }
  get role(): 'applicant' | 'beneficiary' { return this._role; }
  get amount(): Money { return this._amount; }
  get tolerance(): number | undefined { return this._tolerance; }
  get counterpartyName(): string { return this._counterpartyName; }
  get counterpartyCountry(): string { return this._counterpartyCountry; }
  get issuingBank(): string { return this._issuingBank; }
  get issuingBankSwift(): string { return this._issuingBankSwift; }
  get advisingBank(): string | undefined { return this._advisingBank; }
  get advisingBankSwift(): string | undefined { return this._advisingBankSwift; }
  get issueDate(): Date { return this._issueDate; }
  get expiryDate(): Date { return this._expiryDate; }
  get latestShipmentDate(): Date | undefined { return this._latestShipmentDate; }
  get requiredDocuments(): readonly LCDocument[] { return this._requiredDocuments; }
  get description(): string { return this._description; }
  get portOfLoading(): string | undefined { return this._portOfLoading; }
  get portOfDestination(): string | undefined { return this._portOfDestination; }
  get tradeTerms(): TradeTerms { return this._tradeTerms; }
  get issuanceFee(): Money | undefined { return this._issuanceFee; }
  get confirmationFee(): Money | undefined { return this._confirmationFee; }
  get amendmentFee(): Money | undefined { return this._amendmentFee; }
  get status(): LCStatus { return this._status; }
  get statusHistory(): readonly LCStatusChange[] { return this._statusHistory; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  toProps(): LetterOfCreditProps {
    return {
      id: this._id,
      businessUnitId: this._businessUnitId,
      bankRelationshipId: this._bankRelationshipId,
      lcNumber: this._lcNumber,
      type: this._type,
      role: this._role,
      amount: this._amount,
      tolerance: this._tolerance,
      counterpartyName: this._counterpartyName,
      counterpartyCountry: this._counterpartyCountry,
      issuingBank: this._issuingBank,
      issuingBankSwift: this._issuingBankSwift,
      advisingBank: this._advisingBank,
      advisingBankSwift: this._advisingBankSwift,
      issueDate: this._issueDate,
      expiryDate: this._expiryDate,
      latestShipmentDate: this._latestShipmentDate,
      requiredDocuments: [...this._requiredDocuments],
      description: this._description,
      portOfLoading: this._portOfLoading,
      portOfDestination: this._portOfDestination,
      tradeTerms: this._tradeTerms,
      issuanceFee: this._issuanceFee,
      confirmationFee: this._confirmationFee,
      amendmentFee: this._amendmentFee,
      status: this._status,
      statusHistory: [...this._statusHistory],
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
