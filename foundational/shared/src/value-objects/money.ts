import { Decimal } from 'decimal.js';

/**
 * ISO 4217 Currency Codes (common subset)
 */
export type CurrencyCode =
  | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD'
  | 'CNY' | 'HKD' | 'SGD' | 'INR' | 'BRL' | 'MXN' | 'KRW';

/**
 * Money value object - immutable representation of monetary amounts.
 * Uses Decimal.js for precise decimal arithmetic.
 */
export interface Money {
  readonly amount: string; // Serialized Decimal for transport
  readonly currency: CurrencyCode;
}

/**
 * Create a Money value object
 */
export function createMoney(amount: Decimal | number | string, currency: CurrencyCode): Money {
  const decimal = new Decimal(amount);
  return {
    amount: decimal.toString(),
    currency,
  };
}

/**
 * Get the Decimal amount from Money
 */
export function getAmount(money: Money): Decimal {
  return new Decimal(money.amount);
}

/**
 * Add two Money values (must be same currency)
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return createMoney(getAmount(a).plus(getAmount(b)), a.currency);
}

/**
 * Subtract Money values (must be same currency)
 */
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return createMoney(getAmount(a).minus(getAmount(b)), a.currency);
}

/**
 * Multiply Money by a factor
 */
export function multiplyMoney(money: Money, factor: Decimal | number | string): Money {
  return createMoney(getAmount(money).times(factor), money.currency);
}

/**
 * Check if Money is zero
 */
export function isZero(money: Money): boolean {
  return getAmount(money).isZero();
}

/**
 * Check if Money is negative
 */
export function isNegative(money: Money): boolean {
  return getAmount(money).isNegative();
}

/**
 * Compare two Money values (must be same currency)
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return getAmount(a).comparedTo(getAmount(b)) as -1 | 0 | 1;
}

/**
 * Zero money in a given currency
 */
export function zeroMoney(currency: CurrencyCode): Money {
  return createMoney(0, currency);
}
