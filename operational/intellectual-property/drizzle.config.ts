/**
 * Drizzle Kit Configuration
 * Compatible with drizzle-kit v0.20.x
 */

import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/persistence/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ecosystem_dev',
  },
  verbose: true,
  strict: true,
} satisfies Config;
