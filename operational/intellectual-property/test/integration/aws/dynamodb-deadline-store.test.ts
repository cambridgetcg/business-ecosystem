/**
 * DynamoDB Deadline Store Integration Tests
 *
 * Tests for DeadlineStore and IPEventStore classes using mocked AWS SDK.
 * Covers CRUD operations, GSI queries, batch operations, and field mapping.
 *
 * @module test/integration/aws
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  DeadlineStore,
  IPEventStore,
  type Deadline,
  type IPEvent,
} from '../../../src/infrastructure/aws/dynamodb-deadline-store.js';

// Get the mocked document client
const mockDocClient = DynamoDBDocumentClient.from({} as any) as {
  send: Mock;
};

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

function createTestDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    assetId: 'patent-123',
    deadlineId: 'deadline-001',
    assetType: 'patent',
    deadlineType: 'maintenance_fee',
    dueDate: '2024-06-15T00:00:00.000Z',
    status: 'pending',
    priority: 'high',
    title: 'Year 3.5 Maintenance Fee',
    description: 'USPTO maintenance fee due',
    amount: 1600,
    currency: 'USD',
    jurisdiction: 'US',
    remindersSent: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createTestIPEvent(overrides: Partial<IPEvent> = {}): IPEvent {
  return {
    eventId: 'evt-001',
    aggregateType: 'Patent',
    aggregateId: 'patent-123',
    eventType: 'Patent.Filed',
    occurredAt: '2024-01-15T10:30:00.000Z',
    version: 1,
    payload: {
      applicationNumber: '17/123,456',
      filingDate: '2024-01-15',
    },
    metadata: {
      correlationId: 'corr-001',
      userId: 'user-1',
    },
    ...overrides,
  };
}

function createDynamoDBDeadlineItem(deadline: Deadline): Record<string, unknown> {
  return {
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
    created_at: deadline.createdAt,
    updated_at: deadline.updatedAt,
    expires_at: deadline.expiresAt,
    metadata: deadline.metadata,
  };
}

function createDynamoDBEventItem(event: IPEvent): Record<string, unknown> {
  return {
    aggregate_id: event.aggregateId,
    event_id: event.eventId,
    aggregate_type: event.aggregateType,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    version: event.version,
    payload: event.payload,
    metadata: event.metadata,
    ttl: event.ttl,
  };
}

// ===========================================================================
// DEADLINE STORE TESTS
// ===========================================================================

describe('DeadlineStore', () => {
  let store: DeadlineStore;
  const tableName = 'test-deadlines-table';

  beforeEach(() => {
    vi.clearAllMocks();
    store = new DeadlineStore(tableName);
  });

  // -------------------------------------------------------------------------
  // getDeadline
  // -------------------------------------------------------------------------

  describe('getDeadline', () => {
    it('should retrieve a deadline by assetId and deadlineId', async () => {
      // Arrange
      const deadline = createTestDeadline();
      const dynamoItem = createDynamoDBDeadlineItem(deadline);

      mockDocClient.send.mockResolvedValueOnce({
        Item: dynamoItem,
      });

      // Act
      const result = await store.getDeadline('patent-123', 'deadline-001');

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      expect(GetCommand).toHaveBeenCalledWith({
        TableName: tableName,
        Key: {
          asset_id: 'patent-123',
          deadline_id: 'deadline-001',
        },
      });

      expect(result).not.toBeNull();
      expect(result!.assetId).toBe('patent-123');
      expect(result!.deadlineId).toBe('deadline-001');
      expect(result!.status).toBe('pending');
      expect(result!.title).toBe('Year 3.5 Maintenance Fee');
    });

    it('should return null when deadline not found', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({
        Item: undefined,
      });

      // Act
      const result = await store.getDeadline('non-existent', 'non-existent');

      // Assert
      expect(result).toBeNull();
    });

    it('should correctly map snake_case to camelCase fields', async () => {
      // Arrange
      const dynamoItem = {
        asset_id: 'patent-456',
        deadline_id: 'dl-002',
        asset_type: 'trademark',
        deadline_type: 'renewal',
        due_date: '2024-12-01T00:00:00.000Z',
        status: 'completed',
        priority: 'critical',
        title: 'Trademark Renewal',
        reminders_sent: 3,
        last_reminder_at: '2024-11-15T00:00:00.000Z',
        completed_at: '2024-11-20T00:00:00.000Z',
        completed_by: 'user-admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-11-20T00:00:00.000Z',
        expires_at: 1735689600,
      };

      mockDocClient.send.mockResolvedValueOnce({ Item: dynamoItem });

      // Act
      const result = await store.getDeadline('patent-456', 'dl-002');

      // Assert
      expect(result).not.toBeNull();
      expect(result!.assetId).toBe('patent-456');
      expect(result!.deadlineId).toBe('dl-002');
      expect(result!.assetType).toBe('trademark');
      expect(result!.deadlineType).toBe('renewal');
      expect(result!.remindersSent).toBe(3);
      expect(result!.lastReminderAt).toBe('2024-11-15T00:00:00.000Z');
      expect(result!.completedAt).toBe('2024-11-20T00:00:00.000Z');
      expect(result!.completedBy).toBe('user-admin');
      expect(result!.expiresAt).toBe(1735689600);
    });
  });

  // -------------------------------------------------------------------------
  // getDeadlinesByAsset
  // -------------------------------------------------------------------------

  describe('getDeadlinesByAsset', () => {
    it('should retrieve all deadlines for an asset', async () => {
      // Arrange
      const deadlines = [
        createTestDeadline({ deadlineId: 'dl-001' }),
        createTestDeadline({ deadlineId: 'dl-002', deadlineType: 'office_action' }),
        createTestDeadline({ deadlineId: 'dl-003', deadlineType: 'renewal' }),
      ];

      mockDocClient.send.mockResolvedValueOnce({
        Items: deadlines.map(createDynamoDBDeadlineItem),
      });

      // Act
      const result = await store.getDeadlinesByAsset('patent-123');

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: tableName,
        KeyConditionExpression: 'asset_id = :assetId',
        ExpressionAttributeValues: {
          ':assetId': 'patent-123',
        },
      });

      expect(result).toHaveLength(3);
      expect(result.map(d => d.deadlineId)).toEqual(['dl-001', 'dl-002', 'dl-003']);
    });

    it('should return empty array when no deadlines found', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({
        Items: [],
      });

      // Act
      const result = await store.getDeadlinesByAsset('empty-asset');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle undefined Items response', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      const result = await store.getDeadlinesByAsset('some-asset');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getDeadlinesByStatus (GSI Query)
  // -------------------------------------------------------------------------

  describe('getDeadlinesByStatus', () => {
    it('should query by status using GSI', async () => {
      // Arrange
      const pendingDeadlines = [
        createTestDeadline({ deadlineId: 'dl-001', status: 'pending' }),
        createTestDeadline({ deadlineId: 'dl-002', status: 'pending' }),
      ];

      mockDocClient.send.mockResolvedValueOnce({
        Items: pendingDeadlines.map(createDynamoDBDeadlineItem),
      });

      // Act
      const result = await store.getDeadlinesByStatus('pending');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: tableName,
        IndexName: 'status-due-date-index',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'pending' },
        Limit: 100,
        ScanIndexForward: true,
      });

      expect(result).toHaveLength(2);
      expect(result.every(d => d.status === 'pending')).toBe(true);
    });

    it('should filter by dueBefore date', async () => {
      // Arrange
      const dueBefore = new Date('2024-06-01T00:00:00.000Z');

      mockDocClient.send.mockResolvedValueOnce({
        Items: [createDynamoDBDeadlineItem(createTestDeadline())],
      });

      // Act
      await store.getDeadlinesByStatus('pending', { dueBefore });

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyConditionExpression: '#status = :status AND due_date <= :dueBefore',
          ExpressionAttributeValues: {
            ':status': 'pending',
            ':dueBefore': dueBefore.toISOString(),
          },
        })
      );
    });

    it('should respect limit option', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await store.getDeadlinesByStatus('acknowledged', { limit: 25 });

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 25,
        })
      );
    });

    it('should default limit to 100', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await store.getDeadlinesByStatus('completed');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 100,
        })
      );
    });

    it('should sort by due date ascending (oldest first)', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await store.getDeadlinesByStatus('pending');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ScanIndexForward: true,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getUpcomingDeadlines
  // -------------------------------------------------------------------------

  describe('getUpcomingDeadlines', () => {
    it('should query pending deadlines within date range', async () => {
      // Arrange
      const now = new Date('2024-01-15T00:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      mockDocClient.send.mockResolvedValueOnce({
        Items: [createDynamoDBDeadlineItem(createTestDeadline())],
      });

      // Act
      const result = await store.getUpcomingDeadlines(30);

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'status-due-date-index',
          KeyConditionExpression: '#status = :status AND due_date BETWEEN :now AND :future',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: expect.objectContaining({
            ':status': 'pending',
          }),
        })
      );

      vi.useRealTimers();
    });

    it('should use default limit of 50', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await store.getUpcomingDeadlines(7);

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 50,
        })
      );
    });

    it('should allow custom limit', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await store.getUpcomingDeadlines(14, 100);

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 100,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getOverdueDeadlines
  // -------------------------------------------------------------------------

  describe('getOverdueDeadlines', () => {
    it('should query pending deadlines with due_date in the past', async () => {
      // Arrange
      const now = new Date('2024-06-20T00:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const overdueDeadline = createTestDeadline({
        dueDate: '2024-06-15T00:00:00.000Z',
      });

      mockDocClient.send.mockResolvedValueOnce({
        Items: [createDynamoDBDeadlineItem(overdueDeadline)],
      });

      // Act
      const result = await store.getOverdueDeadlines();

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'status-due-date-index',
          KeyConditionExpression: '#status = :status AND due_date < :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'pending',
            ':now': now.toISOString(),
          },
          Limit: 50,
          ScanIndexForward: true,
        })
      );

      expect(result).toHaveLength(1);
      vi.useRealTimers();
    });

    it('should allow custom limit', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await store.getOverdueDeadlines(200);

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 200,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // createDeadline
  // -------------------------------------------------------------------------

  describe('createDeadline', () => {
    it('should create a deadline with PutCommand', async () => {
      // Arrange
      const deadline = createTestDeadline();
      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.createDeadline(deadline);

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: tableName,
          Item: expect.objectContaining({
            asset_id: deadline.assetId,
            deadline_id: deadline.deadlineId,
            asset_type: deadline.assetType,
            deadline_type: deadline.deadlineType,
            due_date: deadline.dueDate,
            status: deadline.status,
            priority: deadline.priority,
            title: deadline.title,
          }),
          ConditionExpression: 'attribute_not_exists(asset_id) AND attribute_not_exists(deadline_id)',
        })
      );
    });

    it('should map camelCase to snake_case fields', async () => {
      // Arrange
      const deadline = createTestDeadline({
        remindersSent: 5,
        lastReminderAt: '2024-05-01T00:00:00.000Z',
        completedAt: '2024-05-15T00:00:00.000Z',
        completedBy: 'user-admin',
        expiresAt: 1735689600,
      });

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.createDeadline(deadline);

      // Assert
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            reminders_sent: 5,
            last_reminder_at: '2024-05-01T00:00:00.000Z',
            completed_at: '2024-05-15T00:00:00.000Z',
            completed_by: 'user-admin',
            expires_at: 1735689600,
          }),
        })
      );
    });

    it('should use provided createdAt or default to now', async () => {
      // Arrange
      const now = new Date('2024-02-01T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const deadlineWithCreatedAt = createTestDeadline({
        createdAt: '2024-01-15T00:00:00.000Z',
      });

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.createDeadline(deadlineWithCreatedAt);

      // Assert
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            created_at: '2024-01-15T00:00:00.000Z',
            updated_at: now.toISOString(),
          }),
        })
      );

      vi.useRealTimers();
    });

    it('should handle optional fields', async () => {
      // Arrange
      const minimalDeadline: Deadline = {
        assetId: 'asset-1',
        deadlineId: 'dl-1',
        assetType: 'patent',
        deadlineType: 'filing',
        dueDate: '2024-03-01T00:00:00.000Z',
        status: 'pending',
        priority: 'medium',
        title: 'Filing Deadline',
        remindersSent: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.createDeadline(minimalDeadline);

      // Assert
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            asset_id: 'asset-1',
            deadline_id: 'dl-1',
            description: undefined,
            amount: undefined,
            currency: undefined,
          }),
        })
      );
    });

    it('should prevent duplicate deadlines with condition expression', async () => {
      // Arrange
      const deadline = createTestDeadline();
      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.createDeadline(deadline);

      // Assert
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ConditionExpression: 'attribute_not_exists(asset_id) AND attribute_not_exists(deadline_id)',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateDeadlineStatus
  // -------------------------------------------------------------------------

  describe('updateDeadlineStatus', () => {
    it('should update status with UpdateCommand', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.updateDeadlineStatus('patent-123', 'dl-001', 'acknowledged');

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      expect(UpdateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: tableName,
          Key: {
            asset_id: 'patent-123',
            deadline_id: 'dl-001',
          },
          UpdateExpression: expect.stringContaining('#status = :status'),
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: expect.objectContaining({
            ':status': 'acknowledged',
          }),
        })
      );
    });

    it('should set completed_at and completed_by when status is completed', async () => {
      // Arrange
      const now = new Date('2024-06-15T10:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.updateDeadlineStatus('patent-123', 'dl-001', 'completed', 'user-admin');

      // Assert
      expect(UpdateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          UpdateExpression: expect.stringContaining('completed_at = :completedAt'),
          ExpressionAttributeValues: expect.objectContaining({
            ':status': 'completed',
            ':completedAt': now.toISOString(),
            ':completedBy': 'user-admin',
          }),
        })
      );

      vi.useRealTimers();
    });

    it('should not set completion fields for non-completed status', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.updateDeadlineStatus('patent-123', 'dl-001', 'missed');

      // Assert
      expect(UpdateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          UpdateExpression: expect.not.stringContaining('completed_at'),
        })
      );
    });

    it('should update timestamp on every status change', async () => {
      // Arrange
      const now = new Date('2024-06-15T10:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.updateDeadlineStatus('patent-123', 'dl-001', 'waived');

      // Assert
      expect(UpdateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: expect.objectContaining({
            ':updatedAt': now.toISOString(),
          }),
        })
      );

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // recordReminderSent
  // -------------------------------------------------------------------------

  describe('recordReminderSent', () => {
    it('should increment reminders_sent counter', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.recordReminderSent('patent-123', 'dl-001');

      // Assert
      expect(UpdateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: tableName,
          Key: {
            asset_id: 'patent-123',
            deadline_id: 'dl-001',
          },
          UpdateExpression: 'SET reminders_sent = reminders_sent + :inc, last_reminder_at = :now, updated_at = :now',
          ExpressionAttributeValues: expect.objectContaining({
            ':inc': 1,
          }),
        })
      );
    });

    it('should update last_reminder_at timestamp', async () => {
      // Arrange
      const now = new Date('2024-06-01T09:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.recordReminderSent('patent-123', 'dl-001');

      // Assert
      expect(UpdateCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: expect.objectContaining({
            ':now': now.toISOString(),
          }),
        })
      );

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------------
  // batchCreateDeadlines
  // -------------------------------------------------------------------------

  describe('batchCreateDeadlines', () => {
    it('should create multiple deadlines in a single batch', async () => {
      // Arrange
      const deadlines = [
        createTestDeadline({ deadlineId: 'dl-001' }),
        createTestDeadline({ deadlineId: 'dl-002' }),
        createTestDeadline({ deadlineId: 'dl-003' }),
      ];

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.batchCreateDeadlines(deadlines);

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      expect(BatchWriteCommand).toHaveBeenCalledWith({
        RequestItems: {
          [tableName]: expect.arrayContaining([
            expect.objectContaining({
              PutRequest: expect.objectContaining({
                Item: expect.objectContaining({
                  deadline_id: 'dl-001',
                }),
              }),
            }),
            expect.objectContaining({
              PutRequest: expect.objectContaining({
                Item: expect.objectContaining({
                  deadline_id: 'dl-002',
                }),
              }),
            }),
            expect.objectContaining({
              PutRequest: expect.objectContaining({
                Item: expect.objectContaining({
                  deadline_id: 'dl-003',
                }),
              }),
            }),
          ]),
        },
      });
    });

    it('should chunk batches into groups of 25 items', async () => {
      // Arrange
      const deadlines = Array.from({ length: 60 }, (_, i) =>
        createTestDeadline({ deadlineId: `dl-${i.toString().padStart(3, '0')}` })
      );

      mockDocClient.send
        .mockResolvedValueOnce({}) // First batch (25)
        .mockResolvedValueOnce({}) // Second batch (25)
        .mockResolvedValueOnce({}); // Third batch (10)

      // Act
      await store.batchCreateDeadlines(deadlines);

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(3);

      // Verify first batch has 25 items
      const firstCall = (BatchWriteCommand as Mock).mock.calls[0][0];
      expect(firstCall.RequestItems[tableName]).toHaveLength(25);

      // Verify second batch has 25 items
      const secondCall = (BatchWriteCommand as Mock).mock.calls[1][0];
      expect(secondCall.RequestItems[tableName]).toHaveLength(25);

      // Verify third batch has 10 items
      const thirdCall = (BatchWriteCommand as Mock).mock.calls[2][0];
      expect(thirdCall.RequestItems[tableName]).toHaveLength(10);
    });

    it('should handle exactly 25 items in a single batch', async () => {
      // Arrange
      const deadlines = Array.from({ length: 25 }, (_, i) =>
        createTestDeadline({ deadlineId: `dl-${i}` })
      );

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.batchCreateDeadlines(deadlines);

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle empty array', async () => {
      // Arrange & Act
      await store.batchCreateDeadlines([]);

      // Assert
      expect(mockDocClient.send).not.toHaveBeenCalled();
    });

    it('should map all deadline fields correctly in batch', async () => {
      // Arrange
      const deadline = createTestDeadline({
        assetId: 'batch-asset',
        deadlineId: 'batch-dl',
        amount: 2500,
        currency: 'EUR',
        metadata: { batchKey: 'value' },
      });

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await store.batchCreateDeadlines([deadline]);

      // Assert
      expect(BatchWriteCommand).toHaveBeenCalledWith({
        RequestItems: {
          [tableName]: [
            {
              PutRequest: {
                Item: expect.objectContaining({
                  asset_id: 'batch-asset',
                  deadline_id: 'batch-dl',
                  amount: 2500,
                  currency: 'EUR',
                  metadata: { batchKey: 'value' },
                }),
              },
            },
          ],
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should propagate DynamoDB errors on getDeadline', async () => {
      // Arrange
      const error = new Error('DynamoDB GetItem failed');
      mockDocClient.send.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(store.getDeadline('asset', 'dl')).rejects.toThrow('DynamoDB GetItem failed');
    });

    it('should propagate DynamoDB errors on createDeadline', async () => {
      // Arrange
      const error = new Error('ConditionalCheckFailedException');
      mockDocClient.send.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(store.createDeadline(createTestDeadline())).rejects.toThrow('ConditionalCheckFailedException');
    });

    it('should propagate DynamoDB errors on updateDeadlineStatus', async () => {
      // Arrange
      const error = new Error('ValidationException');
      mockDocClient.send.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(store.updateDeadlineStatus('a', 'b', 'completed')).rejects.toThrow('ValidationException');
    });

    it('should propagate DynamoDB errors on batchCreateDeadlines', async () => {
      // Arrange
      const error = new Error('BatchWriteItem partial failure');
      mockDocClient.send.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(store.batchCreateDeadlines([createTestDeadline()])).rejects.toThrow('BatchWriteItem partial failure');
    });
  });

  // -------------------------------------------------------------------------
  // Custom Table Name
  // -------------------------------------------------------------------------

  describe('Custom Table Name', () => {
    it('should use provided table name', async () => {
      // Arrange
      const customStore = new DeadlineStore('custom-table');
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await customStore.getDeadlinesByAsset('asset-1');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'custom-table',
        })
      );
    });
  });
});

// ===========================================================================
// IP EVENT STORE TESTS
// ===========================================================================

describe('IPEventStore', () => {
  let eventStore: IPEventStore;
  const tableName = 'test-events-table';

  beforeEach(() => {
    vi.clearAllMocks();
    eventStore = new IPEventStore(tableName);
  });

  // -------------------------------------------------------------------------
  // appendEvent
  // -------------------------------------------------------------------------

  describe('appendEvent', () => {
    it('should append event with PutCommand', async () => {
      // Arrange
      const event = createTestIPEvent();
      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await eventStore.appendEvent(event);

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      expect(PutCommand).toHaveBeenCalledWith({
        TableName: tableName,
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
    });

    it('should map camelCase to snake_case fields', async () => {
      // Arrange
      const event = createTestIPEvent({
        aggregateId: 'tm-456',
        aggregateType: 'Trademark',
        eventType: 'Trademark.Registered',
        eventId: 'evt-tm-001',
      });

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await eventStore.appendEvent(event);

      // Assert
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            aggregate_id: 'tm-456',
            aggregate_type: 'Trademark',
            event_type: 'Trademark.Registered',
            event_id: 'evt-tm-001',
          }),
        })
      );
    });

    it('should handle event with TTL', async () => {
      // Arrange
      const event = createTestIPEvent({
        ttl: 1735689600,
      });

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await eventStore.appendEvent(event);

      // Assert
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            ttl: 1735689600,
          }),
        })
      );
    });

    it('should handle event without metadata', async () => {
      // Arrange
      const event: IPEvent = {
        eventId: 'evt-minimal',
        aggregateType: 'Patent',
        aggregateId: 'patent-minimal',
        eventType: 'Patent.Created',
        occurredAt: '2024-01-01T00:00:00.000Z',
        version: 1,
        payload: {},
      };

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await eventStore.appendEvent(event);

      // Assert
      expect(PutCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            metadata: undefined,
            ttl: undefined,
          }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getEventsByAggregate
  // -------------------------------------------------------------------------

  describe('getEventsByAggregate', () => {
    it('should query events by aggregateId', async () => {
      // Arrange
      const events = [
        createTestIPEvent({ version: 1, eventType: 'Patent.Created' }),
        createTestIPEvent({ version: 2, eventType: 'Patent.Filed' }),
        createTestIPEvent({ version: 3, eventType: 'Patent.Granted' }),
      ];

      mockDocClient.send.mockResolvedValueOnce({
        Items: events.map(createDynamoDBEventItem),
      });

      // Act
      const result = await eventStore.getEventsByAggregate('patent-123');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: tableName,
        KeyConditionExpression: 'aggregate_id = :aggregateId',
        ExpressionAttributeValues: {
          ':aggregateId': 'patent-123',
        },
        ScanIndexForward: true,
        Limit: 1000,
      });

      expect(result).toHaveLength(3);
    });

    it('should filter by afterVersion', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({
        Items: [createDynamoDBEventItem(createTestIPEvent({ version: 5 }))],
      });

      // Act
      await eventStore.getEventsByAggregate('patent-123', { afterVersion: 3 });

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyConditionExpression: 'aggregate_id = :aggregateId AND version > :afterVersion',
          ExpressionAttributeValues: {
            ':aggregateId': 'patent-123',
            ':afterVersion': 3,
          },
        })
      );
    });

    it('should respect limit option', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await eventStore.getEventsByAggregate('patent-123', { limit: 50 });

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 50,
        })
      );
    });

    it('should default limit to 1000', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await eventStore.getEventsByAggregate('patent-123');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 1000,
        })
      );
    });

    it('should sort events by version ascending (oldest first)', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await eventStore.getEventsByAggregate('patent-123');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ScanIndexForward: true,
        })
      );
    });

    it('should correctly map snake_case to camelCase in response', async () => {
      // Arrange
      const dynamoItem = {
        aggregate_id: 'patent-map',
        event_id: 'evt-map-001',
        aggregate_type: 'Patent',
        event_type: 'Patent.Assigned',
        occurred_at: '2024-05-01T00:00:00.000Z',
        version: 5,
        payload: { newAssigneeId: 'entity-789' },
        metadata: { correlationId: 'corr-map', userId: 'user-2' },
        ttl: 1735689600,
      };

      mockDocClient.send.mockResolvedValueOnce({ Items: [dynamoItem] });

      // Act
      const result = await eventStore.getEventsByAggregate('patent-map');

      // Assert
      expect(result[0]).toEqual({
        eventId: 'evt-map-001',
        aggregateType: 'Patent',
        aggregateId: 'patent-map',
        eventType: 'Patent.Assigned',
        occurredAt: '2024-05-01T00:00:00.000Z',
        version: 5,
        payload: { newAssigneeId: 'entity-789' },
        metadata: { correlationId: 'corr-map', userId: 'user-2' },
        ttl: 1735689600,
      });
    });

    it('should handle afterVersion of 0', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await eventStore.getEventsByAggregate('patent-123', { afterVersion: 0 });

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyConditionExpression: 'aggregate_id = :aggregateId AND version > :afterVersion',
          ExpressionAttributeValues: expect.objectContaining({
            ':afterVersion': 0,
          }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getEventsByType (GSI Query)
  // -------------------------------------------------------------------------

  describe('getEventsByType', () => {
    it('should query events by type using GSI', async () => {
      // Arrange
      const filedEvents = [
        createTestIPEvent({ aggregateId: 'patent-1', eventType: 'Patent.Filed' }),
        createTestIPEvent({ aggregateId: 'patent-2', eventType: 'Patent.Filed' }),
      ];

      mockDocClient.send.mockResolvedValueOnce({
        Items: filedEvents.map(createDynamoDBEventItem),
      });

      // Act
      const result = await eventStore.getEventsByType('Patent.Filed');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: tableName,
        IndexName: 'event-type-index',
        KeyConditionExpression: 'event_type = :eventType',
        ExpressionAttributeValues: { ':eventType': 'Patent.Filed' },
        ScanIndexForward: false,
        Limit: 100,
      });

      expect(result).toHaveLength(2);
      expect(result.every(e => e.eventType === 'Patent.Filed')).toBe(true);
    });

    it('should filter by after date', async () => {
      // Arrange
      const afterDate = new Date('2024-03-01T00:00:00.000Z');

      mockDocClient.send.mockResolvedValueOnce({
        Items: [createDynamoDBEventItem(createTestIPEvent())],
      });

      // Act
      await eventStore.getEventsByType('Patent.Granted', { after: afterDate });

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyConditionExpression: 'event_type = :eventType AND occurred_at > :after',
          ExpressionAttributeValues: {
            ':eventType': 'Patent.Granted',
            ':after': afterDate.toISOString(),
          },
        })
      );
    });

    it('should respect limit option', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await eventStore.getEventsByType('Trademark.Registered', { limit: 25 });

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 25,
        })
      );
    });

    it('should default limit to 100', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await eventStore.getEventsByType('Patent.Created');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Limit: 100,
        })
      );
    });

    it('should sort events by occurredAt descending (most recent first)', async () => {
      // Arrange
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await eventStore.getEventsByType('Patent.Filed');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ScanIndexForward: false,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // batchAppendEvents
  // -------------------------------------------------------------------------

  describe('batchAppendEvents', () => {
    it('should append multiple events in a single batch', async () => {
      // Arrange
      const events = [
        createTestIPEvent({ eventId: 'evt-001', version: 1 }),
        createTestIPEvent({ eventId: 'evt-002', version: 2 }),
        createTestIPEvent({ eventId: 'evt-003', version: 3 }),
      ];

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await eventStore.batchAppendEvents(events);

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
      expect(BatchWriteCommand).toHaveBeenCalledWith({
        RequestItems: {
          [tableName]: expect.arrayContaining([
            expect.objectContaining({
              PutRequest: expect.objectContaining({
                Item: expect.objectContaining({
                  event_id: 'evt-001',
                }),
              }),
            }),
            expect.objectContaining({
              PutRequest: expect.objectContaining({
                Item: expect.objectContaining({
                  event_id: 'evt-002',
                }),
              }),
            }),
            expect.objectContaining({
              PutRequest: expect.objectContaining({
                Item: expect.objectContaining({
                  event_id: 'evt-003',
                }),
              }),
            }),
          ]),
        },
      });
    });

    it('should chunk batches into groups of 25 items', async () => {
      // Arrange
      const events = Array.from({ length: 55 }, (_, i) =>
        createTestIPEvent({
          eventId: `evt-${i.toString().padStart(3, '0')}`,
          version: i + 1,
        })
      );

      mockDocClient.send
        .mockResolvedValueOnce({}) // First batch (25)
        .mockResolvedValueOnce({}) // Second batch (25)
        .mockResolvedValueOnce({}); // Third batch (5)

      // Act
      await eventStore.batchAppendEvents(events);

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(3);

      // Verify first batch has 25 items
      const firstCall = (BatchWriteCommand as Mock).mock.calls[0][0];
      expect(firstCall.RequestItems[tableName]).toHaveLength(25);

      // Verify second batch has 25 items
      const secondCall = (BatchWriteCommand as Mock).mock.calls[1][0];
      expect(secondCall.RequestItems[tableName]).toHaveLength(25);

      // Verify third batch has 5 items
      const thirdCall = (BatchWriteCommand as Mock).mock.calls[2][0];
      expect(thirdCall.RequestItems[tableName]).toHaveLength(5);
    });

    it('should handle exactly 25 events in a single batch', async () => {
      // Arrange
      const events = Array.from({ length: 25 }, (_, i) =>
        createTestIPEvent({ eventId: `evt-${i}`, version: i + 1 })
      );

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await eventStore.batchAppendEvents(events);

      // Assert
      expect(mockDocClient.send).toHaveBeenCalledTimes(1);
    });

    it('should handle empty array', async () => {
      // Arrange & Act
      await eventStore.batchAppendEvents([]);

      // Assert
      expect(mockDocClient.send).not.toHaveBeenCalled();
    });

    it('should map all event fields correctly in batch', async () => {
      // Arrange
      const event = createTestIPEvent({
        eventId: 'batch-evt',
        aggregateId: 'batch-agg',
        aggregateType: 'Trademark',
        eventType: 'Trademark.Filed',
        occurredAt: '2024-06-01T00:00:00.000Z',
        version: 1,
        payload: { applicationNumber: 'TM-2024-001' },
        metadata: { correlationId: 'batch-corr', tenantId: 'tenant-1' },
        ttl: 1735689600,
      });

      mockDocClient.send.mockResolvedValueOnce({});

      // Act
      await eventStore.batchAppendEvents([event]);

      // Assert
      expect(BatchWriteCommand).toHaveBeenCalledWith({
        RequestItems: {
          [tableName]: [
            {
              PutRequest: {
                Item: {
                  aggregate_id: 'batch-agg',
                  event_id: 'batch-evt',
                  aggregate_type: 'Trademark',
                  event_type: 'Trademark.Filed',
                  occurred_at: '2024-06-01T00:00:00.000Z',
                  version: 1,
                  payload: { applicationNumber: 'TM-2024-001' },
                  metadata: { correlationId: 'batch-corr', tenantId: 'tenant-1' },
                  ttl: 1735689600,
                },
              },
            },
          ],
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should propagate DynamoDB errors on appendEvent', async () => {
      // Arrange
      const error = new Error('DynamoDB PutItem failed');
      mockDocClient.send.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(eventStore.appendEvent(createTestIPEvent())).rejects.toThrow('DynamoDB PutItem failed');
    });

    it('should propagate DynamoDB errors on getEventsByAggregate', async () => {
      // Arrange
      const error = new Error('Query failed');
      mockDocClient.send.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(eventStore.getEventsByAggregate('agg-1')).rejects.toThrow('Query failed');
    });

    it('should propagate DynamoDB errors on getEventsByType', async () => {
      // Arrange
      const error = new Error('GSI Query failed');
      mockDocClient.send.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(eventStore.getEventsByType('EventType')).rejects.toThrow('GSI Query failed');
    });

    it('should propagate DynamoDB errors on batchAppendEvents', async () => {
      // Arrange
      const error = new Error('BatchWriteItem failed');
      mockDocClient.send.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(eventStore.batchAppendEvents([createTestIPEvent()])).rejects.toThrow('BatchWriteItem failed');
    });
  });

  // -------------------------------------------------------------------------
  // Custom Table Name
  // -------------------------------------------------------------------------

  describe('Custom Table Name', () => {
    it('should use provided table name', async () => {
      // Arrange
      const customStore = new IPEventStore('custom-events-table');
      mockDocClient.send.mockResolvedValueOnce({ Items: [] });

      // Act
      await customStore.getEventsByAggregate('agg-1');

      // Assert
      expect(QueryCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'custom-events-table',
        })
      );
    });
  });
});
