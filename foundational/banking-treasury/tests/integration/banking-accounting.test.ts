/**
 * Banking-Accounting Integration Tests
 *
 * End-to-end tests for the payment → GL posting event flow.
 *
 * @module tests/integration/banking-accounting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Mock event bus for testing event publishing and consumption.
 */
class MockEventBus {
  private handlers: Map<string, Array<(event: any) => Promise<void>>> = new Map();
  private publishedEvents: any[] = [];

  subscribe(eventType: string, handler: (event: any) => Promise<void>): void {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  async publish(event: any): Promise<void> {
    this.publishedEvents.push(event);

    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
  }

  getPublishedEvents(): any[] {
    return [...this.publishedEvents];
  }

  getEventsByType(type: string): any[] {
    return this.publishedEvents.filter(e => e.type === type);
  }

  clear(): void {
    this.publishedEvents = [];
  }
}

/**
 * Mock journal entry repository for testing.
 */
class MockJournalEntryRepository {
  private entries: Map<string, any> = new Map();
  private entriesBySource: Map<string, any> = new Map();

  async save(entry: any): Promise<any> {
    this.entries.set(entry.id, entry);
    if (entry.sourceDocument) {
      this.entriesBySource.set(`${entry.sourceDocument}:${entry.sourceDocumentType}`, entry);
    }
    return entry;
  }

  async findById(id: string): Promise<any | null> {
    return this.entries.get(id) ?? null;
  }

  async findBySourceDocument(sourceDocument: string, sourceDocumentType: string): Promise<any | null> {
    return this.entriesBySource.get(`${sourceDocument}:${sourceDocumentType}`) ?? null;
  }

  getAll(): any[] {
    return Array.from(this.entries.values());
  }

  clear(): void {
    this.entries.clear();
    this.entriesBySource.clear();
  }
}

/**
 * Mock account repository for testing.
 */
class MockAccountRepository {
  private accounts: Map<string, any> = new Map();

  constructor() {
    // Seed with default accounts
    this.accounts.set('tenant_1:1000', { id: 'acc_bank', code: '1000', name: 'Bank' });
    this.accounts.set('tenant_1:2000', { id: 'acc_ap', code: '2000', name: 'Accounts Payable' });
    this.accounts.set('tenant_1:1200', { id: 'acc_ar', code: '1200', name: 'Accounts Receivable' });
  }

  async findByCode(tenantId: string, accountCode: string): Promise<any | null> {
    return this.accounts.get(`${tenantId}:${accountCode}`) ?? null;
  }
}

/**
 * Mock posting service for testing.
 */
class MockPostingService {
  private journalEntryRepo: MockJournalEntryRepository;

  constructor(journalEntryRepo: MockJournalEntryRepository) {
    this.journalEntryRepo = journalEntryRepo;
  }

  async createAndPostEntry(params: {
    tenantId: string;
    entryDate: Date;
    description: string;
    currencyCode: string;
    sourceDocument: string;
    sourceDocumentType: string;
    lines: Array<{ accountId: string; entryType: string; amount: number; description: string }>;
    metadata: Record<string, unknown>;
    createdBy: string;
  }): Promise<any> {
    const entry = {
      id: uuidv4(),
      entryNumber: `JE-${Date.now()}`,
      tenantId: params.tenantId,
      entryDate: params.entryDate,
      description: params.description,
      currencyCode: params.currencyCode,
      sourceDocument: params.sourceDocument,
      sourceDocumentType: params.sourceDocumentType,
      lines: params.lines,
      metadata: params.metadata,
      status: 'POSTED',
      totalDebits: params.lines.filter(l => l.entryType === 'DEBIT').reduce((sum, l) => sum + l.amount, 0),
      totalCredits: params.lines.filter(l => l.entryType === 'CREDIT').reduce((sum, l) => sum + l.amount, 0),
      postedAt: new Date(),
      postedBy: params.createdBy,
      createdAt: new Date(),
    };

    await this.journalEntryRepo.save(entry);
    return entry;
  }

