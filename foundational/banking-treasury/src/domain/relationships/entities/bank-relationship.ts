/**
 * Bank Relationship Entity
 *
 * Tracks the overall relationship with a banking partner.
 * Includes fee schedules, relationship value, and event history.
 *
 * @module relationships/entities
 */

import type { DomainEvent } from '../../events/domain-event.js';
import type {
  RelationshipTier,
  RelationshipStatus,
  BankProduct,
  RelationshipEvent,
  RelationshipEventType,
  FeeSchedule,
  RelationshipValue,
} from '../types.js';

/**
 * Bank relationship entity properties.
 */
export interface BankRelationshipProps {
  readonly id: string;
  readonly bankName: string;
  readonly bankSwiftBic: string;
  readonly legalEntityName: string;
  readonly tier: RelationshipTier;
  readonly primaryContactName: string;
  readonly primaryContactEmail: string;
  readonly primaryContactPhone?: string | undefined;
  readonly relationshipManagerName?: string | undefined;
  readonly accountIds: string[];
  readonly connectionIds: string[];
  readonly activeProducts: BankProduct[];
  readonly creditFacilityIds: string[];
  readonly feeSchedule: FeeSchedule;
  readonly currentRelationshipValue?: RelationshipValue | undefined;
  readonly contractStartDate: Date;
  readonly contractEndDate?: Date | undefined;
  readonly lastPricingReviewDate?: Date | undefined;
  readonly nextReviewDate?: Date | undefined;
  readonly bankCreditRating?: string | undefined;
  readonly regulatoryStatus: 'compliant' | 'under_review' | 'restricted';
  readonly notes?: string | undefined;
  readonly relationshipHistory: RelationshipEvent[];
  readonly status: RelationshipStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Bank Relationship Entity
 */
export class BankRelationship {
  private readonly _id: string;
  private readonly _bankName: string;
  private readonly _bankSwiftBic: string;
  private readonly _legalEntityName: string;
  private _tier: RelationshipTier;
  private _primaryContactName: string;
  private _primaryContactEmail: string;
  private _primaryContactPhone?: string | undefined;
  private _relationshipManagerName?: string | undefined;
  private _accountIds: string[];
  private _connectionIds: string[];
  private _activeProducts: BankProduct[];
  private _creditFacilityIds: string[];
  private _feeSchedule: FeeSchedule;
  private _currentRelationshipValue?: RelationshipValue | undefined;
  private readonly _contractStartDate: Date;
  private _contractEndDate?: Date | undefined;
  private _lastPricingReviewDate?: Date | undefined;
  private _nextReviewDate?: Date | undefined;
  private _bankCreditRating?: string | undefined;
  private _regulatoryStatus: 'compliant' | 'under_review' | 'restricted';
  private _notes?: string | undefined;
  private _relationshipHistory: RelationshipEvent[];
  private _status: RelationshipStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: BankRelationshipProps) {
    this._id = props.id;
    this._bankName = props.bankName;
    this._bankSwiftBic = props.bankSwiftBic;
    this._legalEntityName = props.legalEntityName;
    this._tier = props.tier;
    this._primaryContactName = props.primaryContactName;
    this._primaryContactEmail = props.primaryContactEmail;
    this._primaryContactPhone = props.primaryContactPhone;
    this._relationshipManagerName = props.relationshipManagerName;
    this._accountIds = [...props.accountIds];
    this._connectionIds = [...props.connectionIds];
    this._activeProducts = [...props.activeProducts];
    this._creditFacilityIds = [...props.creditFacilityIds];
    this._feeSchedule = props.feeSchedule;
    this._currentRelationshipValue = props.currentRelationshipValue;
    this._contractStartDate = props.contractStartDate;
    this._contractEndDate = props.contractEndDate;
    this._lastPricingReviewDate = props.lastPricingReviewDate;
    this._nextReviewDate = props.nextReviewDate;
    this._bankCreditRating = props.bankCreditRating;
    this._regulatoryStatus = props.regulatoryStatus;
    this._notes = props.notes;
    this._relationshipHistory = [...props.relationshipHistory];
    this._status = props.status;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Link an account to this relationship.
   */
  linkAccount(accountId: string): void {
    if (!this._accountIds.includes(accountId)) {
      this._accountIds.push(accountId);
      this._updatedAt = new Date();
    }
  }

  /**
   * Unlink an account from this relationship.
   */
  unlinkAccount(accountId: string): void {
    this._accountIds = this._accountIds.filter(id => id !== accountId);
    this._updatedAt = new Date();
  }

  /**
   * Link a gateway connection to this relationship.
   */
  linkConnection(connectionId: string): void {
    if (!this._connectionIds.includes(connectionId)) {
      this._connectionIds.push(connectionId);
      this._updatedAt = new Date();
    }
  }

  /**
   * Add a product to the relationship.
   */
  addProduct(product: BankProduct): void {
    const existing = this._activeProducts.find(
      p => p.productType === product.productType && p.productName === product.productName
    );

    if (!existing) {
      this._activeProducts.push(product);
      this._updatedAt = new Date();

      this.recordEvent('product_added', `Added ${product.productName}`);

      this.addDomainEvent({
        type: 'bank_relationship.product_added',
        aggregateId: this._id,
        aggregateType: 'BankRelationship',
        payload: { productType: product.productType, productName: product.productName },
        occurredAt: new Date(),
      });
    }
  }

  /**
   * Update the fee schedule.
   */
  updateFeeSchedule(feeSchedule: FeeSchedule): void {
    this._feeSchedule = feeSchedule;
    this._lastPricingReviewDate = new Date();
    this._updatedAt = new Date();

    this.recordEvent('pricing_review', 'Fee schedule updated');

    this.addDomainEvent({
      type: 'bank_relationship.fee_schedule_updated',
      aggregateId: this._id,
      aggregateType: 'BankRelationship',
      payload: { effectiveDate: feeSchedule.effectiveDate },
      occurredAt: new Date(),
    });
  }

  /**
   * Update relationship value calculation.
   */
  updateRelationshipValue(value: RelationshipValue): void {
    this._currentRelationshipValue = value;
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'bank_relationship.value_calculated',
      aggregateId: this._id,
      aggregateType: 'BankRelationship',
      payload: {
        score: value.relationshipScore,
        estimatedRevenue: value.estimatedBankRevenue.amount,
        trend: value.trend,
      },
      occurredAt: new Date(),
    });
  }

  /**
   * Record a relationship event.
   */
  recordEvent(
    eventType: RelationshipEventType,
    description: string,
    participants?: string[],
    outcome?: string
  ): void {
    const event: RelationshipEvent = {
      eventType,
      occurredAt: new Date(),
      description,
      participants,
      outcome,
    };

    this._relationshipHistory.push(event);
    this._updatedAt = new Date();
  }

  /**
   * Update relationship tier.
   */
  updateTier(tier: RelationshipTier, reason: string): void {
    const previousTier = this._tier;
    this._tier = tier;
    this._updatedAt = new Date();

    this.recordEvent('meeting', `Tier changed from ${previousTier} to ${tier}: ${reason}`);

    this.addDomainEvent({
      type: 'bank_relationship.tier_changed',
      aggregateId: this._id,
      aggregateType: 'BankRelationship',
      payload: { previousTier, newTier: tier, reason },
      occurredAt: new Date(),
    });
  }

  /**
   * Update regulatory status.
   */
  updateRegulatoryStatus(status: 'compliant' | 'under_review' | 'restricted', reason: string): void {
    this._regulatoryStatus = status;
    this._updatedAt = new Date();

    if (status !== 'compliant') {
      this.recordEvent('issue_raised', `Regulatory status: ${status} - ${reason}`);
    }
  }

  /**
   * Schedule next review.
   */
  scheduleReview(date: Date): void {
    this._nextReviewDate = date;
    this._updatedAt = new Date();
  }

  /**
   * Check if review is due.
   */
  isReviewDue(): boolean {
    if (!this._nextReviewDate) return false;
    return new Date() >= this._nextReviewDate;
  }

  /**
   * Get products by type.
   */
  getProductsByType(type: string): BankProduct[] {
    return this._activeProducts.filter(p => p.productType === type && p.status === 'active');
  }

  /**
   * Check if bank has capability.
   */
  hasProduct(productType: string): boolean {
    return this._activeProducts.some(
      p => p.productType === productType && p.status === 'active'
    );
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
  get bankName(): string { return this._bankName; }
  get bankSwiftBic(): string { return this._bankSwiftBic; }
  get legalEntityName(): string { return this._legalEntityName; }
  get tier(): RelationshipTier { return this._tier; }
  get primaryContactName(): string { return this._primaryContactName; }
  get primaryContactEmail(): string { return this._primaryContactEmail; }
  get primaryContactPhone(): string | undefined { return this._primaryContactPhone; }
  get relationshipManagerName(): string | undefined { return this._relationshipManagerName; }
  get accountIds(): readonly string[] { return this._accountIds; }
  get connectionIds(): readonly string[] { return this._connectionIds; }
  get activeProducts(): readonly BankProduct[] { return this._activeProducts; }
  get creditFacilityIds(): readonly string[] { return this._creditFacilityIds; }
  get feeSchedule(): FeeSchedule { return this._feeSchedule; }
  get currentRelationshipValue(): RelationshipValue | undefined { return this._currentRelationshipValue; }
  get contractStartDate(): Date { return this._contractStartDate; }
  get contractEndDate(): Date | undefined { return this._contractEndDate; }
  get lastPricingReviewDate(): Date | undefined { return this._lastPricingReviewDate; }
  get nextReviewDate(): Date | undefined { return this._nextReviewDate; }
  get bankCreditRating(): string | undefined { return this._bankCreditRating; }
  get regulatoryStatus(): 'compliant' | 'under_review' | 'restricted' { return this._regulatoryStatus; }
  get notes(): string | undefined { return this._notes; }
  get relationshipHistory(): readonly RelationshipEvent[] { return this._relationshipHistory; }
  get status(): RelationshipStatus { return this._status; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  toProps(): BankRelationshipProps {
    return {
      id: this._id,
      bankName: this._bankName,
      bankSwiftBic: this._bankSwiftBic,
      legalEntityName: this._legalEntityName,
      tier: this._tier,
      primaryContactName: this._primaryContactName,
      primaryContactEmail: this._primaryContactEmail,
      primaryContactPhone: this._primaryContactPhone,
      relationshipManagerName: this._relationshipManagerName,
      accountIds: [...this._accountIds],
      connectionIds: [...this._connectionIds],
      activeProducts: [...this._activeProducts],
      creditFacilityIds: [...this._creditFacilityIds],
      feeSchedule: this._feeSchedule,
      currentRelationshipValue: this._currentRelationshipValue,
      contractStartDate: this._contractStartDate,
      contractEndDate: this._contractEndDate,
      lastPricingReviewDate: this._lastPricingReviewDate,
      nextReviewDate: this._nextReviewDate,
      bankCreditRating: this._bankCreditRating,
      regulatoryStatus: this._regulatoryStatus,
      notes: this._notes,
      relationshipHistory: [...this._relationshipHistory],
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
