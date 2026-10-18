/**
 * Event Publishing for Data Privacy Domain
 */

import amqplib from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';
import { messagingConfig, serviceConfig } from '../env.js';

interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  metadata: {
    correlationId: string;
    source: string;
    timestamp: Date;
    userId?: string;
  };
  occurredAt: Date;
  version: number;
}

class EventPublisher {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private connected = false;
  private readonly exchange = 'ecosystem.events';
  private readonly url: string;

  constructor() {
    this.url = messagingConfig.rabbitMqUrl;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.connection = await amqplib.connect(this.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });

      this.connection.on('error', (err) => {
        logger.error({ err }, 'RabbitMQ connection error');
        this.connected = false;
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.connected = false;
      });

      this.connected = true;
      logger.info('Connected to RabbitMQ for event publishing');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to RabbitMQ');
      // Don't throw - allow service to run without events
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close().catch(() => {});
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close().catch(() => {});
      this.connection = null;
    }
    this.connected = false;
  }

  async publish<T>(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    userId?: string
  ): Promise<void> {
    if (!this.channel || !this.connected) {
      logger.warn({ eventType }, 'Cannot publish event - not connected to RabbitMQ');
      return;
    }

    const event: DomainEvent<T> = {
      id: randomUUID(),
      type: eventType,
      aggregateId,
      aggregateType,
      payload,
      metadata: {
        correlationId: randomUUID(),
        source: 'data-privacy',
        timestamp: new Date(),
        userId,
      },
      occurredAt: new Date(),
      version: 1,
    };

    const message = Buffer.from(JSON.stringify(event));

    this.channel.publish(this.exchange, eventType, message, {
      persistent: true,
      contentType: 'application/json',
      messageId: event.id,
      timestamp: Date.now(),
      headers: {
        'x-event-type': eventType,
        'x-aggregate-type': aggregateType,
        'x-aggregate-id': aggregateId,
        'x-source': 'data-privacy',
      },
    });

    logger.info({ eventType, aggregateId }, 'Published domain event');
  }
}

// Singleton instance
export const eventPublisher = new EventPublisher();

// Event type constants
export const EventTypes = {
  // Consent Management
  CONSENT_GIVEN: 'data-privacy.consent.given',
  CONSENT_WITHDRAWN: 'data-privacy.consent.withdrawn',

  // Data Subject Access Requests
  DSAR_SUBMITTED: 'data-privacy.dsar.submitted',
  DSAR_VERIFIED: 'data-privacy.dsar.verified',
  DSAR_COMPLETED: 'data-privacy.dsar.completed',
  DSAR_REJECTED: 'data-privacy.dsar.rejected',
  DSAR_EXTENDED: 'data-privacy.dsar.extended',

  // Breach Management
  BREACH_IDENTIFIED: 'data-privacy.breach.identified',
  BREACH_CONTAINED: 'data-privacy.breach.contained',
  BREACH_AUTHORITY_NOTIFIED: 'data-privacy.breach.authority-notified',
  BREACH_SUBJECTS_NOTIFIED: 'data-privacy.breach.subjects-notified',
  BREACH_RESOLVED: 'data-privacy.breach.resolved',

  // Privacy Impact Assessment
  DPIA_CREATED: 'data-privacy.dpia.created',
  DPIA_SUBMITTED: 'data-privacy.dpia.submitted',
  DPIA_APPROVED: 'data-privacy.dpia.approved',
  DPIA_REJECTED: 'data-privacy.dpia.rejected',

  // Processing Activities
  ACTIVITY_CREATED: 'data-privacy.activity.created',
  ACTIVITY_ACTIVATED: 'data-privacy.activity.activated',
  ACTIVITY_SUSPENDED: 'data-privacy.activity.suspended',
  ACTIVITY_ARCHIVED: 'data-privacy.activity.archived',

  // Data Processors
  PROCESSOR_CREATED: 'data-privacy.processor.created',
  PROCESSOR_ACTIVATED: 'data-privacy.processor.activated',
  PROCESSOR_SUSPENDED: 'data-privacy.processor.suspended',
  PROCESSOR_TERMINATED: 'data-privacy.processor.terminated',
  PROCESSOR_DPA_RECORDED: 'data-privacy.processor.dpa-recorded',

  // Cross-Border Transfers
  TRANSFER_CREATED: 'data-privacy.transfer.created',
  TRANSFER_SUBMITTED: 'data-privacy.transfer.submitted',
  TRANSFER_APPROVED: 'data-privacy.transfer.approved',
  TRANSFER_REJECTED: 'data-privacy.transfer.rejected',
  TRANSFER_SUSPENDED: 'data-privacy.transfer.suspended',
} as const;