  async createReversal(params: {
    originalEntryId: string;
    reversalDate: Date;
    description: string;
    createdBy: string;
  }): Promise<any> {
    const original = await this.journalEntryRepo.findById(params.originalEntryId);
    if (!original) {
      throw new Error('Original entry not found');
    }

    const reversalEntry = {
      id: uuidv4(),
      entryNumber: `JE-REV-${Date.now()}`,
      tenantId: original.tenantId,
      entryDate: params.reversalDate,
      description: params.description,
      currencyCode: original.currencyCode,
      sourceDocument: original.sourceDocument,
      sourceDocumentType: 'reversal',
      reversalOfId: original.id,
      lines: original.lines.map((l: any) => ({
        ...l,
        entryType: l.entryType === 'DEBIT' ? 'CREDIT' : 'DEBIT',
      })),
      status: 'DRAFT',
      totalDebits: original.totalCredits,
      totalCredits: original.totalDebits,
      createdAt: new Date(),
    };

    await this.journalEntryRepo.save(reversalEntry);

    // Update original entry
    original.reversedById = reversalEntry.id;
    await this.journalEntryRepo.save(original);

    return reversalEntry;
  }
}

// =============================================================================
// BANKING EVENT HANDLER (Simplified for testing)
// =============================================================================

class BankingEventHandler {
  private postingService: MockPostingService;
  private accountRepo: MockAccountRepository;
  private journalEntryRepo: MockJournalEntryRepository;

  constructor(
    postingService: MockPostingService,
    accountRepo: MockAccountRepository,
    journalEntryRepo: MockJournalEntryRepository
  ) {
    this.postingService = postingService;
    this.accountRepo = accountRepo;
    this.journalEntryRepo = journalEntryRepo;
  }

  async handlePaymentCompleted(event: any): Promise<string> {
    const payload = event.payload;
    const tenantId = event.metadata?.tenantId ?? 'tenant_1';

    // Check idempotency
    const existing = await this.journalEntryRepo.findBySourceDocument(
      payload.transactionId,
      'banking_payment'
    );

    if (existing) {
      return existing.id;
    }

    // Get accounts
    const apAccount = await this.accountRepo.findByCode(tenantId, '2000');
    const bankAccount = await this.accountRepo.findByCode(tenantId, '1000');

    if (!apAccount || !bankAccount) {
      throw new Error('Required accounts not found');
    }

    // Create journal entry
    const entry = await this.postingService.createAndPostEntry({
      tenantId,
      entryDate: new Date(),
      description: `Payment: ${payload.externalReference ?? payload.transactionId}`,
      currencyCode: payload.currency,
      sourceDocument: payload.transactionId,
      sourceDocumentType: 'banking_payment',
      lines: [
        { accountId: apAccount.id, entryType: 'DEBIT', amount: payload.amount, description: 'Reduce AP' },
        { accountId: bankAccount.id, entryType: 'CREDIT', amount: payload.amount, description: 'Reduce Bank' },
      ],
      metadata: {
        bankingTransactionId: payload.transactionId,
        externalReference: payload.externalReference,
      },
      createdBy: 'banking-integration',
    });

    return entry.id;
  }

