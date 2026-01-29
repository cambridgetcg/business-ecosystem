/**
 * Payment Rail Repository Interface
 *
 * Domain-level interface for payment rail persistence.
 * Implementation resides in infrastructure layer.
 */

import type { PaymentRail, RailType } from '../value-objects/payment-rail.js';

/**
 * Repository interface for PaymentRail value objects.
 */
export interface PaymentRailRepository {
  /**
   * Find a payment rail by its unique identifier.
   */
  findById(id: string): Promise<PaymentRail | null>;

  /**
   * Find all payment rails of a specific type.
   */
  findByType(type: RailType): Promise<PaymentRail[]>;

  /**
   * Find payment rails that support a specific corridor.
   * @param sourceCurrency Source currency code
   * @param destCurrency Destination currency code
   * @param sourceCountry Optional source country code
   * @param destCountry Optional destination country code
   */
  findByCorridor(
    sourceCurrency: string,
    destCurrency: string,
    sourceCountry?: string,
    destCountry?: string
  ): Promise<PaymentRail[]>;

  /**
   * Find all active payment rails.
   */
  findActive(): Promise<PaymentRail[]>;

  /**
   * Find all payment rails regardless of status.
   */
  findAll(): Promise<PaymentRail[]>;

  /**
   * Save a payment rail (create or update).
   */
  save(rail: PaymentRail): Promise<void>;

  /**
   * Update the status of a payment rail.
   */
  updateStatus(id: string, status: PaymentRail['status']): Promise<void>;

  /**
   * Delete a payment rail by ID.
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a payment rail exists.
   */
  exists(id: string): Promise<boolean>;
}
