/**
 * Type Definitions for Deadline Escalation Lambda
 *
 * Defines types for DynamoDB Stream events and CloudWatch scheduled events
 * used by the deadline escalation handler.
 *
 * @module lambdas/deadline-escalation
 */

import type { DynamoDBStreamEvent, ScheduledEvent, Context } from 'aws-lambda';

/**
 * DynamoDB Stream record image for deadline records.
 * Maps to the DynamoDB table schema with snake_case attributes.
 */
export interface DeadlineStreamImage {
  asset_id: string;
  deadline_id: string;
  asset_type: 'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret';
  deadline_type: string;
  due_date: string;
  status: 'pending' | 'acknowledged' | 'completed' | 'missed' | 'waived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
  jurisdiction?: string;
  reminders_sent: number;
  last_reminder_at?: string;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  expires_at?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Processed deadline record (camelCase for application use).
 */
export interface ProcessedDeadline {
  assetId: string;
  deadlineId: string;
  assetType: 'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret';
  deadlineType: string;
  dueDate: string;
  status: 'pending' | 'acknowledged' | 'completed' | 'missed' | 'waived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
  jurisdiction?: string;
  remindersSent: number;
  lastReminderAt?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Result of processing a single deadline.
 */
export interface DeadlineProcessingResult {
  deadlineId: string;
  assetId: string;
  processed: boolean;
  notificationSent: boolean;
  escalated: boolean;
  level?: string;
  daysUntilDue: number;
  error?: string;
}

/**
 * Overall Lambda execution result.
 */
export interface LambdaExecutionResult {
  statusCode: number;
  body: {
    message: string;
    eventType: 'stream' | 'scheduled';
    recordsProcessed: number;
    notificationsSent: number;
    escalations: number;
    errors: number;
    results: DeadlineProcessingResult[];
    executionTime: number;
  };
}

/**
 * Scheduled event detail for deadline checks.
 */
export interface ScheduledCheckDetail {
  /** Type of scheduled check */
  checkType: 'hourly' | 'daily' | 'weekly';
  /** Days ahead to check for upcoming deadlines */
  daysAhead?: number;
  /** Maximum deadlines to process per invocation */
  maxDeadlines?: number;
}

/**
 * Type guard for DynamoDB Stream events.
 */
export function isDynamoDBStreamEvent(event: unknown): event is DynamoDBStreamEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'Records' in event &&
    Array.isArray((event as DynamoDBStreamEvent).Records) &&
    (event as DynamoDBStreamEvent).Records.length > 0 &&
    'dynamodb' in ((event as DynamoDBStreamEvent).Records[0] ?? {})
  );
}

/**
 * Type guard for CloudWatch Scheduled events.
 */
export function isScheduledEvent(event: unknown): event is ScheduledEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'source' in event &&
    (event as ScheduledEvent).source === 'aws.events' &&
    'detail-type' in event &&
    (event as ScheduledEvent)['detail-type'] === 'Scheduled Event'
  );
}

/**
 * Lambda handler function type.
 */
export type DeadlineEscalationHandler = (
  event: DynamoDBStreamEvent | ScheduledEvent,
  context: Context
) => Promise<LambdaExecutionResult>;

/**
 * Configuration for the Lambda function.
 */
export interface LambdaConfig {
  /** DynamoDB deadlines table name */
  deadlinesTableName: string;
  /** SNS topic ARN for deadline alerts */
  deadlineAlertsTopic: string;
  /** SNS topic ARN for critical alerts */
  criticalAlertsTopic: string;
  /** Days ahead to check for upcoming deadlines (scheduled mode) */
  defaultDaysAhead: number;
  /** Maximum deadlines to process per scheduled invocation */
  maxDeadlinesPerInvocation: number;
  /** Whether to process overdue deadlines */
  processOverdue: boolean;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Get Lambda configuration from environment variables.
 */
export function getLambdaConfig(): LambdaConfig {
  return {
    deadlinesTableName: process.env.DEADLINES_TABLE_NAME ?? 'ip-service-dev-deadlines',
    deadlineAlertsTopic: process.env.SNS_DEADLINE_ALERTS_TOPIC ?? '',
    criticalAlertsTopic: process.env.SNS_CRITICAL_ALERTS_TOPIC ?? '',
    defaultDaysAhead: parseInt(process.env.DEFAULT_DAYS_AHEAD ?? '90', 10),
    maxDeadlinesPerInvocation: parseInt(process.env.MAX_DEADLINES_PER_INVOCATION ?? '100', 10),
    processOverdue: process.env.PROCESS_OVERDUE !== 'false',
    logLevel: (process.env.LOG_LEVEL ?? 'info') as LambdaConfig['logLevel'],
  };
}
