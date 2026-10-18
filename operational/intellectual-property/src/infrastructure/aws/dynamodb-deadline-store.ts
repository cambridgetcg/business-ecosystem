/**
 * DynamoDB Deadline Store for Intellectual Property
 *
 * Manages IP deadlines and events with:
 * - Real-time deadline tracking
 * - Status-based queries
 * - Event sourcing for audit trail
 *
 * @module infrastructure/aws
 */

import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { awsConfig } from './config.js';

const client = new DynamoDBClient({ region: awsConfig.region });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

/**
 * Deadline record structure.
 */
export interface Deadline {
  assetId: string;
  deadlineId: string;
  assetType: 'patent' | 'trademark' | 'domain' | 'license' | 'trade_secret';
  deadlineType: string;
  dueDate: string;
  status: 'pending' | 'acknowledged' | 'completed' | 'missed' | 'waived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string | undefined;
  amount?: number | undefined;
  currency?: string | undefined;
  jurisdiction?: string | undefined;
  remindersSent: number;
  lastReminderAt?: string | undefined;
  completedAt?: string | undefined;
  completedBy?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
  expiresAt?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * IP event record structure (for event sourcing).
 */
export interface IPEvent {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  occurredAt: string;
  version: number;
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string | undefined;
    causationId?: string | undefined;
    userId?: string | undefined;
    tenantId?: string | undefined;
  } | undefined;
  ttl?: number | undefined;
}

/**
 * Deadline Store
 *
 * Manages IP deadline tracking in DynamoDB.
 */
export class DeadlineStore {
  private readonly tableName: string;

  constructor(tableName?: string) {
    this.tableName = tableName ?? awsConfig.dynamodb.deadlinesTable;
  }

