import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/**
 * Environment Configuration
 * 
 * Supports both local development (DATABASE_URL) and AWS deployment (secrets).
 * AWS credentials are fetched from Secrets Manager when USE_AWS_SECRETS=true.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3004),
    
    // Database - either direct URL or fetched from AWS Secrets Manager
    DATABASE_URL: z.string().url().optional(),
    USE_AWS_SECRETS: z.coerce.boolean().default(false),
    
    // AWS Configuration
    AWS_REGION: z.string().default('us-east-1'),
    DB_CREDENTIALS_SECRET: z.string().optional(),
    
    // SNS/SQS Configuration
    SNS_BANKING_TREASURY_TOPIC: z.string().optional(),
    SQS_EVENTS_QUEUE: z.string().optional(),

    // RabbitMQ Configuration
    RABBITMQ_URL: z.string().url().optional(),
    
    // Logging
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    
    // Feature flags
    ENABLE_EVENT_PUBLISHING: z.coerce.boolean().default(true),

    // Plaid Configuration
    PLAID_CLIENT_ID: z.string().optional(),
    PLAID_SECRET: z.string().optional(),
    PLAID_ENVIRONMENT: z.enum(['sandbox', 'development', 'production']).default('sandbox'),
    PLAID_WEBHOOK_URL: z.string().url().optional(),

    // Redis/Cache Configuration
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.coerce.number().default(6379),
    ENABLE_CACHING: z.coerce.boolean().default(true),
    CACHE_TTL_SECONDS: z.coerce.number().default(300), // 5 minutes default
  },
  runtimeEnv: process.env,
});

// Validate that we have either DATABASE_URL or AWS secrets configured
if (!env.DATABASE_URL && !env.USE_AWS_SECRETS) {
  console.warn('Warning: Neither DATABASE_URL nor USE_AWS_SECRETS is configured');
}
