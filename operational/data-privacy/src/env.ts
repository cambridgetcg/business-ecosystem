/**
 * Environment Configuration with Validation
 * Fails fast on startup if required configuration is missing
 */

import { z } from 'zod';

// Check if running in test environment
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3012'),
  HOST: z.string().default('0.0.0.0'),

  // Database Configuration (optional in test mode)
  DATABASE_URL: isTestEnv
    ? z.string().default('postgresql://test:test@localhost:5432/test')
    : z.string().url().describe('PostgreSQL connection URL'),

  // Message Queue Configuration
  RABBITMQ_URL: z.string().url().default('amqp://localhost:5672'),

  // Service Identity
  SERVICE_NAME: z.string().default('data-privacy'),
  SERVICE_VERSION: z.string().default('0.1.0'),

  // Logging Configuration
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  // Security Configuration
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()).default('100'),

  // Optional: External Service URLs
  NOTIFICATION_SERVICE_URL: z.string().url().optional(),
  DOCUMENT_STORAGE_BUCKET: z.string().optional(),

  // Optional: AWS Configuration (for S3/SES)
  AWS_REGION: z.string().default('eu-west-2'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Optional: Sentry for error tracking
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

// Validate and export environment configuration
export const env = validateEnv();

// Export individual config sections for convenience
export const serverConfig = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  host: env.HOST,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

export const databaseConfig = {
  url: env.DATABASE_URL,
} as const;

export const messagingConfig = {
  rabbitMqUrl: env.RABBITMQ_URL,
} as const;

export const loggingConfig = {
  level: env.LOG_LEVEL,
  format: env.LOG_FORMAT,
} as const;

export const rateLimitConfig = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
} as const;

export const serviceConfig = {
  name: env.SERVICE_NAME,
  version: env.SERVICE_VERSION,
} as const;
