/**
 * Payment Repository Interface
 *
 * Domain-level interface for payment persistence.
 * Implementation resides in infrastructure layer.
 *
 * @module domain/repositories
 */

import type { Payment } from '../entities/payment.js';
import type { Money, TransactionStatus, PaymentMethod } from '../../types/financial.js';

/**
 * Filter options for querying payments.
 */
export interface PaymentQueryOptions {
  entityId?: string | undefined;
  status?: TransactionStatus | undefined;
  method?: PaymentMethod | undefined;
  currency?: string | undefined;
  minAmount?: number | undefined;
  maxAmount?: number | undefined;
  fromDate?: Date | undefined;
  toDate?: Date | undefined;
  sourceAccountId?: string | undefined;
  destinationAccountId?: string | undefined;
}

/**
 * Pagination options.
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

/**
 * Paginated result.
 */
export interface PaginatedPayments {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Payment summary by status.
 */
export interface PaymentStatusSummary {
  status: TransactionStatus;
  count: number;
  totalAmount: Money;
}

/**
 * Repository interface for Payment aggregate.
 */
export interface IPaymentRepository {
  /**
   * Find payment by ID.
   */
  findById(id: string): Promise<Payment | null>;

  /**
   * Find payments by transaction ID.
   */
  findByTransactionId(transactionId: string): Promise<Payment[]>;

  /**
   * Find payments with filters and pagination.
   */
  findBy(
    options: PaymentQueryOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedPayments>;

  /**
   * Find pending payments that need processing.
   */
  findPending(limit?: number): Promise<Payment[]>;

  /**
   * Find payments that failed and are eligible for retry.
   */
  findRetryable(): Promise<Payment[]>;

  /**
   * Get payment status summary for an entity.
   */
  getStatusSummary(entityId: string, fromDate?: Date): Promise<PaymentStatusSummary[]>;

  /**
   * Get total payment volume for a period.
   */
  getVolumeByPeriod(
    entityId: string,
    fromDate: Date,
    toDate: Date,
    currency?: string
  ): Promise<Money>;

  /**
   * Save payment (create or update).
   */
  save(payment: Payment): Promise<void>;

  /**
   * Update payment status.
   */
  updateStatus(id: string, status: TransactionStatus): Promise<void>;

  /**
   * Check if payment exists.
   */
  exists(id: string): Promise<boolean>;
}
