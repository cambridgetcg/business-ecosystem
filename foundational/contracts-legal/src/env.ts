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

    // Security Configuration
    JWT_SECRET: z.string().min(32).optional(),

    // Rate Limiting
    RATE_LIMIT_MAX: z.coerce.number().default(100),
    RATE_LIMIT_WINDOW: z.string().default('1 minute'),

    // File Storage
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),

    // Integration Configuration
    ENTITY_GOVERNANCE_SERVICE_URL: z.string().url().optional(),
    KYC_IDENTITY_SERVICE_URL: z.string().url().optional(),
    DOCUSIGN_API_KEY: z.string().optional(),
    DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  },
  runtimeEnv: process.env,
});