  async handlePaymentFailed(event: any): Promise<void> {
    const payload = event.payload;

    const existing = await this.journalEntryRepo.findBySourceDocument(
      payload.transactionId,
      'banking_payment'
    );

    if (!existing || existing.reversedById) {
      return;
    }

    await this.postingService.createReversal({
      originalEntryId: existing.id,
      reversalDate: new Date(),
      description: `Reversal: Payment failed - ${payload.failureReason}`,
      createdBy: 'banking-integration',
    });
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('Banking-Accounting Integration', () => {
  let eventBus: MockEventBus;
  let journalEntryRepo: MockJournalEntryRepository;
  let accountRepo: MockAccountRepository;
  let postingService: MockPostingService;
  let handler: BankingEventHandler;

  beforeEach(() => {
    eventBus = new MockEventBus();
    journalEntryRepo = new MockJournalEntryRepository();
    accountRepo = new MockAccountRepository();
    postingService = new MockPostingService(journalEntryRepo);
    handler = new BankingEventHandler(postingService, accountRepo, journalEntryRepo);

    // Register handlers
    eventBus.subscribe('payment.completed', (event) => handler.handlePaymentCompleted(event));
    eventBus.subscribe('payment.failed', (event) => handler.handlePaymentFailed(event));
  });

  afterEach(() => {
    eventBus.clear();
    journalEntryRepo.clear();
  });

  describe('payment.completed', () => {
    it('should create journal entry when payment is completed', async () => {
      const event = {
        id: uuidv4(),
        type: 'payment.completed',
        aggregateId: 'pay_123',
        aggregateType: 'Payment',
        payload: {
          transactionId: 'pay_123',
          amount: 5000,
          currency: 'USD',
          sourceAccountId: 'acct_456',
          externalReference: 'INV-2024-001',
        },
        metadata: {
          tenantId: 'tenant_1',
          correlationId: uuidv4(),
        },
        occurredAt: new Date(),
      };

      await eventBus.publish(event);

      const entries = journalEntryRepo.getAll();
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.status).toBe('POSTED');
      expect(entry.totalDebits).toBe(5000);
      expect(entry.totalCredits).toBe(5000);
      expect(entry.sourceDocument).toBe('pay_123');
      expect(entry.lines).toHaveLength(2);
    });

    it('should be idempotent - same event processed twice creates only one entry', async () => {
      const event = {
        id: uuidv4(),
        type: 'payment.completed',
        aggregateId: 'pay_456',
        aggregateType: 'Payment',
        payload: {
          transactionId: 'pay_456',
          amount: 3000,
          currency: 'USD',
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      // Process same event twice
      await eventBus.publish(event);
      await eventBus.publish(event);

      const entries = journalEntryRepo.getAll();
      expect(entries).toHaveLength(1);
    });

    it('should create balanced journal entry (debits = credits)', async () => {
      const event = {
        id: uuidv4(),
        type: 'payment.completed',
        aggregateId: 'pay_789',
        aggregateType: 'Payment',
        payload: {
          transactionId: 'pay_789',
          amount: 12500.50,
          currency: 'USD',
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      await eventBus.publish(event);

      const entries = journalEntryRepo.getAll();
      const entry = entries[0];

      expect(entry.totalDebits).toBe(entry.totalCredits);
    });
  });

  describe('payment.failed', () => {
    it('should create reversal entry when payment fails after GL posting', async () => {
      // First, complete a payment
      const completedEvent = {
        id: uuidv4(),
        type: 'payment.completed',
        aggregateId: 'pay_fail_1',
        aggregateType: 'Payment',
        payload: {
          transactionId: 'pay_fail_1',
          amount: 2000,
          currency: 'USD',
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      await eventBus.publish(completedEvent);

      // Then, fail the payment
      const failedEvent = {
        id: uuidv4(),
        type: 'payment.failed',
        aggregateId: 'pay_fail_1',
        aggregateType: 'Payment',
        payload: {
          transactionId: 'pay_fail_1',
          failureCode: 'INSUFFICIENT_FUNDS',
          failureReason: 'Account balance too low',
          retryable: true,
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      await eventBus.publish(failedEvent);

      const entries = journalEntryRepo.getAll();
      expect(entries).toHaveLength(2);

      const original = entries.find(e => e.sourceDocumentType === 'banking_payment');
      const reversal = entries.find(e => e.sourceDocumentType === 'reversal');

      expect(original).toBeDefined();
      expect(reversal).toBeDefined();
      expect(original!.reversedById).toBe(reversal!.id);
      expect(reversal!.reversalOfId).toBe(original!.id);
    });

    it('should not create reversal if no GL entry exists', async () => {
      const failedEvent = {
        id: uuidv4(),
        type: 'payment.failed',
        aggregateId: 'pay_never_posted',
        aggregateType: 'Payment',
        payload: {
          transactionId: 'pay_never_posted',
          failureCode: 'VALIDATION_ERROR',
          failureReason: 'Invalid account',
          retryable: false,
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      await eventBus.publish(failedEvent);

      const entries = journalEntryRepo.getAll();
      expect(entries).toHaveLength(0);
    });

    it('should not create duplicate reversal if payment fails twice', async () => {
      // Complete payment
      const completedEvent = {
        id: uuidv4(),
        type: 'payment.completed',
        aggregateId: 'pay_double_fail',
        aggregateType: 'Payment',
        payload: {
          transactionId: 'pay_double_fail',
          amount: 1000,
          currency: 'USD',
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      await eventBus.publish(completedEvent);

      // Fail twice
      const failedEvent = {
        id: uuidv4(),
        type: 'payment.failed',
        aggregateId: 'pay_double_fail',
        aggregateType: 'Payment',
        payload: {
          transactionId: 'pay_double_fail',
          failureCode: 'NETWORK_ERROR',
          failureReason: 'Connection timeout',
          retryable: true,
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      await eventBus.publish(failedEvent);
      await eventBus.publish(failedEvent);

      const entries = journalEntryRepo.getAll();
      expect(entries).toHaveLength(2); // Original + one reversal
    });
  });

  describe('end-to-end flow', () => {
    it('should handle complete payment lifecycle', async () => {
      const transactionId = uuidv4();

      // 1. Payment initiated (no GL impact yet)
      // 2. Payment completed - GL entry created
      const completedEvent = {
        id: uuidv4(),
        type: 'payment.completed',
        aggregateId: transactionId,
        aggregateType: 'Payment',
        payload: {
          transactionId,
          amount: 7500,
          currency: 'GBP',
          externalReference: 'SUPPLIER-INV-001',
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      await eventBus.publish(completedEvent);

      // Verify GL entry
      let entries = journalEntryRepo.getAll();
      expect(entries).toHaveLength(1);

      const originalEntry = entries[0];
      expect(originalEntry.totalDebits).toBe(7500);
      expect(originalEntry.currencyCode).toBe('GBP');

      // Simulate: Payment recalled
      const failedEvent = {
        id: uuidv4(),
        type: 'payment.failed',
        aggregateId: transactionId,
        aggregateType: 'Payment',
        payload: {
          transactionId,
          failureCode: 'RECALLED',
          failureReason: 'Payment recalled by payer',
          retryable: false,
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      };

      await eventBus.publish(failedEvent);

      // Verify reversal
      entries = journalEntryRepo.getAll();
      expect(entries).toHaveLength(2);

      const reversalEntry = entries.find(e => e.sourceDocumentType === 'reversal');
      expect(reversalEntry).toBeDefined();
      expect(reversalEntry!.totalDebits).toBe(7500);
      expect(reversalEntry!.totalCredits).toBe(7500);
    });

    it('should process multiple payments concurrently', async () => {
      const payments = Array.from({ length: 5 }, (_, i) => ({
        id: uuidv4(),
        type: 'payment.completed',
        aggregateId: `pay_concurrent_${i}`,
        aggregateType: 'Payment',
        payload: {
          transactionId: `pay_concurrent_${i}`,
          amount: 1000 * (i + 1),
          currency: 'USD',
        },
        metadata: { tenantId: 'tenant_1' },
        occurredAt: new Date(),
      }));

      // Process all concurrently
      await Promise.all(payments.map(p => eventBus.publish(p)));

      const entries = journalEntryRepo.getAll();
      expect(entries).toHaveLength(5);

      // Verify all entries are balanced
      for (const entry of entries) {
        expect(entry.totalDebits).toBe(entry.totalCredits);
      }
    });
  });
});
