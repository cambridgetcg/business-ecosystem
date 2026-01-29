/**
 * Structured logger using Pino
 */

import pino from 'pino';
import type { Logger as PinoLoggerType } from 'pino';
import type { AuditLoggerConfig } from './types.js';

export interface Logger {
  trace(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, error?: Error, data?: Record<string, unknown>): void;
  fatal(msg: string, error?: Error, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export class PinoLogger implements Logger {
  private pinoInstance: PinoLoggerType;

  constructor(config: AuditLoggerConfig) {
    this.pinoInstance = pino({
      name: config.serviceName,
      level: config.logLevel || 'info',
      transport: config.prettyPrint
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
      base: {
        service: config.serviceName,
        environment: config.environment,
      },
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  trace(msg: string, data?: Record<string, unknown>): void {
    this.pinoInstance.trace(data || {}, msg);
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.pinoInstance.debug(data || {}, msg);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.pinoInstance.info(data || {}, msg);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.pinoInstance.warn(data || {}, msg);
  }

  error(msg: string, error?: Error, data?: Record<string, unknown>): void {
    this.pinoInstance.error({ ...data, err: error }, msg);
  }

  fatal(msg: string, error?: Error, data?: Record<string, unknown>): void {
    this.pinoInstance.fatal({ ...data, err: error }, msg);
  }

  child(bindings: Record<string, unknown>): Logger {
    const childLogger = new PinoLogger({
      serviceName: '',
      environment: '',
    });
    childLogger.pinoInstance = this.pinoInstance.child(bindings);
    return childLogger;
  }
}

export function createLogger(config: AuditLoggerConfig): Logger {
  return new PinoLogger(config);
}
