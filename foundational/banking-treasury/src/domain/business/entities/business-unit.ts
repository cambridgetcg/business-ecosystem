/**
 * Business Unit Entity
 *
 * Organizational unit with distinct banking needs.
 * Primary aggregate for business context in treasury operations.
 *
 * @module business/entities
 */

import type { DomainEvent } from '../../events/domain-event.js';
import type { AccountPurpose } from '../value-objects/account-purpose.js';
import type { BankingPolicy } from '../value-objects/banking-policy.js';

/**
 * Type of business unit determining banking requirements.
 */
export type BusinessUnitType =
  | 'saas'               // SaaS/subscription business
  | 'trading'            // Physical goods trading
  | 'services'           // Professional services
  | 'holding'            // Holding company
  | 'shared_services';   // Shared services center

/**
 * Status of a business unit.
 */
export type BusinessUnitStatus = 'active' | 'inactive' | 'setup';

/**
 * Assignment of an account to a business unit with purpose.
 */
export interface AccountAssignment {
  readonly accountId: string;
  readonly purpose: AccountPurpose;
  readonly isPrimaryForPurpose: boolean;
  readonly assignedAt: Date;
}

/**
 * Business Unit entity properties.
 */
export interface BusinessUnitProps {
  readonly id: string;
  readonly name: string;
  readonly type: BusinessUnitType;
  readonly legalEntityId: string;
  readonly parentUnitId?: string | undefined;
  readonly functionalCurrency: string;
  readonly bankingPolicy: BankingPolicy;
  readonly accountAssignments: AccountAssignment[];
  readonly processorIds: string[];
  readonly bankRelationshipIds: string[];
  readonly creditFacilityIds: string[];
  readonly status: BusinessUnitStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Business Unit Entity
 *
 * Represents an organizational unit with distinct banking needs.
 * Tracks account assignments, processor connections, and bank relationships.
 */
export class BusinessUnit {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _type: BusinessUnitType;
  private readonly _legalEntityId: string;
  private readonly _parentUnitId?: string | undefined;
  private readonly _functionalCurrency: string;
  private _bankingPolicy: BankingPolicy;
  private _accountAssignments: AccountAssignment[];
  private _processorIds: string[];
  private _bankRelationshipIds: string[];
  private _creditFacilityIds: string[];
  private _status: BusinessUnitStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: BusinessUnitProps) {
    this._id = props.id;
    this._name = props.name;
    this._type = props.type;
    this._legalEntityId = props.legalEntityId;
    this._parentUnitId = props.parentUnitId;
    this._functionalCurrency = props.functionalCurrency;
    this._bankingPolicy = props.bankingPolicy;
    this._accountAssignments = [...props.accountAssignments];
    this._processorIds = [...props.processorIds];
    this._bankRelationshipIds = [...props.bankRelationshipIds];
    this._creditFacilityIds = [...props.creditFacilityIds];
    this._status = props.status;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Assign an account to this business unit.
   */
  assignAccount(
    accountId: string,
    purpose: AccountPurpose,
    isPrimaryForPurpose: boolean = false
  ): void {
    // Check if already assigned
    const existing = this._accountAssignments.find(a => a.accountId === accountId);
    if (existing) {
      throw new Error(`Account ${accountId} already assigned to this business unit`);
    }

    // If marking as primary, unset other primaries for this purpose
    if (isPrimaryForPurpose) {
      this._accountAssignments = this._accountAssignments.map(a =>
        a.purpose.type === purpose.type
          ? { ...a, isPrimaryForPurpose: false }
          : a
      );
    }

    const assignment: AccountAssignment = {
      accountId,
      purpose,
      isPrimaryForPurpose,
      assignedAt: new Date(),
    };

    this._accountAssignments.push(assignment);
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.account_assigned',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: { accountId, purpose: purpose.type, isPrimaryForPurpose },
      occurredAt: new Date(),
    });
  }

  /**
   * Unassign an account from this business unit.
   */
  unassignAccount(accountId: string): void {
    const index = this._accountAssignments.findIndex(a => a.accountId === accountId);
    if (index === -1) {
      throw new Error(`Account ${accountId} not assigned to this business unit`);
    }

    const removedItems = this._accountAssignments.splice(index, 1);
    const removed = removedItems[0];
    if (!removed) {
      throw new Error(`Unexpected error: could not remove account ${accountId}`);
    }
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.account_unassigned',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: { accountId, purpose: removed.purpose.type },
      occurredAt: new Date(),
    });
  }

  /**
   * Link a payment processor to this business unit.
   */
  linkProcessor(processorId: string): void {
    if (this._processorIds.includes(processorId)) {
      return; // Already linked
    }

    this._processorIds.push(processorId);
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.processor_linked',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: { processorId },
      occurredAt: new Date(),
    });
  }

  /**
   * Unlink a payment processor from this business unit.
   */
  unlinkProcessor(processorId: string): void {
    const index = this._processorIds.indexOf(processorId);
    if (index === -1) {
      throw new Error(`Processor ${processorId} not linked to this business unit`);
    }

    this._processorIds.splice(index, 1);
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.processor_unlinked',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: { processorId },
      occurredAt: new Date(),
    });
  }

  /**
   * Link a bank relationship to this business unit.
   */
  linkBankRelationship(relationshipId: string): void {
    if (this._bankRelationshipIds.includes(relationshipId)) {
      return;
    }

    this._bankRelationshipIds.push(relationshipId);
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.bank_relationship_linked',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: { relationshipId },
      occurredAt: new Date(),
    });
  }

  /**
   * Link a credit facility to this business unit.
   */
  linkCreditFacility(facilityId: string): void {
    if (this._creditFacilityIds.includes(facilityId)) {
      return;
    }

    this._creditFacilityIds.push(facilityId);
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.credit_facility_linked',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: { facilityId },
      occurredAt: new Date(),
    });
  }

  /**
   * Update the banking policy for this business unit.
   */
  updateBankingPolicy(policy: BankingPolicy): void {
    if (policy.businessUnitId !== this._id) {
      throw new Error('Banking policy must be for this business unit');
    }

    this._bankingPolicy = policy;
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.policy_updated',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: { effectiveFrom: policy.effectiveFrom },
      occurredAt: new Date(),
    });
  }

  /**
   * Activate this business unit.
   */
  activate(): void {
    if (this._status === 'active') return;

    this._status = 'active';
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.activated',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: {},
      occurredAt: new Date(),
    });
  }

  /**
   * Deactivate this business unit.
   */
  deactivate(): void {
    if (this._status === 'inactive') return;

    this._status = 'inactive';
    this._updatedAt = new Date();

    this.addDomainEvent({
      type: 'business_unit.deactivated',
      aggregateId: this._id,
      aggregateType: 'BusinessUnit',
      payload: {},
      occurredAt: new Date(),
    });
  }

  /**
   * Get the primary account for a given purpose.
   */
  getPrimaryAccountForPurpose(purposeType: string): AccountAssignment | undefined {
    return this._accountAssignments.find(
      a => a.purpose.type === purposeType && a.isPrimaryForPurpose
    );
  }

  /**
   * Get all accounts for a given purpose.
   */
  getAccountsForPurpose(purposeType: string): AccountAssignment[] {
    return this._accountAssignments.filter(a => a.purpose.type === purposeType);
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
  get name(): string { return this._name; }
  get type(): BusinessUnitType { return this._type; }
  get legalEntityId(): string { return this._legalEntityId; }
  get parentUnitId(): string | undefined { return this._parentUnitId; }
  get functionalCurrency(): string { return this._functionalCurrency; }
  get bankingPolicy(): BankingPolicy { return this._bankingPolicy; }
  get accountAssignments(): readonly AccountAssignment[] { return this._accountAssignments; }
  get processorIds(): readonly string[] { return this._processorIds; }
  get bankRelationshipIds(): readonly string[] { return this._bankRelationshipIds; }
  get creditFacilityIds(): readonly string[] { return this._creditFacilityIds; }
  get status(): BusinessUnitStatus { return this._status; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  /**
   * Serialize to plain object for persistence.
   */
  toProps(): BusinessUnitProps {
    return {
      id: this._id,
      name: this._name,
      type: this._type,
      legalEntityId: this._legalEntityId,
      parentUnitId: this._parentUnitId,
      functionalCurrency: this._functionalCurrency,
      bankingPolicy: this._bankingPolicy,
      accountAssignments: [...this._accountAssignments],
      processorIds: [...this._processorIds],
      bankRelationshipIds: [...this._bankRelationshipIds],
      creditFacilityIds: [...this._creditFacilityIds],
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
