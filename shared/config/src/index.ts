/**
 * @ecosystem/config
 * Shared configuration management
 */

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenvConfig();

// Base configuration schema
export const baseConfigSchema = z.object({
  // Environment
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  
  // Server
  host: z.string().default('0.0.0.0'),
  port: z.coerce.number().default(3000),
  
  // Database
  databaseUrl: z.string(),
  databasePoolMin: z.coerce.number().default(2),
  databasePoolMax: z.coerce.number().default(10),
  
  // Redis
  redisUrl: z.string().optional(),
  
  // RabbitMQ
  rabbitmqUrl: z.string().optional(),
  
  // Auth
  jwtSecret: z.string(),
  jwtExpiresIn: z.string().default('1d'),
  jwtRefreshExpiresIn: z.string().default('7d'),
  
  // Encryption
  encryptionKey: z.string().optional(),
  
  // AWS
  awsRegion: z.string().default('us-east-1'),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
});

export type BaseConfig = z.infer<typeof baseConfigSchema>;

export function loadBaseConfig(): BaseConfig {
  return baseConfigSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    host: process.env.HOST,
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL,
    databasePoolMin: process.env.DATABASE_POOL_MIN,
    databasePoolMax: process.env.DATABASE_POOL_MAX,
    redisUrl: process.env.REDIS_URL,
    rabbitmqUrl: process.env.RABBITMQ_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    encryptionKey: process.env.ENCRYPTION_KEY,
    awsRegion: process.env.AWS_REGION,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
}

// Service-specific config factory
export function createServiceConfig<T extends z.ZodRawShape>(
  serviceName: string,
  additionalSchema: z.ZodObject<T>
) {
  const serviceSchema = baseConfigSchema.merge(additionalSchema).extend({
    serviceName: z.string().default(serviceName),
  });

  return {
    schema: serviceSchema,
    load: () => serviceSchema.parse({
      ...loadBaseConfig(),
      serviceName,
    }),
  };
}
