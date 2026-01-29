import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/persistence/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/entity_governance',
  },
  verbose: true,
  strict: true,
} satisfies Config;
