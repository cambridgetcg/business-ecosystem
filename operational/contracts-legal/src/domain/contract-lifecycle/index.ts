/**
 * Contract Lifecycle Domain
 *
 * Handles contract state transitions, renewal workflows, and lifecycle events
 */

export * from './validators.js';
export * from './repository.js';
export * from './service.js';

export const DOMAIN_NAME = 'contract-lifecycle';
export const DOMAIN_STATUS = 'complete';
