/**
 * Application Layer - Public API
 *
 * This module exports all application-level components following CQRS pattern:
 * - Commands: Write operations that mutate state
 * - Queries: Read operations that retrieve data
 * - Handlers: Execute commands and queries
 */

// Commands
export * from './commands/index.js';

// Queries
export * from './queries/index.js';

// Handlers
export * from './handlers/index.js';
