/**
 * EventBridge Publisher Integration Tests
 *
 * Comprehensive tests for EventBridgePublisher class covering:
 * - Single event publishing
 * - Batch publishing with chunking (max 10 per call)
 * - Error handling when EventBridge fails
 * - Partial failures in batch operations
 * - All domain-specific publish methods
 * - Event structure validation (DetailType, Source, Detail JSON)
 * - Resource ARN construction
 *
 * @module test/integration/aws
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  PutEventsCommandOutput,
  PutEventsResultEntry,
} from '@aws-sdk/client-eventbridge';

// Use vi.hoisted to create mock functions that are available before imports
const { mockSend, MockPutEventsCommand } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const MockPutEventsCommand = vi.fn();
  return { mockSend, MockPutEventsCommand };
});

// Mock the AWS SDK
vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutEventsCommand: MockPutEventsCommand.mockImplementation((input: unknown) => input),
}));

// Mock the config module
vi.mock('../../../src/infrastructure/aws/config.js', () => ({
  awsConfig: {
    region: 'us-east-1',
    accountId: '123456789012',
    environment: 'test',
    eventBridge: {
      eventBusName: 'intellectual-property-test-events',
      eventBusArn: 'arn:aws:events:us-east-1:123456789012:event-bus/intellectual-property-test-events',
    },
  },
}));

// Import after mocking
import {
  EventBridgePublisher,
  type DomainEvent,
} from '../../../src/infrastructure/aws/eventbridge-publisher.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a successful PutEventsCommandOutput.
 */
function createSuccessResponse(count: number): PutEventsCommandOutput {
  const entries: PutEventsResultEntry[] = [];
  for (let i = 0; i < count; i++) {
    entries.push({ EventId: `event-id-${i}` });
  }
  return {
    $metadata: {},
    Entries: entries,
    FailedEntryCount: 0,
  };
}

/**
 * Create a partial failure PutEventsCommandOutput.
 */
function createPartialFailureResponse(
  successIndices: number[],
  failureIndices: number[],
  errorCode: string = 'ThrottlingException',
  errorMessage: string = 'Rate exceeded'
): PutEventsCommandOutput {
  const totalCount = successIndices.length + failureIndices.length;
  const entries: PutEventsResultEntry[] = [];

  for (let i = 0; i < totalCount; i++) {
    if (failureIndices.includes(i)) {
      entries.push({
        ErrorCode: errorCode,
        ErrorMessage: errorMessage,
      });
    } else {
      entries.push({ EventId: `event-id-${i}` });
    }
  }

  return {
    $metadata: {},
    Entries: entries,
    FailedEntryCount: failureIndices.length,
  };
}

/**
 * Create a test domain event.
 */
function createTestEvent(overrides?: Partial<DomainEvent>): DomainEvent {
  return {
    type: 'Patent.Filed',
    aggregateType: 'Patent',
    aggregateId: 'patent-123',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    payload: {
      patentNumber: 'US12345678',
      title: 'Test Patent',
      jurisdiction: 'US',
    },
    metadata: {
      correlationId: 'corr-123',
      causationId: 'cause-456',
      userId: 'user-789',
      tenantId: 'tenant-abc',
    },
    ...overrides,
  };
}

/**
 * Create multiple test events.
 */
function createTestEvents(count: number): DomainEvent[] {
  const events: DomainEvent[] = [];
  for (let i = 0; i < count; i++) {
    events.push(createTestEvent({
      aggregateId: `patent-${i}`,
      payload: {
        patentNumber: `US${10000000 + i}`,
        title: `Test Patent ${i}`,
        index: i,
      },
    }));
  }
  return events;
}

/**
 * Get the last command input passed to PutEventsCommand.
 */
function getLastCommandInput() {
  const calls = MockPutEventsCommand.mock.calls;
  return calls[calls.length - 1]?.[0];
}

/**
 * Get all command inputs passed to PutEventsCommand.
 */
function getAllCommandInputs() {
  return MockPutEventsCommand.mock.calls.map((call: unknown[]) => call[0]);
}

