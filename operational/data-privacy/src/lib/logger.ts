/**
 * Logger Configuration for Data Privacy Service
 * Structured JSON logging with request correlation
 */

import pino from 'pino';
import { randomUUID } from 'crypto';
import { loggingConfig, serviceConfig, serverConfig } from '../env.js';

// Use pino.default for ESM compatibility
const pinoFn = typeof pino === 'function' ? pino : (pino as any).default;

// Build logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: loggingConfig.level,
  base: {
    service: serviceConfig.name,
    version: serviceConfig.version,
    environment: serverConfig.nodeEnv,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions?.isoTime ?? (() => `,"time":"${new Date().toISOString()}"`),
  // PII redaction for GDPR compliance
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'secret',
      'token',
      'apiKey',
      'subjectEmail',
      'subjectName',
      'subjectId',
      '*.email',
      '*.personalData',
      '*.ssn',
      '*.dateOfBirth',
    ],
    censor: '[REDACTED]',
  },
  // Format configuration
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  // Serializers for common objects
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers?.['user-agent'],
        'content-type': req.headers?.['content-type'],
        'x-request-id': req.headers?.['x-request-id'],
      },
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
};

// Add pretty printing in development
if (serverConfig.isDevelopment && loggingConfig.format === 'pretty') {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pinoFn(loggerConfig);

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Create a domain-specific logger
 */
export function createDomainLogger(domain: string) {
  return logger.child({ domain });
}

/**
 * Create a request-scoped logger with correlation ID
 */
export function createRequestLogger(requestId?: string) {
  const correlationId = requestId || randomUUID();
  return logger.child({
    requestId: correlationId,
    type: 'request',
  });
}

/**
 * Audit logger for privacy-sensitive operations
 * Logs to a separate stream for compliance tracking
 */
export const auditLogger = logger.child({
  type: 'privacy-audit',
  compliance: 'gdpr',
});

/**
 * Security logger for security-related events
 */
export const securityLogger = logger.child({
  type: 'security',
});

/**
 * Performance logger for timing metrics
 */
export const perfLogger = logger.child({
  type: 'performance',
});

/**
 * Log a privacy-relevant action (audit trail)
 */
export function logPrivacyAction(action: {
  type: string;
  entityId: string;
  subjectId?: string;
  actorId: string;
  resource: string;
  details?: Record<string, unknown>;
}) {
  auditLogger.info({
    action: action.type,
    entityId: action.entityId,
    subjectId: action.subjectId,
    actorId: action.actorId,
    resource: action.resource,
    timestamp: new Date().toISOString(),
    ...action.details,
  }, `Privacy action: ${action.type}`);
}

export default logger;
