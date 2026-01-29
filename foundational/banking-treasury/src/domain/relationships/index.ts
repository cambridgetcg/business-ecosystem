/**
 * Bank Relationship Domain
 *
 * Models bank relationships, negotiated terms, and relationship value.
 * Enables data-driven negotiation and relationship management.
 *
 * @module relationships
 */

// Types
export * from './types.js';

// Entities
export { BankRelationship } from './entities/bank-relationship.js';
export type { BankRelationshipProps } from './entities/bank-relationship.js';