// ============================================================================
// Single Event Publishing Tests
// ============================================================================

describe('EventBridgePublisher', () => {
  let publisher: EventBridgePublisher;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to default success response
    mockSend.mockReset();
    mockSend.mockResolvedValue(createSuccessResponse(1));
    // Create a new publisher instance
    publisher = new EventBridgePublisher('test-event-bus');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('publish (single event)', () => {
    it('should publish a single event successfully', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent();
      const result = await publisher.publish(event);

      expect(result).toBe(event.aggregateId);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(MockPutEventsCommand).toHaveBeenCalledTimes(1);
    });

    it('should construct event entry with correct structure', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent();
      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries).toHaveLength(1);

      const entry = commandInput.Entries[0];
      expect(entry.EventBusName).toBe('test-event-bus');
      expect(entry.Source).toBe('intellectual-property');
      expect(entry.DetailType).toBe('Patent.Filed');
      expect(entry.Time).toEqual(event.timestamp);
    });

    it('should include payload and metadata in Detail JSON', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent();
      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];
      const detail = JSON.parse(entry.Detail);

      expect(detail.aggregateType).toBe('Patent');
      expect(detail.aggregateId).toBe('patent-123');
      expect(detail.patentNumber).toBe('US12345678');
      expect(detail.title).toBe('Test Patent');
      expect(detail.metadata).toEqual({
        correlationId: 'corr-123',
        causationId: 'cause-456',
        userId: 'user-789',
        tenantId: 'tenant-abc',
      });
    });

    it('should construct correct resource ARN', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent();
      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.Resources).toEqual([
        'arn:aws:intellectual-property:us-east-1:123456789012:Patent/patent-123',
      ]);
    });

    it('should throw error when EventBridge returns failure', async () => {
      mockSend.mockResolvedValueOnce(createPartialFailureResponse([], [0], 'ValidationError', 'Invalid event'));

      const event = createTestEvent();

      await expect(publisher.publish(event)).rejects.toThrow('Failed to publish event: Invalid event');
    });

    it('should throw error when EventBridge client throws', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      const event = createTestEvent();

      await expect(publisher.publish(event)).rejects.toThrow('Failed to publish event: Network error');
    });

    it('should handle event without metadata', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent();
      delete event.metadata;

      const result = await publisher.publish(event);

      expect(result).toBe(event.aggregateId);

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];
      const detail = JSON.parse(entry.Detail);

      expect(detail.metadata).toBeUndefined();
    });
  });

  // ============================================================================
  // Batch Publishing Tests
  // ============================================================================

  describe('publishBatch', () => {
    it('should publish all events in a single batch when count <= 10', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(5));

      const events = createTestEvents(5);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(5);
      expect(result.failedCount).toBe(0);
      expect(result.failedEvents).toHaveLength(0);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should publish exactly 10 events in a single batch', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(10));

      const events = createTestEvents(10);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(10);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries).toHaveLength(10);
    });

    it('should chunk 25 events into 3 batches (10, 10, 5)', async () => {
      mockSend
        .mockResolvedValueOnce(createSuccessResponse(10))
        .mockResolvedValueOnce(createSuccessResponse(10))
        .mockResolvedValueOnce(createSuccessResponse(5));

      const events = createTestEvents(25);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(25);
      expect(result.failedCount).toBe(0);
      expect(mockSend).toHaveBeenCalledTimes(3);

      // Verify batch sizes
      const allInputs = getAllCommandInputs();
      expect(allInputs[0].Entries).toHaveLength(10);
      expect(allInputs[1].Entries).toHaveLength(10);
      expect(allInputs[2].Entries).toHaveLength(5);
    });

    it('should chunk 100 events into 10 batches of 10', async () => {
      for (let i = 0; i < 10; i++) {
        mockSend.mockResolvedValueOnce(createSuccessResponse(10));
      }

      const events = createTestEvents(100);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(100);
      expect(result.failedCount).toBe(0);
      expect(mockSend).toHaveBeenCalledTimes(10);
    });

    it('should handle empty event array', async () => {
      const result = await publisher.publishBatch([]);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.failedEvents).toHaveLength(0);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle single event in batch', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const events = createTestEvents(1);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should preserve event order in batches', async () => {
      mockSend
        .mockResolvedValueOnce(createSuccessResponse(10))
        .mockResolvedValueOnce(createSuccessResponse(5));

      const events = createTestEvents(15);
      await publisher.publishBatch(events);

      const allInputs = getAllCommandInputs();

      // Check first batch
      const firstBatchEntries = allInputs[0].Entries;
      for (let i = 0; i < 10; i++) {
        const detail = JSON.parse(firstBatchEntries[i].Detail);
        expect(detail.index).toBe(i);
      }

      // Check second batch
      const secondBatchEntries = allInputs[1].Entries;
      for (let i = 0; i < 5; i++) {
        const detail = JSON.parse(secondBatchEntries[i].Detail);
        expect(detail.index).toBe(10 + i);
      }
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle partial failures in a batch', async () => {
      // 3 successes, 2 failures
      mockSend.mockResolvedValueOnce(
        createPartialFailureResponse([0, 2, 4], [1, 3], 'ThrottlingException', 'Rate exceeded')
      );

      const events = createTestEvents(5);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(2);
      expect(result.failedEvents).toHaveLength(2);

      // Verify failed event details
      expect(result.failedEvents[0].event.aggregateId).toBe('patent-1');
      expect(result.failedEvents[0].errorCode).toBe('ThrottlingException');
      expect(result.failedEvents[0].errorMessage).toBe('Rate exceeded');

      expect(result.failedEvents[1].event.aggregateId).toBe('patent-3');
    });

    it('should handle complete batch failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Service unavailable'));

      const events = createTestEvents(5);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(5);
      expect(result.failedEvents).toHaveLength(5);

      // All events should have BATCH_FAILED error code
      result.failedEvents.forEach((failure, index) => {
        expect(failure.errorCode).toBe('BATCH_FAILED');
        expect(failure.errorMessage).toBe('Service unavailable');
        expect(failure.event.aggregateId).toBe(`patent-${index}`);
      });
    });

    it('should handle failures in some batches but not others', async () => {
      // First batch succeeds, second batch fails completely, third batch succeeds
      mockSend
        .mockResolvedValueOnce(createSuccessResponse(10))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(createSuccessResponse(5));

      const events = createTestEvents(25);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(15); // 10 + 0 + 5
      expect(result.failedCount).toBe(10); // 0 + 10 + 0
      expect(result.failedEvents).toHaveLength(10);

      // Verify failed events are from the second batch (indices 10-19)
      result.failedEvents.forEach((failure, index) => {
        expect(failure.event.aggregateId).toBe(`patent-${10 + index}`);
        expect(failure.errorCode).toBe('BATCH_FAILED');
      });
    });

    it('should handle partial failures across multiple batches', async () => {
      // First batch: 8 success, 2 fail
      // Second batch: all 5 succeed
      mockSend
        .mockResolvedValueOnce(createPartialFailureResponse([0, 1, 2, 3, 4, 5, 6, 7], [8, 9]))
        .mockResolvedValueOnce(createSuccessResponse(5));

      const events = createTestEvents(15);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(13);
      expect(result.failedCount).toBe(2);
      expect(result.failedEvents).toHaveLength(2);
    });

    it('should handle unknown error message gracefully', async () => {
      mockSend.mockResolvedValueOnce({
        $metadata: {},
        Entries: [{ ErrorCode: 'UnknownError' }],
        FailedEntryCount: 1,
      });

      const events = createTestEvents(1);
      const result = await publisher.publishBatch(events);

      expect(result.failedCount).toBe(1);
      expect(result.failedEvents[0].errorMessage).toBe('Unknown error');
    });

    it('should handle non-Error thrown exceptions', async () => {
      mockSend.mockRejectedValueOnce('string error');

      const events = createTestEvents(3);
      const result = await publisher.publishBatch(events);

      expect(result.failedCount).toBe(3);
      result.failedEvents.forEach(failure => {
        expect(failure.errorMessage).toBe('Unknown error');
      });
    });
  });

  // ============================================================================
  // Domain-Specific Publish Methods Tests
  // ============================================================================

  describe('publishPatentEvent', () => {
    it('should publish patent event with correct structure', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const result = await publisher.publishPatentEvent(
        'Patent.Filed',
        'patent-abc',
        {
          patentNumber: 'US12345678',
          title: 'Novel Invention',
          filingDate: new Date('2024-01-15'),
        },
        { correlationId: 'corr-1', userId: 'user-1' }
      );

      expect(result).toBe('patent-abc');

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.DetailType).toBe('Patent.Filed');
      expect(entry.Resources).toContain('arn:aws:intellectual-property:us-east-1:123456789012:Patent/patent-abc');

      const detail = JSON.parse(entry.Detail);
      expect(detail.aggregateType).toBe('Patent');
      expect(detail.aggregateId).toBe('patent-abc');
      expect(detail.patentNumber).toBe('US12345678');
    });

    it('should publish Patent.Granted event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishPatentEvent(
        'Patent.Granted',
        'patent-granted-1',
        { grantDate: new Date('2024-06-15'), claims: 20 }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('Patent.Granted');
    });

    it('should publish Patent.Expired event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishPatentEvent(
        'Patent.Expired',
        'patent-expired-1',
        { expirationDate: new Date('2024-12-31'), reason: 'term-end' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('Patent.Expired');
    });

    it('should publish Patent.Abandoned event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishPatentEvent(
        'Patent.Abandoned',
        'patent-abandoned-1',
        { abandonmentDate: new Date('2024-06-01'), reason: 'non-payment' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('Patent.Abandoned');
    });
  });

  describe('publishTrademarkEvent', () => {
    it('should publish trademark event with correct structure', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const result = await publisher.publishTrademarkEvent(
        'Trademark.Registered',
        'tm-123',
        {
          mark: 'ACME',
          registrationNumber: 'TM1234567',
          registrationDate: new Date('2024-02-20'),
        },
        { tenantId: 'tenant-1' }
      );

      expect(result).toBe('tm-123');

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.DetailType).toBe('Trademark.Registered');

      const detail = JSON.parse(entry.Detail);
      expect(detail.aggregateType).toBe('Trademark');
      expect(detail.mark).toBe('ACME');
    });

    it('should publish Trademark.RenewalDue event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTrademarkEvent(
        'Trademark.RenewalDue',
        'tm-456',
        { dueDate: new Date('2024-08-15'), daysUntilDue: 30 }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('Trademark.RenewalDue');
    });

    it('should publish Trademark.OppositionFiled event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTrademarkEvent(
        'Trademark.OppositionFiled',
        'tm-opposition-1',
        { opposer: 'Competitor Inc', filingDate: new Date('2024-03-15') }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('Trademark.OppositionFiled');
    });

    it('should publish Trademark.Cancelled event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTrademarkEvent(
        'Trademark.Cancelled',
        'tm-cancelled-1',
        { cancellationDate: new Date('2024-04-01'), reason: 'non-use' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('Trademark.Cancelled');
    });
  });

  describe('publishTradeSecretEvent', () => {
    it('should publish trade secret event with correct structure', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const result = await publisher.publishTradeSecretEvent(
        'TradeSecret.Created',
        'ts-001',
        {
          name: 'Secret Formula',
          classification: 'highly-confidential',
          custodian: 'user-123',
        }
      );

      expect(result).toBe('ts-001');

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.DetailType).toBe('TradeSecret.Created');

      const detail = JSON.parse(entry.Detail);
      expect(detail.aggregateType).toBe('TradeSecret');
      expect(detail.classification).toBe('highly-confidential');
    });

    it('should publish TradeSecret.Compromised event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTradeSecretEvent(
        'TradeSecret.Compromised',
        'ts-compromised',
        { detectedAt: new Date(), severity: 'critical' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('TradeSecret.Compromised');
    });

    it('should publish TradeSecret.ProtectionUpdated event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTradeSecretEvent(
        'TradeSecret.ProtectionUpdated',
        'ts-protected',
        { newClassification: 'top-secret', reason: 'annual-review' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('TradeSecret.ProtectionUpdated');
    });

    it('should publish TradeSecret.Disclosed event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTradeSecretEvent(
        'TradeSecret.Disclosed',
        'ts-disclosed',
        { disclosedTo: 'Partner Corp', ndaReference: 'NDA-2024-001' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('TradeSecret.Disclosed');
    });
  });

  describe('publishDomainNameEvent', () => {
    it('should publish domain name event with correct structure', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const result = await publisher.publishDomainNameEvent(
        'DomainName.Registered',
        'domain-1',
        {
          domainName: 'example.com',
          registrar: 'Registrar Inc',
          expirationDate: new Date('2025-01-15'),
        }
      );

      expect(result).toBe('domain-1');

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.DetailType).toBe('DomainName.Registered');

      const detail = JSON.parse(entry.Detail);
      expect(detail.aggregateType).toBe('DomainName');
      expect(detail.domainName).toBe('example.com');
    });

    it('should publish DomainDispute.Filed event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishDomainNameEvent(
        'DomainDispute.Filed',
        'dispute-1',
        { respondent: 'Bad Actor', forum: 'WIPO' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('DomainDispute.Filed');
    });

    it('should publish DomainName.TransferInitiated event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishDomainNameEvent(
        'DomainName.TransferInitiated',
        'domain-transfer',
        { targetRegistrar: 'New Registrar Inc', authCode: 'masked' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('DomainName.TransferInitiated');
    });

    it('should publish DomainDispute.Decided event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishDomainNameEvent(
        'DomainDispute.Decided',
        'dispute-decided',
        { outcome: 'transfer', decisionDate: new Date('2024-05-15') }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('DomainDispute.Decided');
    });
  });

  describe('publishLicenseEvent', () => {
    it('should publish license event with correct structure', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const result = await publisher.publishLicenseEvent(
        'License.Executed',
        'license-001',
        {
          licenseType: 'exclusive',
          licensee: 'Partner Corp',
          territory: 'Worldwide',
          royaltyRate: 0.05,
        },
        { correlationId: 'deal-123' }
      );

      expect(result).toBe('license-001');

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.DetailType).toBe('License.Executed');

      const detail = JSON.parse(entry.Detail);
      expect(detail.aggregateType).toBe('License');
      expect(detail.licenseType).toBe('exclusive');
    });

    it('should publish License.RoyaltyDue event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishLicenseEvent(
        'License.RoyaltyDue',
        'license-royalty',
        { period: 'Q1-2024', amount: 50000, currency: 'USD' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('License.RoyaltyDue');
    });

    it('should publish License.Terminated event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishLicenseEvent(
        'License.Terminated',
        'license-terminated',
        { terminationDate: new Date('2024-06-30'), reason: 'breach' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('License.Terminated');
    });

    it('should publish License.Renewed event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishLicenseEvent(
        'License.Renewed',
        'license-renewed',
        { newEndDate: new Date('2027-12-31'), renewalTerm: '3 years' }
      );

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].DetailType).toBe('License.Renewed');
    });
  });

  // ============================================================================
  // Specialized Event Methods Tests
  // ============================================================================

  describe('publishMaintenanceFeeDue', () => {
    it('should publish maintenance fee due event with required fields', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const result = await publisher.publishMaintenanceFeeDue(
        'patent-maint-1',
        {
          patentNumber: 'US12345678',
          feeWindow: '3.5-year',
          dueDate: new Date('2024-06-15'),
          amount: 1600,
          currency: 'USD',
          jurisdiction: 'US',
        }
      );

      expect(result).toBe('patent-maint-1');

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.DetailType).toBe('Patent.MaintenanceFeeDue');

      const detail = JSON.parse(entry.Detail);
      expect(detail.aggregateType).toBe('Patent');
      expect(detail.patentNumber).toBe('US12345678');
      expect(detail.feeWindow).toBe('3.5-year');
      expect(detail.amount).toBe(1600);
      expect(detail.currency).toBe('USD');
      expect(detail.jurisdiction).toBe('US');
    });

    it('should include metadata when provided', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishMaintenanceFeeDue(
        'patent-maint-2',
        {
          patentNumber: 'US87654321',
          feeWindow: '7.5-year',
          dueDate: new Date('2024-09-01'),
          amount: 3600,
          currency: 'USD',
          jurisdiction: 'US',
        },
        { correlationId: 'reminder-batch-123', userId: 'system' }
      );

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);

      expect(detail.metadata.correlationId).toBe('reminder-batch-123');
      expect(detail.metadata.userId).toBe('system');
    });

    it('should handle different fee windows', async () => {
      const feeWindows = ['3.5-year', '7.5-year', '11.5-year'];

      for (const feeWindow of feeWindows) {
        vi.clearAllMocks();
        mockSend.mockResolvedValueOnce(createSuccessResponse(1));

        await publisher.publishMaintenanceFeeDue(
          `patent-${feeWindow}`,
          {
            patentNumber: 'US11111111',
            feeWindow,
            dueDate: new Date('2024-06-15'),
            amount: 1600,
            currency: 'USD',
            jurisdiction: 'US',
          }
        );

        const commandInput = getLastCommandInput();
        const detail = JSON.parse(commandInput.Entries[0].Detail);
        expect(detail.feeWindow).toBe(feeWindow);
      }
    });
  });

  describe('publishTradeSecretAccessed', () => {
    it('should publish trade secret accessed event with audit details', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const accessedAt = new Date('2024-03-15T14:30:00Z');

      const result = await publisher.publishTradeSecretAccessed(
        'ts-audit-1',
        {
          tradeSecretName: 'Secret Formula X',
          accessedBy: 'user-analyst-1',
          accessedAt,
          purpose: 'R&D review',
          accessLevel: 'view',
          ipAddress: '192.168.1.100',
        }
      );

      expect(result).toBe('ts-audit-1');

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.DetailType).toBe('TradeSecret.Accessed');

      const detail = JSON.parse(entry.Detail);
      expect(detail.aggregateType).toBe('TradeSecret');
      expect(detail.tradeSecretName).toBe('Secret Formula X');
      expect(detail.accessedBy).toBe('user-analyst-1');
      expect(detail.purpose).toBe('R&D review');
      expect(detail.accessLevel).toBe('view');
      expect(detail.ipAddress).toBe('192.168.1.100');
    });

    it('should handle view access level', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTradeSecretAccessed(
        'ts-view',
        {
          tradeSecretName: 'Document',
          accessedBy: 'user-1',
          accessedAt: new Date(),
          purpose: 'Review',
          accessLevel: 'view',
        }
      );

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);
      expect(detail.accessLevel).toBe('view');
    });

    it('should handle export access level', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTradeSecretAccessed(
        'ts-export',
        {
          tradeSecretName: 'Customer List',
          accessedBy: 'user-sales-1',
          accessedAt: new Date(),
          purpose: 'Sales planning',
          accessLevel: 'export',
        }
      );

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);
      expect(detail.accessLevel).toBe('export');
    });

    it('should handle modify access level', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTradeSecretAccessed(
        'ts-modify',
        {
          tradeSecretName: 'Manufacturing Process',
          accessedBy: 'user-engineer-1',
          accessedAt: new Date(),
          purpose: 'Production modification',
          accessLevel: 'modify',
        }
      );

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);
      expect(detail.accessLevel).toBe('modify');
    });

    it('should work without optional ipAddress', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishTradeSecretAccessed(
        'ts-no-ip',
        {
          tradeSecretName: 'Document',
          accessedBy: 'user-1',
          accessedAt: new Date(),
          purpose: 'Review',
          accessLevel: 'view',
        }
      );

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);
      expect(detail.ipAddress).toBeUndefined();
    });
  });

  describe('publishDomainExpiring', () => {
    it('should publish domain expiring event with all fields', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const expirationDate = new Date('2024-04-30');

      const result = await publisher.publishDomainExpiring(
        'domain-exp-1',
        {
          domainName: 'brand.com',
          expirationDate,
          daysUntilExpiration: 30,
          registrar: 'GoDaddy',
          linkedTrademark: 'tm-brand-1',
        }
      );

      expect(result).toBe('domain-exp-1');

      const commandInput = getLastCommandInput();
      const entry = commandInput.Entries[0];

      expect(entry.DetailType).toBe('DomainName.Expiring');

      const detail = JSON.parse(entry.Detail);
      expect(detail.aggregateType).toBe('DomainName');
      expect(detail.domainName).toBe('brand.com');
      expect(detail.daysUntilExpiration).toBe(30);
      expect(detail.registrar).toBe('GoDaddy');
      expect(detail.linkedTrademark).toBe('tm-brand-1');
    });

    it('should work without optional linkedTrademark', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishDomainExpiring(
        'domain-exp-2',
        {
          domainName: 'product.io',
          expirationDate: new Date('2024-05-15'),
          daysUntilExpiration: 45,
          registrar: 'Namecheap',
        }
      );

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);

      expect(detail.linkedTrademark).toBeUndefined();
    });

    it('should handle urgent expiration (7 days or less)', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publishDomainExpiring(
        'domain-urgent',
        {
          domainName: 'critical.com',
          expirationDate: new Date('2024-02-07'),
          daysUntilExpiration: 7,
          registrar: 'Registrar Inc',
        }
      );

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);
      expect(detail.daysUntilExpiration).toBe(7);
    });
  });

  // ============================================================================
  // Event Structure Validation Tests
  // ============================================================================

  describe('event structure validation', () => {
    it('should always set Source to intellectual-property', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent());

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Source).toBe('intellectual-property');
    });

    it('should use custom event bus name when provided', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const customPublisher = new EventBridgePublisher('custom-event-bus');
      await customPublisher.publish(createTestEvent());

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].EventBusName).toBe('custom-event-bus');
    });

    it('should use timestamp from event', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const specificTime = new Date('2024-07-04T12:00:00Z');
      const event = createTestEvent({ timestamp: specificTime });

      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Time).toEqual(specificTime);
    });

    it('should include all standard fields in Detail JSON', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent({
        type: 'Patent.Expired',
        aggregateType: 'Patent',
        aggregateId: 'patent-expired-1',
        payload: {
          patentNumber: 'US99999999',
          expirationReason: 'term-end',
        },
      });

      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);

      // Standard fields
      expect(detail.aggregateType).toBe('Patent');
      expect(detail.aggregateId).toBe('patent-expired-1');

      // Payload fields merged at top level
      expect(detail.patentNumber).toBe('US99999999');
      expect(detail.expirationReason).toBe('term-end');
    });

    it('should handle complex payload objects', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent({
        payload: {
          nested: {
            level1: {
              level2: 'deep value',
            },
          },
          array: [1, 2, 3],
          date: new Date('2024-01-01'),
        },
      });

      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);

      expect(detail.nested.level1.level2).toBe('deep value');
      expect(detail.array).toEqual([1, 2, 3]);
    });
  });

  // ============================================================================
  // Resource ARN Construction Tests
  // ============================================================================

  describe('resource ARN construction', () => {
    it('should construct ARN with correct region and account', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent({
        aggregateType: 'Patent',
        aggregateId: 'pat-123',
      }));

      const commandInput = getLastCommandInput();
      const resources = commandInput.Entries[0].Resources;

      expect(resources[0]).toMatch(/^arn:aws:intellectual-property:us-east-1:123456789012:/);
    });

    it('should include aggregate type and ID in resource ARN', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent({
        aggregateType: 'Trademark',
        aggregateId: 'tm-special-mark',
      }));

      const commandInput = getLastCommandInput();
      const resources = commandInput.Entries[0].Resources;

      expect(resources[0]).toContain('Trademark/tm-special-mark');
    });

    it('should construct correct ARNs for Patent aggregate type', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent({
        aggregateType: 'Patent',
        aggregateId: 'pat-1',
      }));

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Resources[0]).toBe(
        'arn:aws:intellectual-property:us-east-1:123456789012:Patent/pat-1'
      );
    });

    it('should construct correct ARNs for Trademark aggregate type', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent({
        aggregateType: 'Trademark',
        aggregateId: 'tm-1',
      }));

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Resources[0]).toBe(
        'arn:aws:intellectual-property:us-east-1:123456789012:Trademark/tm-1'
      );
    });

    it('should construct correct ARNs for TradeSecret aggregate type', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent({
        aggregateType: 'TradeSecret',
        aggregateId: 'ts-1',
      }));

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Resources[0]).toBe(
        'arn:aws:intellectual-property:us-east-1:123456789012:TradeSecret/ts-1'
      );
    });

    it('should construct correct ARNs for DomainName aggregate type', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent({
        aggregateType: 'DomainName',
        aggregateId: 'dom-1',
      }));

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Resources[0]).toBe(
        'arn:aws:intellectual-property:us-east-1:123456789012:DomainName/dom-1'
      );
    });

    it('should construct correct ARNs for License aggregate type', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent({
        aggregateType: 'License',
        aggregateId: 'lic-1',
      }));

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Resources[0]).toBe(
        'arn:aws:intellectual-property:us-east-1:123456789012:License/lic-1'
      );
    });

    it('should handle aggregate IDs with special characters', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await publisher.publish(createTestEvent({
        aggregateType: 'Patent',
        aggregateId: 'pat-abc-123-xyz',
      }));

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Resources[0]).toContain('Patent/pat-abc-123-xyz');
    });
  });

  // ============================================================================
  // Default Event Bus Name Tests
  // ============================================================================

  describe('default event bus configuration', () => {
    it('should use config event bus name when not provided', async () => {
      // Create publisher without explicit event bus name
      const defaultPublisher = new EventBridgePublisher();
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      await defaultPublisher.publish(createTestEvent());

      const commandInput = getLastCommandInput();
      // Should use the mocked config value
      expect(commandInput.Entries[0].EventBusName).toBe('intellectual-property-test-events');
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle events with empty payload', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent({ payload: {} });
      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);

      expect(detail.aggregateType).toBe('Patent');
      expect(detail.aggregateId).toBe('patent-123');
    });

    it('should handle batch with exactly 11 events (splits to 10 + 1)', async () => {
      mockSend
        .mockResolvedValueOnce(createSuccessResponse(10))
        .mockResolvedValueOnce(createSuccessResponse(1));

      const events = createTestEvents(11);
      const result = await publisher.publishBatch(events);

      expect(result.successCount).toBe(11);
      expect(mockSend).toHaveBeenCalledTimes(2);

      const allInputs = getAllCommandInputs();
      expect(allInputs[0].Entries).toHaveLength(10);
      expect(allInputs[1].Entries).toHaveLength(1);
    });

    it('should handle events with undefined optional metadata fields', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const event = createTestEvent({
        metadata: {
          correlationId: 'corr-1',
          // other fields undefined
        },
      });

      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      const detail = JSON.parse(commandInput.Entries[0].Detail);

      expect(detail.metadata.correlationId).toBe('corr-1');
      expect(detail.metadata.causationId).toBeUndefined();
    });

    it('should handle very long aggregate IDs', async () => {
      mockSend.mockResolvedValueOnce(createSuccessResponse(1));

      const longId = 'a'.repeat(200);
      const event = createTestEvent({ aggregateId: longId });

      await publisher.publish(event);

      const commandInput = getLastCommandInput();
      expect(commandInput.Entries[0].Resources[0]).toContain(longId);
    });
  });
});
