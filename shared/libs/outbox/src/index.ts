/**
 * @ecosystem/outbox
 * Transactional outbox pattern for reliable event publishing
 */

import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
import { eq, and, lt, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pino from 'pino';

const logger = pino({ name: 'outbox' });

// Outbox table schema
export const outboxTable = pgTable('outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
  aggregateId: uuid('aggregate_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  attempts: integer('attempts').default(0).notNull(),
  lastError: text('last_error'),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
});

// Idempotency table to track processed events
export const idempotencyTable = pgTable('idempotency', {
  key: varchar('key', { length: 255 }).primaryKey(),
  result: jsonb('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

export interface OutboxEvent {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    tenantId?: string;
  };
  idempotencyKey?: string;
}

export interface OutboxRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  processedAt: Date | null;
  attempts: number;
  lastError: string | null;
  idempotencyKey: string | null;
}

// Outbox writer - writes events within a transaction
export class OutboxWriter {
  constructor(private db: NodePgDatabase<any>) {}

  async write(event: OutboxEvent): Promise<string> {
    const [record] = await this.db.insert(outboxTable).values({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
      metadata: event.metadata || {},
      idempotencyKey: event.idempotencyKey,
    }).returning({ id: outboxTable.id });

    logger.debug({ eventId: record.id, eventType: event.eventType }, 'Event written to outbox');
    return record.id;
  }

  async writeMany(events: OutboxEvent[]): Promise<string[]> {
    if (events.length === 0) return [];

    const records = await this.db.insert(outboxTable).values(
      events.map(e => ({
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        eventType: e.eventType,
        payload: e.payload,
        metadata: e.metadata || {},
        idempotencyKey: e.idempotencyKey,
      }))
    ).returning({ id: outboxTable.id });

    logger.debug({ count: records.length }, 'Events written to outbox');
    return records.map(r => r.id);
  }
}

// Outbox poller - reads and processes events
export interface OutboxPublisher {
  publish(event: OutboxRecord): Promise<void>;
}

export interface OutboxPollerConfig {
  batchSize?: number;
  pollIntervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class OutboxPoller {
  private running = false;
  private intervalId: NodeJS.Timeout | null = null;
  private config: Required<OutboxPollerConfig>;

  constructor(
    private db: NodePgDatabase<any>,
    private publisher: OutboxPublisher,
    config?: OutboxPollerConfig
  ) {
    this.config = {
      batchSize: config?.batchSize || 100,
      pollIntervalMs: config?.pollIntervalMs || 1000,
      maxRetries: config?.maxRetries || 5,
      retryDelayMs: config?.retryDelayMs || 5000,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.poll();
    logger.info('Outbox poller started');
  }

  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Outbox poller stopped');
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      await this.processBatch();
    } catch (error) {
      logger.error({ error }, 'Error processing outbox batch');
    }

    this.intervalId = setTimeout(() => this.poll(), this.config.pollIntervalMs);
  }

  private async processBatch(): Promise<void> {
    // Get unprocessed events
    const events = await this.db.select()
      .from(outboxTable)
      .where(
        and(
          isNull(outboxTable.processedAt),
          lt(outboxTable.attempts, this.config.maxRetries)
        )
      )
      .orderBy(outboxTable.createdAt)
      .limit(this.config.batchSize);

    for (const event of events) {
      await this.processEvent(event as OutboxRecord);
    }
  }

  private async processEvent(event: OutboxRecord): Promise<void> {
    try {
      await this.publisher.publish(event);

      // Mark as processed
      await this.db.update(outboxTable)
        .set({ processedAt: new Date() })
        .where(eq(outboxTable.id, event.id));

      logger.debug({ eventId: event.id, eventType: event.eventType }, 'Event published');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update attempt count and error
      await this.db.update(outboxTable)
        .set({
          attempts: event.attempts + 1,
          lastError: errorMessage,
        })
        .where(eq(outboxTable.id, event.id));

      logger.error({ eventId: event.id, error: errorMessage }, 'Failed to publish event');
    }
  }
}

// Idempotency helper
export class IdempotencyGuard {
  constructor(private db: NodePgDatabase<any>) {}

  async check(key: string): Promise<{ exists: boolean; result?: unknown }> {
    const [record] = await this.db.select()
      .from(idempotencyTable)
      .where(eq(idempotencyTable.key, key))
      .limit(1);

    if (record && record.expiresAt > new Date()) {
      return { exists: true, result: record.result };
    }

    return { exists: false };
  }

  async save(key: string, result: unknown, ttlSeconds = 86400): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.db.insert(idempotencyTable)
      .values({ key, result, expiresAt })
      .onConflictDoUpdate({
        target: idempotencyTable.key,
        set: { result, expiresAt },
      });
  }

  async cleanup(): Promise<number> {
    const result = await this.db.delete(idempotencyTable)
      .where(lt(idempotencyTable.expiresAt, new Date()));
    
    return 0; // Drizzle doesn't return count easily
  }
}

// SQL for creating tables
export const outboxMigrationSQL = `
CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  idempotency_key VARCHAR(255) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON outbox (created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox (aggregate_type, aggregate_id);

CREATE TABLE IF NOT EXISTS idempotency (
  key VARCHAR(255) PRIMARY KEY,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency (expires_at);
`;
