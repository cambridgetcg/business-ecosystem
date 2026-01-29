/**
 * Payment Processor Domain
 *
 * Models payment processor connections (Stripe, Adyen, etc.)
 * Distinct from bank connections - processors collect customer payments;
 * banks hold the resulting funds after settlement.
 *
 * @module processors
 */

// Types
export * from './types.js';

// Entities
export { ProcessorConnection } from './entities/processor-connection.js';
export type { ProcessorConnectionProps } from './entities/processor-connection.js';
