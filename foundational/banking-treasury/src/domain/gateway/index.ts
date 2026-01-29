/**
 * Bank Gateway Module
 *
 * Unified abstraction layer for banking operations across multiple providers.
 *
 * @module gateway
 */

// Core types
export * from './types.js';

// Interfaces
export * from './interfaces.js';

// Adapters
export { BaseBankAdapter, DEFAULT_CAPABILITIES, DEFAULT_RATE_LIMITS } from './adapters/base-adapter.js';
export { PlaidAdapter } from './adapters/plaid-adapter.js';
export { ModernTreasuryAdapter } from './adapters/modern-treasury-adapter.js';
