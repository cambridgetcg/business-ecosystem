/**
 * Extended Bank Account Entity
 *
 * Full-featured bank account aggregate with cash pooling support,
 * virtual account management, and multi-rail connectivity.
 *
 * @see docs/research/nuances/12_INTERCOMPANY_SETTLEMENT.md
 */

import type { Money, BankAccountType, BankAccountStatus } from '../../types/financial.js';
import type { DomainEvent, AggregateRoot } from '../events/domain-event.js';

/**
 * Role within a cash pool structure.
 */
export type PoolRole = 'header' | 'participant';

/**
 * Properties for constructing a BankAccountExtended entity.
 */
export interface BankAccountExtendedProps {
  id: string;
  entityId: string;
  accountName: string;
  accountType: BankAccountType;

  // Bank identification
  bankId: string; // Reference to BankRelationship
  bankName: string;
  swiftBic?: string | undefined;
  iban?: string | undefined;
  accountNumber: string;
  routingNumber?: string | undefined; // US ACH routing
  sortCode?: string | undefined; // UK sort code

  // Balance
  currency: string;
  balance: Money;
  availableBalance?: Money | undefined; // May differ from balance (holds, pending)

  // Virtual accounts (J.P. Morgan VAM support)
  virtualAccountId?: string | undefined;
  parentAccountId?: string | undefined; // If this is a virtual account

  // Cash pooling
  poolParticipant: boolean;
  poolRole?: PoolRole | undefined;
  poolId?: string | undefined;

  // Operations
  cutoffWindowId?: string | undefined;
  defaultRailId?: string | undefined;

  // Status
  status: BankAccountStatus;
  isPrimary: boolean;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extended Bank Account aggregate root.
 *
 * Extends base BankAccount with:
 * - Cash pooling participation
 * - Virtual account support
 * - Available balance tracking
 * - Default rail assignment
 * - Cutoff window configuration
 */
export class BankAccountExtended implements AggregateRoot {
  private readonly _props: BankAccountExtendedProps;
  private readonly _domainEvents: DomainEvent[] = [];

  constructor(props: BankAccountExtendedProps) {
    this._props = { ...props };
  }

  // ==========================================================================
  // BALANCE OPERATIONS
  // ==========================================================================

  /**
   * Update the ledger balance.
   */
  updateBalance(newBalance: Money, transactionId: string): void {
    if (newBalance.currency !== this._props.currency) {
      throw new Error('Currency mismatch on balance update');
    }
    if (this._props.status === 'frozen' || this._props.status === 'closed') {
      throw new Error(`Cannot update balance on ${this._props.status} account`);
    }

    const previousBalance = { ...this._props.balance };
    this._props.balance = newBalance;
    this._props.updatedAt = new Date();

    this.addEvent('account.balance_changed', {
      previousBalance,
      newBalance,
      transactionId,
    });
  }

  /**
   * Update the available balance (ledger minus holds).
   */
  updateAvailableBalance(available: Money): void {
    if (available.currency !== this._props.currency) {
      throw new Error('Currency mismatch');
    }

    const previous = this._props.availableBalance;
    this._props.availableBalance = available;
    this._props.updatedAt = new Date();

    this.addEvent('account.available_balance_updated', {
      previous,
      available,
    });
  }

  // ==========================================================================
  // STATUS OPERATIONS
  // ==========================================================================

  /**
   * Freeze the account.
   */
  freeze(reason: string): void {
    if (this._props.status === 'closed') {
      throw new Error('Cannot freeze a closed account');
    }
    if (this._props.status === 'frozen') return;

    this._props.status = 'frozen';
    this._props.updatedAt = new Date();
    this.addEvent('account.frozen', { reason });
  }

  /**
   * Unfreeze the account.
   */
  unfreeze(): void {
    if (this._props.status !== 'frozen') {
      throw new Error('Account is not frozen');
    }

    this._props.status = 'active';
    this._props.updatedAt = new Date();
    this.addEvent('account.unfrozen', {});
  }

  /**
   * Close the account.
   */
  close(reason: string): void {
    if (this._props.status === 'closed') return;
    if (this._props.balance.amount !== 0) {
      throw new Error('Cannot close account with non-zero balance');
    }
    if (this._props.poolParticipant) {
      throw new Error('Must leave cash pool before closing account');
    }

    this._props.status = 'closed';
    this._props.updatedAt = new Date();
    this.addEvent('account.closed', { reason });
  }

  // ==========================================================================
  // CASH POOLING OPERATIONS
  // ==========================================================================

  /**
   * Join a cash pool as header or participant.
   */
  joinPool(poolId: string, role: PoolRole): void {
    if (this._props.poolParticipant) {
      throw new Error('Account already in a pool');
    }
    if (this._props.status !== 'active') {
      throw new Error('Only active accounts can join a pool');
    }

    this._props.poolParticipant = true;
    this._props.poolRole = role;
    this._props.poolId = poolId;
    this._props.updatedAt = new Date();

    this.addEvent('account.joined_pool', {
      poolId,
      role,
    });
  }

  /**
   * Leave the current cash pool.
   */
  leavePool(): void {
    if (!this._props.poolParticipant) {
      throw new Error('Account not in a pool');
    }

    const poolId = this._props.poolId;
    const role = this._props.poolRole;

    this._props.poolParticipant = false;
    this._props.poolRole = undefined;
    this._props.poolId = undefined;
    this._props.updatedAt = new Date();

    this.addEvent('account.left_pool', {
      poolId,
      role,
    });
  }

