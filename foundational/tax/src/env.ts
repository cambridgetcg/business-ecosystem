import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3005),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    RABBITMQ_URL: z.string().url().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_SERVICE_NAME: z.string().default('tax'),

    // Security Configuration
    JWT_SECRET: z.string().min(32).optional(),
    COOKIE_SECRET: z.string().min(32).optional(),

    // Rate Limiting
    RATE_LIMIT_MAX: z.coerce.number().default(100),
    RATE_LIMIT_WINDOW: z.string().default('1 minute'),

    // AWS Configuration
    AWS_REGION: z.string().default('eu-west-2'), // London region for UK compliance
    AWS_SECRET_ARN: z.string().optional(),
    AWS_KMS_KEY_ID: z.string().optional(),

    // Integration Configuration
    ENTITY_GOVERNANCE_SERVICE_URL: z.string().url().optional(),
    ACCOUNTING_SERVICE_URL: z.string().url().optional(),

    // HMRC MTD Configuration
    HMRC_API_BASE_URL: z.string().url().optional(),
    HMRC_CLIENT_ID: z.string().optional(),
    HMRC_CLIENT_SECRET: z.string().optional(),
    HMRC_REDIRECT_URI: z.string().url().optional(),
    HMRC_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  },
  runtimeEnv: process.env,
});
