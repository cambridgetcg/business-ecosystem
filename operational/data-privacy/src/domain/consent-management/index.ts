/**
 * Consent Management Module
 * GDPR Art. 6 - Lawful basis for processing
 * GDPR Art. 7 - Conditions for consent
 */

// Models
export * from './models/consent-record.js';

// Repository interface
export type { ConsentRepository } from './repositories/consent.repository.js';

// Service
export { ConsentService } from './services/consent.service.js';
export type { ConsentCheckResult, ServiceResult, ServiceError } from './services/consent.service.js';
