/**
 * Logger Configuration for Data Privacy Service
 */

import { pino } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');
const serviceName = process.env.SERVICE_NAME || 'data-privacy';
const serviceVersion = process.env.SERVICE_VERSION || '0.1.0';

export const logger = pino({
  level: logLevel,
  base: {
    service: serviceName,
    version: serviceVersion,
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'secret',
      'token',
      'subjectEmail',
      'subjectName',
      '*.email',
      '*.personalData',
    ],
    censor: '[REDACTED]',
  },
});

export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export function createDomainLogger(domain: string) {
  return logger.child({ domain });
}

export const auditLogger = logger.child({ type: 'privacy-audit' });

export default logger;
