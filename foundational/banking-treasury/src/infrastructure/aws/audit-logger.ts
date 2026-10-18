/**
 * Audit Logger
 *
 * Logs structured audit events to CloudWatch Logs for compliance and debugging.
 * Events are streamed to S3 via Kinesis Firehose for long-term storage.
 *
 * @module infrastructure/aws
 */

import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { awsConfig } from './config.js';

const client = new CloudWatchLogsClient({ region: awsConfig.region });

/**
 * Audit event structure.
 */
export interface AuditEvent {
  eventType: string;
  actor: {
    id: string;
    type: 'user' | 'system' | 'service';
    name?: string | undefined;
  };
  resource: {
    type: string;
    id: string;
  };
  action: string;
  beforeState?: Record<string, unknown> | undefined;
  afterState?: Record<string, unknown> | undefined;
  metadata?: Record<string, unknown> | undefined;
  requestId?: string | undefined;
  ipAddress?: string | undefined;
}

/**
 * Internal log entry format (matches Glue table schema).
 */
interface AuditLogEntry {
  timestamp: string;
  event_type: string;
  actor_id: string;
  actor_type: string;
  resource_type: string;
  resource_id: string;
  action: string;
  before_state: string | null;
  after_state: string | null;
  metadata: string | null;
  request_id: string | null;
  ip_address: string | null;
}

/**
 * Audit Logger
 *
 * Provides structured audit logging with:
 * - Automatic log stream management
 * - Batched writes for efficiency
 * - JSON formatting for Athena queries
 */
export class AuditLogger {
  private readonly logGroupName: string;
  private readonly logStreamName: string;
  private sequenceToken: string | undefined;
  private eventBuffer: AuditLogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushIntervalMs = 5000;
  private readonly maxBufferSize = 100;

  constructor(logGroupName?: string) {
    this.logGroupName = logGroupName ?? awsConfig.cloudWatch.auditLogGroup;
    this.logStreamName = `audit-${new Date().toISOString().split('T')[0]}-${process.pid}`;
  }

  /**
   * Log an audit event.
   */
  async log(event: AuditEvent): Promise<void> {
    const entry = this.formatEvent(event);
    this.eventBuffer.push(entry);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.maxBufferSize) {
      await this.flush();
    } else {
      // Schedule flush if not already scheduled
      this.scheduleFlush();
    }
  }

  /**
   * Log payment-related audit event.
   */
  async logPaymentEvent(
    action: 'created' | 'approved' | 'rejected' | 'executed' | 'completed' | 'failed' | 'cancelled',
    paymentId: string,
    actor: AuditEvent['actor'],
    details: {
      beforeState?: Record<string, unknown> | undefined;
      afterState?: Record<string, unknown> | undefined;
      metadata?: Record<string, unknown> | undefined;
      requestId?: string | undefined;
    }
  ): Promise<void> {
    await this.log({
      eventType: `Payment.${action}`,
      actor,
      resource: { type: 'Payment', id: paymentId },
      action: `payment_${action}`,
      ...details,
    });
  }

  /**
   * Log account-related audit event.
   */
  async logAccountEvent(
    action: 'created' | 'updated' | 'frozen' | 'closed' | 'balance_update',
    accountId: string,
    actor: AuditEvent['actor'],
    details: {
      beforeState?: Record<string, unknown> | undefined;
      afterState?: Record<string, unknown> | undefined;
      metadata?: Record<string, unknown> | undefined;
      requestId?: string | undefined;
    }
  ): Promise<void> {
    await this.log({
      eventType: `BankAccount.${action}`,
      actor,
      resource: { type: 'BankAccount', id: accountId },
      action: `account_${action}`,
      ...details,
    });
  }

  /**
   * Log reconciliation audit event.
   */
  async logReconciliationEvent(
    action: 'started' | 'matched' | 'exception_created' | 'exception_resolved' | 'completed',
    reconciliationId: string,
    actor: AuditEvent['actor'],
    details: {
      beforeState?: Record<string, unknown> | undefined;
      afterState?: Record<string, unknown> | undefined;
      metadata?: Record<string, unknown> | undefined;
      requestId?: string | undefined;
    }
  ): Promise<void> {
    await this.log({
      eventType: `Reconciliation.${action}`,
      actor,
      resource: { type: 'Reconciliation', id: reconciliationId },
      action: `reconciliation_${action}`,
      ...details,
    });
  }

  /**
   * Flush buffered events to CloudWatch Logs.
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    // Clear timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Take events from buffer
    const events = this.eventBuffer.splice(0, this.eventBuffer.length);

    try {
      // Ensure log stream exists
      await this.ensureLogStream();

      // Put log events
      const command = new PutLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: events.map(event => ({
          timestamp: new Date(event.timestamp).getTime(),
          message: JSON.stringify(event),
        })),
        sequenceToken: this.sequenceToken,
      });

      const response = await client.send(command);
      this.sequenceToken = response.nextSequenceToken;
    } catch (error) {
      // On error, put events back in buffer
      this.eventBuffer.unshift(...events);
      console.error('Failed to flush audit logs:', error);
      throw error;
    }
  }

  /**
   * Graceful shutdown - flush remaining events.
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Format event for logging.
   */
  private formatEvent(event: AuditEvent): AuditLogEntry {
    return {
      timestamp: new Date().toISOString(),
      event_type: event.eventType,
      actor_id: event.actor.id,
      actor_type: event.actor.type,
      resource_type: event.resource.type,
      resource_id: event.resource.id,
      action: event.action,
      before_state: event.beforeState ? JSON.stringify(event.beforeState) : null,
      after_state: event.afterState ? JSON.stringify(event.afterState) : null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      request_id: event.requestId ?? null,
      ip_address: event.ipAddress ?? null,
    };
  }

  /**
   * Schedule a flush operation.
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(async () => {
      this.flushTimer = null;
      try {
        await this.flush();
      } catch {
        // Error already logged in flush()
      }
    }, this.flushIntervalMs);
  }

  /**
   * Ensure the log stream exists.
   */
  private async ensureLogStream(): Promise<void> {
    try {
      // Check if stream exists
      const describeCommand = new DescribeLogStreamsCommand({
        logGroupName: this.logGroupName,
        logStreamNamePrefix: this.logStreamName,
      });

      const response = await client.send(describeCommand);
      const stream = response.logStreams?.find(s => s.logStreamName === this.logStreamName);

      if (stream) {
        this.sequenceToken = stream.uploadSequenceToken;
        return;
      }
    } catch {
      // Stream doesn't exist, create it
    }

    // Create log stream
    const createCommand = new CreateLogStreamCommand({
      logGroupName: this.logGroupName,
      logStreamName: this.logStreamName,
    });

    await client.send(createCommand);
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  await auditLogger.shutdown();
});

process.on('SIGINT', async () => {
  await auditLogger.shutdown();
});
