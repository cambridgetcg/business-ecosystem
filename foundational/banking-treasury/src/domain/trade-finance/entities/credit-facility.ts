/**
 * Credit Facility Entity
 *
 * Represents a credit line or loan facility from a bank.
 * Critical for working capital management in trading businesses.
 *
 * @module trade-finance/entities
 */

import type { Money } from '../../../types/financial.js';
import type { DomainEvent } from '../../events/domain-event.js';
import type {
  FacilityType,
  FacilityStatus,
  InterestRate,
  Covenant,
  CollateralInfo,
} from '../types.js';

/**
 * Credit facility entity properties.
 */
export interface CreditFacilityProps {
  readonly id: string;
  readonly businessUnitId: string;
  readonly bankRelationshipId: string;
  readonly facilityType: FacilityType;
  readonly facilityNumber: string;
  readonly commitmentAmount: Money;
  readonly availableAmount: Money;
  readonly drawnAmount: Money;
  readonly interestRate: InterestRate;
  readonly commitmentFee: number;
  readonly utilizationFee?: number | undefined;
  readonly effectiveDate: Date;
  readonly maturityDate: Date;
  readonly covenants: Covenant[];
  readonly collateral: CollateralInfo[];
  readonly status: FacilityStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Credit Facility Entity
 */
export class CreditFacility {
  private readonly _id: string;
  private readonly _businessUnitId: string;
  private readonly _bankRelationshipId: string;
  private readonly _facilityType: FacilityType;
  private readonly _facilityNumber: string;
  private readonly _commitmentAmount: Money;
  private _availableAmount: Money;
  private _drawnAmount: Money;
  private _interestRate: InterestRate;
  private readonly _commitmentFee: number;
  private readonly _utilizationFee?: number | undefined;
  private readonly _effectiveDate: Date;
  private readonly _maturityDate: Date;
  private _covenants: Covenant[];
  private _collateral: CollateralInfo[];
  private _status: FacilityStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: CreditFacilityProps) {
    this._id = props.id;
    this._businessUnitId = props.businessUnitId;
    this._bankRelationshipId = props.bankRelationshipId;
    this._facilityType = props.facilityType;
    this._facilityNumber = props.facilityNumber;
    this._commitmentAmount = props.commitmentAmount;
    this._availableAmount = props.availableAmount;
    this._drawnAmount = props.drawnAmount;
    this._interestRate = props.interestRate;
    this._commitmentFee = props.commitmentFee;
    this._utilizationFee = props.utilizationFee;
    this._effectiveDate = props.effectiveDate;
    this._maturityDate = props.maturityDate;
    this._covenants = [...props.covenants];
    this._collateral = [...props.collateral];
    this._status = props.status;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Draw from the facility.
   */
  draw(amount: Money, reference: string): void {
    if (this._status !== 'active') {
      throw new Error(`Cannot draw from facility in status ${this._status}`);
    }

    if (amount.currency !== this._commitmentAmount.currency) {
      throw new Error('Currency mismatch');
    }

    if (amount.amount > this._availableAmount.amount) {
      throw new Error(`Insufficient available amount. Requested: ${amount.amount}, Available: ${this._availableAmount.amount}`);
    }

    this._drawnAmount = {
      amount: this._drawnAmount.amount + amount.amount,
      currency: this._drawnAmount.currency,
    };

    this._availableAmount = {
      amount: this._availableAmount.amount - amount.amount,
      currency: this._availableAmount.currency,
    };

    this._updatedAt = new Date();

    // Check if fully drawn
    if (this._availableAmount.amount <= 0) {
      this._status = 'fully_drawn';
    }

    this.addDomainEvent({
      type: 'credit_facility.drawn',
      aggregateId: this._id,
      aggregateType: 'CreditFacility',
      payload: { amount: amount.amount, reference, newDrawnAmount: this._drawnAmount.amount },
      occurredAt: new Date(),
    });
  }

  /**
   * Repay to the facility.
   */
  repay(amount: Money, reference: string): void {
    if (amount.currency !== this._commitmentAmount.currency) {
      throw new Error('Currency mismatch');
    }

    if (amount.amount > this._drawnAmount.amount) {
      throw new Error(`Cannot repay more than drawn. Repayment: ${amount.amount}, Drawn: ${this._drawnAmount.amount}`);
    }

    this._drawnAmount = {
      amount: this._drawnAmount.amount - amount.amount,
      currency: this._drawnAmount.currency,
    };

    this._availableAmount = {
      amount: this._availableAmount.amount + amount.amount,
      currency: this._availableAmount.currency,
    };

    // Restore to active if was fully drawn
    if (this._status === 'fully_drawn' && this._availableAmount.amount > 0) {
      this._status = 'active';
    }

    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'credit_facility.repaid',
      aggregateId: this._id,
      aggregateType: 'CreditFacility',
      payload: { amount: amount.amount, reference, newDrawnAmount: this._drawnAmount.amount },
      occurredAt: new Date(),
    });
  }

  /**
   * Update covenant compliance status.
   */
  updateCovenantCompliance(covenantName: string, currentValue: number, inCompliance: boolean): void {
    const index = this._covenants.findIndex(c => c.name === covenantName);
    if (index === -1) {
      throw new Error(`Covenant not found: ${covenantName}`);
    }

    const existingCovenant = this._covenants[index];
    if (!existingCovenant) {
      throw new Error(`Covenant at index ${index} not found`);
    }

    const updatedCovenant: Covenant = {
      type: existingCovenant.type,
      name: existingCovenant.name,
      description: existingCovenant.description,
      metric: existingCovenant.metric,
      threshold: existingCovenant.threshold,
      frequency: existingCovenant.frequency,
      currentValue,
      inCompliance,
      lastTestedAt: new Date(),
    };
    this._covenants[index] = updatedCovenant;

    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'credit_facility.covenant_tested',
      aggregateId: this._id,
      aggregateType: 'CreditFacility',
      payload: { covenantName, currentValue, inCompliance },
      occurredAt: new Date(),
    });

    // Check if defaulted
    if (!inCompliance) {
      this.addDomainEvent({
        type: 'credit_facility.covenant_breach',
        aggregateId: this._id,
        aggregateType: 'CreditFacility',
        payload: { covenantName, currentValue, threshold: existingCovenant.threshold },
        occurredAt: new Date(),
      });
    }
  }

  /**
   * Add collateral to the facility.
   */
  addCollateral(collateral: CollateralInfo): void {
    this._collateral.push(collateral);
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'credit_facility.collateral_added',
      aggregateId: this._id,
      aggregateType: 'CreditFacility',
      payload: { type: collateral.type, value: collateral.value.amount },
      occurredAt: new Date(),
    });
  }

  /**
   * Calculate utilization percentage.
   */
  utilizationPercentage(): number {
    if (this._commitmentAmount.amount === 0) return 0;
    return (this._drawnAmount.amount / this._commitmentAmount.amount) * 100;
  }

  /**
   * Check if any covenants are breached.
   */
  hasCovenantBreach(): boolean {
    return this._covenants.some(c => !c.inCompliance);
  }

  /**
   * Days until maturity.
   */
  daysUntilMaturity(): number {
    const now = new Date();
    const diff = this._maturityDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if facility is expired.
   */
  isExpired(): boolean {
    return new Date() > this._maturityDate;
  }

  /**
   * Calculate total collateral value.
   */
  totalCollateralValue(): Money {
    const currency = this._commitmentAmount.currency;
    const total = this._collateral
      .filter(c => c.value.currency === currency)
      .reduce((sum, c) => sum + c.value.amount, 0);

    return { amount: total, currency };
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
  get facilityType(): FacilityType { return this._facilityType; }
  get facilityNumber(): string { return this._facilityNumber; }
  get commitmentAmount(): Money { return this._commitmentAmount; }
  get availableAmount(): Money { return this._availableAmount; }
  get drawnAmount(): Money { return this._drawnAmount; }
  get interestRate(): InterestRate { return this._interestRate; }
  get commitmentFee(): number { return this._commitmentFee; }
  get utilizationFee(): number | undefined { return this._utilizationFee; }
  get effectiveDate(): Date { return this._effectiveDate; }
  get maturityDate(): Date { return this._maturityDate; }
  get covenants(): readonly Covenant[] { return this._covenants; }
  get collateral(): readonly CollateralInfo[] { return this._collateral; }
  get status(): FacilityStatus { return this._status; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  toProps(): CreditFacilityProps {
    return {
      id: this._id,
      businessUnitId: this._businessUnitId,
      bankRelationshipId: this._bankRelationshipId,
      facilityType: this._facilityType,
      facilityNumber: this._facilityNumber,
      commitmentAmount: this._commitmentAmount,
      availableAmount: this._availableAmount,
      drawnAmount: this._drawnAmount,
      interestRate: this._interestRate,
      commitmentFee: this._commitmentFee,
      utilizationFee: this._utilizationFee,
      effectiveDate: this._effectiveDate,
      maturityDate: this._maturityDate,
      covenants: [...this._covenants],
      collateral: [...this._collateral],
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
