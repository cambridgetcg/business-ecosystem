/**
 * Core Module Barrel Export
 *
 * The core module provides foundational infrastructure:
 * - Error types and handling
 * - Result type for functional error handling
 * - Dependency injection
 * - Event bus
 *
 * @module core
 */

// Errors
export * from './errors/index.js';

// Result type
export * from './result.js';

// Dependency Injection
export * from './di/index.js';

// Events
export * from './events/index.js';
