/**
 * Cash Position Stream Processor
 *
 * Processes DynamoDB Streams events for cash position changes.
 * Updates Redis cache and publishes events to EventBridge.
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
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Environment variables
const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_AUTH_SECRET = process.env.REDIS_AUTH_SECRET;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? 'default';
const CACHE_KEY_PREFIX = process.env.CACHE_KEY_PREFIX ?? 'cash-position:';
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS ?? '300', 10);

// Clients
const eventBridgeClient = new EventBridgeClient({});
const secretsClient = new SecretsManagerClient({});

// Redis client (lazy init)
let redisClient: ReturnType<typeof createClient> | null = null;

interface CashPositionRecord {
  entity_id: string;
  currency_timestamp: string;
  account_id: string;
  currency: string;
  available_balance: number;
  current_balance: number;
  pending_credits: number;
  pending_debits: number;
  last_transaction_id?: string | undefined;
  updated_at: string;
}

/**
 * Initialize Redis client with auth from Secrets Manager.
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
 * Main handler for DynamoDB Stream events.
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  console.log(`Processing ${event.Records.length} records`);

  const redis = await getRedisClient();
  const eventBridgeEvents: Array<{
    DetailType: string;
    Detail: string;
    Source: string;
    EventBusName: string;
  }> = [];

  for (const record of event.Records) {
    try {
      await processRecord(record, redis, eventBridgeEvents);
    } catch (error) {
      console.error('Error processing record:', record.eventID, error);
      throw error; // Re-throw to trigger DLQ
    }
  }

  // Batch publish EventBridge events
  if (eventBridgeEvents.length > 0) {
    await publishEvents(eventBridgeEvents);
  }

  console.log('Successfully processed all records');
}

/**
 * Process a single DynamoDB Stream record.
 */
async function processRecord(
  record: DynamoDBRecord,
  redis: ReturnType<typeof createClient>,
  events: Array<{
    DetailType: string;
    Detail: string;
    Source: string;
    EventBusName: string;
  }>
): Promise<void> {
  const eventName = record.eventName;

  if (eventName !== 'INSERT' && eventName !== 'MODIFY') {
    return;
  }

  const newImage = record.dynamodb?.NewImage;
  if (!newImage) {
    console.warn('No NewImage in record:', record.eventID);
    return;
  }

  const position = unmarshall(
    newImage as Record<string, AttributeValue>
  ) as CashPositionRecord;

  console.log('Processing cash position:', {
    entityId: position.entity_id,
    currency: position.currency,
    balance: position.current_balance,
  });

  // Update Redis cache
  await updateCache(redis, position);

  // Prepare EventBridge event
  const oldImage = record.dynamodb?.OldImage
    ? (unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>) as CashPositionRecord)
    : null;

  events.push({
    DetailType: 'CashPosition.Updated',
    Source: 'banking-treasury.streams',
    EventBusName: EVENT_BUS_NAME,
    Detail: JSON.stringify({
      aggregateType: 'CashPosition',
      aggregateId: position.entity_id,
      entityId: position.entity_id,
      accountId: position.account_id,
      currency: position.currency,
      currentBalance: position.current_balance,
      availableBalance: position.available_balance,
      pendingCredits: position.pending_credits,
      pendingDebits: position.pending_debits,
      previousBalance: oldImage?.current_balance,
      changeAmount: oldImage
        ? position.current_balance - oldImage.current_balance
        : undefined,
      updatedAt: position.updated_at,
      metadata: {
        eventName,
        streamArn: record.eventSourceARN,
        sequenceNumber: record.dynamodb?.SequenceNumber,
      },
    }),
  });
}

/**
 * Update Redis cache with latest cash position.
 */
async function updateCache(
  redis: ReturnType<typeof createClient>,
  position: CashPositionRecord
): Promise<void> {
  // Cache by entity + currency
  const entityCurrencyKey = `${CACHE_KEY_PREFIX}${position.entity_id}:${position.currency}`;

  // Cache by account
  const accountKey = `${CACHE_KEY_PREFIX}account:${position.account_id}`;

  const cacheValue = JSON.stringify({
    entityId: position.entity_id,
    accountId: position.account_id,
    currency: position.currency,
    currentBalance: position.current_balance,
    availableBalance: position.available_balance,
    pendingCredits: position.pending_credits,
    pendingDebits: position.pending_debits,
    lastTransactionId: position.last_transaction_id,
    updatedAt: position.updated_at,
    cachedAt: new Date().toISOString(),
  });

  // Use pipeline for atomic operations
  await redis
    .multi()
    .set(entityCurrencyKey, cacheValue, { EX: CACHE_TTL_SECONDS })
    .set(accountKey, cacheValue, { EX: CACHE_TTL_SECONDS })
    // Add to sorted set for entity positions (for range queries)
    .zAdd(`${CACHE_KEY_PREFIX}entity:${position.entity_id}`, {
      score: Date.now(),
      value: position.currency,
    })
    .exec();

  console.log('Updated cache:', entityCurrencyKey);
}

/**
 * Batch publish events to EventBridge.
 */
async function publishEvents(
  events: Array<{
    DetailType: string;
    Detail: string;
    Source: string;
    EventBusName: string;
  }>
): Promise<void> {
  // EventBridge allows max 10 events per request
  const batches = chunk(events, 10);

  for (const batch of batches) {
    const command = new PutEventsCommand({
      Entries: batch.map((e) => ({
        ...e,
        Time: new Date(),
      })),
    });

    const response = await eventBridgeClient.send(command);

    if (response.FailedEntryCount && response.FailedEntryCount > 0) {
      console.error(
        'Some EventBridge events failed:',
        response.Entries?.filter((e) => e.ErrorCode)
      );
    }
  }

  console.log(`Published ${events.length} events to EventBridge`);
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
