/**
 * @foundational/tax
 *
 * Tax domain for the business ecosystem.
 * Handles multi-jurisdiction tax compliance, nexus tracking,
 * tax position management, and transfer pricing documentation.
 */

// Domain entities
export * from './domain/entities/index.js';

// Application services
export { TaxService } from './application/services/index.js';

// UK VAT: the 9-box return calculator and its models, with the VAT schemes and rates they use
export * from './domain/vat/index.js';
export * from './domain/value-objects/index.js';
