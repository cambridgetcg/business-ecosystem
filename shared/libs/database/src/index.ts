/**
 * @ecosystem/database
 * Database abstraction layer for the business ecosystem
 *
 * Usage:
 * - Base types and interfaces: import { Entity, Repository } from '@ecosystem/database'
 * - Drizzle ORM support: import { DrizzleRepository, DrizzleConnection } from '@ecosystem/database/drizzle'
 */

export * from './repository.js';
export * from './unit-of-work.js';
export * from './connection.js';
export * from './types.js';
export * from './cached-repository.js';

// Note: Drizzle-specific exports are available via '@ecosystem/database/drizzle'
// to keep the main bundle smaller for services that don't use Drizzle
