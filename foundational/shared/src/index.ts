/**
 * @foundational/shared
 *
 * Shared contracts, events, and value objects for the foundational layer.
 *
 * This package provides:
 * - Value Objects: Money, Jurisdiction, EntityReference
 * - Domain Events: Entity, Accounting, Banking-Treasury events
 * - Contracts: Service interfaces for cross-domain communication
 * - Integration: Event routing, service registry, cross-domain workflows
 */

// Value Objects
export * from './value-objects/index.js';

// Events
export * from './events/index.js';

// Contracts
export * from './contracts/index.js';

// Integration
export * from './integration/index.js';
