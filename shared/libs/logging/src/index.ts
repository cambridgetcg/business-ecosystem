/**
 * @ecosystem/logging
 * Centralized logging configuration for the business ecosystem
 */

import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';

export interface LogConfig {
  serviceName: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  prettyPrint?: boolean;
  redactPaths?: string[];
}

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

const defaultRedactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.secret',
  '*.token',
  '*.apiKey',
  '*.creditCard',
  '*.ssn',
];

export function createLogger(config: LogConfig): Logger {
  const options: LoggerOptions = {
    name: config.serviceName,
    level: config.level || process.env.LOG_LEVEL || 'info',
    
    formatters: {
      level: (label: string) => ({ level: label }),
      bindings: (bindings) => ({
        service: config.serviceName,
        pid: bindings.pid,
        hostname: bindings.hostname,
      }),
    },

    timestamp: () => ',"timestamp":"' + new Date().toISOString() + '"',

    redact: {
      paths: [...defaultRedactPaths, ...(config.redactPaths || [])],
      censor: '[REDACTED]',
    },

    base: {
      environment: process.env.NODE_ENV || 'development',
    },
  };

  if (config.prettyPrint ?? process.env.NODE_ENV !== 'production') {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

export function withContext(logger: Logger, context: LogContext): Logger {
  return logger.child(context);
}

export interface RequestLoggerOptions {
  level?: string;
  serializers?: {
    req?: (req: any) => any;
    res?: (res: any) => any;
  };
  redact?: {
    paths: string[];
    censor: string;
  };
  customLogLevel?: (req: any, res: any, err?: Error) => string;
  customSuccessMessage?: (req: any, res: any, responseTime: number) => string;
  customErrorMessage?: (req: any, res: any, err: Error) => string;
}

export function createRequestLogger(config: LogConfig): RequestLoggerOptions {
  return {
    level: config.level || 'info',
    
    serializers: {
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        path: req.routeOptions?.url,
        parameters: req.params,
        correlationId: req.correlationId,
        requestId: req.requestId,
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
      }),
    },

    redact: {
      paths: defaultRedactPaths,
      censor: '[REDACTED]',
    },

    customLogLevel: (req: any, res: any, err?: Error) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },

    customSuccessMessage: (req: any, res: any, responseTime: number) => {
      return req.method + ' ' + req.url + ' ' + res.statusCode + ' - ' + responseTime + 'ms';
    },

    customErrorMessage: (req: any, res: any, err: Error) => {
      return req.method + ' ' + req.url + ' ' + res.statusCode + ' - ' + err.message;
    },
  };
}

export function createAuditLogger(config: LogConfig): Logger {
  return pino({
    name: config.serviceName + '-audit',
    level: 'info',
    
    formatters: {
      level: () => ({ type: 'AUDIT' }),
    },

    timestamp: () => ',"timestamp":"' + new Date().toISOString() + '"',

    base: {
      service: config.serviceName,
      environment: process.env.NODE_ENV || 'development',
    },
  });
}

export interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorType: 'user' | 'service' | 'system';
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export function logAudit(logger: Logger, entry: AuditLogEntry): void {
  logger.info({
    audit: true,
    ...entry,
    timestamp: new Date().toISOString(),
  }, 'AUDIT: ' + entry.action + ' on ' + entry.entityType + ':' + entry.entityId);
}

export { Logger, pino };
