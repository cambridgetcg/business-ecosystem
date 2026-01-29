/**
 * Dependency Injection Container Setup
 * Uses tsyringe for lightweight DI
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { getDb, type Database } from './infrastructure/persistence/database.js';

// Register database instance
container.register<Database>('Database', {
  useFactory: () => getDb(),
});

export { container };