  /**
   * Get deadline by ID.
   */
  async getDeadline(assetId: string, deadlineId: string): Promise<Deadline | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        asset_id: assetId,
        deadline_id: deadlineId,
      },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      return null;
    }

    return this.mapToDeadline(response.Item as Record<string, unknown>);
  }

  /**
   * Get all deadlines for an asset.
   */
  async getDeadlinesByAsset(assetId: string): Promise<Deadline[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'asset_id = :assetId',
      ExpressionAttributeValues: {
        ':assetId': assetId,
      },
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToDeadline(item as Record<string, unknown>));
  }

  /**
   * Get deadlines by status (using GSI).
   */
  async getDeadlinesByStatus(
    status: Deadline['status'],
    options?: {
      limit?: number | undefined;
      dueBefore?: Date | undefined;
    }
  ): Promise<Deadline[]> {
    let keyConditionExpression = '#status = :status';
    const expressionAttributeNames: Record<string, string> = { '#status': 'status' };
    const expressionAttributeValues: Record<string, unknown> = { ':status': status };

    if (options?.dueBefore) {
      keyConditionExpression += ' AND due_date <= :dueBefore';
      expressionAttributeValues[':dueBefore'] = options.dueBefore.toISOString();
    }

    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'status-due-date-index',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: options?.limit ?? 100,
      ScanIndexForward: true, // Oldest due dates first
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToDeadline(item as Record<string, unknown>));
  }

  /**
   * Get upcoming deadlines (pending, within date range).
   */
  async getUpcomingDeadlines(daysAhead: number, limit = 50): Promise<Deadline[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'status-due-date-index',
      KeyConditionExpression: '#status = :status AND due_date BETWEEN :now AND :future',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'pending',
        ':now': now.toISOString(),
        ':future': futureDate.toISOString(),
      },
      Limit: limit,
      ScanIndexForward: true,
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToDeadline(item as Record<string, unknown>));
  }

  /**
   * Get overdue deadlines.
   */
  async getOverdueDeadlines(limit = 50): Promise<Deadline[]> {
    const now = new Date().toISOString();

    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'status-due-date-index',
      KeyConditionExpression: '#status = :status AND due_date < :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'pending',
        ':now': now,
      },
      Limit: limit,
      ScanIndexForward: true,
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToDeadline(item as Record<string, unknown>));
  }

  /**
   * Create a deadline.
   */
  async createDeadline(deadline: Deadline): Promise<void> {
    const now = new Date().toISOString();

    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        asset_id: deadline.assetId,
        deadline_id: deadline.deadlineId,
        asset_type: deadline.assetType,
        deadline_type: deadline.deadlineType,
        due_date: deadline.dueDate,
        status: deadline.status,
        priority: deadline.priority,
        title: deadline.title,
        description: deadline.description,
        amount: deadline.amount,
        currency: deadline.currency,
        jurisdiction: deadline.jurisdiction,
        reminders_sent: deadline.remindersSent,
        last_reminder_at: deadline.lastReminderAt,
        completed_at: deadline.completedAt,
        completed_by: deadline.completedBy,
        notes: deadline.notes,
        created_at: deadline.createdAt || now,
        updated_at: now,
        expires_at: deadline.expiresAt,
        metadata: deadline.metadata,
      },
      ConditionExpression: 'attribute_not_exists(asset_id) AND attribute_not_exists(deadline_id)',
    });

    await docClient.send(command);
  }

  /**
   * Update deadline status.
   */
  async updateDeadlineStatus(
    assetId: string,
    deadlineId: string,
    status: Deadline['status'],
    completedBy?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const updateExpressions = ['#status = :status', 'updated_at = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = { '#status': 'status' };
    const expressionAttributeValues: Record<string, unknown> = {
      ':status': status,
      ':updatedAt': now,
    };

    if (status === 'completed' && completedBy) {
      updateExpressions.push('completed_at = :completedAt', 'completed_by = :completedBy');
      expressionAttributeValues[':completedAt'] = now;
      expressionAttributeValues[':completedBy'] = completedBy;
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        asset_id: assetId,
        deadline_id: deadlineId,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await docClient.send(command);
  }

  /**
   * Record reminder sent.
   */
  async recordReminderSent(assetId: string, deadlineId: string): Promise<void> {
    const now = new Date().toISOString();

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        asset_id: assetId,
        deadline_id: deadlineId,
      },
      UpdateExpression: 'SET reminders_sent = reminders_sent + :inc, last_reminder_at = :now, updated_at = :now',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': now,
      },
    });

    await docClient.send(command);
  }

  /**
   * Batch create deadlines.
   */
  async batchCreateDeadlines(deadlines: Deadline[]): Promise<void> {
    const now = new Date().toISOString();
    const batches = this.chunk(deadlines, 25);

    for (const batch of batches) {
      const command = new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: batch.map(deadline => ({
            PutRequest: {
              Item: {
                asset_id: deadline.assetId,
                deadline_id: deadline.deadlineId,
                asset_type: deadline.assetType,
                deadline_type: deadline.deadlineType,
                due_date: deadline.dueDate,
                status: deadline.status,
                priority: deadline.priority,
                title: deadline.title,
                description: deadline.description,
                amount: deadline.amount,
                currency: deadline.currency,
                jurisdiction: deadline.jurisdiction,
                reminders_sent: deadline.remindersSent,
                created_at: deadline.createdAt || now,
                updated_at: now,
                metadata: deadline.metadata,
              },
            },
          })),
        },
      });

      await docClient.send(command);
    }
  }

  private mapToDeadline(item: Record<string, unknown>): Deadline {
    return {
      assetId: item.asset_id as string,
      deadlineId: item.deadline_id as string,
      assetType: item.asset_type as Deadline['assetType'],
      deadlineType: item.deadline_type as string,
      dueDate: item.due_date as string,
      status: item.status as Deadline['status'],
      priority: item.priority as Deadline['priority'],
      title: item.title as string,
      description: item.description as string | undefined,
      amount: item.amount as number | undefined,
      currency: item.currency as string | undefined,
      jurisdiction: item.jurisdiction as string | undefined,
      remindersSent: item.reminders_sent as number,
      lastReminderAt: item.last_reminder_at as string | undefined,
      completedAt: item.completed_at as string | undefined,
      completedBy: item.completed_by as string | undefined,
      notes: item.notes as string | undefined,
      createdAt: item.created_at as string,
      updatedAt: item.updated_at as string,
      expiresAt: item.expires_at as number | undefined,
      metadata: item.metadata as Record<string, unknown> | undefined,
    };
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * IP Event Store
 *
 * Event sourcing store for IP domain events.
 */
export class IPEventStore {
  private readonly tableName: string;

  constructor(tableName?: string) {
    this.tableName = tableName ?? awsConfig.dynamodb.eventsTable;
  }

  /**
   * Append event to store.
   */
  async appendEvent(event: IPEvent): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        aggregate_id: event.aggregateId,
        event_id: event.eventId,
        aggregate_type: event.aggregateType,
        event_type: event.eventType,
        occurred_at: event.occurredAt,
        version: event.version,
        payload: event.payload,
        metadata: event.metadata,
        ttl: event.ttl,
      },
    });

    await docClient.send(command);
  }

  /**
   * Get events for an aggregate.
   */
  async getEventsByAggregate(
    aggregateId: string,
    options?: {
      afterVersion?: number | undefined;
      limit?: number | undefined;
    }
  ): Promise<IPEvent[]> {
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'aggregate_id = :aggregateId',
      ExpressionAttributeValues: {
        ':aggregateId': aggregateId,
      },
      ScanIndexForward: true, // Oldest first
      Limit: options?.limit ?? 1000,
    };

    if (options?.afterVersion !== undefined) {
      queryInput.KeyConditionExpression += ' AND version > :afterVersion';
      queryInput.ExpressionAttributeValues![':afterVersion'] = options.afterVersion;
    }

    const response = await docClient.send(new QueryCommand(queryInput));
    return (response.Items ?? []).map(item => this.mapToEvent(item as Record<string, unknown>));
  }

  /**
   * Get events by type (using GSI).
   */
  async getEventsByType(
    eventType: string,
    options?: {
      after?: Date | undefined;
      limit?: number | undefined;
    }
  ): Promise<IPEvent[]> {
    let keyConditionExpression = 'event_type = :eventType';
    const expressionAttributeValues: Record<string, unknown> = { ':eventType': eventType };

    if (options?.after) {
      keyConditionExpression += ' AND occurred_at > :after';
      expressionAttributeValues[':after'] = options.after.toISOString();
    }

    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'event-type-index',
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: false, // Most recent first
      Limit: options?.limit ?? 100,
    });

    const response = await docClient.send(command);
    return (response.Items ?? []).map(item => this.mapToEvent(item as Record<string, unknown>));
  }

  /**
   * Batch append events.
   */
  async batchAppendEvents(events: IPEvent[]): Promise<void> {
    const batches = this.chunk(events, 25);

    for (const batch of batches) {
      const command = new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: batch.map(event => ({
            PutRequest: {
              Item: {
                aggregate_id: event.aggregateId,
                event_id: event.eventId,
                aggregate_type: event.aggregateType,
                event_type: event.eventType,
                occurred_at: event.occurredAt,
                version: event.version,
                payload: event.payload,
                metadata: event.metadata,
                ttl: event.ttl,
              },
            },
          })),
        },
      });

      await docClient.send(command);
    }
  }

  private mapToEvent(item: Record<string, unknown>): IPEvent {
    return {
      eventId: item.event_id as string,
      aggregateType: item.aggregate_type as string,
      aggregateId: item.aggregate_id as string,
      eventType: item.event_type as string,
      occurredAt: item.occurred_at as string,
      version: item.version as number,
      payload: item.payload as Record<string, unknown>,
      metadata: item.metadata as IPEvent['metadata'],
      ttl: item.ttl as number | undefined,
    };
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Singleton instances
export const deadlineStore = new DeadlineStore();
export const ipEventStore = new IPEventStore();
