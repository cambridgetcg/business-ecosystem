import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/persistence/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/banking-treasury',
  },
} satisfies Config;
