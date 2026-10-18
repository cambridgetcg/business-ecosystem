/**
 * Deadline Escalation Lambda Handler
 *
 * Processes deadline changes and triggers escalation notifications.
 * Supports two invocation modes:
 *
 * 1. DynamoDB Streams: Real-time processing when deadlines are created/updated
 * 2. CloudWatch Events: Scheduled checks for approaching and overdue deadlines
 *
 * @module lambdas/deadline-escalation
 */

import type {
  DynamoDBStreamEvent,
  DynamoDBRecord,
  ScheduledEvent,
  Context,
} from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import {
  SNSClient,
  PublishCommand,
  type MessageAttributeValue,
} from '@aws-sdk/client-sns';
import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import {
  type DeadlineStreamImage,
  type ProcessedDeadline,
  type DeadlineProcessingResult,
  type LambdaExecutionResult,
  type ScheduledCheckDetail,
  isDynamoDBStreamEvent,
  isScheduledEvent,
  getLambdaConfig,
} from './types.js';

// AWS Clients
const snsClient = new SNSClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

// Configuration
const config = getLambdaConfig();

/**
 * Logger helper with structured output for CloudWatch.
 */
const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    if (config.logLevel === 'debug') {
      console.log(JSON.stringify({ level: 'DEBUG', message, ...data, timestamp: new Date().toISOString() }));
    }
  },
  info: (message: string, data?: Record<string, unknown>) => {
    if (['debug', 'info'].includes(config.logLevel)) {
      console.log(JSON.stringify({ level: 'INFO', message, ...data, timestamp: new Date().toISOString() }));
    }
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    if (['debug', 'info', 'warn'].includes(config.logLevel)) {
      console.warn(JSON.stringify({ level: 'WARN', message, ...data, timestamp: new Date().toISOString() }));
    }
  },
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      message,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      ...data,
      timestamp: new Date().toISOString(),
    }));
  },
};

/**
 * Main Lambda handler.
 *
 * Routes to appropriate processing based on event type:
 * - DynamoDB Stream events: Process individual record changes
 * - CloudWatch Scheduled events: Batch check upcoming/overdue deadlines
 */
export async function handler(
  event: DynamoDBStreamEvent | ScheduledEvent,
  context: Context
): Promise<LambdaExecutionResult> {
  const startTime = Date.now();

  logger.info('Deadline escalation Lambda invoked', {
    requestId: context.awsRequestId,
    functionName: context.functionName,
    remainingTime: context.getRemainingTimeInMillis(),
  });

  try {
    if (isDynamoDBStreamEvent(event)) {
      return await handleStreamEvent(event, startTime);
    } else if (isScheduledEvent(event)) {
      return await handleScheduledEvent(event, startTime);
    } else {
      logger.warn('Unknown event type received', { event });
      return buildResponse(400, 'Unknown event type', 'stream', [], startTime);
    }
  } catch (error) {
    logger.error('Unhandled error in Lambda handler', error);
    return buildResponse(500, 'Internal error', 'stream', [], startTime);
  }
}

/**
 * Handle DynamoDB Stream events.
 *
 * Processes INSERT and MODIFY events for deadline records.
 */
