/**
 * Breach Management Module
 * GDPR Articles 33-34 - Breach notification
 */

// Models
export * from './models/data-breach.js';

// Repository interface
export type { BreachRepository } from './repositories/breach.repository.js';

// Service
export { BreachService } from './services/breach.service.js';
export type { ServiceResult, ServiceError, BreachWithUrgency } from './services/breach.service.js';
