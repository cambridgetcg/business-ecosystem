/**
 * Logger Configuration
 *
 * Centralized logging using Pino with structured JSON output.
 * Configured for production use with AWS CloudWatch integration.
 */

import { pino, type Logger, type LoggerOptions } from 'pino';

/**
 * Environment configuration
 */
const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');
const serviceName = process.env.SERVICE_NAME || 'contracts-legal';
const serviceVersion = process.env.SERVICE_VERSION || '0.1.0';

/**
 * Pino configuration
 */
const pinoOptions: LoggerOptions = {
  level: logLevel,
  base: {
    service: serviceName,
    version: serviceVersion,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      ...bindings,
      node_version: process.version,
    }),
  },
  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'secret',
      'token',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      '*.password',
      '*.secret',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
};

/**
 * Development transport with pretty printing
 */
const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname,service,version',
  },
};

/**
 * Create base logger instance
 */
export const logger: Logger = isDev
  ? pino(pinoOptions, pino.transport(devTransport))
  : pino(pinoOptions);

/**
 * Create child logger with additional context
 */
export function createLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}

/**
 * Request logger for HTTP requests
 */
export function createRequestLogger(requestId: string, method: string, path: string): Logger {
  return logger.child({
    requestId,
    method,
    path,
  });
}

/**
 * Domain logger for specific business domains
 */
export function createDomainLogger(domain: string): Logger {
  return logger.child({ domain });
}

/**
 * Audit logger for compliance-related events
 */
export const auditLogger = logger.child({
  type: 'audit',
});

/**
 * Log levels type
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Structured log entry for audit events
 */
export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}

/**
 * Log audit event
 */
export function logAudit(entry: AuditLogEntry): void {
  auditLogger.info(entry, `Audit: ${entry.action} on ${entry.entityType}`);
}

/**
 * Performance logger for timing operations
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  const level: LogLevel = durationMs > 5000 ? 'warn' : durationMs > 1000 ? 'info' : 'debug';

  logger[level](
    {
      operation,
      durationMs,
      ...metadata,
    },
    `Performance: ${operation} completed in ${durationMs}ms`
  );
}

/**
 * Error logger with stack trace handling
 */
export function logError(
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  if (error instanceof Error) {
    logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...context,
      },
      error.message
    );
  } else {
    logger.error(
      {
        error: String(error),
        ...context,
      },
      'Unknown error occurred'
    );
  }
}

export default logger;
