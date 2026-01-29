/**
 * Bank Account Repository Interface
 *
 * Domain-level interface for bank account persistence.
 * Implementation resides in infrastructure layer.
 *
 * @module domain/repositories
 */

import type { BankAccount } from '../entities/bank-account.js';
import type { Money, BankAccountStatus, BankAccountType } from '../../types/financial.js';

/**
 * Filter options for querying bank accounts.
 */
export interface BankAccountQueryOptions {
  entityId?: string | undefined;
  status?: BankAccountStatus | undefined;
  currency?: string | undefined;
  bankName?: string | undefined;
  accountType?: BankAccountType | undefined;
  isPrimary?: boolean | undefined;
}

/**
 * Summary of accounts by currency.
 */
export interface AccountCurrencySummary {
  currency: string;
  accountCount: number;
  totalBalance: Money;
}

/**
 * Repository interface for BankAccount aggregate.
 */
export interface IBankAccountRepository {
  /**
   * Find account by ID.
   */
  findById(id: string): Promise<BankAccount | null>;

  /**
   * Find all accounts for an entity.
   */
  findByEntityId(entityId: string): Promise<BankAccount[]>;

  /**
   * Find accounts matching query options.
   */
  findBy(options: BankAccountQueryOptions): Promise<BankAccount[]>;

  /**
   * Find the primary account for an entity and currency.
   */
  findPrimary(entityId: string, currency?: string): Promise<BankAccount | null>;

  /**
   * Get summary of accounts by currency for an entity.
   */
  getCurrencySummary(entityId: string): Promise<AccountCurrencySummary[]>;

  /**
   * Save account (create or update).
   */
  save(account: BankAccount): Promise<void>;

  /**
   * Delete account (soft delete).
   */
  delete(id: string): Promise<void>;

  /**
   * Check if account exists.
   */
  exists(id: string): Promise<boolean>;

  /**
   * Check if account number already exists for a bank.
   */
  existsByAccountNumber(accountNumber: string, bankName: string): Promise<boolean>;
}
