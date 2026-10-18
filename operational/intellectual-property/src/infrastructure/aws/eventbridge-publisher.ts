/**
 * EventBridge Event Publisher for Intellectual Property
 *
 * Publishes IP domain events to EventBridge for routing to various targets.
 * Handles patent, trademark, trade secret, domain name, and license events.
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
 * IP Event Types for EventBridge
 */
export type PatentEventType =
  | 'Patent.Filed'
  | 'Patent.Granted'
  | 'Patent.Expired'
  | 'Patent.MaintenanceFeeDue'
  | 'Patent.MaintenanceFeeMissed'
  | 'Patent.MaintenanceFeePaid'
  | 'Patent.Abandoned';

export type TrademarkEventType =
  | 'Trademark.Filed'
  | 'Trademark.Registered'
  | 'Trademark.RenewalDue'
  | 'Trademark.Renewed'
  | 'Trademark.OppositionFiled'
  | 'Trademark.Cancelled'
  | 'Trademark.Expired';

export type TradeSecretEventType =
  | 'TradeSecret.Created'
  | 'TradeSecret.Accessed'
  | 'TradeSecret.Disclosed'
  | 'TradeSecret.ProtectionUpdated'
  | 'TradeSecret.Compromised';

export type DomainNameEventType =
  | 'DomainName.Registered'
  | 'DomainName.Renewed'
  | 'DomainName.Expiring'
  | 'DomainName.TransferInitiated'
  | 'DomainName.TransferCompleted'
  | 'DomainDispute.Filed'
  | 'DomainDispute.Decided';

export type LicenseEventType =
  | 'License.Executed'
  | 'License.RoyaltyDue'
  | 'License.RoyaltyPaid'
  | 'License.Terminated'
  | 'License.Renewed';

export type IPEventType =
  | PatentEventType
  | TrademarkEventType
  | TradeSecretEventType
  | DomainNameEventType
  | LicenseEventType;

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
  private readonly source: string = 'intellectual-property';

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
          `arn:aws:intellectual-property:${awsConfig.region}:${awsConfig.accountId}:${event.aggregateType}/${event.aggregateId}`,
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
   * Publish patent event.
   */
  async publishPatentEvent(
    eventType: PatentEventType,
    patentId: string,
    payload: Record<string, unknown>,
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: eventType,
      aggregateType: 'Patent',
      aggregateId: patentId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Publish trademark event.
   */
  async publishTrademarkEvent(
    eventType: TrademarkEventType,
    trademarkId: string,
    payload: Record<string, unknown>,
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: eventType,
      aggregateType: 'Trademark',
      aggregateId: trademarkId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Publish trade secret event.
   */
  async publishTradeSecretEvent(
    eventType: TradeSecretEventType,
    tradeSecretId: string,
    payload: Record<string, unknown>,
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: eventType,
      aggregateType: 'TradeSecret',
      aggregateId: tradeSecretId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Publish domain name event.
   */
  async publishDomainNameEvent(
    eventType: DomainNameEventType,
    domainNameId: string,
    payload: Record<string, unknown>,
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: eventType,
      aggregateType: 'DomainName',
      aggregateId: domainNameId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Publish license event.
   */
  async publishLicenseEvent(
    eventType: LicenseEventType,
    licenseId: string,
    payload: Record<string, unknown>,
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publish({
      type: eventType,
      aggregateType: 'License',
      aggregateId: licenseId,
      timestamp: new Date(),
      payload,
      metadata,
    });
  }

  /**
   * Publish maintenance fee due event.
   */
  async publishMaintenanceFeeDue(
    patentId: string,
    payload: {
      patentNumber: string;
      feeWindow: string;
      dueDate: Date;
      amount: number;
      currency: string;
      jurisdiction: string;
    },
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publishPatentEvent('Patent.MaintenanceFeeDue', patentId, payload, metadata);
  }

  /**
   * Publish trade secret accessed event (critical - audit trail).
   */
  async publishTradeSecretAccessed(
    tradeSecretId: string,
    payload: {
      tradeSecretName: string;
      accessedBy: string;
      accessedAt: Date;
      purpose: string;
      accessLevel: 'view' | 'export' | 'modify';
      ipAddress?: string | undefined;
    },
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publishTradeSecretEvent('TradeSecret.Accessed', tradeSecretId, payload, metadata);
  }

  /**
   * Publish domain expiring event.
   */
  async publishDomainExpiring(
    domainNameId: string,
    payload: {
      domainName: string;
      expirationDate: Date;
      daysUntilExpiration: number;
      registrar: string;
      linkedTrademark?: string | undefined;
    },
    metadata?: DomainEvent['metadata']
  ): Promise<string> {
    return this.publishDomainNameEvent('DomainName.Expiring', domainNameId, payload, metadata);
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
