/**
 * Test Setup
 *
 * Global test configuration and utilities.
 * Runs before all tests.
 *
 * @module test
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({
      send: vi.fn(),
    }),
  },
  PutCommand: vi.fn(),
  GetCommand: vi.fn(),
  QueryCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  BatchWriteCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ Entries: [{ EventId: 'test-event-id' }] }),
  })),
  PutEventsCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ MessageId: 'test-message-id' }),
  })),
  PublishCommand: vi.fn(),
  PublishBatchCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  CopyObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned-url.example.com'),
}));

// Global test hooks
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
  process.env.AWS_ACCOUNT_ID = '123456789012';
});

afterAll(() => {
  // Cleanup
  vi.clearAllMocks();
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});

/**
 * Test utilities
 */
export const testUtils = {
  /**
   * Create a mock date for consistent testing.
   */
  mockDate(date: Date): void {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  },

  /**
   * Restore real date.
   */
  restoreDate(): void {
    vi.useRealTimers();
  },

  /**
   * Wait for async operations to complete.
   */
  async flushPromises(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
  },

  /**
   * Create a UUID for testing.
   */
  uuid(): string {
    return 'test-uuid-' + Math.random().toString(36).substring(2, 9);
  },

  /**
   * Create a date N days from now.
   */
  daysFromNow(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  },

  /**
   * Create a date N years from a given date.
   */
  yearsFrom(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  },
};

/**
 * Custom matchers
 */
declare global {
  namespace Vi {
    interface Assertion {
      toBeValidUUID(): void;
      toBeWithinDays(expected: Date, days: number): void;
    }
  }
}

// Export for use in test files
export { vi };