async function handleStreamEvent(
  event: DynamoDBStreamEvent,
  startTime: number
): Promise<LambdaExecutionResult> {
  logger.info('Processing DynamoDB Stream event', {
    recordCount: event.Records.length,
  });

  const results: DeadlineProcessingResult[] = [];

  for (const record of event.Records) {
    try {
      const result = await processStreamRecord(record);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      logger.error('Error processing stream record', error, {
        eventId: record.eventID,
        eventName: record.eventName,
      });
      results.push({
        deadlineId: 'unknown',
        assetId: 'unknown',
        processed: false,
        notificationSent: false,
        escalated: false,
        daysUntilDue: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return buildResponse(200, 'Stream processing complete', 'stream', results, startTime);
}

/**
 * Process a single DynamoDB Stream record.
 */
async function processStreamRecord(
  record: DynamoDBRecord
): Promise<DeadlineProcessingResult | null> {
  const eventName = record.eventName;

  // Only process INSERT and MODIFY events
  if (eventName !== 'INSERT' && eventName !== 'MODIFY') {
    logger.debug('Skipping non-INSERT/MODIFY event', { eventName });
    return null;
  }

  const newImage = record.dynamodb?.NewImage;
  if (!newImage) {
    logger.warn('No NewImage in stream record');
    return null;
  }

  // Unmarshal DynamoDB record
  const rawDeadline = unmarshall(
    newImage as Record<string, AttributeValue>
  ) as DeadlineStreamImage;

  const deadline = mapToProcessedDeadline(rawDeadline);

  logger.debug('Processing deadline record', {
    deadlineId: deadline.deadlineId,
    assetId: deadline.assetId,
    status: deadline.status,
    dueDate: deadline.dueDate,
  });

  // Skip non-pending deadlines
  if (deadline.status !== 'pending') {
    logger.debug('Skipping non-pending deadline', { status: deadline.status });
    return {
      deadlineId: deadline.deadlineId,
      assetId: deadline.assetId,
      processed: true,
      notificationSent: false,
      escalated: false,
      daysUntilDue: calculateDaysUntilDue(deadline.dueDate),
    };
  }

  return await evaluateAndNotify(deadline);
}

/**
 * Handle CloudWatch Scheduled events.
 *
 * Queries for upcoming and overdue deadlines and processes them.
 */
async function handleScheduledEvent(
  event: ScheduledEvent,
  startTime: number
): Promise<LambdaExecutionResult> {
  const detail = (event.detail ?? {}) as ScheduledCheckDetail;
  const checkType = detail.checkType ?? 'daily';
  const daysAhead = detail.daysAhead ?? config.defaultDaysAhead;
  const maxDeadlines = detail.maxDeadlines ?? config.maxDeadlinesPerInvocation;

  logger.info('Processing scheduled deadline check', {
    checkType,
    daysAhead,
    maxDeadlines,
  });

  const results: DeadlineProcessingResult[] = [];

  // Query upcoming deadlines
  const upcomingDeadlines = await queryUpcomingDeadlines(daysAhead, maxDeadlines);
  logger.info('Found upcoming deadlines', { count: upcomingDeadlines.length });

  for (const deadline of upcomingDeadlines) {
    try {
      const result = await evaluateAndNotify(deadline);
      results.push(result);
    } catch (error) {
      logger.error('Error processing upcoming deadline', error, {
        deadlineId: deadline.deadlineId,
      });
      results.push({
        deadlineId: deadline.deadlineId,
        assetId: deadline.assetId,
        processed: false,
        notificationSent: false,
        escalated: false,
        daysUntilDue: calculateDaysUntilDue(deadline.dueDate),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Query overdue deadlines if enabled
  if (config.processOverdue) {
    const overdueDeadlines = await queryOverdueDeadlines(maxDeadlines);
    logger.info('Found overdue deadlines', { count: overdueDeadlines.length });

    for (const deadline of overdueDeadlines) {
      try {
        const result = await evaluateAndNotifyOverdue(deadline);
        results.push(result);
      } catch (error) {
        logger.error('Error processing overdue deadline', error, {
          deadlineId: deadline.deadlineId,
        });
        results.push({
          deadlineId: deadline.deadlineId,
          assetId: deadline.assetId,
          processed: false,
          notificationSent: false,
          escalated: false,
          daysUntilDue: calculateDaysUntilDue(deadline.dueDate),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  return buildResponse(200, 'Scheduled check complete', 'scheduled', results, startTime);
}

/**
 * Query upcoming deadlines from DynamoDB.
 */
async function queryUpcomingDeadlines(
  daysAhead: number,
  limit: number
): Promise<ProcessedDeadline[]> {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const command = new QueryCommand({
    TableName: config.deadlinesTableName,
    IndexName: 'gsi1-status-deadline',
    KeyConditionExpression: 'gsi1pk = :status AND gsi1sk BETWEEN :now AND :future',
    ExpressionAttributeValues: {
      ':status': 'STATUS#pending',
      ':now': now.toISOString(),
      ':future': futureDate.toISOString(),
    },
    Limit: limit,
    ScanIndexForward: true, // Oldest due dates first
  });

  const response = await docClient.send(command);
  return (response.Items ?? []).map(item => mapToProcessedDeadline(item as DeadlineStreamImage));
}

/**
 * Query overdue deadlines from DynamoDB.
 */
async function queryOverdueDeadlines(limit: number): Promise<ProcessedDeadline[]> {
  const now = new Date().toISOString();

  const command = new QueryCommand({
    TableName: config.deadlinesTableName,
    IndexName: 'gsi1-status-deadline',
    KeyConditionExpression: 'gsi1pk = :status AND gsi1sk < :now',
    ExpressionAttributeValues: {
      ':status': 'STATUS#pending',
      ':now': now,
    },
    Limit: limit,
    ScanIndexForward: true,
  });

  const response = await docClient.send(command);
  return (response.Items ?? []).map(item => mapToProcessedDeadline(item as DeadlineStreamImage));
}

/**
 * Evaluate a deadline and send notification if needed.
 */
async function evaluateAndNotify(deadline: ProcessedDeadline): Promise<DeadlineProcessingResult> {
  const daysUntilDue = calculateDaysUntilDue(deadline.dueDate);

  logger.debug('Evaluating deadline', {
    deadlineId: deadline.deadlineId,
    daysUntilDue,
    priority: deadline.priority,
    type: deadline.deadlineType,
  });

  // Determine escalation level based on days until due and priority
  const escalationLevel = determineEscalationLevel(daysUntilDue, deadline.priority);

  if (!escalationLevel) {
    return {
      deadlineId: deadline.deadlineId,
      assetId: deadline.assetId,
      processed: true,
      notificationSent: false,
      escalated: false,
      daysUntilDue,
    };
  }

  // Check if we should send notification (avoid spam)
  const shouldNotify = await shouldSendNotification(deadline, daysUntilDue);

  if (!shouldNotify) {
    logger.debug('Skipping notification (already sent recently)', {
      deadlineId: deadline.deadlineId,
    });
    return {
      deadlineId: deadline.deadlineId,
      assetId: deadline.assetId,
      processed: true,
      notificationSent: false,
      escalated: false,
      daysUntilDue,
      level: escalationLevel.name,
    };
  }

  // Send notification
  await sendDeadlineNotification(deadline, daysUntilDue, escalationLevel);

  // Record that notification was sent
  await recordNotificationSent(deadline.assetId, deadline.deadlineId);

  return {
    deadlineId: deadline.deadlineId,
    assetId: deadline.assetId,
    processed: true,
    notificationSent: true,
    escalated: escalationLevel.isEscalation,
    daysUntilDue,
    level: escalationLevel.name,
  };
}

/**
 * Evaluate and notify for overdue deadlines.
 */
async function evaluateAndNotifyOverdue(deadline: ProcessedDeadline): Promise<DeadlineProcessingResult> {
  const daysUntilDue = calculateDaysUntilDue(deadline.dueDate);
  const daysOverdue = Math.abs(daysUntilDue);

  logger.debug('Evaluating overdue deadline', {
    deadlineId: deadline.deadlineId,
    daysOverdue,
  });

  // Check if we should send notification
  const shouldNotify = await shouldSendNotification(deadline, daysUntilDue);

  if (!shouldNotify) {
    return {
      deadlineId: deadline.deadlineId,
      assetId: deadline.assetId,
      processed: true,
      notificationSent: false,
      escalated: false,
      daysUntilDue,
    };
  }

  // Send critical overdue notification
  await sendOverdueNotification(deadline, daysOverdue);

  // Record notification sent
  await recordNotificationSent(deadline.assetId, deadline.deadlineId);

  return {
    deadlineId: deadline.deadlineId,
    assetId: deadline.assetId,
    processed: true,
    notificationSent: true,
    escalated: true,
    daysUntilDue,
    level: 'Overdue Alert',
  };
}

/**
 * Escalation level configuration.
 */
interface EscalationLevelConfig {
  name: string;
  isEscalation: boolean;
  isCritical: boolean;
}

/**
 * Determine escalation level based on days until due and priority.
 */
function determineEscalationLevel(
  daysUntilDue: number,
  priority: ProcessedDeadline['priority']
): EscalationLevelConfig | null {
  // Priority multiplier affects thresholds
  const priorityMultiplier = {
    low: 0.5,
    medium: 1,
    high: 1.5,
    critical: 2,
  }[priority];

  // Define escalation thresholds
  const thresholds = [
    { days: 90, name: 'Initial Notice', isEscalation: false, isCritical: false },
    { days: 60, name: 'Second Notice', isEscalation: false, isCritical: false },
    { days: 30, name: 'Urgent Notice', isEscalation: true, isCritical: false },
    { days: 14, name: 'Critical Notice', isEscalation: true, isCritical: true },
    { days: 7, name: 'Final Warning', isEscalation: true, isCritical: true },
    { days: 3, name: 'Emergency Alert', isEscalation: true, isCritical: true },
  ];

  // Find appropriate level
  for (const threshold of thresholds) {
    const adjustedThreshold = Math.ceil(threshold.days * priorityMultiplier);
    if (daysUntilDue <= adjustedThreshold) {
      return {
        name: threshold.name,
        isEscalation: threshold.isEscalation,
        isCritical: threshold.isCritical,
      };
    }
  }

  return null;
}

/**
 * Check if notification should be sent (avoid duplicate notifications).
 */
async function shouldSendNotification(
  deadline: ProcessedDeadline,
  daysUntilDue: number
): Promise<boolean> {
  // Always notify for critical thresholds
  const criticalDays = [90, 60, 30, 14, 7, 3, 1, 0];
  if (criticalDays.includes(daysUntilDue)) {
    return true;
  }

  // Check last reminder time
  if (!deadline.lastReminderAt) {
    return true;
  }

  const lastReminder = new Date(deadline.lastReminderAt);
  const hoursSinceLastReminder = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60);

  // Determine repeat interval based on urgency
  let repeatIntervalHours = 168; // Weekly default
  if (daysUntilDue <= 3) {
    repeatIntervalHours = 12;
  } else if (daysUntilDue <= 7) {
    repeatIntervalHours = 24;
  } else if (daysUntilDue <= 14) {
    repeatIntervalHours = 72;
  } else if (daysUntilDue < 0) {
    // Overdue
    repeatIntervalHours = Math.abs(daysUntilDue) > 7 ? 12 : 24;
  }

  return hoursSinceLastReminder >= repeatIntervalHours;
}

/**
 * Send deadline notification via SNS.
 */
async function sendDeadlineNotification(
  deadline: ProcessedDeadline,
  daysUntilDue: number,
  level: EscalationLevelConfig
): Promise<void> {
  const topicArn = level.isCritical ? config.criticalAlertsTopic : config.deadlineAlertsTopic;

  if (!topicArn) {
    logger.warn('SNS topic ARN not configured, skipping notification');
    return;
  }

  const urgencyPrefix =
    daysUntilDue <= 3 ? 'URGENT: ' :
    daysUntilDue <= 7 ? 'ACTION REQUIRED: ' :
    daysUntilDue <= 14 ? 'REMINDER: ' : '';

  const subject = `${urgencyPrefix}${deadline.title} - Due in ${daysUntilDue} days`;

  const message = buildNotificationMessage(deadline, daysUntilDue, level.name);

  const messageAttributes: Record<string, MessageAttributeValue> = {
    priority: { DataType: 'String', StringValue: deadline.priority },
    assetType: { DataType: 'String', StringValue: deadline.assetType },
    assetId: { DataType: 'String', StringValue: deadline.assetId },
    deadlineId: { DataType: 'String', StringValue: deadline.deadlineId },
    daysUntilDue: { DataType: 'Number', StringValue: daysUntilDue.toString() },
    escalationLevel: { DataType: 'String', StringValue: level.name },
  };

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: subject.substring(0, 100), // SNS subject limit
      Message: message,
      MessageAttributes: messageAttributes,
    })
  );

  logger.info('Deadline notification sent', {
    deadlineId: deadline.deadlineId,
    level: level.name,
    daysUntilDue,
    topicArn,
  });
}

/**
 * Send overdue notification via SNS.
 */
async function sendOverdueNotification(
  deadline: ProcessedDeadline,
  daysOverdue: number
): Promise<void> {
  const topicArn = config.criticalAlertsTopic;

  if (!topicArn) {
    logger.warn('Critical SNS topic ARN not configured, skipping overdue notification');
    return;
  }

  const subject = `OVERDUE: ${deadline.title} (${daysOverdue} days past due)`;

  const message = buildOverdueMessage(deadline, daysOverdue);

  const messageAttributes: Record<string, MessageAttributeValue> = {
    priority: { DataType: 'String', StringValue: 'critical' },
    assetType: { DataType: 'String', StringValue: deadline.assetType },
    assetId: { DataType: 'String', StringValue: deadline.assetId },
    deadlineId: { DataType: 'String', StringValue: deadline.deadlineId },
    daysOverdue: { DataType: 'Number', StringValue: daysOverdue.toString() },
    escalationLevel: { DataType: 'String', StringValue: 'Overdue Alert' },
  };

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: subject.substring(0, 100),
      Message: message,
      MessageAttributes: messageAttributes,
    })
  );

  logger.info('Overdue notification sent', {
    deadlineId: deadline.deadlineId,
    daysOverdue,
  });
}

/**
 * Build notification message body.
 */
function buildNotificationMessage(
  deadline: ProcessedDeadline,
  daysUntilDue: number,
  levelName: string
): string {
  const lines = [
    `Deadline Alert: ${levelName}`,
    '',
    `Asset: ${deadline.assetType.toUpperCase()} - ${deadline.assetId}`,
    `Deadline: ${deadline.title}`,
    `Due Date: ${new Date(deadline.dueDate).toLocaleDateString()}`,
    `Days Remaining: ${daysUntilDue}`,
    `Priority: ${deadline.priority.toUpperCase()}`,
    `Deadline Type: ${deadline.deadlineType}`,
  ];

  if (deadline.description) {
    lines.push('', `Description: ${deadline.description}`);
  }

  if (deadline.amount && deadline.currency) {
    lines.push(`Amount Due: ${deadline.amount} ${deadline.currency}`);
  }

  if (deadline.jurisdiction) {
    lines.push(`Jurisdiction: ${deadline.jurisdiction}`);
  }

  lines.push('', 'Please take appropriate action to avoid missing this deadline.');

  return lines.join('\n');
}

/**
 * Build overdue notification message.
 */
function buildOverdueMessage(
  deadline: ProcessedDeadline,
  daysOverdue: number
): string {
  const lines = [
    'OVERDUE DEADLINE ALERT',
    '',
    `Asset: ${deadline.assetType.toUpperCase()} - ${deadline.assetId}`,
    `Deadline: ${deadline.title}`,
    `Due Date: ${new Date(deadline.dueDate).toLocaleDateString()}`,
    `Days Overdue: ${daysOverdue}`,
    '',
    'This deadline has been missed. Immediate action may be required to:',
    '- Assess potential consequences',
    '- Determine if remediation is possible',
    '- Document the miss for compliance purposes',
  ];

  if (deadline.deadlineType.includes('patent_maintenance')) {
    lines.push(
      '',
      'Note: Patent maintenance fees may be payable during a grace period with surcharge.'
    );
  }

  if (deadline.deadlineType.includes('trademark')) {
    lines.push(
      '',
      'Note: Trademark deadlines may have grace periods. Consult counsel immediately.'
    );
  }

  return lines.join('\n');
}

/**
 * Record that a notification was sent for a deadline.
 */
async function recordNotificationSent(assetId: string, deadlineId: string): Promise<void> {
  const now = new Date().toISOString();

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: config.deadlinesTableName,
        Key: {
          pk: `ASSET#${assetId}`,
          sk: `DEADLINE#${deadlineId}`,
        },
        UpdateExpression: 'SET reminders_sent = reminders_sent + :inc, last_reminder_at = :now, updated_at = :now',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':now': now,
        },
      })
    );

    logger.debug('Recorded notification sent', { assetId, deadlineId });
  } catch (error) {
    logger.error('Failed to record notification sent', error, { assetId, deadlineId });
    // Don't throw - notification was sent, just couldn't record it
  }
}

/**
 * Calculate days until due date.
 */
function calculateDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Map DynamoDB image to processed deadline.
 */
function mapToProcessedDeadline(image: DeadlineStreamImage): ProcessedDeadline {
  return {
    assetId: image.asset_id,
    deadlineId: image.deadline_id,
    assetType: image.asset_type,
    deadlineType: image.deadline_type,
    dueDate: image.due_date,
    status: image.status,
    priority: image.priority,
    title: image.title,
    description: image.description,
    amount: image.amount,
    currency: image.currency,
    jurisdiction: image.jurisdiction,
    remindersSent: image.reminders_sent,
    lastReminderAt: image.last_reminder_at,
    completedAt: image.completed_at,
    completedBy: image.completed_by,
    notes: image.notes,
    createdAt: image.created_at,
    updatedAt: image.updated_at,
    expiresAt: image.expires_at,
    metadata: image.metadata,
  };
}

/**
 * Build Lambda response.
 */
function buildResponse(
  statusCode: number,
  message: string,
  eventType: 'stream' | 'scheduled',
  results: DeadlineProcessingResult[],
  startTime: number
): LambdaExecutionResult {
  const notificationsSent = results.filter(r => r.notificationSent).length;
  const escalations = results.filter(r => r.escalated).length;
  const errors = results.filter(r => r.error).length;

  return {
    statusCode,
    body: {
      message,
      eventType,
      recordsProcessed: results.length,
      notificationsSent,
      escalations,
      errors,
      results,
      executionTime: Date.now() - startTime,
    },
  };
}
