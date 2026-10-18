/**
 * EventBridge Event Publisher
 *
 * Publishes domain events to EventBridge for routing to various targets.
 * Replaces direct SNS publishing with EventBridge for flexible routing.
 *
 * @module infrastructure/aws
 */

import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { awsConfig } from './config.js';

const client = new EventBridgeClient({ region: awsConfig.region });

/**
 * Domain event structure for EventBridge.
 */
export interface DomainEvent {
  type: string;
  aggregateType: string;
  aggregateId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  metadata?: {
    correlationId?: string | undefined;
    causationId?: string | undefined;
    userId?: string | undefined;
    tenantId?: string | undefined;
  } | undefined;
}

/**
 * Result of publishing events.
 */
export interface PublishResult {
  successCount: number;
  failedCount: number;
  failedEvents: Array<{
    event: DomainEvent;
    errorCode: string;
    errorMessage: string;
  }>;
}

/**
 * EventBridge Event Publisher
 *
 * Publishes domain events to EventBridge with:
 * - Automatic batching (up to 10 events per request)
 * - Retry handling
 * - Detailed error reporting
 */
export class EventBridgePublisher {
  private readonly eventBusName: string;
  private readonly source: string = 'banking-treasury';

  constructor(eventBusName?: string) {
    this.eventBusName = eventBusName ?? awsConfig.eventBridge.eventBusName;
  }

  /**
   * Publish a single domain event.
   */
  async publish(event: DomainEvent): Promise<string> {
    const result = await this.publishBatch([event]);

    if (result.failedCount > 0) {
      const failure = result.failedEvents[0];
      throw new Error(`Failed to publish event: ${failure?.errorMessage ?? 'Unknown error'}`);
    }

    return event.aggregateId;
  }

  /**
   * Publish multiple events in batches.
   */
  async publishBatch(events: DomainEvent[]): Promise<PublishResult> {
    const result: PublishResult = {
      successCount: 0,
      failedCount: 0,
      failedEvents: [],
    };

    // EventBridge allows max 10 events per PutEvents call
    const batches = this.chunk(events, 10);

    for (const batch of batches) {
      const entries: PutEventsRequestEntry[] = batch.map(event => ({
        EventBusName: this.eventBusName,
        Source: this.source,
        DetailType: event.type,
        Time: event.timestamp,
        Detail: JSON.stringify({
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          ...event.payload,
          metadata: event.metadata,
        }),
        Resources: [
          `arn:aws:banking-treasury:${awsConfig.region}:${awsConfig.accountId}:${event.aggregateType}/${event.aggregateId}`,
        ],
      }));

      try {
        const command = new PutEventsCommand({ Entries: entries });
        const response = await client.send(command);

        // Process results
        response.Entries?.forEach((entry, index) => {
          if (entry.ErrorCode) {
            result.failedCount++;
            result.failedEvents.push({
              event: batch[index] as DomainEvent,
              errorCode: entry.ErrorCode,
              errorMessage: entry.ErrorMessage ?? 'Unknown error',
            });
          } else {
            result.successCount++;
          }
        });
      } catch (error) {
        // All events in batch failed
        batch.forEach(event => {
          result.failedCount++;
          result.failedEvents.push({
            event,
            errorCode: 'BATCH_FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    }

    return result;
  }

  /**
   * Publish payment event.
   */
  async publishPaymentEvent(
    eventType: 'Payment.Initiated' | 'Payment.Completed' | 'Payment.Failed' | 'Payment.Cancelled',
    paymentId: string,
    payload: Record<string, unknown>,
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: eventType,
      aggregateType: 'Payment',
      aggregateId: paymentId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Publish account balance change event.
   */
  async publishBalanceEvent(
    accountId: string,
    payload: {
      previousBalance: number;
      newBalance: number;
      currency: string;
      changeAmount: number;
      changeType: 'credit' | 'debit';
      transactionId?: string | undefined;
    },
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: 'Account.BalanceChanged',
      aggregateType: 'BankAccount',
      aggregateId: accountId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Publish reconciliation event.
   */
  async publishReconciliationEvent(
    eventType: 'Reconciliation.Started' | 'Reconciliation.Completed' | 'Reconciliation.ExceptionsDetected',
    reconciliationId: string,
    payload: Record<string, unknown>,
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: eventType,
      aggregateType: 'Reconciliation',
      aggregateId: reconciliationId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Publish cash position alert.
   */
  async publishCashPositionAlert(
    entityId: string,
    alertType: 'LowBalance' | 'HighBalance' | 'StaleData' | 'ConcentrationRisk',
    payload: Record<string, unknown>,
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: `CashPosition.${alertType}`,
      aggregateType: 'CashPosition',
      aggregateId: entityId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Split array into chunks.
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Singleton instance
export const eventBridgePublisher = new EventBridgePublisher();
