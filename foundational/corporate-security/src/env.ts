/**
 * Environment Configuration
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3006),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/corporate_security'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RABBITMQ_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('development-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  SESSION_TIMEOUT_HOURS: z.coerce.number().default(24),
  PASSWORD_MIN_LENGTH: z.coerce.number().default(12),
  MFA_ISSUER: z.string().default('BusinessEcosystem'),
});

export const env = envSchema.parse(process.env);
