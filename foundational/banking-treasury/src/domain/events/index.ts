/**
 * Domain Events
 */
export * from './domain-event.js';

// Event types for this domain
export const BANKING_TREASURY_EVENTS = [
  'account.balance_changed',
  'account.frozen',
  'account.unfrozen',
  'account.closed',
  'payment.processing_started',
  'payment.completed',
  'payment.failed',
  'payment.cancelled',
] as const;

export type BankingTreasuryEventType = typeof BANKING_TREASURY_EVENTS[number];
