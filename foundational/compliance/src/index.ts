/**
 * @foundational/compliance
 *
 * Compliance domain for the business ecosystem.
 * Handles regulatory requirement tracking, BOI/CTA filing,
 * compliance obligation management, and audit finding remediation.
 */

// Domain entities
export * from './domain/entities/index.js';

// Application services
export { ComplianceService } from './application/services/index.js';
