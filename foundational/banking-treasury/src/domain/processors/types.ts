/**
 * Payment Processor Types
 *
 * Types for payment processor connections (Stripe, Adyen, etc.)
 * Distinct from bank connections - processors collect; banks hold.
 *
 * @module processors/types
 */

import type { Money } from '../../types/financial.js';

/**
 * Supported payment processor types.
 */
export type PaymentProcessorType =
  | 'stripe'              // Stripe Payments
  | 'stripe_connect'      // Stripe Connect (marketplaces)
  | 'adyen'               // Adyen
  | 'checkout_com'        // Checkout.com
  | 'worldpay'            // Worldpay
  | 'square'              // Square
  | 'paypal_braintree'    // PayPal/Braintree
  | 'dlocal'              // dLocal (emerging markets)
  | 'ebanx'               // EBANX (LATAM)
  | 'razorpay';           // Razorpay (India)

/**
 * Processor connection status.
 */
export type ProcessorConnectionStatus =
  | 'active'
  | 'suspended'
  | 'setup'
  | 'disconnected';

/**
 * Payment method types supported by processors.
 */
export type ProcessorPaymentMethodType =
  | 'card'
  | 'bank_transfer'
  | 'wallet'
  | 'bnpl'
  | 'local_method';

/**
 * A payment method enabled on a processor.
 */
export interface ProcessorPaymentMethod {
  readonly type: ProcessorPaymentMethodType;
  readonly name: string;                    // e.g., "visa", "sepa_debit", "apple_pay", "klarna"
  readonly enabled: boolean;
  readonly regions: string[];               // ISO country codes
}

/**
 * Settlement schedule configuration.
 */
export interface SettlementSchedule {
  /** Standard settlement delay in business days */
  readonly standardDelayDays: number;

  /** Whether instant/same-day settlement is available */
  readonly instantSettlementAvailable: boolean;

  /** Cost of instant settlement (percentage or fixed) */
  readonly instantSettlementFee?: Money | number;

  /** Settlement currency options */
  readonly settlementCurrencies: string[];

  /** Minimum payout threshold */
  readonly minimumPayout: Money;

  /** Schedule type */
  readonly scheduleType: 'daily' | 'weekly' | 'manual' | 'threshold';

  /** For weekly: day of week (0=Sunday, 6=Saturday) */
  readonly settlementDay?: number;

  /** For threshold: trigger amount */
  readonly thresholdAmount?: Money;
}

/**
 * Negotiated pricing with a processor.
 */
export interface ProcessorPricing {
  /** Card processing rate (percentage, e.g., 2.9 for 2.9%) */
  readonly cardRate: number;

  /** Per-transaction fixed fee */
  readonly perTransactionFee: Money;

  /** International card surcharge (percentage) */
  readonly internationalSurcharge?: number;

  /** ACH/bank transfer rate (percentage) */
  readonly bankTransferRate?: number;

  /** ACH/bank transfer cap (max fee per transaction) */
  readonly bankTransferCap?: Money;

  /** Volume tier (affects rates) */
  readonly volumeTier?: string;

  /** Contract expiration */
  readonly contractExpires?: Date;
}

/**
 * Processor transaction summary for reconciliation.
 */
export interface ProcessorTransactionSummary {
  readonly processorConnectionId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;

  /** Gross volume collected */
  readonly grossVolume: Money;

  /** Refunds issued */
  readonly refunds: Money;

  /** Chargebacks */
  readonly chargebacks: Money;

  /** Fees charged by processor */
  readonly fees: Money;

  /** Net amount to be settled */
  readonly netSettlement: Money;

  /** Number of transactions */
  readonly transactionCount: number;

  /** Number of refunds */
  readonly refundCount: number;

  /** Number of chargebacks */
  readonly chargebackCount: number;
}

/**
 * Default settlement schedules by processor.
 */
export const DEFAULT_SETTLEMENT_SCHEDULES: Record<PaymentProcessorType, SettlementSchedule> = {
  stripe: {
    standardDelayDays: 2,
    instantSettlementAvailable: true,
    instantSettlementFee: 0.01, // 1%
    settlementCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    minimumPayout: { amount: 0.01, currency: 'USD' },
    scheduleType: 'daily',
  },
  stripe_connect: {
    standardDelayDays: 2,
    instantSettlementAvailable: true,
    instantSettlementFee: 0.01,
    settlementCurrencies: ['USD', 'EUR', 'GBP'],
    minimumPayout: { amount: 0.01, currency: 'USD' },
    scheduleType: 'daily',
  },
  adyen: {
    standardDelayDays: 3,
    instantSettlementAvailable: false,
    settlementCurrencies: ['USD', 'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK'],
    minimumPayout: { amount: 1, currency: 'EUR' },
    scheduleType: 'daily',
  },
  checkout_com: {
    standardDelayDays: 2,
    instantSettlementAvailable: false,
    settlementCurrencies: ['USD', 'EUR', 'GBP'],
    minimumPayout: { amount: 1, currency: 'USD' },
    scheduleType: 'daily',
  },
  worldpay: {
    standardDelayDays: 3,
    instantSettlementAvailable: false,
    settlementCurrencies: ['USD', 'EUR', 'GBP'],
    minimumPayout: { amount: 10, currency: 'USD' },
    scheduleType: 'daily',
  },
  square: {
    standardDelayDays: 1,
    instantSettlementAvailable: true,
    instantSettlementFee: 0.015, // 1.5%
    settlementCurrencies: ['USD', 'CAD', 'GBP', 'AUD', 'JPY'],
    minimumPayout: { amount: 0.01, currency: 'USD' },
    scheduleType: 'daily',
  },
  paypal_braintree: {
    standardDelayDays: 1,
    instantSettlementAvailable: true,
    settlementCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    minimumPayout: { amount: 1, currency: 'USD' },
    scheduleType: 'daily',
  },
  dlocal: {
    standardDelayDays: 7,
    instantSettlementAvailable: false,
    settlementCurrencies: ['USD'],
    minimumPayout: { amount: 100, currency: 'USD' },
    scheduleType: 'weekly',
    settlementDay: 3, // Wednesday
  },
  ebanx: {
    standardDelayDays: 14,
    instantSettlementAvailable: false,
    settlementCurrencies: ['USD'],
    minimumPayout: { amount: 50, currency: 'USD' },
    scheduleType: 'weekly',
    settlementDay: 5, // Friday
  },
  razorpay: {
    standardDelayDays: 2,
    instantSettlementAvailable: true,
    instantSettlementFee: { amount: 25, currency: 'INR' },
    settlementCurrencies: ['INR'],
    minimumPayout: { amount: 100, currency: 'INR' },
    scheduleType: 'daily',
  },
};
