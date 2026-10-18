import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url().optional(),
    RABBITMQ_URL: z.string().url().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    OTEL_SERVICE_NAME: z.string().default('entity-governance'),

    // Security Configuration
    JWT_SECRET: z.string().min(32).optional(), // Required in production
    COOKIE_SECRET: z.string().min(32).optional(),

    // Rate Limiting
    RATE_LIMIT_MAX: z.coerce.number().default(100),
    RATE_LIMIT_WINDOW: z.string().default('1 minute'),

    // AWS Configuration
    AWS_REGION: z.string().default('us-east-1'),
    AWS_SECRET_ARN: z.string().optional(), // Secrets Manager ARN for DB credentials
    AWS_KMS_KEY_ID: z.string().optional(), // KMS key for encryption

    // Integration Configuration
    ACCOUNTING_SERVICE_URL: z.string().url().optional(),
    TAX_SERVICE_URL: z.string().url().optional(),
    COMPLIANCE_SERVICE_URL: z.string().url().optional(),
    KYC_IDENTITY_SERVICE_URL: z.string().url().optional(),
    BANKING_TREASURY_SERVICE_URL: z.string().url().optional(),

    // Companies House API Configuration
    COMPANIES_HOUSE_API_KEY: z.string().min(1).optional(), // Required for Companies House integration
    COMPANIES_HOUSE_API_URL: z.string().url().default('https://api.company-information.service.gov.uk'),
  },
  runtimeEnv: process.env,
});
