/**
 * Trade Finance Domain
 *
 * Models trade finance instruments: Letters of Credit,
 * Documentary Collections, and Credit Facilities.
 *
 * Essential for physical goods trading businesses requiring
 * structured payment guarantees and working capital financing.
 *
 * @module trade-finance
 */

// Types
export * from './types.js';

// Entities
export { LetterOfCredit } from './entities/letter-of-credit.js';
export type { LetterOfCreditProps } from './entities/letter-of-credit.js';

export { CreditFacility } from './entities/credit-facility.js';
export type { CreditFacilityProps } from './entities/credit-facility.js';
