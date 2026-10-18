/**
 * Payment Status Stream Processor
 *
 * Processes DynamoDB Streams events for payment status changes.
 * Updates Redis cache and publishes real-time notifications.
 *
 * @module lambdas/stream-processors
 */

import type { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { createClient } from 'redis';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  SNSClient,
  PublishCommand,
} from '@aws-sdk/client-sns';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Environment variables
const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_AUTH_SECRET = process.env.REDIS_AUTH_SECRET;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? 'default';
const CACHE_KEY_PREFIX = process.env.CACHE_KEY_PREFIX ?? 'payment-status:';
const SNS_PAYMENT_TOPIC_ARN = process.env.SNS_PAYMENT_TOPIC_ARN;

// Clients
const eventBridgeClient = new EventBridgeClient({});
const snsClient = new SNSClient({});
const secretsClient = new SecretsManagerClient({});

// Redis client (lazy init)
let redisClient: ReturnType<typeof createClient> | null = null;

interface PaymentStatusRecord {
  payment_id: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
  source_account: string;
  destination_account: string;
  amount: number;
  currency: string;
  initiated_by: string;
  workflow_execution_arn?: string | undefined;
  approved_by?: string | undefined;
  approved_at?: string | undefined;
  completed_at?: string | undefined;
  failure_reason?: string | undefined;
  updated_at: string;
}

/**
 * Initialize Redis client.
 */
async function getRedisClient(): Promise<ReturnType<typeof createClient>> {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  let authToken: string | undefined;

  if (REDIS_AUTH_SECRET) {
    const secretResponse = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: REDIS_AUTH_SECRET })
    );
    authToken = secretResponse.SecretString;
  }

  redisClient = createClient({
    url: `redis://${REDIS_HOST}:6379`,
    password: authToken,
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * Main handler.
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  console.log(`Processing ${event.Records.length} payment status records`);

  const redis = await getRedisClient();

  for (const record of event.Records) {
    try {
      await processRecord(record, redis);
    } catch (error) {
      console.error('Error processing record:', record.eventID, error);
      throw error;
    }
  }

  console.log('Successfully processed all payment status records');
}

/**
 * Process a single record.
 */
async function processRecord(
  record: DynamoDBRecord,
  redis: ReturnType<typeof createClient>
): Promise<void> {
  const eventName = record.eventName;

  if (eventName !== 'INSERT' && eventName !== 'MODIFY') {
    return;
  }

  const newImage = record.dynamodb?.NewImage;
  if (!newImage) {
    return;
  }

  const payment = unmarshall(
    newImage as Record<string, AttributeValue>
  ) as PaymentStatusRecord;

  const oldImage = record.dynamodb?.OldImage
    ? (unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>) as PaymentStatusRecord)
    : null;

  const statusChanged = !oldImage || oldImage.status !== payment.status;

  console.log('Processing payment status:', {
    paymentId: payment.payment_id,
    status: payment.status,
    statusChanged,
    previousStatus: oldImage?.status,
  });

  // Update Redis cache
  await updateCache(redis, payment);

  // If status changed, publish events
  if (statusChanged) {
    await publishStatusChange(payment, oldImage?.status);
  }
}

/**
 * Update Redis cache.
 */
async function updateCache(
  redis: ReturnType<typeof createClient>,
  payment: PaymentStatusRecord
): Promise<void> {
  const paymentKey = `${CACHE_KEY_PREFIX}${payment.payment_id}`;
  const sourceAccountKey = `${CACHE_KEY_PREFIX}account:${payment.source_account}`;

  const cacheValue = JSON.stringify({
    paymentId: payment.payment_id,
    status: payment.status,
    sourceAccount: payment.source_account,
    destinationAccount: payment.destination_account,
    amount: payment.amount,
    currency: payment.currency,
    initiatedBy: payment.initiated_by,
    approvedBy: payment.approved_by,
    approvedAt: payment.approved_at,
    completedAt: payment.completed_at,
    failureReason: payment.failure_reason,
    updatedAt: payment.updated_at,
    cachedAt: new Date().toISOString(),
  });

  // Cache TTL: 1 hour for active, 5 min for terminal states
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(payment.status);
  const ttl = isTerminal ? 300 : 3600;

  await redis
    .multi()
    .set(paymentKey, cacheValue, { EX: ttl })
    // Add to sorted set for account's recent payments
    .zAdd(sourceAccountKey, {
      score: Date.now(),
      value: payment.payment_id,
    })
    // Keep only last 100 payments per account
    .zRemRangeByRank(sourceAccountKey, 0, -101)
    .exec();

  console.log('Updated payment cache:', paymentKey);
}

/**
 * Publish payment status change events.
 */
async function publishStatusChange(
  payment: PaymentStatusRecord,
  previousStatus?: string
): Promise<void> {
  // Map status to event type
  const eventTypeMap: Record<string, string> = {
    pending: 'Payment.Initiated',
    approved: 'Payment.Approved',
    processing: 'Payment.Processing',
    completed: 'Payment.Completed',
    failed: 'Payment.Failed',
    cancelled: 'Payment.Cancelled',
  };

  const eventType = eventTypeMap[payment.status] ?? 'Payment.StatusChanged';

  const eventDetail = {
    aggregateType: 'Payment',
    aggregateId: payment.payment_id,
    paymentId: payment.payment_id,
    status: payment.status,
    previousStatus,
    sourceAccount: payment.source_account,
    destinationAccount: payment.destination_account,
    amount: payment.amount,
    currency: payment.currency,
    initiatedBy: payment.initiated_by,
    approvedBy: payment.approved_by,
    completedAt: payment.completed_at,
    failureReason: payment.failure_reason,
    updatedAt: payment.updated_at,
  };

  // Publish to EventBridge
  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
          Source: 'banking-treasury.streams',
          DetailType: eventType,
          Time: new Date(),
          Detail: JSON.stringify(eventDetail),
        },
      ],
    })
  );

  console.log('Published EventBridge event:', eventType);

  // Publish to SNS for immediate notifications (if configured)
  if (SNS_PAYMENT_TOPIC_ARN && shouldNotify(payment.status)) {
    await snsClient.send(
      new PublishCommand({
        TopicArn: SNS_PAYMENT_TOPIC_ARN,
        Subject: `Payment ${payment.status.toUpperCase()}: ${payment.payment_id}`,
        Message: JSON.stringify(eventDetail, null, 2),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: eventType,
          },
          status: {
            DataType: 'String',
            StringValue: payment.status,
          },
          currency: {
            DataType: 'String',
            StringValue: payment.currency,
          },
          amount: {
            DataType: 'Number',
            StringValue: payment.amount.toString(),
          },
        },
      })
    );

    console.log('Published SNS notification');
  }
}

/**
 * Determine if status should trigger notification.
 */
function shouldNotify(status: string): boolean {
  // Notify on terminal states and approval
  return ['approved', 'completed', 'failed', 'cancelled'].includes(status);
}