  /**
   * Change role within pool (e.g., promote participant to header).
   */
  changePoolRole(newRole: PoolRole): void {
    if (!this._props.poolParticipant) {
      throw new Error('Account not in a pool');
    }

    const previousRole = this._props.poolRole;
    this._props.poolRole = newRole;
    this._props.updatedAt = new Date();

    this.addEvent('account.pool_role_changed', {
      poolId: this._props.poolId,
      previousRole,
      newRole,
    });
  }

  // ==========================================================================
  // CONFIGURATION OPERATIONS
  // ==========================================================================

  /**
   * Assign cutoff window for payment timing.
   */
  assignCutoffWindow(windowId: string): void {
    const previous = this._props.cutoffWindowId;
    this._props.cutoffWindowId = windowId;
    this._props.updatedAt = new Date();

    this.addEvent('account.cutoff_assigned', {
      previous,
      windowId,
    });
  }

  /**
   * Assign default payment rail.
   */
  assignDefaultRail(railId: string): void {
    const previous = this._props.defaultRailId;
    this._props.defaultRailId = railId;
    this._props.updatedAt = new Date();

    this.addEvent('account.default_rail_assigned', {
      previous,
      railId,
    });
  }

  /**
   * Update account name.
   */
  rename(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Account name cannot be empty');
    }

    const previousName = this._props.accountName;
    this._props.accountName = newName.trim();
    this._props.updatedAt = new Date();

    this.addEvent('account.renamed', {
      previousName,
      newName: this._props.accountName,
    });
  }

  /**
   * Set as primary account for the entity.
   */
  setPrimary(isPrimary: boolean): void {
    if (this._props.isPrimary === isPrimary) return;

    this._props.isPrimary = isPrimary;
    this._props.updatedAt = new Date();

    this.addEvent('account.primary_changed', {
      isPrimary,
    });
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private addEvent(
    type: string,
    payload: Record<string, unknown> = {}
  ): void {
    this._domainEvents.push({
      type,
      aggregateId: this._props.id,
      aggregateType: 'BankAccount',
      payload: {
        ...payload,
        accountId: this._props.id,
        entityId: this._props.entityId,
      },
      occurredAt: new Date(),
    });
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  /**
   * Check if account is operational (active and not in error state).
   */
  get isOperational(): boolean {
    return this._props.status === 'active';
  }

  /**
   * Check if account is a virtual account.
   */
  get isVirtualAccount(): boolean {
    return this._props.parentAccountId !== undefined;
  }

  /**
   * Check if account is a pool header.
   */
  get isPoolHeader(): boolean {
    return this._props.poolParticipant && this._props.poolRole === 'header';
  }

  /**
   * Get the available balance, falling back to ledger balance if not set.
   */
  get effectiveAvailableBalance(): Money {
    return this._props.availableBalance ?? this._props.balance;
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  get id(): string {
    return this._props.id;
  }
  get entityId(): string {
    return this._props.entityId;
  }
  get accountName(): string {
    return this._props.accountName;
  }
  get accountType(): BankAccountType {
    return this._props.accountType;
  }
  get bankId(): string {
    return this._props.bankId;
  }
  get bankName(): string {
    return this._props.bankName;
  }
  get swiftBic(): string | undefined {
    return this._props.swiftBic;
  }
  get iban(): string | undefined {
    return this._props.iban;
  }
  get accountNumber(): string {
    return this._props.accountNumber;
  }
  get routingNumber(): string | undefined {
    return this._props.routingNumber;
  }
  get sortCode(): string | undefined {
    return this._props.sortCode;
  }
  get currency(): string {
    return this._props.currency;
  }
  get balance(): Money {
    return { ...this._props.balance };
  }
  get availableBalance(): Money | undefined {
    return this._props.availableBalance
      ? { ...this._props.availableBalance }
      : undefined;
  }
  get virtualAccountId(): string | undefined {
    return this._props.virtualAccountId;
  }
  get parentAccountId(): string | undefined {
    return this._props.parentAccountId;
  }
  get poolParticipant(): boolean {
    return this._props.poolParticipant;
  }
  get poolRole(): PoolRole | undefined {
    return this._props.poolRole;
  }
  get poolId(): string | undefined {
    return this._props.poolId;
  }
  get cutoffWindowId(): string | undefined {
    return this._props.cutoffWindowId;
  }
  get defaultRailId(): string | undefined {
    return this._props.defaultRailId;
  }
  get status(): BankAccountStatus {
    return this._props.status;
  }
  get isPrimary(): boolean {
    return this._props.isPrimary;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  /**
   * Convert to plain object for persistence.
   */
  toProps(): Readonly<BankAccountExtendedProps> {
    return { ...this._props };
  }
}

/**
 * Factory function to create a new bank account.
 */
export function createBankAccount(params: {
  id: string;
  entityId: string;
  accountName: string;
  accountType: BankAccountType;
  bankId: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  swiftBic?: string;
  iban?: string;
  routingNumber?: string;
  sortCode?: string;
  isPrimary?: boolean;
}): BankAccountExtended {
  return new BankAccountExtended({
    id: params.id,
    entityId: params.entityId,
    accountName: params.accountName,
    accountType: params.accountType,
    bankId: params.bankId,
    bankName: params.bankName,
    swiftBic: params.swiftBic,
    iban: params.iban,
    accountNumber: params.accountNumber,
    routingNumber: params.routingNumber,
    sortCode: params.sortCode,
    currency: params.currency,
    balance: { amount: 0, currency: params.currency },
    poolParticipant: false,
    status: 'active',
    isPrimary: params.isPrimary ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
